// Data loading for the play app: cache-busted fetches, schema checks, stale wording.
// Paths are relative to /play/, so the data lives one level up.

import { clock } from '../format.js';

const SCHEMA_VERSION = 1;
export const STALE_AFTER_MS = 75 * 60 * 1000;
export const REFRESH_MS = 5 * 60 * 1000;
export const TICK_MS = 60 * 1000;

async function loadJson(path) {
  const bust = Math.floor(Date.now() / 60000);
  const response = await fetch(`${path}?v=${bust}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

export const isForecast = (d) => Boolean(d && d.version === SCHEMA_VERSION && d.regions && d.national && d.window && d.line && Array.isArray(d.line.columns));
export const isResults = (d) => Boolean(d && d.version === 1 && d.nights && typeof d.nights === 'object');

export async function loadForecast() {
  const data = await loadJson('../data/forecast.json');
  if (!isForecast(data)) throw new Error('unexpected forecast schema');
  return data;
}

export async function loadResults() {
  try {
    const results = await loadJson('../data/results.json');
    return isResults(results) ? results : null;
  } catch {
    return null;
  }
}

/** Empty string when the forecast is fresh. */
export function staleMessage(data, nowMs = Date.now()) {
  const age = nowMs - new Date(data.generated_at).getTime();
  if (nowMs > new Date(data.window.end).getTime()) return `Ця ніч уже минула. Лінія від ${clock(data.generated_at)}, нова з'явиться після оновлення.`;
  if (age > STALE_AFTER_MS) return `Дані застаріли: останнє оновлення о ${clock(data.generated_at)}. Прийом ставок зупинено.`;
  return '';
}
