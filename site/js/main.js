import { mountNightScene } from './art.js';
import { renderBoard } from './board.js';
import { renderCalibration } from './calibration.js';
import { h, icon, replaceChildren } from './dom.js';
import { clock } from './format.js';
import { renderHero } from './hero.js';
import { ICONS } from './icons.js';
import { createMap, renderLegend, renderPill } from './map.js';
import { renderMethod } from './method.js';
import { renderRegionPanel } from './regionPanel.js';
import { renderTable } from './table.js';
import { chips } from './bet/labels.js';
import { syncOddsButtons } from './bet/oddsButton.js';
import { lineState } from './bet/slip.js';
import { mountSlip } from './bet/slipView.js';
import { createBetStore } from './bet/store.js';
import { createToaster } from './bet/toast.js';

const SCHEMA_VERSION = 1;
const REGION_KEY = 'tcn.region';
const STALE_AFTER_MS = 75 * 60 * 1000;
const REFRESH_MS = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;

const $ = (id) => document.getElementById(id);

const regionStorage = {
  read() {
    try { return window.localStorage.getItem(REGION_KEY); } catch { return null; }
  },
  write(value) {
    try {
      if (value) window.localStorage.setItem(REGION_KEY, value);
      else window.localStorage.removeItem(REGION_KEY);
    } catch { /* storage blocked: selection simply is not remembered */ }
  },
};

async function loadJson(path) {
  const bust = Math.floor(Date.now() / 60000);
  const response = await fetch(`${path}?v=${bust}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

const isForecast = (d) => d && d.version === SCHEMA_VERSION && d.regions && d.national && d.window && Array.isArray(d.markets);
const isResults = (d) => d && d.version === 1 && d.nights && typeof d.nights === 'object';

async function loadResults() {
  try {
    const results = await loadJson('data/results.json');
    return isResults(results) ? results : null;
  } catch {
    return null;
  }
}

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

function mountWallet(store) {
  const chip = $('wallet-chip');
  let lastBalance = null;
  chip.addEventListener('click', () => store.open('bets'));
  return (state) => {
    const { balance } = state.wallet;
    replaceChildren(chip, icon(ICONS.chips(18)), h('span', { class: 'wallet__value', text: chips(balance) }), h('span', { class: 'wallet__unit', text: 'фішок' }));
    if (lastBalance !== null && balance !== lastBalance) {
      chip.classList.remove('wallet--bump');
      void chip.offsetWidth;
      chip.classList.add('wallet--bump');
    }
    lastBalance = balance;
  };
}

async function start() {
  replaceChildren($('wordmark-icon'), icon(ICONS.moon(22)));
  const toast = createToaster($('toasts'));
  const store = createBetStore({ onEvent: toast });
  mountSlip($('slip'), store);
  const renderWallet = mountWallet(store);
  store.subscribe((state) => { syncOddsButtons(document, state.slip); renderWallet(state); });
  renderWallet(store.state);

  let data;
  let mapData;
  let results;
  try {
    [mapData, data, results] = await Promise.all([loadJson('data/map.json'), loadJson('data/forecast.json'), loadResults()]);
    if (!isForecast(data)) throw new Error('unexpected forecast schema');
  } catch (error) {
    showError();
    throw error;
  }
  store.setData(data, results);
  if (store.bonusGranted > 0) toast({ type: 'bonus', balance: store.state.wallet.balance });

  const known = (name) => (name && data.regions[name] ? name : null);
  let selected = known(regionStorage.read());
  const scene = mountNightScene($('art'), { date: new Date(data.generated_at), intensity: data.national.intensity });

  const select = (name, { viaTouch = false } = {}) => {
    selected = known(name);
    regionStorage.write(selected);
    renderSelection();
    if (viaTouch && selected && window.matchMedia('(max-width: 1100px)').matches) {
      $('region-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const map = createMap(mapData, { canvas: $('map-canvas'), tooltip: $('map-tooltip'), onSelect: select });

  function renderSelection() {
    renderHero(data, selected, select);
    map.update(data, selected);
    renderRegionPanel($('region-panel'), data, selected, select, store);
  }

  function renderAll() {
    renderSelection();
    renderPill($('map-pill'), data);
    renderLegend($('map-legend'));
    renderTable($('region-table'), data, (name) => { select(name); $('map').scrollIntoView({ block: 'start' }); }, store);
    renderBoard($('board-rows'), store, data);
    renderCalibration($('calibration'), data.backtest);
    renderMethod($('method-text'), $('method-notes'), data);
    scene.setIntensity(data.national.intensity);
    updateStale(data);
  }

  renderAll();
  let lineOpen = lineState(store.state.line, Math.floor(Date.now() / 1000)).open;

  window.setInterval(() => {
    updateStale(data);
    const open = lineState(store.state.line, Math.floor(Date.now() / 1000)).open;
    if (open !== lineOpen) {
      lineOpen = open;
      renderBoard($('board-rows'), store, data);
    }
    store.settle();
  }, TICK_MS);

  window.setInterval(async () => {
    try {
      const [fresh, freshResults] = await Promise.all([loadJson('data/forecast.json'), loadResults()]);
      if (!isForecast(fresh)) return;
      const changed = fresh.generated_at !== data.generated_at;
      data = fresh;
      store.setData(data, freshResults);
      if (changed) {
        selected = known(selected);
        renderAll();
      }
    } catch { /* keep the last good forecast; the stale banner covers it */ }
  }, REFRESH_MS);
}

start().catch(() => { /* error state already rendered */ });
