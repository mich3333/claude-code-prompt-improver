// Draws the black-and-gold data graphics frame by frame and turns them into a
// short video (encoded by the main process), placed as a split-screen layer.

import {
  easeOutCubic, formatCountUp, GOLD, GRAPHIC_ANIMATION, GRAPHIC_FPS, graphicDuration, graphicSize, parseBars,
  parseCountUp, yearRange,
} from '../shared/graphics.js';
import { textDirection } from '../shared/timeline.js';

const FONT = 'Rubik, Arial, sans-serif';
const font = (weight, px) => `${weight} ${Math.round(px)}px ${FONT}`;
const fade = (t, start, dur = 0.35) => easeOutCubic((t - start) / dur);

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Fit a single line of text into maxWidth by shrinking the font.
function fitFont(ctx, text, weight, px, maxWidth) {
  ctx.font = font(weight, px);
  const w = ctx.measureText(text).width;
  if (w > maxWidth) ctx.font = font(weight, (px * maxWidth) / w);
}

function textAt(ctx, text, x, y, { weight = 500, px, color, maxWidth, alpha = 1 }) {
  if (!text || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.direction = textDirection(text);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  fitFont(ctx, text, weight, px, maxWidth ?? Infinity);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function background(ctx, W, H, t) {
  ctx.fillStyle = GOLD.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.58, 0, W / 2, H * 0.58, Math.max(W, H) * 0.65);
  glow.addColorStop(0, rgba(GOLD.gold, 0.14));
  glow.addColorStop(1, rgba(GOLD.gold, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Slowly drifting gold dust (deterministic, so every render is identical).
  for (let i = 0; i < 70; i++) {
    const r1 = Math.sin(i * 12.9898) * 43758.5453;
    const r2 = Math.sin(i * 78.233) * 12345.6789;
    const fx = r1 - Math.floor(r1);
    const fy = r2 - Math.floor(r2);
    const x = ((fx + t * 0.01 * ((i % 5) - 2)) % 1 + 1) % 1;
    const y = ((fy - t * 0.012 * ((i % 3) + 1)) % 1 + 1) % 1;
    ctx.fillStyle = rgba(GOLD.light, 0.08 + 0.22 * ((i * 7) % 10) / 10);
    ctx.beginPath();
    ctx.arc(x * W, y * H, Math.max(1, H * 0.0025 * (1 + (i % 3))), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Year strip: grey line and dots, gold progress sliding to the active year.
function yearStrip(ctx, W, H, t, g, y) {
  const years = yearRange(g);
  if (years.length < 2) return;
  const x0 = W * 0.12;
  const x1 = W * 0.88;
  const xAt = (i) => x0 + ((x1 - x0) * i) / (years.length - 1);
  const active = Math.max(0, Math.min(years.length - 1, years.indexOf(Math.round(Number(g.active)))));
  const from = Math.max(0, active - 1);
  const pos = from + (active - from) * easeOutCubic(t / 0.9);
  const lw = Math.max(1.5, H * 0.003);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const xp = x0 + ((x1 - x0) * pos) / (years.length - 1);
  ctx.strokeStyle = GOLD.gold;
  ctx.lineWidth = lw * 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(xp, y);
  ctx.stroke();
  years.forEach((year, i) => {
    const passed = i <= pos + 1e-6;
    ctx.fillStyle = passed ? GOLD.gold : 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(xAt(i), y, H * 0.0055, 0, Math.PI * 2);
    ctx.fill();
    textAt(ctx, String(year), xAt(i), y + H * 0.04, {
      weight: i === active ? 700 : 500, px: H * 0.028, color: i === active ? GOLD.text : GOLD.muted,
    });
  });
  // The moving marker: a gold dot with a soft ring.
  ctx.shadowColor = rgba(GOLD.gold, 0.9);
  ctx.shadowBlur = H * 0.03;
  ctx.fillStyle = GOLD.light;
  ctx.beginPath();
  ctx.arc(xp, y, H * 0.011, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(GOLD.gold, 0.55);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(xp, y, H * 0.022, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function goldFill(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, GOLD.light);
  g.addColorStop(0.55, GOLD.gold);
  g.addColorStop(1, GOLD.dark);
  return g;
}

function drawNumber(ctx, W, H, t, g) {
  if (g.years) yearStrip(ctx, W, H, t, g, H * 0.12);
  const cy = g.years ? H * 0.6 : H * 0.54;
  textAt(ctx, g.label, W / 2, cy - H * 0.19, { weight: 600, px: H * 0.05, color: GOLD.text, maxWidth: W * 0.86, alpha: fade(t, 0.1) });
  const parsed = parseCountUp(g.value);
  const shown = parsed ? formatCountUp(parsed, easeOutCubic((t - 0.2) / 1.3)) : String(g.value ?? '');
  const px = H * 0.22;
  const scale = 0.9 + 0.1 * easeOutCubic((t - 0.2) / 0.5);
  ctx.save();
  ctx.globalAlpha = fade(t, 0.2, 0.3);
  ctx.translate(W / 2, cy);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  // Size by the final value so the number doesn't jump while counting.
  fitFont(ctx, String(g.value ?? ''), 800, px, W * 0.86);
  ctx.shadowColor = rgba(GOLD.gold, 0.45);
  ctx.shadowBlur = H * 0.05;
  ctx.fillStyle = goldFill(ctx, -px / 2, px / 2);
  ctx.fillText(shown, 0, 0);
  ctx.restore();
  textAt(ctx, g.note, W / 2, cy + H * 0.17, { weight: 500, px: H * 0.038, color: GOLD.muted, maxWidth: W * 0.86, alpha: fade(t, 0.9) });
}

function drawBars(ctx, W, H, t, g) {
  if (g.years) yearStrip(ctx, W, H, t, g, H * 0.1);
  const bars = parseBars(g.values);
  textAt(ctx, g.label, W / 2, g.years ? H * 0.24 : H * 0.13, { weight: 600, px: H * 0.05, color: GOLD.text, maxWidth: W * 0.86, alpha: fade(t, 0) });
  if (!bars.length) return;
  const max = Math.max(...bars.map((b) => b.value)) || 1;
  const left = W * 0.12;
  const right = W * 0.88;
  const base = H * 0.84;
  const maxH = H * (g.years ? 0.42 : 0.52);
  const slot = (right - left) / bars.length;
  const bw = Math.min(slot * 0.58, H * 0.16);
  ctx.save();
  ctx.strokeStyle = rgba(GOLD.gold, 0.45);
  ctx.lineWidth = Math.max(1, H * 0.002);
  ctx.beginPath();
  ctx.moveTo(left, base);
  ctx.lineTo(right, base);
  ctx.stroke();
  bars.forEach((b, i) => {
    const p = easeOutCubic((t - 0.15 - i * 0.12) / 0.8);
    const h = Math.max(0, (b.value / max) * maxH * p);
    const x = left + slot * i + (slot - bw) / 2;
    if (h > 0) {
      ctx.save();
      if (i === bars.length - 1) {
        ctx.shadowColor = rgba(GOLD.gold, 0.5);
        ctx.shadowBlur = H * 0.04;
      }
      ctx.fillStyle = goldFill(ctx, base - h, base);
      ctx.beginPath();
      ctx.roundRect(x, base - h, bw, h, [bw * 0.08, bw * 0.08, 0, 0]);
      ctx.fill();
      ctx.restore();
    }
    const parsed = parseCountUp(`${g.prefix ?? ''}${b.value}${g.suffix ?? ''}`);
    textAt(ctx, parsed ? formatCountUp(parsed, p) : String(b.value), x + bw / 2, base - h - H * 0.04, {
      weight: 700, px: H * 0.04, color: GOLD.light, maxWidth: slot * 0.95, alpha: Math.min(1, p * 2),
    });
    textAt(ctx, b.label, x + bw / 2, base + H * 0.045, { weight: 500, px: H * 0.032, color: GOLD.muted, maxWidth: slot * 0.95 });
  });
  ctx.restore();
}

function drawYear(ctx, W, H, t, g) {
  yearStrip(ctx, W, H, t, g, H * 0.14);
  textAt(ctx, g.label, W / 2, H * 0.4, { weight: 600, px: H * 0.05, color: GOLD.gold, maxWidth: W * 0.86, alpha: fade(t, 0.2) });
  const rise = (1 - easeOutCubic((t - 0.3) / 0.6)) * H * 0.04;
  ctx.save();
  ctx.globalAlpha = fade(t, 0.3, 0.45);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = H * 0.03;
  textAt(ctx, String(Math.round(Number(g.active)) || ''), W / 2, H * 0.62 + rise, { weight: 800, px: H * 0.26, color: GOLD.text });
  ctx.restore();
}

// Greedy word wrap for one paragraph.
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Full-screen source card: who said it, where and when, the original words on
// a cream card, a Hebrew translation and the link. Each part arrives in turn.
function drawQuote(ctx, W, H, t, g) {
  const s = Math.min(W / 1080, H / 1920);
  const padX = W * 0.083;
  const right = W - padX;
  const rise = (start, dist = 26) => (1 - easeOutCubic((t - start) / 0.45)) * dist * s;
  const at = (x, y, text, { weight, px, color, dir = 'rtl', align = 'right', alpha = 1, font: family = FONT, maxWidth = W - 2 * padX }) => {
    if (!text || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.direction = dir;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.font = `${weight} ${Math.round(px)}px ${family}`;
    const w = ctx.measureText(text).width;
    if (w > maxWidth) ctx.font = `${weight} ${Math.round((px * maxWidth) / w)}px ${family}`; // long links shrink to fit
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // Header: kicker, name, where/when.
  let y = H * 0.29;
  at(right, y + rise(0.05), g.label, { weight: 700, px: 38 * s, color: GOLD.gold, alpha: fade(t, 0.05) });
  y += 92 * s;
  ctx.save();
  ctx.font = font(800, 84 * s);
  const whoPx = Math.min(84 * s, (84 * s * (W - 2 * padX)) / Math.max(1, ctx.measureText(g.who || ' ').width));
  ctx.restore();
  at(right, y + rise(0.12), g.who, { weight: 800, px: whoPx, color: GOLD.text, dir: textDirection(g.who), alpha: fade(t, 0.12) });
  y += 60 * s;
  at(right, y + rise(0.25), g.where, { weight: 500, px: 36 * s, color: GOLD.muted, dir: textDirection(g.where), alpha: fade(t, 0.25) });

  // Card geometry from the wrapped text.
  const cardX = padX;
  const cardW = W - 2 * padX;
  const inner = cardW - 2 * 60 * s;
  const qPx = (g.headline ? 76 : 62) * s;
  const serif = `Georgia, 'Times New Roman', serif`;
  ctx.save();
  ctx.font = `700 ${Math.round(qPx)}px ${serif}`;
  const quote = g.headline ? String(g.quote ?? '') : `“${String(g.quote ?? '').replace(/^[“"]|[”"]$/g, '')}”`;
  const qLines = wrapLines(ctx, quote, inner);
  ctx.font = font(700, 44 * s);
  const hLines = wrapLines(ctx, g.he, inner);
  ctx.restore();
  const qLH = qPx * 1.2;
  const hLH = 44 * s * 1.35;
  const cardH = 64 * s * 2 + qLines.length * qLH + (hLines.length ? 36 * s + hLines.length * hLH : 0);
  const cardY = y + 70 * s;

  // The card slides up into place; its gold edge wipes down.
  const cp = easeOutCubic((t - 0.35) / 0.55);
  if (cp > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, cp * 1.4);
    ctx.translate(0, (1 - cp) * 90 * s);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 90 * s;
    ctx.shadowOffsetY = 30 * s;
    ctx.fillStyle = GOLD.text;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 28 * s);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = rgba(GOLD.gold, 0.6);
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    const edge = easeOutCubic((t - 0.55) / 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 28 * s);
    ctx.clip();
    ctx.fillStyle = goldFill(ctx, cardY, cardY + cardH);
    ctx.fillRect(cardX, cardY, 14 * s, cardH * edge);
    ctx.restore();

    // Original words, line by line, then the translation.
    let ty = cardY + 64 * s + qPx * 0.9;
    qLines.forEach((line, i) => {
      const a = fade(t, 0.6 + i * 0.1, 0.35);
      at(cardX + 60 * s, ty + rise(0.6 + i * 0.1, 18), line, { weight: 700, px: qPx, color: '#141413', dir: 'ltr', align: 'left', alpha: a, font: serif });
      ty += qLH;
    });
    ty += hLines.length ? 36 * s - qLH + hLH : 0;
    const hStart = 0.7 + qLines.length * 0.1;
    hLines.forEach((line) => {
      at(cardX + cardW - 60 * s, ty, line, { weight: 700, px: 44 * s, color: '#3a3833', alpha: fade(t, hStart, 0.4) });
      ty += hLH;
    });
    ctx.restore();
  }
  at(right, cardY + cardH + 74 * s, g.url, { weight: 500, px: 30 * s, color: GOLD.muted, dir: 'ltr', alpha: fade(t, 1.25) });
}

const DRAW = { number: drawNumber, bars: drawBars, year: drawYear, quote: drawQuote };

export function drawGraphic(ctx, W, H, t, g) {
  ctx.save();
  background(ctx, W, H, t);
  DRAW[g.type]?.(ctx, W, H, t, g);
  ctx.restore();
}

async function ensureFonts() {
  await Promise.all([
    document.fonts.load(font(500, 40), 'אב12'),
    document.fonts.load(font(600, 40), 'אב12'),
    document.fonts.load(font(700, 40), 'אב12'),
    document.fonts.load(font(800, 40), '$12'),
  ]).catch(() => {});
}

// Renders the moving part as JPEG frames; the main process encodes them and
// holds the last frame for the rest of the duration.
export async function renderGraphicVideo(g, aspect) {
  await ensureFonts();
  const { width, height } = graphicSize(aspect, g.type);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const frames = [];
  const count = Math.round(GRAPHIC_ANIMATION * GRAPHIC_FPS);
  for (let i = 0; i < count; i++) {
    drawGraphic(ctx, width, height, i / GRAPHIC_FPS, g);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    frames.push(new Uint8Array(await blob.arrayBuffer()));
  }
  return window.api.encodeGraphic({
    frames, fps: GRAPHIC_FPS, hold: graphicDuration(g) - GRAPHIC_ANIMATION, name: g.type,
  });
}
