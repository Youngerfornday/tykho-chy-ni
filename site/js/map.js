import { h, replaceChildren, s } from './dom.js';
import { BINS, binIndex, clock, day, pct, range } from './format.js';

const COMPACT_WIDTH = 640;
const DARK_LABEL_BINS = new Set([2]);
const KYIV_CITY = 'м. Київ';

function hatch() {
  return s('pattern', { id: 'perm-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    s('rect', { width: 7, height: 7, fill: 'var(--perm)' }),
    s('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: 'var(--perm-hatch)', 'stroke-width': 2.4 }));
}

function tooltipContent(name, region, permanent) {
  if (permanent) return [h('strong', { text: name }), h('span', { text: 'Постійна тривога, окупована територія. Не прогнозуємо.' })];
  const now = region.active_now == null ? 'стан зараз невідомий' : region.active_now ? 'зараз тривога' : 'зараз тихо';
  return [
    h('strong', { text: name }),
    h('span', { class: 'tooltip__big', text: pct(region.p) }),
    h('span', null, 'тривога до 07:00 · діапазон ', h('span', { class: 'tooltip__range', text: range(region.lo, region.hi) })),
    h('span', { class: 'tooltip__muted', text: `${now} · зазвичай ${pct(region.p_base)}` }),
  ];
}

export function createMap(mapData, { canvas, tooltip, onSelect }) {
  const [w, hgt] = mapData.viewBox;
  const fills = s('g', { class: 'map__regions' });
  const pulses = s('g', { class: 'map__pulses', 'aria-hidden': 'true' });
  const selection = s('path', { class: 'map__selected', d: '', 'aria-hidden': 'true' });
  const focusRing = s('path', { class: 'map__focus', d: '', 'aria-hidden': 'true' });
  const labels = s('g', { class: 'map__labels', 'aria-hidden': 'true' });
  const stamp = s('text', { class: 'map__stamp-time', x: 20, y: 618 });
  const stampShort = s('text', { class: 'map__stamp-time map__stamp-time--short', x: 20, y: 618 });
  const watermark = s('g', { class: 'map__watermark' },
    s('text', { class: 'map__stamp', x: 20, y: 560, text: 'ПРОГНОЗ' }),
    s('text', { class: 'map__stamp-sub', x: 20, y: 590, text: 'не офіційна тривога' }), stamp, stampShort);
  const svg = s('svg', { class: 'map', viewBox: `0 0 ${w} ${hgt}`, role: 'group', 'aria-label': 'Карта шансів тривоги по областях' },
    s('defs', null, hatch()), fills, pulses, selection, focusRing, labels, watermark);

  const nodes = new Map(mapData.regions.map((region) => {
    const permanent = region.kind === 'permanent';
    const path = s('path', { d: region.d, class: `map__region${permanent ? ' map__region--perm' : ''}` });
    if (!permanent) {
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
    }
    const [lx, ly] = region.label;
    const isCity = region.name === KYIV_CITY;
    const name = isCity
      ? s('text', { class: 'map__name map__name--city', x: lx - 22, y: ly - 2, text: 'м. Київ' })
      : s('text', { class: 'map__name', x: lx, y: ly - 3, text: region.short });
    const value = s('text', { class: 'map__value', x: isCity ? lx - 22 : lx, y: ly + 13 });
    fills.append(path);
    labels.append(s('g', null, name, value));
    return [region.name, { region, path, name, value, permanent }];
  }));

  let current = null;
  let selectedName = null;

  const hideTip = () => { tooltip.hidden = true; };
  const showTip = (event, entry) => {
    if (!current || event.pointerType === 'touch') return;
    replaceChildren(tooltip, tooltipContent(entry.region.name, current.regions[entry.region.name], entry.permanent));
    const box = canvas.getBoundingClientRect();
    const x = Math.min(event.clientX - box.left + 16, box.width - 250);
    tooltip.style.transform = `translate(${Math.max(8, x)}px, ${event.clientY - box.top + 16}px)`;
    tooltip.hidden = false;
  };

  nodes.forEach((entry, name) => {
    entry.path.addEventListener('pointermove', (event) => showTip(event, entry));
    entry.path.addEventListener('pointerleave', hideTip);
    if (entry.permanent) return;
    let lastPointer = 'mouse';
    const pick = () => onSelect(selectedName === name ? null : name, { viaTouch: lastPointer === 'touch' });
    entry.path.addEventListener('pointerdown', (event) => { lastPointer = event.pointerType; });
    entry.path.addEventListener('click', pick);
    entry.path.addEventListener('focus', () => focusRing.setAttribute('d', entry.region.d));
    entry.path.addEventListener('blur', () => focusRing.setAttribute('d', ''));
    entry.path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); }
    });
  });

  new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width || 1;
    svg.classList.toggle('map--compact', width < COMPACT_WIDTH);
    svg.style.setProperty('--k', (w / width).toFixed(3));
  }).observe(canvas);
  canvas.prepend(svg);

  function update(data, selected) {
    current = data;
    selectedName = selected;
    stamp.textContent = `Станом на ${day(new Date(data.generated_at))}, ${clock(data.generated_at)}`;
    stampShort.textContent = `${day(new Date(data.generated_at))}, ${clock(data.generated_at)}`;
    replaceChildren(pulses);
    nodes.forEach((entry, name) => {
      if (entry.permanent) {
        entry.value.textContent = '';
        return;
      }
      const region = data.regions[name];
      const bin = binIndex(region.p);
      entry.path.style.fill = BINS[bin].color;
      entry.path.setAttribute('aria-label', `${name}: ${pct(region.p)} шанс тривоги до ранку${region.active_now ? ', зараз тривога' : ''}`);
      entry.path.setAttribute('aria-pressed', String(name === selected));
      entry.value.textContent = pct(region.p);
      const isCity = name === KYIV_CITY;
      const labelClass = isCity ? ' map__label--city' : DARK_LABEL_BINS.has(bin) ? ' map__label--dark' : '';
      entry.name.setAttribute('class', `map__name${labelClass}`);
      entry.value.setAttribute('class', `map__value${labelClass}`);
      if (region.active_now) pulses.append(s('path', { d: entry.region.d, class: 'map__pulse' }));
    });
    selection.setAttribute('d', selected && nodes.has(selected) ? nodes.get(selected).region.d : '');
  }

  return { update };
}

export function renderPill(target, data) {
  const counts = BINS.map((_, i) => Object.values(data.regions).filter((r) => binIndex(r.p) === i).length);
  const chips = BINS.map((bin, i) => ({ bin, i, count: counts[i] })).reverse().filter((c) => c.count > 0)
    .map(({ bin, count }) => h('span', { class: 'pill__item', title: bin.label },
      h('span', { class: 'chip', style: { background: bin.color } }), h('span', { text: String(count) })));
  replaceChildren(target, h('span', { class: 'pill__title' }, 'Прогноз', h('span', { class: 'pill__long', text: ' · області' }), ':'), chips);
}

export function renderLegend(target) {
  const rows = BINS.map((bin) => h('li', null,
    h('span', { class: 'chip', style: { background: bin.color } }), h('span', { text: `${bin.label} (${bin.range})` })));
  replaceChildren(target, h('ul', null, rows,
    h('li', null, h('span', { class: 'chip chip--perm' }), h('span', { text: 'Постійна тривога (окупація)' })),
    h('li', null, h('span', { class: 'chip chip--pulse' }), h('span', { text: 'Тривога на момент оновлення' }))));
}

