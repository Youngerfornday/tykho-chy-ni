// First-visit intro: three short swipeable cards inside the line screen, no modal.

import { h, icon } from '../dom.js';
import { ICONS } from '../icons.js';

const CARDS = [
  { icon: 'chips', title: 'Фішки, не гроші', text: '1 000 фішок на старт і поповнення до 1 000 щодня. Жодних грошей, виплат чи призів: це гра на прогноз.' },
  { icon: 'ticket', title: 'Чесні коефіцієнти', text: 'Коефіцієнт = 1 / шанс, без маржі. Експрес рахуємо за реальними спільними ночами: тривоги пов\'язані, тому він менший за добуток.' },
  { icon: 'check', title: 'Розрахунок сам', text: 'Ставка рахує лише події після її розміщення. Виграш нараховується автоматично, щойно дані про ніч стають повними.' },
];

export function introBlock(store) {
  const track = h('div', { class: 'intro__track', role: 'group', 'aria-label': 'Як грати' },
    CARDS.map((card, i) => h('article', { class: 'intro__card', 'aria-label': `${i + 1} з ${CARDS.length}` },
      icon(ICONS[card.icon](22), 'intro__icon'),
      h('h3', { class: 'intro__title', text: card.title }),
      h('p', { class: 'intro__text', text: card.text }))));
  const dots = h('div', { class: 'intro__dots', 'aria-hidden': 'true' }, CARDS.map((_, i) => h('span', { class: `chip${i === 0 ? ' chip--on' : ''}` })));
  track.addEventListener('scroll', () => {
    const index = Math.round(track.scrollLeft / Math.max(1, track.firstElementChild.offsetWidth + 10));
    [...dots.children].forEach((dot, i) => dot.classList.toggle('chip--on', i === index));
  }, { passive: true });
  return h('section', { class: 'intro', 'aria-labelledby': 'intro-title' },
    h('h2', { id: 'intro-title', class: 'intro__heading', text: 'Як грати' }),
    track,
    h('div', { class: 'intro__foot' }, dots,
      h('button', { type: 'button', class: 'btn btn--ghost btn--auto', on: { click: () => store.dismissIntro() } }, 'Зрозуміло')));
}
