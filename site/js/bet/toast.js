// Non-blocking notifications for placed and settled bets.

import { h } from '../dom.js';
import { chips, marketTitle } from './labels.js';

const LIFETIME_MS = 6000;

function describe(event) {
  if (event.type === 'placed') {
    const total = event.tickets.reduce((s, t) => s + t.stake, 0);
    return { tone: 'info', title: 'Ставку прийнято', text: `Списано ${chips(total)} фішок` };
  }
  if (event.type === 'bonus') return { tone: 'bonus', title: 'Щоденний бонус', text: `Баланс поповнено до ${chips(event.balance)} фішок` };
  const { bet } = event;
  const what = bet.kind === 'express' ? `Експрес · ${bet.legs.length} події` : marketTitle(bet.legs[0].key, bet.legs[0].line);
  if (event.type === 'won') return { tone: 'won', title: `Ставка зіграла: +${chips(bet.payout - bet.stake)}`, text: what };
  if (event.type === 'void') return { tone: 'info', title: 'Ставку повернуто', text: what };
  return { tone: 'lost', title: 'Ставка не зіграла', text: what };
}

export function createToaster(root) {
  return (event) => {
    const { tone, title, text } = describe(event);
    const node = h('div', { class: `toast toast--${tone}` }, h('strong', { text: title }), h('span', { text }));
    root.append(node);
    window.setTimeout(() => {
      node.classList.add('toast--out');
      window.setTimeout(() => node.remove(), 400);
    }, LIFETIME_MS);
  };
}
