import { h, icon, replaceChildren } from './dom.js';
import { ICONS } from './icons.js';
import { pct, shortName } from './format.js';
import { marketTitle } from './bet/labels.js';
import { oddsButton } from './bet/oddsButton.js';
import { lineState } from './bet/slip.js';
import { quoteSelection } from './bet/pricing.js';

const DIGITS = '0123456789';
const ROLL_MS = 560;
const ROW_STAGGER_MS = 90;
const TICK_MS = 45;
const MAIN_KEYS = ['west_quiet', 'total_over', 'alarm|м. Київ', 'quiet_late|м. Київ', 'alarm|Київська область', 'alarm|Одеська область', 'alarm|Львівська область'];
const TABS = [
  { id: 'main', text: 'Головні' },
  { id: 'alarm', text: 'Тривога по областях' },
  { id: 'quiet_late', text: 'Тихо з 01:00' },
];

let activeTab = 'main';
let rolled = false;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function roll(row, delay) {
  const values = [...row.querySelectorAll('.odds__value')].filter((el) => /\d/.test(el.textContent));
  window.setTimeout(() => {
    const finals = values.map((el) => el.textContent);
    const started = performance.now();
    const timer = window.setInterval(() => {
      const t = performance.now() - started;
      values.forEach((el, i) => {
        const settled = t >= ROLL_MS * (0.6 + 0.4 * i);
        el.textContent = settled ? finals[i] : finals[i].replace(/\d/g, () => DIGITS[Math.floor(Math.random() * 10)]);
        el.classList.toggle('odds__value--spin', !settled);
      });
      if (t >= ROLL_MS * 1.4) window.clearInterval(timer);
    }, TICK_MS);
  }, delay);
}

function note(store, key, data) {
  const q = quoteSelection(store.state.line, key, 'yes');
  const region = key.includes('|') ? data.regions[key.split('|')[1]] : null;
  if (q.suspended) return region?.status === 'ongoing' ? 'Тривога вже триває, прийом закрито' : 'Результат майже визначений, прийом закрито';
  const kind = key.split('|')[0];
  const base = kind === 'total_over' ? 'Скільки областей почують тривогу' : kind === 'west_quiet' ? 'Жодної тривоги у 7 західних областях' : kind === 'quiet_late' ? 'Жодної тривоги у другій половині ночі' : 'Хоча б одна тривога в області';
  return `${base} · шанс «так» ${pct(q.p)} · ≈${Math.round(q.nEff)} схожих ночей`;
}

function row(store, key, data) {
  const line = store.state.line;
  return h('div', { class: 'board__row', role: 'row' },
    h('div', { class: 'board__market', role: 'cell' },
      h('span', { class: 'board__title', text: marketTitle(key, line.total_line) }),
      h('span', { class: 'board__note', text: note(store, key, data) })),
    h('div', { class: 'board__odds', role: 'cell' }, oddsButton(store, key, 'yes'), oddsButton(store, key, 'no')));
}

function keysFor(tab, data) {
  if (tab === 'main') return MAIN_KEYS;
  return Object.keys(data.regions).sort((a, b) => shortName(a).localeCompare(shortName(b), 'uk')).map((r) => `${tab}|${r}`);
}

export function renderBoard(target, store, data) {
  const line = store.state.line;
  if (!line) {
    replaceChildren(target, h('p', { class: 'board__empty', text: 'Лінія оновлюється. Спробуйте за кілька хвилин.' }));
    return;
  }
  const state = lineState(line, Math.floor(Date.now() / 1000));
  const tabs = h('div', { class: 'board__tabs', role: 'tablist', 'aria-label': 'Ринки' },
    TABS.map((t) => h('button', {
      type: 'button', role: 'tab', class: 'board__tab', 'aria-selected': String(activeTab === t.id),
      on: { click: () => { activeTab = t.id; renderBoard(target, store, data); } },
    }, t.text)));
  const status = h('p', { class: `board__status${state.open ? '' : ' board__status--closed'}` },
    icon(state.open ? ICONS.clock(16) : ICONS.lock(16)),
    state.open ? 'Прийом відкритий до 07:00. Ставка рахує лише події після її розміщення.' : state.reason);
  const rows = keysFor(activeTab, data).map((key) => row(store, key, data));
  const table = h('div', { class: `board__table${activeTab === 'main' ? '' : ' board__table--dense'}`, role: 'table', 'aria-label': 'Коефіцієнти на ніч' },
    h('div', { class: 'board__row board__row--head', role: 'row' },
      h('span', { role: 'columnheader', text: 'Подія до 07:00' }),
      h('span', { role: 'columnheader', class: 'board__head-odds', text: 'Так · Ні' })),
    rows);
  replaceChildren(target, tabs, status, table);

  if (rolled || activeTab !== 'main' || reducedMotion() || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    rolled = true;
    rows.forEach((r, i) => roll(r, i * ROW_STAGGER_MS));
    observer.disconnect();
  }, { threshold: 0.3 });
  observer.observe(table);
}
