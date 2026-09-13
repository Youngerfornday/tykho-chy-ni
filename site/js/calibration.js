import { h, replaceChildren, s } from './dom.js';
import { pct } from './format.js';

const SIZE = 340;
const PAD = { top: 16, right: 16, bottom: 46, left: 50 };
const PLOT = SIZE - PAD.left - PAD.right;
const x = (v) => PAD.left + v * PLOT;
const y = (v) => SIZE - PAD.bottom - v * (SIZE - PAD.top - PAD.bottom);

function axes() {
  const ticks = [0, 0.5, 1];
  return s('g', { class: 'calib__axes' },
    ticks.map((t) => s('line', { class: 'calib__grid', x1: x(0), x2: x(1), y1: y(t), y2: y(t) })),
    ticks.map((t) => s('line', { class: 'calib__grid', x1: x(t), x2: x(t), y1: y(0), y2: y(1) })),
    ticks.map((t) => s('text', { class: 'calib__tick', x: x(t), y: y(0) + 18, 'text-anchor': 'middle', text: `${t * 100}%` })),
    ticks.map((t) => s('text', { class: 'calib__tick', x: x(0) - 8, y: y(t) + 4, 'text-anchor': 'end', text: `${t * 100}%` })),
    s('text', { class: 'calib__axis', x: x(0.5), y: SIZE - 6, 'text-anchor': 'middle', text: 'Що казала модель' }),
    s('text', { class: 'calib__axis', x: 14, y: y(0.5), 'text-anchor': 'middle', transform: `rotate(-90 14 ${y(0.5)})`, text: 'Як сталося насправді' }));
}

export function renderCalibration(target, backtest) {
  const bins = backtest.reliability.filter((b) => b.n > 0 && b.mean_p != null);
  const maxN = Math.max(...bins.map((b) => b.n));
  const tip = h('div', { class: 'calib__tip', role: 'status', text: 'Наведіть на точку, щоб побачити деталі.' });
  const describe = (b) => `Коли модель казала ≈${pct(b.mean_p)}, тривога була в ${pct(b.freq)} випадків (${b.n} пар «область-ніч»).`;

  const points = bins.map((b) => {
    const cx = x(b.mean_p);
    const cy = y(b.freq);
    const r = 4 + 7 * Math.sqrt(b.n / maxN);
    const show = () => { tip.textContent = describe(b); };
    return s('g', { class: 'calib__point', tabindex: 0, role: 'img', 'aria-label': describe(b), on: { pointerenter: show, focus: show } },
      s('circle', { class: 'calib__hit', cx, cy, r: r + 10 }),
      s('circle', { class: 'calib__dot', cx, cy, r }));
  });
  const line = s('polyline', { class: 'calib__line', points: bins.map((b) => `${x(b.mean_p)},${y(b.freq)}`).join(' ') });

  const svg = s('svg', { class: 'calib__svg', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'group', 'aria-label': 'Діаграма калібрування прогнозу' },
    axes(),
    s('line', { class: 'calib__ideal', x1: x(0), y1: y(0), x2: x(1), y2: y(1) }),
    s('text', { class: 'calib__ideal-label', x: x(0.64), y: y(0.55), transform: `rotate(-45 ${x(0.64)} ${y(0.55)})`, text: 'ідеальна точність' }),
    line, points);

  replaceChildren(target,
    h('figcaption', { class: 'calib__title', text: 'Чи можна вірити відсоткам' }),
    svg, tip,
    h('p', { class: 'calib__note', text: `Перевірка на ${backtest.nights} минулих ночах, ${backtest.cases} пар «область-ніч». Чим ближче точки до діагоналі, тим чесніші відсотки.` }));
}
