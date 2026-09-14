// Desktop left rail: section switch, compact level card and the missions of the night.

import { h, replaceChildren } from '../dom.js';
import { missionsBlock } from './missionsView.js';
import { levelCard } from './progressScreen.js';

export function createRail(root, store, { navigate }) {
  const switcher = h('div', { class: 'seg rail__seg', role: 'radiogroup', 'aria-label': 'Розділ' });
  const level = h('button', { type: 'button', class: 'rail__level', 'aria-label': 'Відкрити прогрес', on: { click: () => navigate('progress') } });
  const missions = h('div', { class: 'rail__missions' });
  replaceChildren(root, switcher, level, missions);
  let route = 'line';
  let sig = null;

  function renderSwitch() {
    const option = (id, text) => h('button', { type: 'button', role: 'radio', class: 'seg__opt', 'aria-checked': String((route === 'progress' ? 'progress' : 'line') === id), on: { click: () => navigate(id) } }, text);
    replaceChildren(switcher, option('line', 'Лінія'), option('progress', 'Прогрес'));
  }

  return {
    setRoute(next) { route = next; renderSwitch(); },
    render() {
      const p = store.progress();
      const next = `${p.xp}|${p.level.level}|${p.missions.map((m) => `${m.id}${m.done}`).join()}`;
      if (next === sig) return;
      sig = next;
      replaceChildren(level, levelCard(p, { compact: true }));
      replaceChildren(missions, missionsBlock(p.missions, 'list', { level: 'h2' }));
    },
  };
}
