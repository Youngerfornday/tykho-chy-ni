import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILTERS, MACRO_REGIONS, macroOf, marketKeys } from '../../site/js/play/regions.js';
import { alertedRegions, countdownText, lineStatus, shouldShowSleepNote } from '../../site/js/play/notes.js';
import { parseDeepLink, routeFromHash, visibleScreens } from '../../site/js/play/deepLink.js';

const REGIONS = MACRO_REGIONS.flatMap((g) => g.regions);

test('macro regions cover the 24 forecast regions exactly once', () => {
  assert.equal(REGIONS.length, 24);
  assert.equal(new Set(REGIONS).size, 24);
  assert.equal(macroOf('м. Київ'), 'north');
  assert.equal(macroOf('Львівська область'), 'west');
  assert.equal(macroOf('Луганська область'), null);
  assert.deepEqual(FILTERS.map((f) => f.id), ['main', 'west', 'center', 'north', 'east', 'south', 'quiet_late']);
});

test('market keys follow the filter and the search wins over it', () => {
  const main = marketKeys('main', '', REGIONS);
  assert.deepEqual(main.featured, ['west_quiet', 'total_over', 'alarm|м. Київ', 'alarm|Київська область']);
  assert.ok(main.rows.includes('alarm|Одеська область'));
  const west = marketKeys('west', '', REGIONS);
  assert.equal(west.rows.length, 7);
  assert.ok(west.rows.every((k) => k.startsWith('alarm|')));
  assert.equal(marketKeys('quiet_late', '', REGIONS).rows.length, 24);
  const search = marketKeys('west', 'киї', REGIONS);
  assert.deepEqual(search.rows, ['alarm|м. Київ', 'quiet_late|м. Київ', 'alarm|Київська область', 'quiet_late|Київська область']);
  assert.deepEqual(marketKeys('nope', '', REGIONS).rows, []);
});

test('countdown formats hours, minutes and seconds and never goes negative', () => {
  assert.equal(countdownText(3661), '1:01:01');
  assert.equal(countdownText(59), '0:00:59');
  assert.equal(countdownText(-5), '0:00:00');
});

test('alerted regions come from the slip and the live state', () => {
  const line = { regions: ['A', 'B', 'C'], active_now: '010' };
  const slip = [{ key: 'alarm|A', pick: 'yes' }, { key: 'quiet_late|B', pick: 'yes' }, { key: 'west_quiet', pick: 'yes' }];
  assert.deepEqual(alertedRegions(line, slip), ['B']);
  assert.deepEqual(alertedRegions({ ...line, active_now: null }, slip), []);
  assert.deepEqual(alertedRegions(null, slip), []);
});

test('sleep note shows only between 00:30 and 07:00 Kyiv with pending bets', () => {
  const at = (iso) => Date.parse(iso);
  assert.equal(shouldShowSleepNote(at('2026-09-13T21:45:00Z'), 1), true); // 00:45 Kyiv (UTC+3)
  assert.equal(shouldShowSleepNote(at('2026-09-13T21:15:00Z'), 1), false); // 00:15 Kyiv
  assert.equal(shouldShowSleepNote(at('2026-09-14T04:30:00Z'), 1), false); // 07:30 Kyiv
  assert.equal(shouldShowSleepNote(at('2026-09-13T21:45:00Z'), 0), false);
});

test('line status reports open with a countdown, or the closed reason', () => {
  const line = { window_end: 10000, generated_at: 5000, closes_after_seconds: 3300 };
  assert.deepEqual(lineStatus(line, 6000), { open: true, text: 'Лінія відкрита до 07:00', seconds: 4000 });
  assert.equal(lineStatus(line, 10000).open, false);
  assert.match(lineStatus(line, 9000).text, /застаріли/);
  assert.equal(lineStatus(null, 1).open, false);
});

test('deep links parse market picks and regions, and routes fall back to the line', () => {
  assert.deepEqual(parseDeepLink('?market=alarm%7C%D0%BC.%20%D0%9A%D0%B8%D1%97%D0%B2&pick=yes'), { market: { key: 'alarm|м. Київ', pick: 'yes' }, region: null });
  assert.deepEqual(parseDeepLink('?market=x&pick=maybe'), { market: null, region: null });
  assert.equal(parseDeepLink('?region=%D0%9B%D1%8C%D0%B2%D1%96%D0%B2%D1%81%D1%8C%D0%BA%D0%B0%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C').region, 'Львівська область');
  assert.equal(routeFromHash('#bets'), 'bets');
  assert.equal(routeFromHash('#nope'), 'line');
  assert.deepEqual(visibleScreens('coupon', false), ['coupon']);
  assert.deepEqual(visibleScreens('progress', true), ['progress', 'coupon']);
  assert.deepEqual(visibleScreens('bets', true), ['line', 'bets']);
});
