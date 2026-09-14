// Pure helpers for the shell and coupon notes: countdown text, safety and sleep notes.

import { regionOf } from '../bet/pricing.js';

const kyivClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "7:05:09" style countdown; never negative. */
export function countdownText(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${hh}:${pad(mm)}:${pad(ss)}`;
}

/** Regions referenced by the slip that are under alert right now (line.active_now). */
export function alertedRegions(line, selections) {
  if (!line || !line.active_now) return [];
  const picked = [...new Set(selections.map((s) => regionOf(s.key)).filter(Boolean))];
  return picked.filter((r) => line.active_now[line.regions.indexOf(r)] === '1');
}

export const SAFETY_NOTE = 'У цій області зараз тривога. Спершу безпека: ставка почекає.';
export const SLEEP_NOTE = 'Ставки розрахуються самі. Можна спати.';

/** Minutes since midnight in Kyiv for an epoch in ms. */
export function kyivMinutes(epochMs) {
  const [hh, mm] = kyivClock.format(new Date(epochMs)).split(':').map(Number);
  return hh * 60 + mm;
}

/** True between 00:30 and 07:00 Kyiv time when there are pending bets. */
export function shouldShowSleepNote(epochMs, pendingCount) {
  if (!(pendingCount > 0)) return false;
  const minutes = kyivMinutes(epochMs);
  return minutes >= 30 && minutes < 7 * 60;
}

/** Shell status for the sky strip. */
export function lineStatus(line, nowSeconds) {
  if (!line) return { open: false, text: 'Лінія ще не готова', seconds: 0 };
  if (nowSeconds >= line.window_end) return { open: false, text: 'Ніч завершилась, нова лінія з наступним оновленням', seconds: 0 };
  if (nowSeconds - line.generated_at > line.closes_after_seconds) return { open: false, text: 'Прийом зупинено: дані застаріли, чекаємо оновлення', seconds: 0 };
  return { open: true, text: 'Лінія відкрита до 07:00', seconds: line.window_end - nowSeconds };
}
