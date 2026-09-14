// Map view for the line screen: the forecast map, tapping a region filters the line to it.

import { h, replaceChildren } from '../dom.js';
import { createMap } from '../map.js';

async function loadMapData() {
  const bust = Math.floor(Date.now() / 60000);
  const response = await fetch(`../data/map.json?v=${bust}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`map.json: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.viewBox) || !Array.isArray(data.regions)) throw new Error('unexpected map schema');
  return data;
}

export function createMapView(root, { onSelect }) {
  const tooltip = h('div', { class: 'tooltip', role: 'tooltip', hidden: true });
  const canvas = h('div', { class: 'mapframe__canvas linemap__canvas' }, tooltip);
  const hint = h('p', { class: 'linemap__hint', text: 'Торкніться області, щоб побачити її ринки.' });
  const status = h('p', { class: 'linemap__status', role: 'status', hidden: true });
  replaceChildren(root, canvas, hint, status);
  let map = null;
  let loading = null;
  let data = null;
  let selected = null;

  function apply() {
    if (map && data) map.update(data, selected);
    hint.textContent = selected ? `Обрано: ${selected}. Торкніться ще раз, щоб зняти вибір.` : 'Торкніться області, щоб побачити її ринки.';
  }

  async function ensure() {
    if (map) return;
    if (!loading) {
      status.hidden = false;
      status.textContent = 'Завантажуємо карту…';
      loading = loadMapData().then((mapData) => {
        map = createMap(mapData, { canvas, tooltip, onSelect: (name) => { selected = name; apply(); onSelect(name); } });
        status.hidden = true;
        apply();
      }).catch(() => {
        status.textContent = 'Карту не вдалося завантажити. Скористайтеся списком.';
        loading = null;
      });
    }
    await loading;
  }

  return {
    show() { root.hidden = false; return ensure(); },
    hide() { root.hidden = true; },
    setData(fresh) { data = fresh; apply(); },
    select(name) { selected = name; apply(); },
    get selected() { return selected; },
  };
}
