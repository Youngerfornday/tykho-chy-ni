const GOLD = '#E6B20E';
const YELLOW = '#E5CD40';
const INK = '#EEE9E3';
const RULE = '#3f4246';
const LOCKED_FIELD = '#1c2129';
const LOCKED_GLYPH = '#3B4351';

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const attrs = (values) => Object.entries(values).map(([key, value]) => ` ${key}="${esc(value)}"`).join('');
const tag = (name, values, body = '') => `<${name}${attrs(values)}>${body}</${name}>`;
const self = (name, values) => `<${name}${attrs(values)}/>`;
const path = (d, values = {}) => self('path', { d, ...values });
const line = (x1, y1, x2, y2, values = {}) => self('line', { x1, y1, x2, y2, ...values });
const circle = (cx, cy, r, values = {}) => self('circle', { cx, cy, r, ...values });
const group = (body, values = {}) => tag('g', values, body);

function root(size, body, viewBox = '0 0 64 64', extra = {}) {
  return tag('svg', {
    xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox,
    'aria-hidden': 'true', focusable: 'false', ...extra,
  }, body);
}

function medallion(size, locked, glyph) {
  const ring = locked ? RULE : GOLD;
  const field = locked ? LOCKED_FIELD : '#2A2D31';
  const ink = locked ? LOCKED_GLYPH : YELLOW;
  const art = glyph(ink, locked ? LOCKED_GLYPH : INK);
  const lock = locked ? group([
    path('M50 53V49A4 4 0 0 1 58 49V53', { fill: 'none', stroke: INK, 'stroke-width': 1.4 }),
    self('rect', { x: 48, y: 52, width: 12, height: 8, rx: 1.5, fill: LOCKED_FIELD, stroke: INK, 'stroke-width': 1.2 }),
    circle(54, 55.5, 1, { fill: INK }),
  ]) : '';
  return root(size, [
    circle(32, 32, 30, { fill: field, stroke: ring, 'stroke-width': 2 }),
    circle(32, 32, 25.5, { fill: 'none', stroke: locked ? RULE : '#3f4246', 'stroke-width': 1 }),
    group(art, { fill: ink, stroke: ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    lock,
  ].join(''));
}

const firstBet = (fill, ink) => group([
  self('rect', { x: 15, y: 22, width: 34, height: 21, rx: 3, fill: 'none', 'stroke-width': 2 }),
  path('M21 27H29M21 32H34M21 37H27', { fill: 'none', stroke: ink, 'stroke-width': 1.5 }),
  path('M41 24L42.5 27L46 27.5L43.5 30L44 33.5L41 31.8L38 33.5L38.5 30L36 27.5L39.5 27Z', { fill }),
]);

const firstWin = (fill, ink) => group([
  path('M37 17C27 17 20 24 20 33C20 42 27 48 36 48C31 45 28 40 28 33C28 25 32 19 37 17Z', { fill, stroke: fill, 'stroke-width': 1.2 }),
  path('M35 36L39 40L48 30', { fill: 'none', stroke: ink, 'stroke-width': 2.2 }),
]);

const quietCall = (fill, ink) => group([
  path('M37 17C27 17 20 24 20 33C20 42 27 48 36 48C31 45 28 40 28 33C28 25 32 19 37 17Z', { fill }),
  path('M22 39Q25 35 28 39M29 39Q32 35 35 39', { fill: 'none', stroke: ink, 'stroke-width': 1.5 }),
  path('M42 22L47 22L42 28H47', { fill: 'none', stroke: ink, 'stroke-width': 1.6 }),
]);

const express3 = (fill) => group([
  circle(23, 32, 9, { fill: 'none', 'stroke-width': 2 }),
  circle(32, 32, 9, { fill: 'none', 'stroke-width': 2 }),
  circle(41, 32, 9, { fill: 'none', 'stroke-width': 2 }),
]);

const underdogWin = (fill, ink) => group([
  path('M14 43C22 36 29 39 36 35C42 32 47 35 51 31', { fill: 'none', stroke: ink, 'stroke-width': 2 }),
  path('M14 44Q32 39 51 42V48H14Z', { fill, 'fill-opacity': 0.35, stroke: 'none' }),
  path('M40 18L41.7 22L46 22.4L42.7 25.1L43.7 29.3L40 27L36.3 29.3L37.3 25.1L34 22.4L38.3 22Z', { fill }),
]);

const streak3 = (fill) => group([
  path('M18 31A8 8 0 0 1 30 22A8 8 0 0 0 30 38A8 8 0 0 1 18 31Z', { fill }),
  path('M28 31A8 8 0 0 1 40 22A8 8 0 0 0 40 38A8 8 0 0 1 28 31Z', { fill }),
  path('M38 31A8 8 0 0 1 50 22A8 8 0 0 0 50 38A8 8 0 0 1 38 31Z', { fill }),
]);

const sharp = (fill, ink) => group([
  path('M32 14L35 28L50 32L35 36L32 50L29 36L14 32L29 28Z', { fill: 'none', 'stroke-width': 1.8 }),
  path('M32 19L34 30L43 32L34 34L32 45L30 34L21 32L30 30Z', { fill, 'fill-opacity': 0.35, stroke: ink, 'stroke-width': 1.2 }),
  circle(32, 32, 2.4, { fill: ink, stroke: 'none' }),
]);

const explorer = (fill, ink) => group([
  path('M15 24L27 19L39 24L49 20V42L39 46L27 41L15 46Z', { fill: 'none', 'stroke-width': 1.8 }),
  line(27, 19, 27, 41, { 'stroke-width': 1.4 }), line(39, 24, 39, 46, { 'stroke-width': 1.4 }),
  path('M32 19C26 19 23 23 23 28C23 34 32 42 32 42C32 42 41 34 41 28C41 23 38 19 32 19Z', { fill, 'fill-opacity': 0.28, stroke: ink, 'stroke-width': 1.6 }),
  circle(32, 28, 2.5, { fill: ink, stroke: 'none' }),
]);

const coolHead = (fill, ink) => group([
  line(32, 18, 32, 45, { 'stroke-width': 1.8 }),
  line(23, 22, 41, 22, { 'stroke-width': 1.8 }),
  path('M17 24L27 24L22 36C18 36 16 32 17 24ZM37 24L47 24L42 36C38 36 36 32 37 24Z', { fill: 'none', 'stroke-width': 1.7 }),
  path('M18 38H28M36 38H46M26 45H38', { fill: 'none', stroke: ink, 'stroke-width': 1.7 }),
]);

const star4 = (x, y, r, fill) => path(`M${x} ${y - r}L${x + r * 0.32} ${y - r * 0.32}L${x + r} ${y}L${x + r * 0.32} ${y + r * 0.32}L${x} ${y + r}L${x - r * 0.32} ${y + r * 0.32}L${x - r} ${y}L${x - r * 0.32} ${y - r * 0.32}Z`, { fill, stroke: 'none' });

const flawlessNight = (fill, ink) => group([
  circle(32, 38, 10, { fill, 'fill-opacity': 0.9, stroke: 'none' }),
  circle(32, 38, 13.5, { fill: 'none', stroke: fill, 'stroke-opacity': 0.4, 'stroke-width': 1.2 }),
  star4(20, 20, 3.4, ink), star4(32, 15, 3.8, ink), star4(44, 20, 3.4, ink),
  path('M22 50H42', { fill: 'none', stroke: ink, 'stroke-width': 1.6 }),
]);

const week = (fill, ink) => group([
  path('M16 36C22 22 42 22 48 36', { fill: 'none', stroke: ink, 'stroke-width': 1.6 }),
  [
    [17, 35], [21, 29], [26, 25], [32, 23], [38, 25], [43, 29], [47, 35],
  ].map(([x, y]) => circle(x, y, 2.2, { fill, stroke: 'none' })).join(''),
  line(14, 43, 50, 43, { 'stroke-width': 2 }),
]);

const badge = (glyph) => ({ size = 64, locked = false } = {}) => medallion(size, locked, glyph);

export const BADGES = Object.freeze({
  first_bet: badge(firstBet), first_win: badge(firstWin), quiet_call: badge(quietCall),
  express3: badge(express3), underdog_win: badge(underdogWin), streak3: badge(streak3),
  sharp: badge(sharp), explorer: badge(explorer), cool_head: badge(coolHead),
  flawless_night: badge(flawlessNight), week: badge(week),
});

const emblemStars = (count) => Array.from({ length: count }, (_, i) => {
  const a = -2.5 + (i / Math.max(1, count - 1)) * 5;
  const x = 24 + Math.sin(a) * 18;
  const y = 24 - Math.cos(a) * 18;
  return path(`M${x} ${y - 1.8}L${x + 0.6} ${y - 0.6}L${x + 1.8} ${y}L${x + 0.6} ${y + 0.6}L${x} ${y + 1.8}L${x - 0.6} ${y + 0.6}L${x - 1.8} ${y}L${x - 0.6} ${y - 0.6}Z`, { fill: YELLOW, stroke: 'none' });
}).join('');

function levelEmblem(level, size = 48) {
  const disk = level === 7
    ? circle(24, 24, 16, { fill: YELLOW, stroke: 'none' })
    : path(`M24 8A16 16 0 0 0 24 40A${Math.max(1, 13 - level * 2)} 16 0 0 1 24 8Z`, { fill: YELLOW, stroke: 'none' });
  const halo = level === 7 ? tag('defs', {}, tag('radialGradient', { id: 'emblem-halo' }, [
    self('stop', { offset: 0, 'stop-color': YELLOW, 'stop-opacity': 0.26 }),
    self('stop', { offset: 1, 'stop-color': YELLOW, 'stop-opacity': 0 }),
  ].join(''))) + circle(24, 24, 22, { fill: 'url(#emblem-halo)' }) : '';
  return root(size, halo + emblemStars(level - 1) + disk + circle(24, 24, 16, { fill: 'none', stroke: INK, 'stroke-opacity': 0.45, 'stroke-width': 1 }),'0 0 48 48');
}

export const LEVEL_EMBLEMS = Object.freeze(Array.from({ length: 7 }, (_, index) => ({ size = 48 } = {}) => levelEmblem(index + 1, size)));
