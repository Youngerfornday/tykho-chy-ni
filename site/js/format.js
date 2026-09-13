// Formatting, probability bins and verdict wording shared by every section.

const KYIV_TZ = 'Europe/Kyiv';

export const BINS = Object.freeze([
  { max: 0.15, color: 'var(--bin-0)', label: 'Майже напевно тихо', range: 'до 15%' },
  { max: 0.4, color: 'var(--bin-1)', label: 'Можлива тривога', range: '15–40%' },
  { max: 0.7, color: 'var(--bin-2)', label: 'Ймовірна тривога', range: '40–70%' },
  { max: 0.9, color: 'var(--bin-3)', label: 'Дуже ймовірна тривога', range: '70–90%' },
  { max: Infinity, color: 'var(--bin-4)', label: 'Майже напевно тривога', range: 'від 90%' },
]);

export function binIndex(p) {
  return BINS.findIndex((bin) => p < bin.max);
}

export function pct(p) {
  if (p == null || Number.isNaN(p)) return '—';
  if (p >= 0.995) return '99%+';
  if (p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}

export function range(lo, hi) {
  if (lo == null || hi == null) return '';
  return `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
}

export function oddsText(value) {
  return value >= 50 ? '50+' : value.toFixed(2);
}

const timeFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: KYIV_TZ, hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: KYIV_TZ, day: 'numeric', month: 'long' });

export const clock = (iso) => timeFmt.format(new Date(iso));
export const day = (date) => dayFmt.format(date);

export function nightTitle(anchorIso) {
  const [y, m, d] = anchorIso.split('-').map(Number);
  const morning = new Date(Date.UTC(y, m - 1, d + 1, 9));
  return `Ніч на ${day(morning)}`;
}

export function nationalVerdict(intensity) {
  if (intensity >= 0.55) return { text: 'Тихо не буде', tone: 4 };
  if (intensity >= 0.3) return { text: 'Неспокійна ніч', tone: 3 };
  if (intensity >= 0.12) return { text: 'Скоріше тихо', tone: 1 };
  return { text: 'Тиха ніч', tone: 0 };
}

export function regionVerdict(region) {
  if (region.status === 'ongoing') return { text: 'Тривога вже триває', tone: 4 };
  const p = region.p;
  if (p >= 0.85) return { text: 'Тихо не буде', tone: 4 };
  if (p >= 0.6) return { text: 'Скоріше тривога', tone: 3 };
  if (p >= 0.4) return { text: '50 на 50', tone: 2 };
  if (p >= 0.15) return { text: 'Скоріше тихо', tone: 1 };
  return { text: 'Тихо', tone: 0 };
}

export function shortName(name) {
  if (name === 'м. Київ') return 'Київ';
  if (name === 'Автономна Республіка Крим') return 'Крим';
  return name.replace(' область', '');
}

// Genitive-free phrasing: "у 13 з 24 областей" reads naturally for any count.
export function regionsWord(n) {
  const k = Math.abs(Math.round(n)) % 100;
  const last = k % 10;
  if (k > 10 && k < 20) return 'областях';
  if (last === 1) return 'області';
  return 'областях';
}
