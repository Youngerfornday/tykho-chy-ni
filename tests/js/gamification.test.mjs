import { test } from 'node:test';
import assert from 'node:assert/strict';

import { levelFor, nightSummaries, skill, streaks, totalXp, xpFromBets } from '../../site/js/bet/progress.js';
import { MISSION_POOL, missionDone, missionsFor } from '../../site/js/bet/missions.js';
import { ACHIEVEMENTS, newlyUnlocked } from '../../site/js/bet/achievements.js';
import { applyGamification, createProfile, parseProfile } from '../../site/js/bet/profile.js';

const WEST = ['Львівська область', 'Волинська область'];
const ctx = { now: 2000000000, west: WEST };
let seq = 0;
function bet(over = {}) {
  seq += 1;
  return {
    id: `b${seq}`, anchor: '2026-09-10', placedAt: 1000, windowStart: 2000, windowEnd: 30000, kind: 'single',
    stake: 100, odds: 2, balanceBefore: 1000, status: 'won', payout: 200, settledAt: 40000,
    legs: [{ key: 'alarm|м. Київ', pick: 'yes', line: null, odds: 2 }],
    ...over,
  };
}

test('levels step through thresholds with progress to the next one', () => {
  assert.deepEqual([levelFor(0).level, levelFor(99).level, levelFor(100).level, levelFor(6000).level], [1, 1, 2, 7]);
  assert.equal(levelFor(200).progress, 0.5);
  assert.equal(levelFor(9999).next, null);
  assert.equal(levelFor(100).name, 'Спостерігач');
});

test('bet XP rewards settled bets, upsets a bit more, and caps each night at five bets', () => {
  assert.equal(xpFromBets([bet({ odds: 4, payout: 400 })]), 10 + 30);
  assert.equal(xpFromBets([bet({ status: 'lost', payout: 0 })]), 10);
  assert.equal(xpFromBets([bet({ status: 'pending', payout: 0 }), bet({ status: 'void', payout: 100 })]), 0);
  const many = Array.from({ length: 8 }, (_, i) => bet({ status: 'lost', payout: 0, settledAt: 40000 + i }));
  assert.equal(xpFromBets(many), 50);
  const profile = { ...createProfile(), missions: { a: ['x', 'y'] }, achievements: { first_bet: 1 } };
  assert.equal(totalXp([], profile), 40 + 50);
});

test('skill compares actual hit rate with the rate implied by odds', () => {
  const bets = [bet({ odds: 2 }), bet({ odds: 2, status: 'lost', payout: 0 }), bet({ odds: 4, payout: 400 }), bet({ odds: 4, status: 'void', payout: 100 })];
  const s = skill(bets);
  assert.equal(s.n, 3);
  assert.ok(Math.abs(s.actual - 2 / 3) < 1e-9);
  assert.ok(Math.abs(s.expected - (0.5 + 0.5 + 0.25) / 3) < 1e-9);
  assert.equal(s.enough, false);
  assert.ok(Math.abs(s.roi - (600 - 300) / 300) < 1e-9);
});

test('nights and streaks use closed nights on adjacent dates', () => {
  const bets = [
    bet({ anchor: '2026-09-08' }),
    bet({ anchor: '2026-09-09' }),
    bet({ anchor: '2026-09-10' }),
    bet({ anchor: '2026-09-12' }),
    bet({ anchor: '2026-09-13', status: 'pending', payout: 0 }),
  ];
  const nights = nightSummaries(bets);
  assert.equal(nights[0].anchor, '2026-09-13');
  assert.equal(nights[0].pending, 1);
  assert.deepEqual(streaks(bets), { current: 1, best: 3 });
  assert.deepEqual(streaks([bet({ anchor: '2026-09-12', status: 'lost', payout: 0 })]), { current: 0, best: 0 });
});

test('three distinct missions per night, stable for the same anchor', () => {
  const a = missionsFor('2026-09-13').map((m) => m.id);
  assert.equal(new Set(a).size, 3);
  assert.deepEqual(missionsFor('2026-09-13').map((m) => m.id), a);
  const spread = new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].flatMap((d) => missionsFor(d).map((m) => m.id)));
  assert.ok(spread.size >= 5);
  assert.equal(MISSION_POOL.length, 8);
});

