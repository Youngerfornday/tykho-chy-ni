// Share card: a 1080x1350 PNG built on the night-sky art, led by accuracy against the line.

import { mountNightScene } from '../art.js';
import { nightTitle } from '../format.js';
import { chips } from '../bet/labels.js';
import { isSettled } from '../bet/progress.js';
import { BADGES, LEVEL_EMBLEMS } from '../badges.js';

export const CARD_W = 1080;
export const CARD_H = 1350;
const SKY_H = 720;
const C = { bg: '#141921', panel: '#2A2D31', rule: '#3f4246', ink: '#EEE9E3', ink2: '#c2c2c2', muted: '#989ba0', gold: '#E6B20E', soft: '#E5CD40', red: '#ef8a80', green: '#3fd1a4' };
export const FOOTER = 'Гра на віртуальні фішки · прогноз, не тривога · youngerfornday.github.io/tykho-chy-ni';
const FONT_UI = 'Onest, system-ui, sans-serif';
const FONT_DISPLAY = 'Unbounded, "Arial Black", sans-serif';

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const svgUrl = (markup) => (markup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` : null);

/** Renders the night scene offscreen (no animation) and returns it as an SVG data URL. */
function sceneUrl({ date, intensity }) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;width:1080px;height:720px;overflow:hidden;';
  document.body.append(host);
  try {
    mountNightScene(host, { date, intensity });
    const svg = host.querySelector('svg');
    if (!svg) return null;
    svg.setAttribute('width', String(CARD_W));
    svg.setAttribute('height', String(SKY_H));
    return svgUrl(new XMLSerializer().serializeToString(svg));
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

async function ensureFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([`700 120px ${FONT_DISPLAY}`, `700 56px ${FONT_DISPLAY}`, `600 40px ${FONT_UI}`, `500 28px ${FONT_UI}`].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch { /* fallbacks in the font stacks */ }
}

function edgeSentence(edgePp, settled) {
  if (!settled) return 'Ставки ще не розраховані';
  const n = Math.round(Math.abs(edgePp));
  if (n < 1) return 'Врівень з лінією';
  return edgePp > 0 ? `На ${n} п.п. краще за лінію` : `На ${n} п.п. нижче за лінію`;
}

function text(ctx, value, x, y, font, color, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

/**
 * @param {{ anchor: string, settled: number, wins: number, hitRate: number, edgePp: number, profit: number,
 *   level: {level: number, name: string}, badges: string[], intensity?: number }} card
 * @returns {Promise<Blob>}
 */
export async function renderShareCard(card) {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const sky = await loadImage(sceneUrl({ date: new Date(), intensity: card.intensity ?? 0.3 }));
  if (sky) ctx.drawImage(sky, 0, 0, CARD_W, SKY_H);
  const fade = ctx.createLinearGradient(0, SKY_H - 140, 0, SKY_H);
  fade.addColorStop(0, 'rgba(20, 25, 33, 0)');
  fade.addColorStop(1, 'rgba(20, 25, 33, 1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, SKY_H - 140, CARD_W, 140);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 24;
  text(ctx, nightTitle(card.anchor), 72, 128, `700 56px ${FONT_DISPLAY}`, C.ink);
  ctx.shadowBlur = 0;

  const hasSettled = card.settled > 0;
  text(ctx, hasSettled ? `${Math.round(card.hitRate * 100)}%` : '—', 72, 830, `700 120px ${FONT_DISPLAY}`, C.ink);
  text(ctx, hasSettled ? `влучність · ${card.wins} з ${card.settled}` : 'ще без розрахунку', 72, 886, `500 32px ${FONT_UI}`, C.muted);
  const edgeColor = !hasSettled ? C.muted : card.edgePp >= 1 ? C.green : card.edgePp <= -1 ? C.red : C.ink2;
  text(ctx, edgeSentence(card.edgePp, hasSettled), 72, 958, `600 40px ${FONT_UI}`, edgeColor);
  ctx.fillStyle = C.rule;
  ctx.fillRect(72, 996, CARD_W - 144, 1);

  const emblem = await loadImage(svgUrl(LEVEL_EMBLEMS?.[card.level.level - 1]?.({ size: 160 })));
  if (emblem) ctx.drawImage(emblem, 72, 1030, 104, 104);
  text(ctx, card.level.name, 196, 1080, `700 40px ${FONT_DISPLAY}`, C.ink);
  text(ctx, `Рівень ${card.level.level}`, 196, 1120, `500 28px ${FONT_UI}`, C.muted);
  const badges = await Promise.all(card.badges.slice(0, 6).map((id) => loadImage(svgUrl(BADGES?.[id]?.({ size: 96 })))));
  badges.filter(Boolean).forEach((img, i) => ctx.drawImage(img, CARD_W - 72 - 80 * (i + 1) - 8, 1036, 88, 88));
  if (hasSettled) {
    const sign = card.profit > 0 ? '+' : card.profit < 0 ? '−' : '';
    text(ctx, `Фішки за ніч: ${sign}${chips(Math.abs(card.profit))}`, 72, 1178, `500 26px ${FONT_UI}`, C.muted);
  }

  ctx.fillStyle = C.rule;
  ctx.fillRect(72, 1222, CARD_W - 144, 1);
  text(ctx, 'Тихо чи ні?', 72, 1268, `700 28px ${FONT_DISPLAY}`, C.ink2);
  text(ctx, FOOTER, 72, 1306, `500 23px ${FONT_UI}`, C.muted);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas export failed'))), 'image/png'));
}

export function cardFromNight(night, progress, intensity) {
  const settled = night.bets.filter(isSettled);
  const n = settled.length;
  const hitRate = n ? night.wins / n : 0;
  const expected = n ? settled.reduce((s, b) => s + 1 / b.odds, 0) / n : 0;
  return {
    anchor: night.anchor,
    settled: n,
    wins: night.wins,
    hitRate,
    edgePp: (hitRate - expected) * 100,
    profit: night.profit,
    level: progress.level,
    badges: progress.achievements.filter((a) => a.unlockedAt).map((a) => a.id),
    intensity,
  };
}

export async function shareNight(night, progress, intensity) {
  const blob = await renderShareCard(cardFromNight(night, progress, intensity));
  const file = new File([blob], `tykho-${night.anchor}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nightTitle(night.anchor) });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // Safari rejects share() once the gesture expires during rendering: save the image instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
