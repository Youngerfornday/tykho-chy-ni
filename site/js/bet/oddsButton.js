// Odds button shared by the board, map panel and table. Selection state is synced
// globally through data attributes, so sections never re-render on slip changes.

import { h, icon } from '../dom.js';
import { ICONS } from '../icons.js';
import { pct } from '../format.js';
import { marketTitle, pickLabel } from './labels.js';
import { quoteSelection } from './pricing.js';
import { isSelected } from './slip.js';

export function oddsButton(store, key, pick, { label, compact = false } = {}) {
  const { line, slip } = store.state;
  const q = line ? quoteSelection(line, key, pick) : { suspended: true, odds: null, p: Number.NaN };
  const title = marketTitle(key, line?.total_line);
  const choice = label ?? pickLabel(key, pick, line?.total_line);
  const cls = `odds${compact ? ' odds--compact' : ''}`;

  if (q.suspended) {
    return h('button', { type: 'button', class: `${cls} odds--off`, disabled: true, 'aria-label': `${title}, ${choice}: прийом закрито` },
      compact ? null : h('span', { class: 'odds__label', text: choice }),
      h('span', { class: 'odds__value' }, icon(ICONS.lock(14))));
  }
  return h('button', {
    type: 'button',
    class: cls,
    'data-key': key,
    'data-pick': pick,
    'aria-pressed': String(isSelected(slip, key, pick)),
    'aria-label': `${title}, ${choice}: коефіцієнт ${q.odds.toFixed(2)}, шанс ${pct(q.p)}`,
    on: { click: () => store.toggle({ key, pick, odds: q.odds, line: key === 'total_over' ? line.total_line : null }) },
  },
  compact ? null : h('span', { class: 'odds__label', text: choice }),
  h('span', { class: 'odds__value', text: q.odds.toFixed(2) }));
}

export function syncOddsButtons(root, slip) {
  root.querySelectorAll('button.odds[data-key]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(isSelected(slip, btn.dataset.key, btn.dataset.pick)));
  });
}
