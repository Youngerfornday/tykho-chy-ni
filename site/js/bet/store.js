// Betting state container: wallet, slip, line and results, with persistence and settlement.

import { settleBet } from './settle.js';
import { acceptOdds, addSelection, buildTickets, emptySlip, quoteSlip, removeSelection, setMode, setStake } from './slip.js';
import { applyDailyBonus, applySettlement, createWallet, kyivDay, parseWallet, placeBets, STORAGE_KEY } from './wallet.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

function makeId() {
  const random = globalThis.crypto?.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `b-${Date.now().toString(36)}-${random}`;
}

function openStorage() {
  try {
    const probe = '__tcn_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createBetStore({ onEvent = () => {} } = {}) {
  const storage = openStorage();
  const today = kyivDay(Date.now());
  const initial = storage ? parseWallet(storage.getItem(STORAGE_KEY), today) : createWallet(today);
  const bonus = applyDailyBonus(initial, today);

  let state = {
    wallet: bonus.wallet,
    slip: emptySlip(),
    line: null,
    results: null,
    ctx: { regions: [], west: [] },
    view: { open: false, tab: 'coupon', receipt: null, filter: 'active' },
    persistent: Boolean(storage),
  };
  const listeners = new Set();

  const persist = () => {
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state.wallet)); } catch { /* quota or privacy mode: keep in memory */ }
  };
  const emit = () => listeners.forEach((fn) => fn(state));
  const update = (patch, { save = false } = {}) => {
    state = { ...state, ...patch };
    if (save) persist();
    emit();
  };

  function settle() {
    if (!state.results) return;
    const ctx = { ...state.ctx, now: nowSeconds() };
    const settled = state.wallet.bets.filter((b) => b.status === 'pending').map((b) => settleBet(b, state.results, ctx));
    const { wallet, events } = applySettlement(state.wallet, settled);
    const legProgress = new Map(settled.map((b) => [b.id, b.legStatus]));
    const bets = wallet.bets.map((b) => (legProgress.has(b.id) ? { ...b, legStatus: legProgress.get(b.id) } : b));
    update({ wallet: { ...wallet, bets } }, { save: events.length > 0 });
    events.forEach((event) => onEvent({ type: event.bet.status, bet: event.bet }));
  }

  persist();
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.newValue == null) return;
    update({ wallet: parseWallet(event.newValue, kyivDay(Date.now())) });
  });

  const store = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    quote() { return quoteSlip(state.slip, state.line, { now: nowSeconds(), balance: state.wallet.balance }); },
    bonusGranted: bonus.bonus,

    setData(forecast, results) {
      update({ line: forecast.line || null, results: results || state.results, ctx: { regions: Object.keys(forecast.regions), west: forecast.west || [] } });
      settle();
    },
    toggle(selection) {
      const slip = addSelection(state.slip, selection);
      update({ slip, view: { ...state.view, receipt: null, tab: state.view.open ? 'coupon' : state.view.tab } });
    },
    remove(key) { update({ slip: removeSelection(state.slip, key) }); },
    clear() { update({ slip: { ...emptySlip(), mode: state.slip.mode, stake: state.slip.stake } }); },
    setMode(mode) { update({ slip: setMode(state.slip, mode) }); },
    setStake(stake) { update({ slip: setStake(state.slip, stake) }); },
    acceptOdds() { update({ slip: acceptOdds(state.slip, store.quote()) }); },
    place() {
      const quote = store.quote();
      if (!quote.canPlace) return false;
      const tickets = buildTickets(state.slip, quote, state.line, nowSeconds(), makeId);
      const wallet = placeBets(state.wallet, tickets);
      update({ wallet, slip: { ...emptySlip(), mode: state.slip.mode, stake: state.slip.stake }, view: { ...state.view, receipt: { tickets } } }, { save: true });
      onEvent({ type: 'placed', tickets });
      return true;
    },
    open(tab = state.view.tab) { update({ view: { ...state.view, open: true, tab } }); },
    close() { update({ view: { ...state.view, open: false } }); },
    setTab(tab) { update({ view: { ...state.view, tab, receipt: null } }); },
    setFilter(filter) { update({ view: { ...state.view, filter } }); },
    dismissReceipt() { update({ view: { ...state.view, receipt: null } }); },
    reset() { update({ wallet: createWallet(kyivDay(Date.now())), slip: emptySlip(), view: { ...state.view, receipt: null } }, { save: true }); },
    settle,
  };
  return store;
}
