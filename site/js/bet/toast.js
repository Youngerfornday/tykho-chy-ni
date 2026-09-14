// Non-blocking notifications for placed and settled bets, missions, achievements and levels.
// At most two toasts are visible; the rest wait in a queue. Achievements get a badge reveal.

import { h, icon } from '../dom.js';
import { chips, marketTitle } from './labels.js';

const LIFETIME_MS = 5000;
const REVEAL_LIFETIME_MS = 7000;
const MAX_VISIBLE = 2;

function describe(event) {
  if (event.type === 'placed') {
    const total = event.tickets.reduce((s, t) => s + t.stake, 0);
    return { tone: 'info', title: 'Ставку прийнято', text: `Списано ${chips(total)} фішок` };
  }
  if (event.type === 'bonus') return { tone: 'bonus', title: 'Щоденний бонус', text: `Баланс поповнено до ${chips(event.balance)} фішок` };
  if (event.type === 'mission') return { tone: 'bonus', title: `Завдання виконано: +${chips(event.mission.reward)}`, text: event.mission.title };
  if (event.type === 'achievement') return { tone: 'won', title: `Досягнення: ${event.achievement.title}`, text: `+${chips(event.achievement.reward)} фішок · ${event.achievement.desc}`, reveal: event.achievement.id };
  if (event.type === 'levelUp') return { tone: 'bonus', title: `Новий рівень ${event.reached}: ${event.level?.name ?? ''}`.trim(), text: `+${chips(event.reward)} фішок`, level: event.reached };
  const { bet } = event;
  const what = bet.kind === 'express' ? `Експрес · ${bet.legs.length} події` : marketTitle(bet.legs[0].key, bet.legs[0].line);
  if (event.type === 'won') return { tone: 'won', title: `Ставка зіграла: +${chips(bet.payout - bet.stake)}`, text: what };
  if (event.type === 'void') return { tone: 'info', title: 'Ставку повернуто', text: what };
  return { tone: 'lost', title: 'Ставка не зіграла', text: what };
}

/**
 * @param {HTMLElement} root container; gets aria-live="polite"
 * @param {{ badgeFor?: (id: string) => string|null, emblemFor?: (level: number) => string|null }} art
 */
export function createToaster(root, art = {}) {
  root.setAttribute('aria-live', 'polite');
  const queue = [];
  let visible = 0;

  function show({ node, lifetime }) {
    visible += 1;
    root.append(node);
    window.setTimeout(() => {
      node.classList.add('toast--out');
      window.setTimeout(() => {
        node.remove();
        visible -= 1;
        if (queue.length) show(queue.shift());
      }, 400);
    }, lifetime);
  }

  return (event) => {
    const { tone, title, text, reveal, level } = describe(event);
    const badge = reveal && art.badgeFor ? art.badgeFor(reveal) : null;
    const emblem = level && art.emblemFor ? art.emblemFor(level) : null;
    const artwork = badge || emblem;
    const node = h('div', { class: `toast toast--${tone}${artwork ? ' toast--reveal' : ''}` },
      artwork ? icon(artwork, 'toast__art') : null,
      h('div', { class: 'toast__text' }, h('strong', { text: title }), h('span', { text })));
    const item = { node, lifetime: artwork ? REVEAL_LIFETIME_MS : LIFETIME_MS };
    if (visible < MAX_VISIBLE) show(item);
    else queue.push(item);
  };
}
