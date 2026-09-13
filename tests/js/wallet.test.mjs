import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyDailyBonus, applySettlement, createWallet, parseWallet, placeBets, walletStats, START_BALANCE } from '../../site/js/bet/wallet.js';
import { addSelection, buildTickets, quoteSlip, removeSelection } from '../../site/js/bet/slip.js';

const line = {
  anchor: '2026-09-13', window_start: 100, late_start: 200, window_end: 1000, generated_at: 50, closes_after_seconds: 2100,
  total_line: 12.5, regions: ['A', 'B'], active_now: '00',
  columns: ['alarm|A', 'alarm|B', 'quiet_late|A', 'quiet_late|B', 'west_quiet', 'total_over'],
  params: { prior_strength: 3, own_state_mismatch: 0.1 },
  nights: [
    { r: 1, s: 1, act: '00', y: '110011' },
    { r: 1, s: 1, act: '00', y: '000011' },
    { r: 1, s: 1, act: '00', y: '110010' },
    { r: 1, s: 1, act: '00', y: '001100' },
  ],
};

test('daily bonus tops up only below the start balance, once per day', () => {
  const low = { ...createWallet('2026-09-12'), balance: 120 };
  const { wallet, bonus } = applyDailyBonus(low, '2026-09-13');
  assert.equal(wallet.balance, START_BALANCE);
  assert.equal(bonus, 880);
  assert.equal(applyDailyBonus(wallet, '2026-09-13').bonus, 0);
  assert.equal(low.balance, 120);
  const rich = { ...createWallet('2026-09-12'), balance: 1500 };
  assert.equal(applyDailyBonus(rich, '2026-09-13').wallet.balance, 1500);
});

test('corrupted storage falls back to a fresh wallet and drops malformed bets', () => {
  assert.equal(parseWallet('not json', '2026-09-13').balance, START_BALANCE);
  const raw = JSON.stringify({ version: 1, balance: 400, bonusDay: '2026-09-13', bets: [{ id: 'x' }, { id: 'ok', placedAt: 1, anchor: 'a', windowEnd: 2, kind: 'single', stake: 10, odds: 2, legs: [{ key: 'alarm|A', pick: 'yes' }], status: 'pending', payout: 0 }] });
  const wallet = parseWallet(raw, '2026-09-13');
  assert.equal(wallet.balance, 400);
  assert.equal(wallet.bets.length, 1);
});

test('slip toggles picks and replaces the opposite pick of the same market', () => {
  let slip = addSelection({ selections: [], mode: 'single', stake: 100 }, { key: 'alarm|A', pick: 'yes', odds: 2 });
  slip = addSelection(slip, { key: 'alarm|A', pick: 'no', odds: 2 });
  assert.deepEqual(slip.selections.map((s) => s.pick), ['no']);
  slip = removeSelection(slip, 'alarm|A');
  assert.equal(slip.selections.length, 0);
});

test('express quote prices legs jointly and flags odds changes', () => {
  let slip = { selections: [], mode: 'express', stake: 100 };
  slip = addSelection(slip, { key: 'alarm|A', pick: 'yes', odds: 2 });
  slip = addSelection(slip, { key: 'alarm|B', pick: 'yes', odds: 2 });
  const q = quoteSlip(slip, line, { now: 60, balance: 1000 });
  assert.equal(q.canPlace, true);
  assert.ok(q.express.odds < q.express.productOdds);
  assert.equal(q.potentialWin, Math.round(100 * q.express.odds));

  const stale = quoteSlip({ ...slip, selections: slip.selections.map((s) => ({ ...s, odds: 1.9 })) }, line, { now: 60, balance: 1000 });
  assert.ok(stale.legs.every((l) => l.changed));
  assert.equal(stale.canPlace, false);
});

test('closed line, low balance and impossible combos block placing', () => {
  const slip = { selections: [{ key: 'alarm|A', pick: 'yes', odds: 2 }], mode: 'single', stake: 100 };
  assert.equal(quoteSlip(slip, line, { now: 50 + 2101, balance: 1000 }).canPlace, false);
  assert.equal(quoteSlip({ ...slip, stake: 5000 }, line, { now: 60, balance: 1000 }).canPlace, false);
  const contradictory = { selections: [{ key: 'alarm|A', pick: 'yes', odds: 2 }, { key: 'quiet_late|A', pick: 'yes', odds: 2 }, { key: 'west_quiet', pick: 'no', odds: 2 }], mode: 'express', stake: 100 };
  const q = quoteSlip(contradictory, { ...line, nights: line.nights.slice(0, 3) }, { now: 60, balance: 1000 });
  assert.equal(q.canPlace, false);
});

test('placing and settling moves chips exactly once', () => {
  const slip = { selections: [{ key: 'alarm|A', pick: 'yes', odds: 2 }, { key: 'alarm|B', pick: 'no', odds: 2 }], mode: 'single', stake: 100 };
  const quote = quoteSlip(slip, line, { now: 60, balance: 1000 });
  let n = 0;
  const tickets = buildTickets(slip, quote, line, 60, () => `b${n++}`);
  assert.equal(tickets.length, 2);
  const placed = placeBets(createWallet('2026-09-13'), tickets);
  assert.equal(placed.balance, 800);
  const settled = placed.bets.map((b, i) => ({ ...b, status: i === 0 ? 'won' : 'lost', payout: i === 0 ? Math.round(b.stake * b.odds) : 0 }));
  const { wallet, events } = applySettlement(placed, settled);
  assert.equal(events.length, 2);
  assert.equal(wallet.balance, 800 + Math.round(100 * tickets[0].odds));
  assert.equal(applySettlement(wallet, wallet.bets).events.length, 0);
  const stats = walletStats(wallet);
  assert.equal(stats.won, 1);
  assert.equal(stats.lost, 1);
});
