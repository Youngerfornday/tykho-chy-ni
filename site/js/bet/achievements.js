// One-time achievements. Conditions read bet history only; unlock state lives in the profile.

import { nightSummaries, skill, streaks } from './progress.js';

const regionOf = (key) => {
  const [kind, region] = key.split('|');
  return kind === 'alarm' || kind === 'quiet_late' ? region : null;
};
const isQuietPick = (leg) => (leg.key.startsWith('alarm|') && leg.pick === 'no')
  || (leg.key.startsWith('quiet_late|') && leg.pick === 'yes')
  || (leg.key === 'west_quiet' && leg.pick === 'yes');
const won = (bets) => bets.filter((b) => b.status === 'won');

function coolHeadNights(bets) {
  const groups = bets.reduce((acc, b) => ({ ...acc, [b.anchor]: [...(acc[b.anchor] || []), b] }), {});
  return Object.values(groups)
    .filter((group) => group.every((b) => Number.isFinite(b.balanceBefore) && b.stake <= 0.25 * b.balanceBefore))
    .length;
}

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_bet', title: 'Перший прогноз', desc: 'Зробити першу ставку', reward: 100, check: (bets) => bets.length > 0 },
  { id: 'first_win', title: 'Перша влучність', desc: 'Виграти першу ставку', reward: 100, check: (bets) => won(bets).length > 0 },
  { id: 'quiet_call', title: 'Тиха ніч', desc: 'Вгадати, що тривоги не буде', reward: 150, check: (bets) => won(bets).some((b) => b.legs.some(isQuietPick)) },
  { id: 'express3', title: 'Експрес-мислення', desc: 'Виграти експрес із 3+ подій', reward: 300, check: (bets) => won(bets).some((b) => b.kind === 'express' && b.legs.length >= 3) },
  { id: 'underdog_win', title: 'Проти течії', desc: 'Виграти ординар з коефіцієнтом від 4.00', reward: 250, check: (bets) => won(bets).some((b) => b.kind === 'single' && b.odds >= 4) },
  { id: 'streak3', title: 'Три ночі поспіль', desc: 'Три прибуткові ночі підряд', reward: 300, check: (bets) => streaks(bets).best >= 3 },
  { id: 'sharp', title: 'Краще за лінію', desc: '10+ ставок і влучність на 5 п.п. вища за коефіцієнти', reward: 500, check: (bets) => { const s = skill(bets); return s.enough && s.edgePp >= 5; } },
  { id: 'explorer', title: 'Уся карта', desc: 'Ставки на 12 різних областей', reward: 200, check: (bets) => new Set(bets.flatMap((b) => b.legs.map((l) => regionOf(l.key))).filter(Boolean)).size >= 12 },
  { id: 'cool_head', title: 'Холодна голова', desc: '7 ночей без ставок більше 25% балансу', reward: 300, check: (bets) => coolHeadNights(bets) >= 7 },
  { id: 'flawless_night', title: 'Бездоганна ніч', desc: 'Ніч із 3+ розрахованими ставками, усі виграні', reward: 250, check: (bets) => nightSummaries(bets).some((n) => n.pending === 0 && n.losses === 0 && n.wins >= 3) },
  { id: 'week', title: 'Тиждень прогнозів', desc: 'Ставки у 7 різні ночі', reward: 300, check: (bets) => new Set(bets.map((b) => b.anchor)).size >= 7 },
]);

export function newlyUnlocked(bets, profile, ctx) {
  return ACHIEVEMENTS.filter((a) => !profile.achievements[a.id] && a.check(bets, ctx));
}
