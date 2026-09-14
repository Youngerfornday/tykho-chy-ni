// Play app entry: shell, hash router, screens, data refresh and settlement ticks.

import { mountNightScene } from '../art.js';
import { BADGES } from '../badges.js';
import { createBetStore } from '../bet/store.js';
import { createToaster } from '../bet/toast.js';
import { quoteSelection } from '../bet/pricing.js';
import { loadForecast, loadResults, REFRESH_MS, staleMessage, TICK_MS } from './data.js';
import { parseDeepLink, routeFromHash, visibleScreens } from './deepLink.js';
import { createLineScreen } from './lineScreen.js';
import { createCouponScreen } from './couponScreen.js';
import { createBetsScreen } from './betsScreen.js';
import { createProgressScreen } from './progressScreen.js';
import { createRail } from './rail.js';
import { emblemFor, mountShell } from './shell.js';

const $ = (id) => document.getElementById(id);
const desktopQuery = window.matchMedia('(min-width: 1024px)');
const nowSeconds = () => Math.floor(Date.now() / 1000);
const CELEBRATION = { won: 'win', achievement: 'achievement', levelUp: 'level' };

function createRouter({ shell, rail, screens }) {
  let current = null;
  function apply({ focus = true } = {}) {
    const route = routeFromHash(window.location.hash);
    const visible = visibleScreens(route, desktopQuery.matches);
    Object.entries(screens).forEach(([id, el]) => { el.hidden = !visible.includes(id); });
    $('app').dataset.route = route;
    shell.setRoute(route);
    rail.setRoute(route);
    if (route === current) return;
    current = route;
    $('main').scrollTop = 0;
    if (focus) $(`screen-${route}-title`)?.focus({ preventScroll: true });
  }
  const navigate = (route) => {
    if (routeFromHash(window.location.hash) === route) { apply(); return; }
    window.location.hash = route;
  };
  window.addEventListener('hashchange', () => apply());
  window.addEventListener('keydown', () => { document.body.dataset.input = 'key'; }, { passive: true });
  window.addEventListener('pointerdown', () => { document.body.dataset.input = 'pointer'; }, { passive: true });
  desktopQuery.addEventListener('change', () => apply({ focus: false }));
  return { apply, navigate };
}

async function start() {
  const scene = mountNightScene($('sky-art'), { date: new Date(), intensity: 0.2 });
  const toast = createToaster($('toasts'), { badgeFor: (id) => BADGES?.[id]?.({ size: 48 }) ?? null, emblemFor: (level) => emblemFor(level, 48) });
  const store = createBetStore({
    onEvent: (event) => {
      toast(event);
      const kind = CELEBRATION[event.type];
      if (kind) scene.celebrate?.(kind);
    },
  });

  let data;
  const screens = { line: $('screen-line'), coupon: $('screen-coupon'), bets: $('screen-bets'), progress: $('screen-progress') };
  let navigate = () => {};
  const late = (route) => navigate(route);
  const line = createLineScreen(screens.line, store, { navigate: late });
  const coupon = createCouponScreen(screens.coupon, store, { navigate: late });
  const bets = createBetsScreen(screens.bets, store, { intensity: () => data?.national?.intensity ?? 0.3 });
  const progress = createProgressScreen(screens.progress, store);
  const rail = createRail($('rail'), store, { navigate: late });
  const shell = mountShell(store, { navigate: late });
  const router = createRouter({ shell, rail, screens });
  navigate = router.navigate;
  router.apply({ focus: false });

  store.subscribe((state) => {
    shell.update(state);
    line.sync(state);
    coupon.render(state);
    bets.render(state);
    progress.render(state);
    rail.render();
  });
  shell.update(store.state);
  coupon.render(store.state);
  bets.render(store.state);
  progress.render(store.state);
  rail.render();
  shell.tick(nowSeconds());

  let results;
  try {
    [data, results] = await Promise.all([loadForecast(), loadResults()]);
  } catch (error) {
    line.showError();
    shell.tick(nowSeconds());
    throw error;
  }
  store.setData(data, results);
  scene.setIntensity(data.national.intensity);
  line.setData(data, staleMessage(data));
  line.sync(store.state);
  shell.tick(nowSeconds());
  if (store.bonusGranted > 0) toast({ type: 'bonus', balance: store.state.wallet.balance });

  const link = parseDeepLink(window.location.search);
  if (link.region) line.presetRegion(link.region);
  if (link.market && store.state.line) {
    const q = quoteSelection(store.state.line, link.market.key, link.market.pick);
    if (!q.suspended) {
      store.toggle({ key: link.market.key, pick: link.market.pick, odds: q.odds, line: link.market.key === 'total_over' ? store.state.line.total_line : null });
      navigate('coupon');
    }
  }
  if (link.region || link.market) window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);

  window.setInterval(() => shell.tick(nowSeconds()), 1000);
  window.setInterval(() => {
    line.setStale(staleMessage(data));
    store.settle();
    coupon.render(store.state);
  }, TICK_MS);
  window.setInterval(async () => {
    try {
      const [fresh, freshResults] = await Promise.all([loadForecast(), loadResults()]);
      const changed = fresh.generated_at !== data.generated_at;
      data = fresh;
      store.setData(data, freshResults);
      if (changed) {
        scene.setIntensity(data.national.intensity);
        line.setData(data, staleMessage(data));
      }
    } catch { /* keep the last good line; the stale note covers it */ }
  }, REFRESH_MS);
}

start().catch(() => { /* error state already rendered */ });
