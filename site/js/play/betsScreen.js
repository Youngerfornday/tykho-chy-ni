// "Мої ставки": night summary cards with sharing, then the bet list.

import { h, icon, replaceChildren } from '../dom.js';
import { ICONS } from '../icons.js';
import { nightTitle } from '../format.js';
import { renderBets } from '../bet/betsView.js';
import { chips, marketTitle } from '../bet/labels.js';
import { shareNight } from './shareCard.js';

const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${chips(Math.abs(n))}`;

function nightCard(night, progress, onShare) {
  const settled = night.wins + night.losses;
  const tone = settled === 0 ? 'open' : night.profit > 0 ? 'won' : night.profit < 0 ? 'lost' : 'even';
  const hitRate = settled ? Math.round((night.wins / settled) * 100) : null;
  const best = night.best ? `${marketTitle(night.best.legs[0].key, night.best.legs[0].line)}${night.best.kind === 'express' ? ` (експрес · ${night.best.legs.length})` : ''} · +${chips(night.best.payout - night.best.stake)}` : null;
  const shareBtn = h('button', {
    type: 'button', class: 'btn btn--ghost btn--auto night__share', disabled: settled === 0,
    'aria-label': `Поділитися підсумком: ${nightTitle(night.anchor)}`,
    on: { click: async () => {
      shareBtn.disabled = true;
      replaceChildren(shareBtn, icon(ICONS.share(16)), 'Готуємо картку…');
      let label = 'Поділитися';
      try {
        const outcome = await onShare(night, progress);
        if (outcome === 'downloaded') label = 'Картку збережено';
      } catch {
        label = 'Не вдалося. Спробуйте ще';
      }
      replaceChildren(shareBtn, icon(ICONS.share(16)), label);
      shareBtn.disabled = false;
      if (label !== 'Поділитися') window.setTimeout(() => replaceChildren(shareBtn, icon(ICONS.share(16)), 'Поділитися'), 4000);
    } },
  }, icon(ICONS.share(16)), 'Поділитися');
  return h('li', { class: `night night--${tone}` },
    h('div', { class: 'night__head' },
      h('h3', { class: 'night__title', text: nightTitle(night.anchor) }),
      night.pending ? h('span', { class: 'badge badge--pending', text: `Очікує · ${night.pending}` }) : null),
    h('div', { class: 'night__grid' },
      h('div', { class: 'night__stat night__stat--profit' }, h('span', { class: 'night__label', text: 'Прибуток' }), h('span', { class: 'night__value', text: settled ? signed(night.profit) : '—' })),
      h('div', { class: 'night__stat' }, h('span', { class: 'night__label', text: 'Рахунок' }), h('span', { class: 'night__value', text: `${night.wins} · ${night.losses}` })),
      h('div', { class: 'night__stat' }, h('span', { class: 'night__label', text: 'Влучність' }), h('span', { class: 'night__value', text: hitRate == null ? '—' : `${hitRate}%` }))),
    best ? h('p', { class: 'night__best' }, h('span', { class: 'night__label', text: 'Краща ставка' }), best) : null,
    shareBtn);
}

export function createBetsScreen(root, store, { intensity = () => 0.3 } = {}) {
  const head = h('div', { class: 'screen__head' },
    h('h2', { id: 'screen-bets-title', class: 'screen__title', tabindex: '-1', text: 'Мої ставки' }));
  const nights = h('div', { class: 'nights' });
  const list = h('div', { class: 'betlist' });
  replaceChildren(root, head, nights, list);
  let lastWallet = null;
  let lastFilter = null;

  function render(state) {
    if (state.wallet === lastWallet && state.view.filter === lastFilter) return;
    lastWallet = state.wallet;
    lastFilter = state.view.filter;
    const progress = store.progress();
    const recent = progress.nights.slice(0, 3);
    replaceChildren(nights, recent.length
      ? [h('h3', { class: 'nights__title', text: 'Підсумки ночей' }), h('ul', { class: 'nights__list' }, recent.map((n) => nightCard(n, progress, (night, p) => shareNight(night, p, intensity()))))]
      : null);
    replaceChildren(list, renderBets(store, state));
  }
  return { render };
}
