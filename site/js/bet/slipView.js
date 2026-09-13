// Bet slip: collapsed bar plus an expandable panel (desktop) or bottom sheet (mobile).

import { h, icon, replaceChildren } from '../dom.js';
import { ICONS } from '../icons.js';
import { renderBets } from './betsView.js';
import { chips, marketTitle, pickLabel } from './labels.js';
import { MAX_LEGS, MIN_STAKE } from './slip.js';

const QUICK_STAKES = [50, 100, 250];

function legRow(store, leg, line) {
  const changed = leg.changed && leg.odds;
  const dir = changed && leg.odds > leg.oddsAtAdd ? 'up' : 'down';
  return h('li', { class: `leg${leg.suspended ? ' leg--off' : ''}` },
    h('div', { class: 'leg__text' },
      h('span', { class: 'leg__title', text: marketTitle(leg.key, leg.line ?? line?.total_line) }),
      h('span', { class: 'leg__pick', text: leg.suspended ? 'Знято з прийому' : pickLabel(leg.key, leg.pick, leg.line ?? line?.total_line) })),
    h('div', { class: 'leg__odds' },
      changed ? h('span', { class: `leg__was leg__was--${dir}` }, icon(ICONS[dir](12)), h('s', { text: leg.oddsAtAdd.toFixed(2) })) : null,
      h('b', { text: leg.odds ? leg.odds.toFixed(2) : '—' })),
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
    h('div', { class: 'express__row' }, h('span', { text: 'Коефіцієнт експресу' }), h('b', { text: odds.toFixed(2) })),
    correlated ? h('p', { class: 'express__note', text: `Якби події були незалежні, вийшло б ${productOdds.toFixed(2)}. Тривоги пов'язані між собою, тому рахуємо за реальними спільними ночами.` }) : null);
}

function stakeBlock(store, slip, quote, balance) {
  const count = slip.mode === 'express' ? 1 : slip.selections.length;
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
      h('button', { type: 'button', class: 'chipbtn', on: { click: () => store.setStake(Math.floor(balance / Math.max(1, count))) } }, 'Усе')),
    h('dl', { class: 'totals' },
      count > 1 ? h('div', null, h('dt', { text: `Разом (${count} × ${chips(slip.stake)})` }), h('dd', { text: chips(quote.totalStake) })) : null,
      h('div', null, h('dt', { text: 'Можливий виграш' }), h('dd', { class: 'totals__win', text: chips(quote.potentialWin) }))));
}

function receiptView(store, receipt) {
  const total = receipt.tickets.reduce((s, t) => s + t.stake, 0);
  return h('div', { class: 'receipt', role: 'status' },
    h('span', { class: 'receipt__icon' }, icon(ICONS.check(28))),
    h('h3', { text: receipt.tickets.length > 1 ? `Прийнято ${receipt.tickets.length} ставки` : 'Ставку прийнято' }),
    h('p', { text: `Списано ${chips(total)} фішок. Розрахунок автоматично, щойно з'являться дані про тривоги.` }),
    h('div', { class: 'receipt__actions' },
      h('button', { type: 'button', class: 'btn btn--ghost', on: { click: () => store.setTab('bets') } }, 'Мої ставки'),
      h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => store.dismissReceipt() } }, 'Ще ставка')));
}

