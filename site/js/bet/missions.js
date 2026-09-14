// Nightly missions: three per night, picked deterministically from the anchor date.
// They reward thoughtful play (early, varied, small stakes), never bigger stakes.

export const MISSION_POOL = Object.freeze([
  { id: 'early_bird', title: 'Прогноз до 23:00', hint: 'Зробіть ставку ще до початку ночі', reward: 50 },
  { id: 'west_pick', title: 'Погляд на Захід', hint: 'Ставка на Захід тихий або на західну область', reward: 50 },
  { id: 'express2', title: "Зв'язані події", hint: 'Зберіть експрес хоча б із двох подій', reward: 75 },
  { id: 'quiet_late', title: 'Друга половина ночі', hint: 'Ставка на ринок «тихо з 01:00»', reward: 50 },
  { id: 'cool_head', title: 'Холодна голова', hint: 'Ставка не більше 10% від балансу', reward: 50 },
  { id: 'total', title: 'Тотал ночі', hint: 'Ставка на кількість областей з тривогою', reward: 50 },
  { id: 'underdog', title: 'Проти течії', hint: 'Ставка з коефіцієнтом від 3.00', reward: 75 },
  { id: 'three_regions', title: 'Три області', hint: 'Ставки на три різні області за ніч', reward: 75 },
]);

const MISSIONS_PER_NIGHT = 3;
const EIGHT_HOURS = 8 * 3600;

function hash(text) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function missionsFor(anchor) {
  const rand = mulberry32(hash(`missions:${anchor}`));
  const order = MISSION_POOL.map((m) => ({ m, k: rand() })).sort((a, b) => a.k - b.k);
  return order.slice(0, MISSIONS_PER_NIGHT).map(({ m }) => m);
}

const regionOf = (key) => {
  const [kind, region] = key.split('|');
  return kind === 'alarm' || kind === 'quiet_late' ? region : null;
};
const legs = (bets) => bets.flatMap((b) => b.legs);

const CHECKS = {
  early_bird: (bets) => bets.some((b) => b.placedAt < (b.windowStart ?? b.windowEnd - EIGHT_HOURS)),
  west_pick: (bets, ctx) => legs(bets).some((l) => l.key === 'west_quiet' || ctx.west.includes(regionOf(l.key))),
  express2: (bets) => bets.some((b) => b.kind === 'express' && b.legs.length >= 2),
  quiet_late: (bets) => legs(bets).some((l) => l.key.startsWith('quiet_late|')),
  cool_head: (bets) => bets.some((b) => Number.isFinite(b.balanceBefore) && b.stake <= 0.1 * b.balanceBefore),
  total: (bets) => legs(bets).some((l) => l.key === 'total_over'),
  underdog: (bets) => bets.some((b) => b.odds >= 3),
  three_regions: (bets) => new Set(legs(bets).map((l) => regionOf(l.key)).filter(Boolean)).size >= 3,
};

/** `bets` are the bets of one night. */
export function missionDone(id, bets, ctx) {
  const check = CHECKS[id];
  return Boolean(check && check(bets, ctx));
}

export function missionProgress(anchor, allBets, ctx, profile) {
  const bets = allBets.filter((b) => b.anchor === anchor);
  const rewarded = profile.missions[anchor] || [];
  return missionsFor(anchor).map((m) => ({ ...m, done: rewarded.includes(m.id) || missionDone(m.id, bets, ctx) }));
}
