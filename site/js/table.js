import { h, replaceChildren } from './dom.js';
import { BINS, binIndex, pct, range, shortName } from './format.js';
import { oddsButton } from './bet/oddsButton.js';

export function renderTable(target, data, onSelect, store) {
  const rows = Object.entries(data.regions)
    .sort((a, b) => b[1].p - a[1].p)
    .map(([name, r]) => h('tr', { on: { click: () => onSelect(name) } },
      h('td', null, h('span', { class: 'name' },
        h('span', { class: 'chip', style: { background: BINS[binIndex(r.p)].color } }),
        h('button', { type: 'button', class: 'linklike', text: shortName(name), on: { click: (e) => { e.stopPropagation(); onSelect(name); } } }))),
      h('td', { class: 'num', text: pct(r.p) }),
      h('td', { class: 'num', text: range(r.lo, r.hi) }),
      h('td', { text: r.active_now == null ? '—' : r.active_now ? 'тривога' : 'тихо' }),
      h('td', { class: 'num', text: pct(r.p_base) }),
      h('td', { class: 'num', text: pct(r.p_quiet_late) }),
      h('td', { class: 'bets-cell', on: { click: (e) => e.stopPropagation() } },
        oddsButton(store, `alarm|${name}`, 'yes', { compact: true }), oddsButton(store, `alarm|${name}`, 'no', { compact: true }))));
  replaceChildren(target, h('table', null,
    h('caption', { class: 'visually-hidden', text: 'Шанс тривоги до 07:00 по областях' }),
    h('thead', null, h('tr', null,
      h('th', { scope: 'col', text: 'Область' }),
      h('th', { scope: 'col', class: 'num', text: 'Тривога до 07:00' }),
      h('th', { scope: 'col', class: 'num', text: 'Діапазон' }),
      h('th', { scope: 'col', text: 'Зараз' }),
      h('th', { scope: 'col', class: 'num', text: 'Зазвичай' }),
      h('th', { scope: 'col', class: 'num', text: 'Тихо з 01:00' }),
      h('th', { scope: 'col', text: 'Тривога: так · ні' }))),
    h('tbody', null, rows)));
}
