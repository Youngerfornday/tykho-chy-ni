// "Мої ставки": stats, filter and bet cards with per-leg progress.

import { h, replaceChildren } from '../dom.js';
import { chips, marketTitle, pickLabel, placedWhen, STATUS_LABEL } from './labels.js';
import { walletStats } from './wallet.js';

let resetArmed = false;

function badge(bet) {
  const profit = bet.payout - bet.stake;
  const text = bet.status === 'won' ? `${STATUS_LABEL.won} +${chips(profit)}` : STATUS_LABEL[bet.status];
  return h('span', { class: `badge badge--${bet.status}`, text });
}

function card(bet) {
  const legStatus = bet.legStatus || bet.legs.map(() => 'open');
  const kind = bet.kind === 'express' ? `Експрес · ${bet.legs.length} події` : 'Ординар';
  const money = bet.status === 'pending'
    ? `Можливий виграш ${chips(Math.round(bet.stake * bet.odds))}`
    : bet.status === 'void' ? `Повернуто ${chips(bet.payout)}` : `Виплата ${chips(bet.payout)}`;
  return h('li', { class: `bet bet--${bet.status}` },
    h('div', { class: 'bet__head' }, h('span', { class: 'bet__kind', text: kind }), badge(bet)),
    h('ul', { class: 'bet__legs' }, bet.legs.map((leg, i) => h('li', { class: `bet__leg bet__leg--${legStatus[i]}` },
      h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('span', { class: 'bet__leg-title', text: marketTitle(leg.key, leg.line) }),
      h('span', { class: 'bet__leg-pick', text: pickLabel(leg.key, leg.pick, leg.line) }),
      h('span', { class: 'visually-hidden', text: STATUS_LABEL[legStatus[i]] })))),
    h('div', { class: 'bet__foot' },
      h('span', { text: `${chips(bet.stake)} × ${bet.odds.toFixed(2)}` }),
      h('span', { class: 'bet__money', text: money })),
    h('p', { class: 'bet__when', text: `Поставлено ${placedWhen(bet.placedAt)}` }),
    bet.status === 'pending' && Date.now() / 1000 > bet.windowEnd
      ? h('p', { class: 'bet__wait', text: 'Ніч минула. Чекаємо повних даних про тривоги: зазвичай до ранку, для деяких областей до тижня.' })
      : null);
}

export function renderBets(store, state) {
  const { wallet, view } = state;
  const stats = walletStats(wallet);
  const active = wallet.bets.filter((b) => b.status === 'pending');
  const settled = wallet.bets.filter((b) => b.status !== 'pending');
  const list = view.filter === 'active' ? active : settled;

  const stat = (label, value) => h('div', { class: 'stat' }, h('dt', { text: label }), h('dd', { text: value }));
  const filter = (id, text) => h('button', { type: 'button', role: 'radio', class: 'seg__opt', 'aria-checked': String(view.filter === id), on: { click: () => store.setFilter(id) } }, text);

  const resetBtn = h('button', {
    type: 'button', class: `linkbtn${resetArmed ? ' linkbtn--danger' : ''}`,
    on: { click: () => { if (resetArmed) { resetArmed = false; store.reset(); } else { resetArmed = true; replaceChildren(resetBtn, 'Точно? Натисніть ще раз, щоб стерти історію'); } } },
  }, 'Почати з нуля');

  return [
    h('dl', { class: 'stats' },
      stat('Баланс', chips(wallet.balance)),
      stat('Виграно', String(stats.won)),
      stat('Програно', String(stats.lost)),
      stat('ROI', stats.roi == null ? '—' : `${stats.roi > 0 ? '+' : ''}${Math.round(stats.roi * 100)}%`)),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Фільтр ставок' },
      filter('active', `Активні · ${active.length}`), filter('settled', `Розраховані · ${settled.length}`)),
    list.length
      ? h('ul', { class: 'bets' }, list.map(card))
      : h('p', { class: 'slip__empty-text', text: view.filter === 'active' ? 'Активних ставок немає.' : 'Ще нічого не розраховано. Результати з\'являються вночі й після ранкового оновлення даних.' }),
    state.persistent ? null : h('p', { class: 'slip__warn', text: 'Браузер не зберігає дані: ставки зникнуть після закриття сторінки.' }),
    resetBtn,
  ];
}
