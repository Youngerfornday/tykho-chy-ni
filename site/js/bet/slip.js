// Bet slip state (pure): selections, mode, stake, and a quote against the live line.

import { coherentPrice, EXPRESS_MAX_ODDS, IMPOSSIBLE_P, oddsFor, quoteSelection } from './pricing.js';

export const MIN_STAKE = 10;
export const MAX_LEGS = 6;
export const MAX_SELECTIONS = 12;

export const emptySlip = () => ({ selections: [], mode: 'single', stake: 100 });
export const SLIP_KEY = 'tcn.slip.v1';

const isSelection = (s) => s && typeof s.key === 'string' && (s.pick === 'yes' || s.pick === 'no')
  && Number.isFinite(s.odds) && (s.line == null || Number.isFinite(s.line));

export function serializeSlip(slip, anchor) {
  return JSON.stringify({ version: 1, anchor, slip });
}

/** @returns {{ anchor: string|null, slip: object } | null} a clean slip, or null for unreadable input */
export function parseSlip(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.slip) return null;
    const { selections, mode, stake } = data.slip;
    const base = emptySlip();
    return {
      anchor: typeof data.anchor === 'string' ? data.anchor : null,
      slip: {
        selections: Array.isArray(selections)
          ? selections.filter(isSelection).slice(0, MAX_SELECTIONS).map(({ key, pick, odds, line }) => ({ key, pick, odds, line: line ?? null }))
          : [],
        mode: mode === 'express' ? 'express' : 'single',
        stake: Number.isInteger(stake) && stake > 0 ? stake : base.stake,
      },
    };
  } catch {
    return null;
  }
}

export function addSelection(slip, selection) {
  const existing = slip.selections.find((s) => s.key === selection.key);
  if (existing && existing.pick === selection.pick) return removeSelection(slip, selection.key);
  const others = slip.selections.filter((s) => s.key !== selection.key);
  if (!existing && others.length >= MAX_SELECTIONS) return slip;
  return { ...slip, selections: [...others, selection] };
}

export const removeSelection = (slip, key) => ({ ...slip, selections: slip.selections.filter((s) => s.key !== key) });
export const setMode = (slip, mode) => ({ ...slip, mode });
export const setStake = (slip, stake) => ({ ...slip, stake: Math.max(0, Math.floor(Number(stake) || 0)) });
export const acceptOdds = (slip, quote) => ({
  ...slip,
  selections: slip.selections.map((s) => {
    const leg = quote.legs.find((l) => l.key === s.key);
    return leg && leg.odds ? { ...s, odds: leg.odds } : s;
  }),
});
export const isSelected = (slip, key, pick) => slip.selections.some((s) => s.key === key && s.pick === pick);

export function lineState(line, now) {
  if (!line) return { open: false, reason: 'Лінія ще не готова' };
  if (now >= line.window_end) return { open: false, reason: 'Ніч завершилась, нова лінія з наступним оновленням' };
  if (now - line.generated_at > line.closes_after_seconds) return { open: false, reason: 'Прийом зупинено: дані застаріли, чекаємо оновлення' };
  return { open: true, reason: '' };
}

function blockReason(slip, quote, balance) {
  if (!quote.line.open) return quote.line.reason;
  if (!slip.selections.length) return 'Оберіть коефіцієнт';
  if (quote.legs.some((l) => l.suspended)) return 'Одна з подій знята з прийому';
  if (quote.legs.some((l) => l.changed)) return 'Коефіцієнти змінилися';
  if (slip.stake < MIN_STAKE) return `Мінімальна ставка ${MIN_STAKE}`;
  if (quote.totalStake > balance) return 'Недостатньо фішок';
  if (slip.mode === 'express') {
    if (slip.selections.length < 2) return 'Для експресу потрібно 2 події';
    if (slip.selections.length > MAX_LEGS) return `В експресі до ${MAX_LEGS} подій`;
    if (!(quote.express.p >= IMPOSSIBLE_P)) return 'Така комбінація майже неможлива';
  }
  return '';
}

export function quoteSlip(slip, line, { now, balance }) {
  const state = lineState(line, now);
  const legs = slip.selections.map((s) => {
    const q = line ? quoteSelection(line, s.key, s.pick) : { suspended: true, odds: null, p: Number.NaN };
    return { ...s, p: q.p, suspended: q.suspended, current: q.odds, changed: Boolean(q.odds && q.odds !== s.odds) };
  });

  let express = null;
  if (slip.mode === 'express' && line && legs.length >= 2) {
    const { p, nEff } = coherentPrice(line, legs.map(({ key, pick }) => ({ key, pick })));
    const productOdds = Math.round(legs.reduce((acc, l) => acc * (l.current || 1), 1) * 100) / 100;
    express = { p, nEff, odds: oddsFor(p, EXPRESS_MAX_ODDS), productOdds };
  }

  const count = slip.mode === 'express' ? 1 : legs.length;
  const totalStake = slip.stake * count;
  const potentialWin = slip.mode === 'express'
    ? Math.round(slip.stake * (express ? express.odds : 0))
    : legs.reduce((sum, l) => sum + Math.round(slip.stake * (l.current || 0)), 0);

  const quote = { line: state, legs: legs.map((l) => ({ ...l, odds: l.current })), express, totalStake, potentialWin };
  const reason = blockReason(slip, { ...quote, legs }, balance);
  return { ...quote, canPlace: !reason, reason };
}

export function buildTickets(slip, quote, line, now, makeId, balanceBefore = null) {
  const base = { placedAt: now, anchor: line.anchor, windowStart: line.window_start, windowEnd: line.window_end, balanceBefore, status: 'pending', payout: 0, settledAt: null };
  const legOf = (l) => ({ key: l.key, pick: l.pick, line: l.key === 'total_over' ? line.total_line : null, odds: l.odds });
  if (slip.mode === 'express') {
    return [{ ...base, id: makeId(), kind: 'express', stake: slip.stake, odds: quote.express.odds, legs: quote.legs.map(legOf) }];
  }
  return quote.legs.map((l) => ({ ...base, id: makeId(), kind: 'single', stake: slip.stake, odds: l.odds, legs: [legOf(l)] }));
}
