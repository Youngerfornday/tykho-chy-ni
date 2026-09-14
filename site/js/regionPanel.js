import { h, icon, replaceChildren } from './dom.js';
import { BINS, binIndex, pct, range, regionVerdict, shortName } from './format.js';
import { ICONS } from './icons.js';
import { quoteSelection } from './bet/pricing.js';

function scale(region) {
  const bands = BINS.map((bin, i) => {
    const lo = i === 0 ? 0 : BINS[i - 1].max;
    const hi = Math.min(bin.max, 1);
    return h('span', { class: 'scale__band', style: { background: bin.color, flexGrow: String(hi - lo) } });
  });
  const pos = (v) => `${Math.min(100, Math.max(0, v * 100))}%`;
  return h('div', { class: 'scale', role: 'img', 'aria-label': `Шанс ${pct(region.p)}, діапазон ${range(region.lo, region.hi)}` },
    h('div', { class: 'scale__bands' }, bands),
    h('span', { class: 'scale__interval', style: { left: pos(region.lo), width: `calc(${pos(region.hi)} - ${pos(region.lo)})` } }),
    h('span', { class: 'scale__marker', style: { left: pos(region.p) } }),
    h('div', { class: 'scale__ticks' }, ['0', '50%', '100%'].map((t) => h('span', { text: t }))));
}

function row(label, value) {
  return value == null ? null : h('div', { class: 'facts__row' }, h('dt', { text: label }), h('dd', { text: value }));
}

function betBlock(line, region) {
  if (!line) return null;
  const odds = (key, pick) => {
    const q = quoteSelection(line, key, pick);
    return q.suspended ? '—' : q.odds.toFixed(2);
  };
  const key = `alarm|${region}`;
  return h('a', { class: 'panel__play', href: `play/?market=${encodeURIComponent(key)}&pick=yes` },
    h('span', null, h('b', { text: 'Зробити прогноз у грі' }), h('small', { text: `Тривога до 07:00 · так ${odds(key, 'yes')} · ні ${odds(key, 'no')}` })),
    icon(ICONS.ticket(20)));
}

export function renderRegionPanel(target, data, selected, onSelect) {
  if (!selected) {
    const loud = Object.entries(data.regions).filter(([, r]) => r.p >= 0.7 && r.status !== 'ongoing').length;
    replaceChildren(target,
      h('div', { class: 'panel__hint' },
        icon(ICONS.pin(22), 'panel__icon'),
        h('p', { text: 'Оберіть область на карті, щоб побачити її шанси, діапазон і як зазвичай буває цієї пори.' }),
        h('p', { class: 'panel__muted', text: `Поки тихо, але висока ймовірність тривоги: ${loud} ${loud === 1 ? 'область' : 'областей'}.` })));
    return;
  }
  const region = data.regions[selected];
  const verdict = regionVerdict(region);
  const now = region.active_now == null ? 'невідомо' : region.active_now ? 'тривога' : 'тихо';
  replaceChildren(target,
    h('div', { class: 'panel__head' },
      h('h3', { text: shortName(selected) }),
      h('button', { type: 'button', class: 'panel__close', 'aria-label': 'Закрити', on: { click: () => onSelect(null) } }, icon(ICONS.close(18)))),
    h('p', { class: 'panel__verdict', style: { '--tone': BINS[binIndex(region.p)].color } }, h('span', { class: 'chip' }), verdict.text),
    h('p', { class: 'panel__big' }, h('span', { text: pct(region.p) }), h('small', { text: 'тривога до 07:00' })),
    scale(region),
    h('dl', { class: 'facts' },
      row('Зараз', now),
      row('Діапазон', range(region.lo, region.hi)),
      row('Зазвичай (останні тижні)', pct(region.p_base)),
      row('Тихо з 01:00 до 07:00', pct(region.p_quiet_late)),
      region.active_now ? row('Відбій протягом години', pct(region.p_clear_1h)) : null,
      row('Схожих ночей в основі', `≈${Math.round(region.n_eff)}`)),
    betBlock(data.line, selected));
}
