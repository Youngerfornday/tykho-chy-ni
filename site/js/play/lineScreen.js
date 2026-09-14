// "Лінія": intro, missions carousel, featured cards, list/map toggle, filters, search and market rows.

import { h, icon, replaceChildren } from '../dom.js';
import { ICONS } from '../icons.js';
import { BINS, binIndex, nightTitle, pct, shortName } from '../format.js';
import { marketTitle } from '../bet/labels.js';
import { oddsButton, syncOddsButtons } from '../bet/oddsButton.js';
import { quoteSelection, regionOf } from '../bet/pricing.js';
import { introBlock } from './intro.js';
import { createMapView } from './mapView.js';
import { missionsBlock } from './missionsView.js';
import { FILTERS, marketKeys } from './regions.js';
import { rollChanged } from './roll.js';

const KIND_TITLE = { alarm: 'Тривога до 07:00', quiet_late: 'Тихо з 01:00 до 07:00' };
const isQuietMarket = (key) => key === 'west_quiet' || key.startsWith('quiet_late|');

/** Bar length is p("так"); color follows the alert chance, so quiet markets color by 1 - p. */
function meter(p, key) {
  const bin = binIndex(isQuietMarket(key) ? 1 - p : p);
  return h('span', { class: 'meter', 'aria-hidden': 'true' },
    h('span', { class: 'meter__fill', style: { transform: `scaleX(${Math.min(1, Math.max(0, p)).toFixed(3)})`, background: BINS[bin].color } }));
}

function hint(store, key, data) {
  const q = quoteSelection(store.state.line, key, 'yes');
  const region = regionOf(key) ? data.regions[regionOf(key)] : null;
  const live = Boolean(region?.active_now);
  if (q.suspended) {
    return { p: q.p, text: region?.status === 'ongoing' ? 'Тривога вже триває, прийом закрито' : 'Результат майже визначений, прийом закрито', live };
  }
  return { p: q.p, text: `шанс «так» ${pct(q.p)} · ≈${Math.round(q.nEff)} схожих ночей`, live };
}

function liveMark() {
  return h('span', { class: 'live' }, h('span', { class: 'chip chip--red', 'aria-hidden': 'true' }), 'зараз тривога');
}

function featuredCard(store, key, data) {
  const { line } = store.state;
  const info = hint(store, key, data);
  const note = key === 'west_quiet' ? 'Жодної тривоги у 7 західних областях' : key === 'total_over' ? `Очікуємо ${data.national.expected_regions} областей` : 'Хоча б одна тривога у вікні';
  return h('article', { class: 'feat', 'aria-label': marketTitle(key, line.total_line) },
    h('h3', { class: 'feat__title', text: marketTitle(key, line.total_line) }),
    h('p', { class: 'feat__note', text: note }),
    h('div', { class: 'feat__chance' },
      h('span', { class: 'feat__pct', text: Number.isFinite(info.p) ? pct(info.p) : '—' }),
      h('span', { class: 'feat__hint', text: info.live ? 'зараз тривога' : 'шанс «так»' })),
    Number.isFinite(info.p) ? meter(info.p, key) : null,
    h('div', { class: 'feat__odds' }, oddsButton(store, key, 'yes'), oddsButton(store, key, 'no')));
}

function marketRow(store, key, data, mixed) {
  const { line } = store.state;
  const info = hint(store, key, data);
  const region = regionOf(key);
  const title = mixed || !region ? marketTitle(key, line.total_line) : shortName(region);
  return h('div', { class: `mrow${info.live ? ' mrow--live' : ''}`, role: 'row' },
    h('div', { class: 'mrow__text', role: 'cell' },
      h('span', { class: 'mrow__title', text: title }),
      h('span', { class: 'mrow__hint' }, info.live ? liveMark() : null, info.text),
      Number.isFinite(info.p) ? meter(info.p, key) : null),
    h('div', { class: 'mrow__odds', role: 'cell' }, oddsButton(store, key, 'yes', { compact: true }), oddsButton(store, key, 'no', { compact: true })));
}

