// Coupon view: legs, mode, stake and the primary action. Returns body and footer parts:
// the stake, payout and CTA live in the footer so they always sit together.

import { h, icon } from '../dom.js';
import { ICONS } from '../icons.js';
import { chips, marketTitle, pickLabel } from './labels.js';
import { MAX_LEGS, MIN_STAKE } from './slip.js';

const QUICK_STAKES = [50, 100, 250];
const CAUTIOUS_SHARE = 0.1;

function legRow(store, leg, line) {
  const changed = leg.changed && leg.odds;
  const dir = changed && leg.odds > leg.oddsAtAdd ? 'up' : 'down';
  return h('li', { class: `leg${leg.suspended ? ' leg--off' : ''}`, 'data-key': leg.key },
    h('div', { class: 'leg__text' },
      h('span', { class: 'leg__title', text: marketTitle(leg.key, leg.line ?? line?.total_line) }),
      h('span', { class: 'leg__pick', text: leg.suspended ? 'Знято з прийому' : pickLabel(leg.key, leg.pick, leg.line ?? line?.total_line) })),
    h('div', { class: 'leg__odds' },
      changed ? h('span', { class: `leg__was leg__was--${dir}` }, icon(ICONS[dir](12)), h('s', { text: leg.oddsAtAdd.toFixed(2) })) : null,
      h('b', { class: 'leg__value', text: leg.odds ? leg.odds.toFixed(2) : '—' })),
    h('button', { type: 'button', class: 'iconbtn', 'aria-label': `Прибрати: ${marketTitle(leg.key, line?.total_line)}`, on: { click: () => store.remove(leg.key) } },
      icon(ICONS.close(16))));
}

function modeSwitch(store, slip) {
  const canExpress = slip.selections.length >= 2;
  const option = (mode, text) => h('button', {
    type: 'button', role: 'radio', class: 'seg__opt', 'aria-checked': String(slip.mode === mode),
    disabled: mode === 'express' && !canExpress, on: { click: () => store.setMode(mode) },
  }, text);
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Тип ставки' },
    option('single', 'Ординар'), option('express', `Експрес${canExpress ? ` · ${slip.selections.length}` : ''}`));
}

function expressBlock(quote) {
  if (!quote.express) return null;
  const { odds, productOdds } = quote.express;
  const correlated = Number.isFinite(productOdds) && Math.abs(productOdds - odds) / odds > 0.03;
  return h('div', { class: 'express' },
    h('div', { class: 'express__row' }, h('span', { text: 'Коефіцієнт експресу' }), h('b', { class: 'express__value', text: odds.toFixed(2) })),
    correlated ? h('p', { class: 'express__note', text: `Якби події були незалежні, вийшло б ${productOdds.toFixed(2)}. Тривоги пов'язані між собою, тому рахуємо за реальними спільними ночами.` }) : null);
}

function stakeBlock(store, slip, quote, balance) {
  const count = slip.mode === 'express' ? 1 : slip.selections.length;
  const cautious = Math.max(MIN_STAKE, Math.floor((balance * CAUTIOUS_SHARE) / Math.max(1, count)));
  const input = h('input', {
    id: 'slip-stake', class: 'stake__input', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    value: String(slip.stake), 'aria-label': 'Сума ставки у фішках',
    on: { input: (e) => store.setStake(e.target.value.replace(/\D/g, '')) },
  });
  const step = (delta) => () => store.setStake(Math.max(MIN_STAKE, slip.stake + delta));
  return h('div', { class: 'stake' },
    h('div', { class: 'stake__row' },
      h('button', { type: 'button', class: 'iconbtn iconbtn--box', 'aria-label': 'Менше на 10', on: { click: step(-10) } }, icon(ICONS.minus(16))),
      input,
      h('button', { type: 'button', class: 'iconbtn iconbtn--box', 'aria-label': 'Більше на 10', on: { click: step(10) } }, icon(ICONS.plus(16)))),
    h('div', { class: 'stake__quick' },
      QUICK_STAKES.map((v) => h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(slip.stake === v), on: { click: () => store.setStake(v) } }, String(v))),
      h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(slip.stake === cautious), 'aria-label': `10% балансу: ${chips(cautious)}`, on: { click: () => store.setStake(cautious) } }, '10%')),
    h('dl', { class: 'totals' },
      count > 1 ? h('div', null, h('dt', { text: `Разом (${count} × ${chips(slip.stake)})` }), h('dd', { text: chips(quote.totalStake) })) : null,
      h('div', null, h('dt', { text: 'Можливий виграш' }), h('dd', { class: 'totals__win', text: chips(quote.potentialWin) }))));
}

