// Read-only teaser of tonight's line on the forecast page; every price links into /play/.

import { h, icon, replaceChildren } from './dom.js';
import { ICONS } from './icons.js';
import { pct } from './format.js';
import { marketTitle, pickLabel } from './bet/labels.js';
import { missionsFor } from './bet/missions.js';
import { quoteSelection } from './bet/pricing.js';
import { lineState } from './bet/slip.js';

const TEASER_KEYS = ['west_quiet', 'total_over', 'alarm|м. Київ', 'alarm|Київська область'];
const DIGITS = '0123456789';
const ROLL_MS = 560;
const ROW_STAGGER_MS = 90;
const TICK_MS = 45;

let rolled = false;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const playLink = (params = '') => `play/${params}`;

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

function priceLink(line, key, pick) {
  const q = quoteSelection(line, key, pick);
  const choice = pickLabel(key, pick, line.total_line);
  const title = marketTitle(key, line.total_line);
  if (q.suspended) {
    return h('span', { class: 'odds odds--off', role: 'img', 'aria-label': `${title}, ${choice}: прийом закрито` },
      h('span', { class: 'odds__label', text: choice }), h('span', { class: 'odds__value' }, icon(ICONS.lock(14))));
  }
  const params = `?market=${encodeURIComponent(key)}&pick=${pick}`;
  return h('a', { class: 'odds', href: playLink(params), 'aria-label': `${title}, ${choice}: коефіцієнт ${q.odds.toFixed(2)}. Відкрити в грі` },
    h('span', { class: 'odds__label', text: choice }), h('span', { class: 'odds__value', text: q.odds.toFixed(2) }));
}

function row(line, key) {
  const q = quoteSelection(line, key, 'yes');
  return h('div', { class: 'board__row', role: 'row' },
    h('div', { class: 'board__market', role: 'cell' },
      h('span', { class: 'board__title', text: marketTitle(key, line.total_line) }),
      h('span', { class: 'board__note', text: q.suspended ? 'Результат майже визначений, прийом закрито' : `Шанс «так» ${pct(q.p)} · ≈${Math.round(q.nEff)} схожих ночей` })),
    h('div', { class: 'board__odds', role: 'cell' }, priceLink(line, key, 'yes'), priceLink(line, key, 'no')));
}

export function renderBoard(target, data) {
  const { line } = data;
  if (!line) {
    replaceChildren(target, h('p', { class: 'board__empty', text: 'Лінія оновлюється. Спробуйте за кілька хвилин.' }));
    return;
  }
  const state = lineState(line, Math.floor(Date.now() / 1000));
  const rows = TEASER_KEYS.map((key) => row(line, key));
  const missions = missionsFor(line.anchor);

  replaceChildren(target,
    h('p', { class: `board__status${state.open ? '' : ' board__status--closed'}` },
      icon(state.open ? ICONS.clock(16) : ICONS.lock(16)),
      state.open ? 'Прийом відкритий до 07:00. Ставка рахує лише події після її розміщення.' : state.reason),
    h('div', { class: 'board__table', role: 'table', 'aria-label': 'Головні коефіцієнти на ніч' },
      h('div', { class: 'board__row board__row--head', role: 'row' },
        h('span', { role: 'columnheader', text: 'Подія до 07:00' }),
        h('span', { role: 'columnheader', class: 'board__head-odds', text: 'Так · Ні' })),
      rows),
    h('div', { class: 'board__cta' },
      h('div', { class: 'board__missions' },
        h('span', { class: 'board__missions-title', text: 'Завдання цієї ночі' }),
        h('ul', null, missions.map((m) => h('li', null, h('span', { class: 'chip chip--mission', 'aria-hidden': 'true' }), `${m.title} · +${m.reward}`)))),
      h('a', { class: 'board__play', href: playLink() }, icon(ICONS.ticket(20)), 'Відкрити гру: 24 області, експреси, рівні')));

  if (rolled || reducedMotion() || !('IntersectionObserver' in window)) return;
  const table = target.querySelector('.board__table');
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    rolled = true;
    rows.forEach((r, i) => roll(r, i * ROW_STAGGER_MS));
    observer.disconnect();
  }, { threshold: 0.3 });
  observer.observe(table);
}