export function createLineScreen(root, store, { navigate }) {
  const ui = { filter: 'main', search: '', view: 'list' };
  let data = null;
  let introShown = null;
  let missionsNode = null;
  let searchInput = null;
  const shownOdds = new Map();

  const head = h('div', { class: 'screen__head' },
    h('h2', { id: 'screen-line-title', class: 'screen__title', tabindex: '-1', text: 'Лінія на ніч' }),
    h('p', { class: 'screen__sub', id: 'line-night' }));
  const stale = h('p', { class: 'stale-note', role: 'status', hidden: true });
  const introSlot = h('div', { class: 'slot' });
  const missionsSlot = h('div', { class: 'slot slot--missions' });
  const viewSwitch = h('div', { class: 'seg seg--view', role: 'radiogroup', 'aria-label': 'Вигляд лінії' });
  const mapRoot = h('div', { class: 'linemap', hidden: true });
  const featured = h('div', { class: 'featured' });
  const filterBar = h('div', { class: 'filters' });
  const list = h('div', { class: 'rows', role: 'table', 'aria-label': 'Коефіцієнти на ніч' });
  replaceChildren(root, head, stale, introSlot, missionsSlot, viewSwitch, mapRoot, featured, filterBar, list);

  const mapView = createMapView(mapRoot, {
    onSelect: (name) => {
      ui.search = name ? shortName(name) : '';
      if (searchInput) searchInput.value = ui.search;
      renderRows();
      syncChips();
      if (name) list.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    },
  });

  function renderViewSwitch() {
    const option = (id, text, glyph) => h('button', {
      type: 'button', role: 'radio', class: 'seg__opt', 'aria-checked': String(ui.view === id), on: { click: () => setView(id) },
    }, icon(ICONS[glyph](16)), text);
    replaceChildren(viewSwitch, option('list', 'Список', 'list'), option('map', 'Карта', 'pin'));
  }

  function setView(view) {
    ui.view = view;
    renderViewSwitch();
    root.dataset.view = view;
    if (view === 'map') {
      featured.hidden = true;
      mapView.show();
    } else {
      mapView.hide();
      renderRows();
    }
  }

  function renderFilters() {
    searchInput = h('input', {
      type: 'search', class: 'search__input', id: 'region-search', placeholder: 'Область', value: ui.search,
      autocomplete: 'off', 'aria-label': 'Пошук області',
      on: { input: (e) => { ui.search = e.target.value; renderRows(); syncChips(); } },
    });
    const chipsRow = h('div', { class: 'filters__chips', role: 'group', 'aria-label': 'Фільтр ринків' },
      FILTERS.map((f) => h('button', {
        type: 'button', class: 'fchip', 'data-id': f.id, 'aria-pressed': String(!ui.search && ui.filter === f.id),
        on: { click: () => { ui.filter = f.id; ui.search = ''; searchInput.value = ''; mapView.select(null); renderRows(); syncChips(); } },
      }, f.title)));
    replaceChildren(filterBar,
      h('label', { class: 'search', for: 'region-search' }, icon(ICONS.search(18), 'search__icon'), searchInput),
      chipsRow);
  }

  function syncChips() {
    filterBar.querySelectorAll('.fchip').forEach((b) => b.setAttribute('aria-pressed', String(!ui.search && ui.filter === b.dataset.id)));
  }

  function renderRows() {
    if (!data) return;
    const keys = marketKeys(ui.filter, ui.search, Object.keys(data.regions));
    replaceChildren(featured, keys.featured.map((k) => featuredCard(store, k, data)));
    featured.hidden = ui.view === 'map' || !keys.featured.length;
    const mixed = Boolean(ui.search) || ui.filter === 'main';
    const kind = ui.filter === 'quiet_late' ? 'quiet_late' : 'alarm';
    const headText = mixed ? 'Подія до 07:00' : `${KIND_TITLE[kind]} · ${FILTERS.find((f) => f.id === ui.filter)?.title || ''}`;
    const rows = keys.rows.map((k) => marketRow(store, k, data, mixed));
    replaceChildren(list,
      h('div', { class: 'rows__head', role: 'row' },
        h('span', { role: 'columnheader', text: headText }),
        h('span', { role: 'columnheader', class: 'rows__head-odds', text: 'Так · Ні' })),
      rows.length ? rows : h('p', { class: 'rows__empty', role: 'cell', text: 'Такої області немає. Спробуйте іншу назву.' }));
    syncOddsButtons(root, store.state.slip);
    rollChanged(shownOdds, [...root.querySelectorAll('.odds[data-key]')].map((btn) => ({
      key: `${btn.dataset.key}|${btn.dataset.pick}`, el: btn.querySelector('.odds__value'), roll: btn.getAttribute('aria-pressed') === 'true',
    })));
  }

  function renderMissions() {
    const missions = store.progress().missions;
    const signature = missions.map((m) => `${m.id}:${m.done}`).join('|');
    if (missionsNode && missionsNode.dataset.sig === signature) return;
    const block = missionsBlock(missions, 'carousel');
    if (block) block.dataset.sig = signature;
    missionsNode = block;
    replaceChildren(missionsSlot, block);
  }

  function renderIntro(state) {
    const show = !state.profile.introDismissed;
    if (show === introShown) return;
    introShown = show;
    replaceChildren(introSlot, show ? introBlock(store) : null);
  }

  renderViewSwitch();
  root.dataset.view = ui.view;

  return {
    setData(fresh, staleText) {
      data = fresh;
      document.getElementById('line-night').textContent = nightTitle(fresh.line.anchor);
      stale.textContent = staleText || '';
      stale.hidden = !staleText;
      if (!searchInput) renderFilters();
      mapView.setData(fresh);
      renderRows();
    },
    setStale(text) { stale.textContent = text || ''; stale.hidden = !text; },
    showError() {
      replaceChildren(list, h('p', { class: 'rows__empty', text: 'Не вдалося завантажити лінію. Оновіть сторінку за кілька хвилин.' }));
    },
    presetRegion(name) {
      if (!data || !data.regions[name]) return false;
      ui.search = shortName(name);
      if (searchInput) searchInput.value = ui.search;
      mapView.select(name);
      renderRows();
      syncChips();
      return true;
    },
    setView,
    sync(state) {
      syncOddsButtons(root, state.slip);
      renderIntro(state);
      renderMissions();
    },
    rerender() { renderRows(); },
    navigate,
  };
}
