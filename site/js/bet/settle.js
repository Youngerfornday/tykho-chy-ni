// Settles bets against results.json. Proof of an alert settles immediately;
// proof of absence waits until the data covers the window (docs/betting.md).

export const TOLERANCE = 900;
export const VOID_AFTER = 10 * 24 * 3600;

function hasAlert(night, region, from, to) {
  const record = night.regions[region];
  return Boolean(record && record.alerts.some(([s, e]) => s < to && e > from));
}

function absent(night, region, from, to) {
  const record = night.regions[region];
  return Boolean(record && record.no_known_until >= to - TOLERANCE && !hasAlert(night, region, from, to));
}

// Outcome of the underlying event: true happened, false did not, null unknown yet.
function eventOutcome(leg, placedAt, night, ctx) {
  const [kind, region] = leg.key.split('|');
  const to = night.window_end;
  const from = Math.max(placedAt, kind === 'quiet_late' ? night.late_start : night.window_start);
  if (from >= to) return null;

  if (kind === 'alarm') {
    if (hasAlert(night, region, from, to)) return true;
    return absent(night, region, from, to) ? false : null;
  }
  if (kind === 'quiet_late') {
    if (hasAlert(night, region, from, to)) return false;
    return absent(night, region, from, to) ? true : null;
  }
  if (kind === 'west_quiet') {
    if (ctx.west.some((r) => hasAlert(night, r, from, to))) return false;
    return ctx.west.every((r) => absent(night, r, from, to)) ? true : null;
  }
  if (kind === 'total_over') {
    const loud = ctx.regions.filter((r) => hasAlert(night, r, from, to)).length;
    if (loud > leg.line) return true;
    const settled = ctx.regions.every((r) => hasAlert(night, r, from, to) || absent(night, r, from, to));
    return settled ? false : null;
  }
  return null;
}

/** @returns {'won'|'lost'|'open'|'void'} */
export function settleLeg(leg, placedAt, night, ctx, windowEnd = night?.window_end) {
  const outcome = night ? eventOutcome(leg, placedAt, night, ctx) : null;
  if (outcome === null) return windowEnd && ctx.now > windowEnd + VOID_AFTER ? 'void' : 'open';
  return outcome === (leg.pick === 'yes') ? 'won' : 'lost';
}

export function settleBet(bet, results, ctx) {
  if (bet.status !== 'pending') return bet;
  const night = results?.nights?.[bet.anchor] || null;
  const legStatus = bet.legs.map((leg) => settleLeg(leg, bet.placedAt, night, ctx, bet.windowEnd));

  let status = 'pending';
  if (legStatus.includes('lost')) status = 'lost';
  else if (legStatus.every((s) => s === 'won')) status = 'won';
  else if (!legStatus.includes('open')) status = 'void';

  const payout = status === 'won' ? Math.round(bet.stake * bet.odds) : status === 'void' ? bet.stake : 0;
  return {
    ...bet,
    legStatus,
    status,
    payout,
    settledAt: status === 'pending' ? null : ctx.now,
  };
}
