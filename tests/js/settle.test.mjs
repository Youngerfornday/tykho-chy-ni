import { test } from 'node:test';
import assert from 'node:assert/strict';

import { settleBet, settleLeg, TOLERANCE, VOID_AFTER } from '../../site/js/bet/settle.js';

const WS = 1000000;
const LATE = WS + 7200;
const END = WS + 8 * 3600;
const REGIONS = ['A', 'B', 'W1', 'W2'];
const WEST = ['W1', 'W2'];
const ctx = (now) => ({ now, regions: REGIONS, west: WEST });

function night(regions) {
  return { window_start: WS, late_start: LATE, window_end: END, regions };
}
const known = (alerts = [], noKnown = END) => ({ yes_known_until: END, no_known_until: noKnown, alerts });

test('alarm yes wins as soon as an alert inside the bet window is known', () => {
  const n = night({ A: known([[WS + 600, WS + 1800]], WS + 2000) });
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'yes' }, WS - 3600, n, ctx(WS + 2000)), 'won');
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'no' }, WS - 3600, n, ctx(WS + 2000)), 'lost');
});

test('alerts before placement do not count', () => {
  const n = night({ A: known([[WS + 600, WS + 1800]], WS + 2000) });
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'yes' }, WS + 1800, n, ctx(WS + 2000)), 'open');
});

test('absence needs data coverage up to the end minus tolerance', () => {
  const almost = night({ A: known([], END - TOLERANCE) });
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'no' }, WS, almost, ctx(END + 60)), 'won');
  const short = night({ A: known([], END - TOLERANCE - 1) });
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'no' }, WS, short, ctx(END + 60)), 'open');
});

test('quiet_late counts only from 01:00 or placement', () => {
  const n = night({ A: known([[WS + 600, WS + 1200]]) });
  assert.equal(settleLeg({ key: 'quiet_late|A', pick: 'yes' }, WS, n, ctx(END + 60)), 'won');
  const loud = night({ A: known([[LATE + 60, LATE + 600]], LATE + 700) });
  assert.equal(settleLeg({ key: 'quiet_late|A', pick: 'yes' }, WS, loud, ctx(LATE + 700)), 'lost');
});

test('west_quiet needs every western region', () => {
  const quiet = night({ W1: known(), W2: known() });
  assert.equal(settleLeg({ key: 'west_quiet', pick: 'yes' }, WS, quiet, ctx(END + 60)), 'won');
  const partial = night({ W1: known(), W2: known([], WS) });
  assert.equal(settleLeg({ key: 'west_quiet', pick: 'yes' }, WS, partial, ctx(END + 60)), 'open');
  const loud = night({ W1: known([[WS + 10, WS + 20]], WS + 30), W2: known([], WS) });
  assert.equal(settleLeg({ key: 'west_quiet', pick: 'no' }, WS, loud, ctx(WS + 30)), 'won');
});

test('total_over settles early for over and at the end for under', () => {
  const alert = [[WS + 10, WS + 20]];
  const early = night({ A: known(alert, WS), B: known(alert, WS), W1: known(alert, WS), W2: known([], WS) });
  assert.equal(settleLeg({ key: 'total_over', pick: 'yes', line: 2.5 }, WS, early, ctx(WS + 30)), 'won');
  const unknown = night({ A: known(alert, WS), B: known([], WS), W1: known(), W2: known() });
  assert.equal(settleLeg({ key: 'total_over', pick: 'no', line: 2.5 }, WS, unknown, ctx(END)), 'open');
  const final = night({ A: known(alert), B: known(), W1: known(), W2: known() });
  assert.equal(settleLeg({ key: 'total_over', pick: 'no', line: 2.5 }, WS, final, ctx(END)), 'won');
});

test('missing results void after the grace period', () => {
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'yes' }, WS, null, ctx(END + 60), END), 'open');
  assert.equal(settleLeg({ key: 'alarm|A', pick: 'yes' }, WS, null, ctx(END + VOID_AFTER + 1), END), 'void');
});

const bet = (legs, kind = legs.length > 1 ? 'express' : 'single') => ({
  id: 'b1', placedAt: WS, anchor: '2026-09-13', windowEnd: END, kind, stake: 100, odds: 3.1, legs, status: 'pending', payout: 0,
});

test('single and express payouts', () => {
  const results = { nights: { '2026-09-13': night({ A: known([[WS + 10, WS + 20]]), B: known() }) } };
  const won = settleBet(bet([{ key: 'alarm|A', pick: 'yes' }]), results, ctx(END + 60));
  assert.equal(won.status, 'won');
  assert.equal(won.payout, 310);
  const lost = settleBet(bet([{ key: 'alarm|A', pick: 'yes' }, { key: 'alarm|B', pick: 'yes' }]), results, ctx(END + 60));
  assert.equal(lost.status, 'lost');
  assert.equal(lost.payout, 0);
  assert.deepEqual(lost.legStatus, ['won', 'lost']);
});

test('express stays pending while a leg is open and never mutates the input', () => {
  const results = { nights: { '2026-09-13': night({ A: known([[WS + 10, WS + 20]], WS + 30), B: known([], WS + 30) }) } };
  const input = bet([{ key: 'alarm|A', pick: 'yes' }, { key: 'alarm|B', pick: 'no' }]);
  const out = settleBet(input, results, ctx(WS + 40));
  assert.equal(out.status, 'pending');
  assert.equal(input.legStatus, undefined);
  const voided = settleBet(input, { nights: {} }, ctx(END + VOID_AFTER + 5));
  assert.equal(voided.status, 'void');
  assert.equal(voided.payout, 100);
});
