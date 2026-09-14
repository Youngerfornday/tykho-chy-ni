import { mountNightScene } from './art.js';
import { renderBoard } from './board.js';
import { renderCalibration } from './calibration.js';
import { icon, replaceChildren } from './dom.js';
import { clock } from './format.js';
import { renderHero } from './hero.js';
import { ICONS } from './icons.js';
import { createMap, renderLegend, renderPill } from './map.js';
import { renderMethod } from './method.js';
import { renderRegionPanel } from './regionPanel.js';
import { renderTable } from './table.js';

const SCHEMA_VERSION = 1;
const REGION_KEY = 'tcn.region';
const STALE_AFTER_MS = 75 * 60 * 1000;
const REFRESH_MS = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;

const $ = (id) => document.getElementById(id);

function readStorage(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeRegion(value) {
  try {
    if (value) window.localStorage.setItem(REGION_KEY, value);
    else window.localStorage.removeItem(REGION_KEY);
  } catch { /* storage blocked: selection simply is not remembered */ }
}

async function loadJson(path) {
  const bust = Math.floor(Date.now() / 60000);
  const response = await fetch(`${path}?v=${bust}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

const isForecast = (d) => d && d.version === SCHEMA_VERSION && d.regions && d.national && d.window && Array.isArray(d.markets);

function updateStale(data) {
  const banner = $('stale');
  const now = Date.now();
  const age = now - new Date(data.generated_at).getTime();
  let message = '';
  if (now > new Date(data.window.end).getTime()) {
    message = `Ця ніч уже минула. Прогноз від ${clock(data.generated_at)}, новий з'явиться після оновлення.`;
  } else if (age > STALE_AFTER_MS) {
    message = `Прогноз застарів: останнє оновлення о ${clock(data.generated_at)}. Не покладайтеся на ці цифри.`;
  }
  banner.textContent = message;
  banner.hidden = !message;
}

function showError() {
  replaceChildren($('verdict'), 'Прогноз недоступний');
  replaceChildren($('lede'), 'Не вдалося завантажити дані. Оновіть сторінку за кілька хвилин. Реальний стан тривог дивіться в офіційних застосунках.');
  $('stamp').textContent = 'Немає даних';
}

async function start() {
  replaceChildren($('wordmark-icon'), icon(ICONS.moon(22)));

  let data;
  let mapData;
  try {
    [mapData, data] = await Promise.all([loadJson('data/map.json'), loadJson('data/forecast.json')]);
    if (!isForecast(data)) throw new Error('unexpected forecast schema');
  } catch (error) {
    showError();
    throw error;
  }

  const known = (name) => (name && data.regions[name] ? name : null);
  let selected = known(readStorage(REGION_KEY));
  const scene = mountNightScene($('art'), { date: new Date(data.generated_at), intensity: data.national.intensity });

  const select = (name, { viaTouch = false } = {}) => {
    selected = known(name);
    writeRegion(selected);
    renderSelection();
    if (viaTouch && selected && window.matchMedia('(max-width: 1100px)').matches) {
      $('region-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const map = createMap(mapData, { canvas: $('map-canvas'), tooltip: $('map-tooltip'), onSelect: select });

  function renderSelection() {
    renderHero(data, selected, select);
    map.update(data, selected);
    renderRegionPanel($('region-panel'), data, selected, select);
  }

  function renderAll() {
    renderSelection();
    renderPill($('map-pill'), data);
    renderLegend($('map-legend'));
    renderTable($('region-table'), data, (name) => { select(name); $('map').scrollIntoView({ block: 'start' }); });
    renderBoard($('board-rows'), data);
    renderCalibration($('calibration'), data.backtest);
    renderMethod($('method-text'), $('method-notes'), data);
    scene.setIntensity(data.national.intensity);
    updateStale(data);
  }

  renderAll();
  window.setInterval(() => updateStale(data), TICK_MS);
  window.setInterval(async () => {
    try {
      const fresh = await loadJson('data/forecast.json');
      if (!isForecast(fresh) || fresh.generated_at === data.generated_at) return;
      data = fresh;
      selected = known(selected);
      renderAll();
    } catch { /* keep the last good forecast; the stale banner covers it */ }
  }, REFRESH_MS);
}

start().catch(() => { /* error state already rendered */ });
