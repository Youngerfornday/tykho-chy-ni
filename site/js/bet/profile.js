// Player profile: unlocked achievements, rewarded missions and level rewards,
// plus the single transition that grants them and credits chips.

import { ACHIEVEMENTS, newlyUnlocked } from './achievements.js';
import { missionDone, missionsFor, missionProgress } from './missions.js';
import { levelFor, nightSummaries, skill, streaks, totalXp } from './progress.js';

export const PROFILE_KEY = 'tcn.profile.v1';
const LEVEL_REWARD_PER_LEVEL = 100;

export function createProfile() {
  return { version: 1, achievements: {}, missions: {}, levelRewarded: 1, introDismissed: false };
}

export function parseProfile(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return createProfile();
    const achievements = Object.fromEntries(Object.entries(data.achievements || {}).filter(([, t]) => Number.isFinite(t)));
    const missions = Object.fromEntries(Object.entries(data.missions || {})
      .filter(([, ids]) => Array.isArray(ids))
      .map(([day, ids]) => [day, ids.filter((id) => typeof id === 'string')]));
    return {
      version: 1,
      achievements,
      missions,
      levelRewarded: Number.isInteger(data.levelRewarded) && data.levelRewarded >= 1 ? data.levelRewarded : 1,
      introDismissed: data.introDismissed === true,
    };
  } catch {
    return createProfile();
  }
}

export function applyGamification(wallet, profile, ctx) {
  const events = [];
  let credit = 0;
  let missions = profile.missions;
  let achievements = profile.achievements;
  const anchors = [...new Set(wallet.bets.map((b) => b.anchor))];

  for (const anchor of anchors) {
    const nightBets = wallet.bets.filter((b) => b.anchor === anchor);
    const rewarded = missions[anchor] || [];
    const fresh = missionsFor(anchor).filter((m) => !rewarded.includes(m.id) && missionDone(m.id, nightBets, ctx));
    if (fresh.length) {
      missions = { ...missions, [anchor]: [...rewarded, ...fresh.map((m) => m.id)] };
      fresh.forEach((m) => { credit += m.reward; events.push({ type: 'mission', mission: m }); });
    }
  }

  for (const a of newlyUnlocked(wallet.bets, { ...profile, achievements }, ctx)) {
    achievements = { ...achievements, [a.id]: ctx.now };
    credit += a.reward;
    events.push({ type: 'achievement', achievement: a });
  }

  let levelRewarded = profile.levelRewarded;
  const { level } = levelFor(totalXp(wallet.bets, { missions, achievements }));
  for (let l = levelRewarded + 1; l <= level; l += 1) {
    credit += LEVEL_REWARD_PER_LEVEL * l;
    events.push({ type: 'levelUp', level: levelFor(totalXp(wallet.bets, { missions, achievements })), reward: LEVEL_REWARD_PER_LEVEL * l, reached: l });
  }
  levelRewarded = Math.max(levelRewarded, level);

  if (!events.length) return { wallet, profile, events };
  return {
    wallet: { ...wallet, balance: wallet.balance + credit },
    profile: { ...profile, missions, achievements, levelRewarded },
    events,
  };
}

/** Everything the progress UI needs, derived in one place. */
export function progressSnapshot(wallet, profile, ctx, anchor) {
  const xp = totalXp(wallet.bets, profile);
  return {
    xp,
    level: levelFor(xp),
    skill: skill(wallet.bets),
    streaks: streaks(wallet.bets),
    nights: nightSummaries(wallet.bets),
    missions: anchor ? missionProgress(anchor, wallet.bets, ctx, profile) : [],
    achievements: ACHIEVEMENTS.map(({ check, ...a }) => ({ ...a, unlockedAt: profile.achievements[a.id] || null })),
  };
}
