// Query-string deep links from the forecast page: ?market=<key>&pick=<yes|no>, ?region=<name>.

export const ROUTES = Object.freeze(['line', 'coupon', 'bets', 'progress']);

export function parseDeepLink(search) {
  const params = new URLSearchParams(search || '');
  const market = params.get('market');
  const pick = params.get('pick');
  const region = params.get('region');
  return {
    market: market && (pick === 'yes' || pick === 'no') ? { key: market, pick } : null,
    region: region ? region.trim() : null,
  };
}

export function routeFromHash(hash) {
  const id = (hash || '').replace(/^#/, '');
  return ROUTES.includes(id) ? id : 'line';
}

/** Which screens are visible for a route, on a phone (one) or desktop (three columns). */
export function visibleScreens(route, desktop) {
  if (!desktop) return [route];
  const center = route === 'progress' ? 'progress' : 'line';
  const side = route === 'bets' ? 'bets' : 'coupon';
  return [center, side];
}
