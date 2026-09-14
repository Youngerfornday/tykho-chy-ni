// Macro-regions for the line filter chips. Every forecast region belongs to exactly one group.

export const MACRO_REGIONS = Object.freeze([
  { id: 'west', title: 'Захід', regions: ['Закарпатська область', 'Львівська область', 'Волинська область', 'Рівненська область', 'Тернопільська область', 'Івано-Франківська область', 'Чернівецька область'] },
  { id: 'center', title: 'Центр', regions: ['Вінницька область', 'Хмельницька область', 'Черкаська область', 'Кіровоградська область', 'Полтавська область', 'Дніпропетровська область'] },
  { id: 'north', title: 'Північ', regions: ['м. Київ', 'Київська область', 'Житомирська область', 'Чернігівська область', 'Сумська область'] },
  { id: 'east', title: 'Схід', regions: ['Харківська область', 'Донецька область', 'Запорізька область'] },
  { id: 'south', title: 'Південь', regions: ['Одеська область', 'Миколаївська область', 'Херсонська область'] },
]);

const GROUP_OF = new Map(MACRO_REGIONS.flatMap((g) => g.regions.map((r) => [r, g.id])));

export const macroOf = (region) => GROUP_OF.get(region) || null;

export const FILTERS = Object.freeze([
  { id: 'main', title: 'Головні' },
  ...MACRO_REGIONS.map(({ id, title }) => ({ id, title })),
  { id: 'quiet_late', title: 'Тихо з 01:00' },
]);

export const FEATURED_KEYS = Object.freeze(['west_quiet', 'total_over', 'alarm|м. Київ', 'alarm|Київська область']);
const MAIN_ROW_KEYS = Object.freeze(['quiet_late|м. Київ', 'alarm|Одеська область', 'alarm|Харківська область', 'alarm|Дніпропетровська область', 'alarm|Львівська область']);

const fold = (text) => text.toLocaleLowerCase('uk').replace(/[’'`]/g, '');

/**
 * Market keys for the line screen. A search query wins over the filter and shows both
 * markets of every matching region; otherwise the filter decides.
 * @returns {{ featured: string[], rows: string[] }}
 */
export function marketKeys(filter, search, regions) {
  const q = fold(search || '').trim();
  const known = new Set(regions);
  if (q) {
    const hits = regions.filter((r) => fold(r).includes(q));
    return { featured: [], rows: hits.flatMap((r) => [`alarm|${r}`, `quiet_late|${r}`]) };
  }
  if (filter === 'main') {
    return { featured: FEATURED_KEYS.filter((k) => !k.includes('|') || known.has(k.split('|')[1])), rows: MAIN_ROW_KEYS.filter((k) => known.has(k.split('|')[1])) };
  }
  if (filter === 'quiet_late') return { featured: [], rows: regions.map((r) => `quiet_late|${r}`) };
  const group = MACRO_REGIONS.find((g) => g.id === filter);
  if (!group) return { featured: [], rows: [] };
  return { featured: [], rows: group.regions.filter((r) => known.has(r)).map((r) => `alarm|${r}`) };
}
