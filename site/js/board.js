import { h, replaceChildren } from './dom.js';
import { oddsText, pct } from './format.js';

const DIGITS = '0123456789';
const ROLL_MS = 520;
const ROW_STAGGER_MS = 110;
const TICK_MS = 45;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function flap(label, value) {
  const chars = [...value].map((ch) => h('span', { class: 'flap__ch', 'data-final': ch, text: ch }));
  return h('div', { class: 'flap', role: 'text', 'aria-label': `${label} ${value}` },
    h('span', { class: 'flap__label', 'aria-hidden': 'true', text: label }),
    h('span', { class: 'flap__digits', 'aria-hidden': 'true' }, chars));
}

function roll(row, delay) {
  const chars = [...row.querySelectorAll('.flap__ch')].filter((el) => DIGITS.includes(el.dataset.final));
  window.setTimeout(() => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - started;
      chars.forEach((el, i) => {
        const settleAt = ROLL_MS * (0.55 + (0.45 * i) / Math.max(1, chars.length - 1));
        const settled = elapsed >= settleAt;
        el.textContent = settled ? el.dataset.final : DIGITS[Math.floor(Math.random() * 10)];
        el.classList.toggle('flap__ch--spin', !settled);
      });
      if (elapsed >= ROLL_MS) window.clearInterval(timer);
    }, TICK_MS);
  }, delay);
}

export function renderBoard(target, markets) {
  const rows = markets.map((m) => h('div', { class: 'board__row', role: 'row' },
    h('div', { class: 'board__market', role: 'cell' },
      h('span', { class: 'board__title', text: m.title }),
      h('span', { class: 'board__note', text: `${m.note} · шанс ${pct(m.p)} · ≈${Math.round(m.n_eff)} схожих ночей` })),
    h('div', { class: 'board__odds', role: 'cell' }, flap('ТАК', oddsText(m.odds_yes)), flap('НІ', oddsText(m.odds_no)))));
  replaceChildren(target,
    h('div', { class: 'board__row board__row--head', role: 'row' },
      h('span', { role: 'columnheader', text: 'Подія до 07:00' }),
      h('span', { role: 'columnheader', class: 'board__head-odds', text: 'Коефіцієнт' })),
    rows);
  target.setAttribute('role', 'table');
  target.setAttribute('aria-label', 'Умовні коефіцієнти на ніч');

  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    rows.forEach((row, i) => roll(row, i * ROW_STAGGER_MS));
    observer.disconnect();
  }, { threshold: 0.35 });
  observer.observe(target);
}
