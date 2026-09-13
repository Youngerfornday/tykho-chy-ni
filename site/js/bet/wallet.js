// Play-money wallet: pure state transitions plus a validating parser for storage.

export const START_BALANCE = 1000;
export const STORAGE_KEY = 'tcn.wallet.v1';
const STATUSES = new Set(['pending', 'won', 'lost', 'void']);

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });
export const kyivDay = (epochMs) => dayFmt.format(new Date(epochMs));

export function createWallet(today) {
  return { version: 1, balance: START_BALANCE, bonusDay: today, bets: [] };
}

function isLeg(leg) {
  return leg && typeof leg.key === 'string' && (leg.pick === 'yes' || leg.pick === 'no');
}

function isBet(bet) {
  return bet && typeof bet.id === 'string' && Number.isFinite(bet.placedAt) && typeof bet.anchor === 'string'
    && Number.isFinite(bet.windowEnd) && (bet.kind === 'single' || bet.kind === 'express')
    && Number.isInteger(bet.stake) && bet.stake > 0 && Number.isFinite(bet.odds)
    && Array.isArray(bet.legs) && bet.legs.length > 0 && bet.legs.every(isLeg)
    && STATUSES.has(bet.status) && Number.isFinite(bet.payout);
}

export function parseWallet(raw, today) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Number.isFinite(data.balance) || !Array.isArray(data.bets)) return createWallet(today);
    return {
      version: 1,
      balance: Math.max(0, Math.round(data.balance)),
      bonusDay: typeof data.bonusDay === 'string' ? data.bonusDay : today,
      bets: data.bets.filter(isBet),
    };
  } catch {
    return createWallet(today);
  }
}

export function applyDailyBonus(wallet, today) {
  if (wallet.bonusDay === today) return { wallet, bonus: 0 };
  const bonus = Math.max(0, START_BALANCE - wallet.balance);
  return { wallet: { ...wallet, balance: wallet.balance + bonus, bonusDay: today }, bonus };
}

export function placeBets(wallet, tickets) {
  const total = tickets.reduce((sum, t) => sum + t.stake, 0);
  if (!tickets.length || total > wallet.balance) throw new Error('insufficient balance');
  return { ...wallet, balance: wallet.balance - total, bets: [...tickets, ...wallet.bets] };
}

/** Credits payouts for bets that just left `pending`. */
export function applySettlement(wallet, settledBets) {
  const byId = new Map(settledBets.map((b) => [b.id, b]));
  const events = [];
  const bets = wallet.bets.map((bet) => {
    const next = byId.get(bet.id);
    if (!next || bet.status !== 'pending' || next.status === 'pending') return bet;
    events.push({ bet: next, delta: next.payout });
    return next;
  });
  const credit = events.reduce((sum, e) => sum + e.delta, 0);
  return { wallet: { ...wallet, balance: wallet.balance + credit, bets }, events };
}

export function walletStats(wallet) {
  const settled = wallet.bets.filter((b) => b.status === 'won' || b.status === 'lost');
  const staked = settled.reduce((sum, b) => sum + b.stake, 0);
  const returned = settled.reduce((sum, b) => sum + b.payout, 0);
  return {
    pending: wallet.bets.filter((b) => b.status === 'pending').length,
    won: settled.filter((b) => b.status === 'won').length,
    lost: settled.filter((b) => b.status === 'lost').length,
    roi: staked ? (returned - staked) / staked : null,
    biggestWin: settled.reduce((max, b) => Math.max(max, b.payout - b.stake), 0),
  };
}
