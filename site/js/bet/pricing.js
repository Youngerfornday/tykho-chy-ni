// Prices single selections and accumulators from the analog-night matrix.
// Mirrors forecast/model.py so a one-leg price equals the published probability.

export const MIN_ODDS = 1.01;
export const SINGLE_MAX_ODDS = 50;
export const EXPRESS_MAX_ODDS = 100;
const SUSPEND_LOW = 0.015;
const SUSPEND_HIGH = 0.985;
export const IMPOSSIBLE_P = 0.005;

const columnCache = new WeakMap();

function columnsOf(line) {
  if (!columnCache.has(line)) {
    columnCache.set(line, new Map(line.columns.map((key, index) => [key, index])));
  }
  return columnCache.get(line);
}

export function regionOf(key) {
  const [kind, region] = key.split('|');
  return kind === 'alarm' || kind === 'quiet_late' ? region : null;
}

/** @returns {{index: number, wanted: '0'|'1', region: string|null} | null} */
export function legColumn(line, leg) {
  const index = columnsOf(line).get(leg.key);
  if (index === undefined) return null;
  return { index, wanted: leg.pick === 'yes' ? '1' : '0', region: regionOf(leg.key) };
}

/** @returns {{p: number, nEff: number}} */
export function price(line, legs) {
  const cols = legs.map((leg) => legColumn(line, leg));
  if (!cols.length || cols.some((c) => c === null)) return { p: Number.NaN, nEff: 0 };
  const regionIndexes = [...new Set(cols.map((c) => c.region).filter(Boolean))].map((r) => line.regions.indexOf(r));
  const { prior_strength: k, own_state_mismatch: mismatch } = line.params;

  let recTotal = 0;
  let recHit = 0;
  let wTotal = 0;
  let wHit = 0;
  let wSquares = 0;
  for (const night of line.nights) {
    if (cols.some((c) => night.y[c.index] === '-')) continue;
    const hit = cols.every((c) => night.y[c.index] === c.wanted);
    let own = 1;
    if (line.active_now) {
      for (const ri of regionIndexes) {
        const was = night.act[ri];
        if (was !== '-' && was !== line.active_now[ri]) own *= mismatch;
      }
    }
    const w = night.r * night.s * own;
    recTotal += night.r;
    wTotal += w;
    wSquares += w * w;
    if (hit) {
      recHit += night.r;
      wHit += w;
    }
  }
  if (recTotal <= 0) return { p: Number.NaN, nEff: 0 };
  const pBase = recHit / recTotal;
  return { p: (wHit + k * pBase) / (wTotal + k), nEff: wSquares > 0 ? (wTotal * wTotal) / wSquares : 0 };
}

/**
 * Joint price kept inside the Frechet bounds of its legs. Own-state weights multiply
 * across regions, so the raw joint estimate can exceed a single leg; clamp it.
 */
export function coherentPrice(line, legs) {
  const raw = price(line, legs);
  if (legs.length < 2 || !Number.isFinite(raw.p)) return raw;
  const singles = legs.map((leg) => price(line, [leg]).p);
  if (singles.some((v) => !Number.isFinite(v))) return { ...raw, p: Number.NaN };
  const lower = Math.max(0, singles.reduce((sum, v) => sum + v, 0) - (legs.length - 1));
  const upper = Math.min(...singles);
  return { ...raw, p: Math.min(upper, Math.max(lower, raw.p)) };
}

export function oddsFor(p, max) {
  if (!(p > 0)) return max;
  return Math.round(Math.min(max, Math.max(MIN_ODDS, 1 / p)) * 100) / 100;
}

export function selectionState(p) {
  const suspended = !Number.isFinite(p) || p < SUSPEND_LOW || p > SUSPEND_HIGH;
  return { suspended, odds: suspended ? null : oddsFor(p, SINGLE_MAX_ODDS) };
}

export function quoteSelection(line, key, pick) {
  const { p, nEff } = price(line, [{ key, pick }]);
  return { p, nEff, ...selectionState(p) };
}
