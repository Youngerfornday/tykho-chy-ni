// Human wording for markets, picks and bet statuses.

import { shortName } from '../format.js';

export function marketTitle(key, line) {
  const [kind, region] = key.split('|');
  if (kind === 'alarm') return `${shortName(region)}: тривога до 07:00`;
  if (kind === 'quiet_late') return `${shortName(region)}: тихо з 01:00 до 07:00`;
  if (kind === 'west_quiet') return 'Захід тихий до 07:00';
  if (kind === 'total_over') return `Тривоги у ${Math.ceil(line)}+ областях`;
  return key;
}

export function pickLabel(key, pick, line) {
  if (key === 'total_over') return pick === 'yes' ? `${Math.ceil(line)} і більше` : `до ${Math.floor(line)}`;
  return pick === 'yes' ? 'Так' : 'Ні';
}

export const STATUS_LABEL = Object.freeze({
  pending: 'Очікує',
  won: 'Виграш',
  lost: 'Програш',
  void: 'Повернення',
  open: 'Очікує',
});

export function chips(n) {
  return new Intl.NumberFormat('uk-UA').format(n);
}

const whenFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
export const placedWhen = (epochSeconds) => whenFmt.format(new Date(epochSeconds * 1000));