test('mission conditions', () => {
  assert.equal(missionDone('early_bird', [bet({ placedAt: 1999 })], ctx), true);
  assert.equal(missionDone('early_bird', [bet({ placedAt: 2000 })], ctx), false);
  assert.equal(missionDone('west_pick', [bet({ legs: [{ key: 'alarm|Львівська область', pick: 'no' }] })], ctx), true);
  assert.equal(missionDone('express2', [bet({ kind: 'express', legs: [{ key: 'west_quiet', pick: 'yes' }, { key: 'total_over', pick: 'yes', line: 12.5 }] })], ctx), true);
  assert.equal(missionDone('cool_head', [bet({ stake: 100, balanceBefore: 1000 })], ctx), true);
  assert.equal(missionDone('cool_head', [bet({ stake: 101, balanceBefore: 1000 })], ctx), false);
  assert.equal(missionDone('underdog', [bet({ odds: 3 })], ctx), true);
  const three = [bet({ legs: [{ key: 'alarm|A', pick: 'yes' }, { key: 'quiet_late|B', pick: 'yes' }] }), bet({ legs: [{ key: 'alarm|C', pick: 'no' }] })];
  assert.equal(missionDone('three_regions', three, ctx), true);
});

test('achievements unlock once from bet history', () => {
  const bets = [bet({ legs: [{ key: 'alarm|м. Київ', pick: 'no' }] }), bet({ kind: 'express', status: 'won', legs: [{ key: 'alarm|A', pick: 'yes' }, { key: 'alarm|B', pick: 'yes' }, { key: 'alarm|C', pick: 'yes' }] })];
  const ids = newlyUnlocked(bets, createProfile(), ctx).map((a) => a.id);
  assert.ok(ids.includes('first_bet') && ids.includes('first_win') && ids.includes('quiet_call') && ids.includes('express3'));
  assert.ok(!ids.includes('week'));
  const seen = { ...createProfile(), achievements: Object.fromEntries(ids.map((id) => [id, 1])) };
  assert.equal(newlyUnlocked(bets, seen, ctx).length, 0);
  assert.equal(ACHIEVEMENTS.length, 11);
});

test('flawless night needs a closed night with three wins and no losses, whatever the stake', () => {
  const night = (statuses) => statuses.map((status) => bet({ anchor: '2026-09-11', stake: 10, status, payout: status === 'won' ? 20 : 0 }));
  const has = (bets) => newlyUnlocked(bets, createProfile(), ctx).some((a) => a.id === 'flawless_night');
  assert.equal(has(night(['won', 'won', 'won'])), true);
  assert.equal(has(night(['won', 'won', 'lost'])), false);
  assert.equal(has(night(['won', 'won', 'pending'])), false);
  assert.ok(!ACHIEVEMENTS.some((a) => a.id === 'big_night'));
});

test('applyGamification credits missions, achievements and level-ups exactly once', () => {
  const anchor = '2026-09-13';
  const bets = [bet({ anchor, placedAt: 1000, status: 'pending', payout: 0, odds: 3, stake: 50, balanceBefore: 1000 })];
  const wallet = { version: 1, balance: 950, bonusDay: '2026-09-13', bets };
  const first = applyGamification(wallet, createProfile(), ctx);
  const types = first.events.map((e) => e.type);
  assert.ok(types.includes('achievement'));
  assert.ok(first.wallet.balance > 950);
  assert.equal(wallet.balance, 950);
  const again = applyGamification(first.wallet, first.profile, ctx);
  assert.equal(again.events.length, 0);
  assert.equal(again.wallet.balance, first.wallet.balance);
});

test('profile parser rejects garbage', () => {
  assert.deepEqual(parseProfile('nope'), createProfile());
  assert.deepEqual(parseProfile(JSON.stringify({ version: 1, achievements: { a: 1 }, missions: { d: ['x', 3] }, levelRewarded: 2, introDismissed: true })).missions, { d: ['x'] });
});