function couponView(store, state) {
  const { slip, line, view, wallet } = state;
  if (view.receipt) return receiptView(store, view.receipt);
  const quote = store.quote();
  const notice = quote.line.open ? null : h('p', { class: 'slip__notice', role: 'status' }, icon(ICONS.clock(16)), quote.line.reason);
  if (!slip.selections.length) {
    return [notice, h('div', { class: 'slip__empty' },
      icon(ICONS.ticket(32), 'slip__empty-icon'),
      h('p', { text: 'Купон порожній. Натисніть коефіцієнт на лінії, у панелі області або в таблиці.' }))];
  }
  const legs = quote.legs.map((l) => ({ ...l, oddsAtAdd: slip.selections.find((s) => s.key === l.key)?.odds ?? l.odds }));
  const anyChanged = legs.some((l) => l.changed);
  const primary = anyChanged
    ? h('button', { type: 'button', class: 'btn btn--accept', on: { click: () => store.acceptOdds() } }, 'Прийняти нові коефіцієнти')
    : h('button', { type: 'button', class: 'btn btn--primary', disabled: !quote.canPlace, on: { click: () => store.place() } },
      quote.canPlace ? `Поставити ${chips(quote.totalStake)} фішок` : 'Поставити');
  return [
    notice,
    modeSwitch(store, slip),
    h('ul', { class: 'legs' }, legs.map((l) => legRow(store, l, line))),
    slip.mode === 'express' && slip.selections.length > MAX_LEGS ? h('p', { class: 'slip__warn', text: `В експресі до ${MAX_LEGS} подій` }) : null,
    slip.mode === 'express' ? expressBlock(quote) : null,
    stakeBlock(store, slip, quote, wallet.balance),
    primary,
    !quote.canPlace && !anyChanged && quote.reason ? h('p', { class: 'slip__reason', text: quote.reason }) : null,
    h('button', { type: 'button', class: 'linkbtn', on: { click: () => store.clear() } }, icon(ICONS.trash(14)), 'Очистити купон'),
  ];
}

export function mountSlip(root, store) {
  const barCount = h('span', { class: 'slip__count' });
  const barMeta = h('span', { class: 'slip__meta' });
  const bar = h('button', { type: 'button', class: 'slip__bar', 'aria-expanded': 'false', 'aria-controls': 'slip-sheet', on: { click: () => (store.state.view.open ? store.close() : store.open('coupon')) } },
    icon(ICONS.ticket(20)), h('span', { class: 'slip__bar-title', text: 'Купон' }), barCount, barMeta, icon(ICONS.chevron(18), 'slip__chev'));
  const tabs = h('div', { class: 'slip__tabs', role: 'tablist' });
  const body = h('div', { class: 'slip__body', id: 'slip-body' });
  const sheet = h('div', { class: 'slip__sheet', id: 'slip-sheet', role: 'region', 'aria-label': 'Купон і мої ставки' },
    h('div', { class: 'slip__head' }, tabs,
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Згорнути купон', on: { click: () => store.close() } }, icon(ICONS.chevron(20)))),
    body,
    h('p', { class: 'slip__foot', text: 'Гра на віртуальні фішки. Жодних грошей, виплат чи призів.' }));
  const backdrop = h('div', { class: 'slip__backdrop', on: { click: () => store.close() } });
  replaceChildren(root, backdrop, h('div', { class: 'slip__dock' }, sheet, bar));

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && store.state.view.open) store.close(); });

  let lastCount = 0;
  function render(state) {
    const { slip, view, wallet } = state;
    root.dataset.open = String(view.open);
    document.body.classList.toggle('slip-open', view.open);
    if (slip.selections.length !== lastCount) {
      bar.classList.remove('slip__bar--bump');
      void bar.offsetWidth;
      if (slip.selections.length > lastCount) bar.classList.add('slip__bar--bump');
      lastCount = slip.selections.length;
    }
    root.dataset.empty = String(!slip.selections.length);
    bar.setAttribute('aria-expanded', String(view.open));
    barCount.textContent = String(slip.selections.length);
    const quote = slip.selections.length ? store.quote() : null;
    barMeta.textContent = quote && slip.mode === 'express' && quote.express ? `коеф. ${quote.express.odds.toFixed(2)}` : `${chips(wallet.balance)} фішок`;

    const pending = wallet.bets.filter((b) => b.status === 'pending').length;
    const tab = (id, text) => h('button', { type: 'button', role: 'tab', class: 'slip__tab', 'aria-selected': String(view.tab === id), on: { click: () => store.setTab(id) } }, text);
    replaceChildren(tabs, tab('coupon', `Купон${slip.selections.length ? ` · ${slip.selections.length}` : ''}`), tab('bets', `Мої ставки${pending ? ` · ${pending}` : ''}`));

    const focusedStake = document.activeElement?.id === 'slip-stake';
    replaceChildren(body, view.tab === 'bets' ? renderBets(store, state) : couponView(store, state));
    if (focusedStake) {
      const input = document.getElementById('slip-stake');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
  }
  store.subscribe(render);
  render(store.state);
}
