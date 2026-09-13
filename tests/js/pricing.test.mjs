import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { coherentPrice, legColumn, oddsFor, price, selectionState } from '../../site/js/bet/pricing.js';

const line = {
  regions: ['A', 'B'],
  active_now: '10',
  columns: ['alarm|A', 'alarm|B', 'quiet_late|A', 'quiet_late|B', 'west_quiet', 'total_over'],
  params: { prior_strength: 3, own_state_mismatch: 0.1 },
  nights: [
    { r: 1, s: 1, act: '10', y: '110010' },
    { r: 1, s: 1, act: '00', y: '000011' },
    { r: 0.5, s: 0.5, act: '1-', y: '1-0-0-' },
  ],
};

test('single leg follows the shrinkage formula with own-state weighting', () => {
  // A alarm yes: nights 1 (hit, own 1), 2 (miss, own .1), 3 (hit, own 1, w .25)
  const wHit = 1 + 0.25;
  const wTotal = 1 + 0.1 + 0.25;
  const pBase = (1 + 0.5) / 2.5;
  const expected = (wHit + 3 * pBase) / (wTotal + 3);
  assert.ok(Math.abs(price(line, [{ key: 'alarm|A', pick: 'yes' }]).p - expected) < 1e-9);
});

test('uncovered nights are skipped for legs that need them', () => {
  const { p } = price(line, [{ key: 'alarm|B', pick: 'yes' }]);
  // nights 1 and 2 only; B active_now is 0 so night 1 (act 0) own 1, night 2 own 1
  const expected = (1 + 3 * 0.5) / (2 + 3);
  assert.ok(Math.abs(p - expected) < 1e-9);
});

test('joint legs use night outcomes, so correlated pairs are not multiplied', () => {
  const both = price(line, [{ key: 'alarm|A', pick: 'yes' }, { key: 'alarm|B', pick: 'yes' }]).p;
  const a = price(line, [{ key: 'alarm|A', pick: 'yes' }]).p;
  const b = price(line, [{ key: 'alarm|B', pick: 'yes' }]).p;
  assert.ok(both > a * b);
});

test('total_over picks map to over and under', () => {
  assert.deepEqual(legColumn(line, { key: 'total_over', pick: 'yes' }), { index: 5, wanted: '1', region: null });
  assert.deepEqual(legColumn(line, { key: 'total_over', pick: 'no' }), { index: 5, wanted: '0', region: null });
  assert.equal(legColumn(line, { key: 'alarm|Z', pick: 'yes' }), null);
});

test('odds are fair, rounded and clamped', () => {
  assert.equal(oddsFor(0.5, 50), 2);
  assert.equal(oddsFor(0.999, 50), 1.01);
  assert.equal(oddsFor(0.001, 50), 50);
  assert.equal(oddsFor(0.001, 100), 100);
  assert.equal(oddsFor(0.3333, 50), 3);
});

test('selection state suspends near-certain outcomes', () => {
  assert.equal(selectionState(0.5).suspended, false);
  assert.equal(selectionState(0.99).suspended, true);
  assert.equal(selectionState(0.01).suspended, true);
  assert.equal(selectionState(Number.NaN).suspended, true);
});

const fixturePath = new URL('../fixtures/pricing_case.json', import.meta.url);
test('matches the Python reference pricing fixture', { skip: !existsSync(fixturePath) }, () => {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  for (const c of fixture.cases) {
    const legs = c.legs.map(([key, wanted]) => ({ key, pick: wanted === 1 ? 'yes' : 'no' }));
    const { p } = price(fixture.line, legs);
    assert.ok(Math.abs(p - c.p) < 1e-3, `${JSON.stringify(c.legs)}: ${p} vs ${c.p}`);
    if (c.p_coherent != null) {
      const coherent = coherentPrice(fixture.line, legs).p;
      assert.ok(Math.abs(coherent - c.p_coherent) < 1e-3, `coherent ${JSON.stringify(c.legs)}: ${coherent} vs ${c.p_coherent}`);
    }
  }
});

test('joint price never exceeds its most likely-to-fail leg', () => {
  const legs = [{ key: 'alarm|A', pick: 'yes' }, { key: 'alarm|B', pick: 'yes' }];
  const joint = coherentPrice(line, legs).p;
  const singles = legs.map((leg) => price(line, [leg]).p);
  assert.ok(joint <= Math.min(...singles) + 1e-12);
  assert.ok(joint >= Math.max(0, singles[0] + singles[1] - 1) - 1e-12);
});
