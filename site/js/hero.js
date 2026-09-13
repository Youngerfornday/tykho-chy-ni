import { h, replaceChildren } from './dom.js';
import { BINS, binIndex, clock, nationalVerdict, nightTitle, pct, range, regionVerdict, regionsWord, shortName } from './format.js';

const $ = (id) => document.getElementById(id);

function nationalLede(data) {
  const n = data.national;
  const parts = [
    'До 07:00 тривога ймовірна в ', h('b', { text: `${Math.round(n.expected_regions)} з ${n.regions_total}` }),
    ` ${regionsWord(n.expected_regions)} (зазвичай за такої ситуації ${n.expected_lo}–${n.expected_hi}). `,
  ];
  if (n.active_now != null) {
    parts.push('Просто зараз тривога у ', h('b', { text: String(n.active_now) }), ` ${regionsWord(n.active_now)}. `);
  }
  parts.push('Захід, найімовірніше, проспить ніч спокійно: ', h('b', { text: pct(n.p_west_quiet) }), '.');
  return parts;
}

function regionLede(name, region) {
  if (region.status === 'ongoing') {
    return [
      `${shortName(name)}: тривога вже йде. Відбій протягом години — `, h('b', { text: pct(region.p_clear_1h) }),
      '. Тихо з 01:00 до ранку — ', h('b', { text: pct(region.p_quiet_late) }), '.',
    ];
  }
  return [
    'Тривога до 07:00 — ', h('b', { text: pct(region.p) }), ` (діапазон ${range(region.lo, region.hi)}). `,
    'Зазвичай останніми тижнями — ', h('b', { text: pct(region.p_base) }), '. ',
    'Тихо з 01:00 до ранку — ', h('b', { text: pct(region.p_quiet_late) }), '.',
  ];
}

function renderStrip(data, selected, onSelect) {
  const ordered = Object.entries(data.regions).sort((a, b) => a[1].p - b[1].p);
  const cells = ordered.map(([name, region]) => h('button', {
    type: 'button',
    class: `strip__cell${region.active_now ? ' strip__cell--now' : ''}`,
    style: { '--cell': BINS[binIndex(region.p)].color },
    'aria-pressed': String(name === selected),
    'aria-label': `${name}: ${pct(region.p)}${region.active_now ? ', зараз тривога' : ''}`,
    title: `${shortName(name)} · ${pct(region.p)}`,
    on: { click: () => onSelect(name === selected ? null : name) },
  }));
  const caption = h('p', { class: 'strip__caption' },
    h('span', { text: 'Від найтихішої області' }), h('span', { text: 'до найгучнішої · крапка = тривога зараз' }));
  replaceChildren($('strip'), cells, caption);
}

function renderPicker(data, selected, onSelect) {
  const select = $('region-select');
  const names = Object.keys(data.regions).sort((a, b) => shortName(a).localeCompare(shortName(b), 'uk'));
  replaceChildren(select,
    h('option', { value: '', text: 'Вся Україна' }),
    names.map((name) => h('option', { value: name, text: shortName(name), selected: name === selected })));
  select.value = selected || '';
  select.onchange = () => onSelect(select.value || null);
  const reset = $('region-reset');
  reset.hidden = !selected;
  reset.onclick = () => onSelect(null);
}

export function renderHero(data, selected, onSelect) {
  const region = selected ? data.regions[selected] : null;
  const verdict = region ? regionVerdict(region) : nationalVerdict(data.national.intensity);
  const tone = region ? BINS[binIndex(region.status === 'ongoing' ? 1 : region.p)].color : BINS[verdict.tone].color;

  $('night').textContent = nightTitle(data.window.anchor);
  replaceChildren($('verdict'),
    region ? h('span', { class: 'verdict__region', text: selected }) : null,
    verdict.text,
    h('span', { class: 'verdict__chip', style: { '--tone': tone }, 'aria-hidden': 'true' }));
  replaceChildren($('lede'), region ? regionLede(selected, region) : nationalLede(data));
  replaceChildren($('stamp'),
    'Станом на ', h('strong', { text: clock(data.generated_at) }), ' · оновлення кожні 30 хв');
  renderStrip(data, selected, onSelect);
  renderPicker(data, selected, onSelect);
}
