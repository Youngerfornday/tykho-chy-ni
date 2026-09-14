// Missions of the night: three cards, as a snap carousel (line screen) or a list (rail, progress).

import { h, icon } from '../dom.js';
import { ICONS } from '../icons.js';
import { chips } from '../bet/labels.js';

export function missionCard(mission, index) {
  return h('li', { class: `mission${mission.done ? ' mission--done' : ''}`, 'aria-label': `${mission.title}${mission.done ? ', виконано' : ''}` },
    h('div', { class: 'mission__head' },
      h('span', { class: 'mission__index', 'aria-hidden': 'true', text: String(index + 1) }),
      h('span', { class: 'mission__reward' }, icon(ICONS.chips(14)), `+${chips(mission.reward)}`),
      mission.done ? h('span', { class: 'mission__done' }, icon(ICONS.check(14)), 'Виконано') : null),
    h('h3', { class: 'mission__title', text: mission.title }),
    h('p', { class: 'mission__hint', text: mission.hint }));
}

/**
 * @param {'carousel'|'list'} layout
 */
export function missionsBlock(missions, layout = 'carousel', { heading = 'Завдання ночі', level = 'h2' } = {}) {
  if (!missions.length) return null;
  const done = missions.filter((m) => m.done).length;
  return h('div', { class: `missions missions--${layout}` },
    h('div', { class: 'missions__head' },
      h(level, { class: 'missions__title' }, icon(ICONS.flag(16)), heading),
      h('span', { class: 'missions__meter', 'aria-label': `Виконано ${done} з ${missions.length}` },
        missions.map((m) => h('span', { class: `chip${m.done ? ' chip--on' : ''}`, 'aria-hidden': 'true' })))),
    h('ul', { class: 'missions__list' }, missions.map(missionCard)));
}
