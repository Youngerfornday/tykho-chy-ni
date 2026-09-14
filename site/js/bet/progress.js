// Derived player progress: XP, level, skill against the line, nights and streaks.
// Everything here is recomputed from bet history, so it cannot drift from the wallet.

export const LEVELS = Object.freeze([
  { level: 1, xp: 0, name: 'Новачок' },
  { level: 2, xp: 100, name: 'Спостерігач' },
  { level: 3, xp: 300, name: 'Аналітик' },
  { level: 4, xp: 700, name: 'Синоптик' },
  { level: 5, xp: 1500, name: 'Стратег' },
  { level: 6, xp: 3000, name: 'Оракул' },
  { level: 7, xp: 6000, name: 'Легенда ночі' },
]);

const NIGHT_XP_CAP = 5;
const MISSION_XP = 20;
const ACHIEVEMENT_XP = 50;
const DAY_MS = 86400000;

export const isSettled = (bet) => bet.status === 'won' || bet.status === 'lost';

export function betXp(bet) {
  if (!isSettled(bet)) return 0;
  return 10 + (bet.status === 'won' ? Math.round(15 * Math.log2(Math.max(1, bet.odds))) : 0);
}

function byAnchor(bets) {
  return bets.reduce((groups, bet) => ({ ...groups, [bet.anchor]: [...(groups[bet.anchor] || []), bet] }), {});
}

export function xpFromBets(bets) {
  return Object.values(byAnchor(bets.filter(isSettled))).reduce((sum, group) => {
    const firstFive = [...group].sort((a, b) => (a.settledAt ?? a.placedAt) - (b.settledAt ?? b.placedAt)).slice(0, NIGHT_XP_CAP);
    return sum + firstFive.reduce((s, b) => s + betXp(b), 0);
  }, 0);
}

export function totalXp(bets, profile) {
  const missions = Object.values(profile.missions).reduce((n, ids) => n + ids.length, 0);
  return xpFromBets(bets) + MISSION_XP * missions + ACHIEVEMENT_XP * Object.keys(profile.achievements).length;
}

export function levelFor(xp) {
  const index = LEVELS.reduce((found, lvl, i) => (xp >= lvl.xp ? i : found), 0);
  const current = LEVELS[index];
  const next = LEVELS[index + 1] || null;
  return {
    level: current.level,
    name: current.name,
    xp,
    floor: current.xp,
    next,
    progress: next ? (xp - current.xp) / (next.xp - current.xp) : 1,
  };
}

export function skill(bets) {
  const settled = bets.filter(isSettled);
  const n = settled.length;
  const wins = settled.filter((b) => b.status === 'won').length;
  const staked = settled.reduce((s, b) => s + b.stake, 0);
  const returned = settled.reduce((s, b) => s + b.payout, 0);
  const actual = n ? wins / n : 0;
  const expected = n ? settled.reduce((s, b) => s + 1 / b.odds, 0) / n : 0;
  return { n, wins, actual, expected, edgePp: (actual - expected) * 100, roi: staked ? (returned - staked) / staked : null, enough: n >= 10 };
}

export function nightSummaries(bets) {
  return Object.entries(byAnchor(bets))
    .map(([anchor, group]) => {
      const settled = group.filter(isSettled);
      const stake = settled.reduce((s, b) => s + b.stake, 0);
      const payout = settled.reduce((s, b) => s + b.payout, 0);
      const won = settled.filter((b) => b.status === 'won');
      const best = won.reduce((top, b) => (!top || b.payout - b.stake > top.payout - top.stake ? b : top), null);
      return {
        anchor,
        bets: group,
        pending: group.filter((b) => b.status === 'pending').length,
        wins: won.length,
        losses: settled.length - won.length,
        stake,
        payout,
        profit: payout - stake,
        best,
      };
    })
    .sort((a, b) => (a.anchor < b.anchor ? 1 : -1));
}

const dayIndex = (anchor) => Date.UTC(...anchor.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0))) / DAY_MS;

export function streaks(bets) {
  const closed = nightSummaries(bets)
    .filter((n) => n.pending === 0 && n.wins + n.losses > 0)
    .sort((a, b) => (a.anchor < b.anchor ? -1 : 1));
  let best = 0;
  let run = 0;
  let previous = null;
  for (const night of closed) {
    const adjacent = previous !== null && dayIndex(night.anchor) - dayIndex(previous) === 1;
    run = night.profit > 0 ? (adjacent ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    previous = night.anchor;
  }
  return { current: run, best };
}