function receiptView(store, receipt, { onBets, onMore } = {}) {
  const total = receipt.tickets.reduce((s, t) => s + t.stake, 0);
  return h('div', { class: 'receipt', role: 'status' },
    h('span', { class: 'receipt__icon' }, icon(ICONS.check(28))),
    h('h3', { text: receipt.tickets.length > 1 ? `Прийнято ${receipt.tickets.length} ставки` : 'Ставку прийнято' }),
    h('p', { text: `Списано ${chips(total)} фішок. Розрахунок автоматично, щойно з'являться дані про тривоги.` }),
    h('div', { class: 'receipt__actions' },
      h('button', { type: 'button', class: 'btn btn--ghost', on: { click: () => { store.dismissReceipt(); onBets?.(); } } }, 'Мої ставки'),
      h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => { store.dismissReceipt(); onMore?.(); } } }, 'Ще ставка')));
}

/**
 * @returns {{ body: Node[], footer: Node[] }} body scrolls; footer (stake, payout, CTA) stays visible.
 * `notes` are host-provided nodes (safety, sleep) shown above the legs.
 */
export function couponView(store, state, { notes = [], onBets, onMore } = {}) {
  const { slip, line, view, wallet } = state;
  if (view.receipt) return { body: [receiptView(store, view.receipt, { onBets, onMore })], footer: [] };
  const quote = store.quote();
  const notice = quote.line.open ? null : h('p', { class: 'slip__notice', role: 'status' }, icon(ICONS.clock(16)), quote.line.reason);
  if (!slip.selections.length) {
    return {
      body: [notice, ...notes, h('div', { class: 'slip__empty' },
        icon(ICONS.ticket(32), 'slip__empty-icon'),
        h('p', { text: 'Купон порожній. Натисніть коефіцієнт на лінії, і подія з\'явиться тут.' }),
        onMore ? h('button', { type: 'button', class: 'btn btn--ghost', on: { click: onMore } }, 'До лінії') : null)],
      footer: [],
    };
  }
  const legs = quote.legs.map((l) => ({ ...l, oddsAtAdd: slip.selections.find((s) => s.key === l.key)?.odds ?? l.odds }));
  const anyChanged = legs.some((l) => l.changed);
  const primary = anyChanged
    ? h('button', { type: 'button', class: 'btn btn--accept', on: { click: () => store.acceptOdds() } }, 'Прийняти нові коефіцієнти')
    : h('button', { type: 'button', class: 'btn btn--primary', disabled: !quote.canPlace, on: { click: () => store.place() } },
      quote.canPlace ? `Поставити ${chips(quote.totalStake)} фішок` : 'Поставити');
  return {
    body: [
      notice,
      ...notes,
      modeSwitch(store, slip),
      h('ul', { class: 'legs' }, legs.map((l) => legRow(store, l, line))),
      slip.mode === 'express' && slip.selections.length > MAX_LEGS ? h('p', { class: 'slip__warn', text: `В експресі до ${MAX_LEGS} подій` }) : null,
      slip.mode === 'express' ? expressBlock(quote) : null,
      h('button', { type: 'button', class: 'linkbtn', on: { click: () => store.clear() } }, icon(ICONS.trash(14)), 'Очистити купон'),
    ],
    footer: [
      stakeBlock(store, slip, quote, wallet.balance),
      primary,
      !quote.canPlace && !anyChanged && quote.reason ? h('p', { class: 'slip__reason', text: quote.reason }) : null,
    ],
  };
}
