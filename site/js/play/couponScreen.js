// "Купон": header, scrollable body, sticky footer with stake, payout and the CTA; safety and sleep notes.

import { h, icon, replaceChildren } from '../dom.js';
import { ICONS } from '../icons.js';
import { shortName } from '../format.js';
import { couponView } from '../bet/slipView.js';
import { alertedRegions, SAFETY_NOTE, shouldShowSleepNote, SLEEP_NOTE } from './notes.js';
import { rollChanged } from './roll.js';

function safetyNote(regions) {
  if (!regions.length) return null;
  return h('p', { class: 'note note--safety', role: 'status' },
    icon(ICONS.shield(18)),
    h('span', null, h('b', { text: regions.map(shortName).join(', ') }), `. ${SAFETY_NOTE}`));
}

function sleepNote() {
  return h('p', { class: 'note note--sleep' }, icon(ICONS.moon(18)), SLEEP_NOTE);
}

export function createCouponScreen(root, store, { navigate }) {
  const count = h('span', { class: 'screen__count', hidden: true });
  const head = h('div', { class: 'screen__head' },
    h('h2', { id: 'screen-coupon-title', class: 'screen__title', tabindex: '-1' }, 'Купон', count));
  const body = h('div', { class: 'coupon__body' });
  const actions = h('div', { class: 'coupon__actions' });
  const foot = h('div', { class: 'coupon__foot' }, actions,
    h('p', { class: 'coupon__legal', text: 'Гра на віртуальні фішки. Жодних грошей, виплат чи призів.' }));
  replaceChildren(root, head, body, foot);
  const shownOdds = new Map();

  function render(state) {
    const { slip, line, wallet } = state;
    count.textContent = String(slip.selections.length);
    count.hidden = !slip.selections.length;
    const pending = wallet.bets.filter((b) => b.status === 'pending').length;
    const notes = [
      safetyNote(alertedRegions(line, slip.selections)),
      shouldShowSleepNote(Date.now(), pending) ? sleepNote() : null,
    ].filter(Boolean);
    const focusedStake = document.activeElement?.id === 'slip-stake';
    const parts = couponView(store, state, { notes, onBets: () => navigate('bets'), onMore: () => navigate('line') });
    replaceChildren(body, parts.body);
    replaceChildren(actions, parts.footer);
    foot.hidden = !parts.footer.length;
    const legs = [...body.querySelectorAll('.leg[data-key]')].map((leg) => ({ key: leg.dataset.key, el: leg.querySelector('.leg__value'), roll: true }));
    const express = body.querySelector('.express__value');
    rollChanged(shownOdds, [...legs, ...(express ? [{ key: 'express', el: express, roll: true }] : [])]);
    [...shownOdds.keys()].filter((k) => k !== 'express' && !slip.selections.some((s) => s.key === k)).forEach((k) => shownOdds.delete(k));
    if (!express) shownOdds.delete('express');
    if (focusedStake) {
      const input = document.getElementById('slip-stake');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
  }
  return { render };
}
