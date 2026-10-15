// Draws a text overlay. Used for both the live preview and the export
// (where each text is rendered to a transparent full-frame PNG), so the
// exported video shows exactly what the preview shows - including Hebrew
// and other right-to-left text.

import { textDirection } from '../shared/timeline.js';

export const FONTS = {
  // Bundled with the app (Hebrew + Latin), so they look the same on every computer.
  rubik: { label: 'רוביק', css: 'Rubik, Arial, sans-serif' },
  serifHe: { label: 'סריף עריכתי', css: '"Frank Ruhl Libre", Georgia, serif' },
  sans: { label: 'רגיל', css: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  serif: { label: 'קלאסי', css: 'Georgia, "Times New Roman", serif' },
  display: { label: 'בולט', css: 'Impact, "Arial Black", "Helvetica Neue", sans-serif' },
  rounded: { label: 'מעוגל', css: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif' },
  mono: { label: 'מכונת כתיבה', css: '"Courier New", Consolas, monospace' },
};

export const TEXT_STYLES = { none: 'רגיל', shadow: 'צל', outline: 'קו מתאר', box: 'רקע' };

// Size is a fraction of the frame's shorter side, so text fits in any aspect.
function fontFor(text, W, H) {
  const size = Math.max(4, text.size * Math.min(W, H));
  return { size, css: `${text.bold ? 'bold ' : ''}${size}px ${FONTS[text.font]?.css ?? FONTS.sans.css}` };
}

// Bounding box of a text item in canvas pixels.
export function measureText(ctx, text, W, H) {
  const { size, css } = fontFor(text, W, H);
  ctx.save();
  ctx.font = css;
  const lines = String(text.text || ' ').split('\n');
  const widths = lines.map((l) => ctx.measureText(l || ' ').width);
  ctx.restore();
  const lineH = size * 1.25;
  const w = Math.max(...widths);
  const h = lineH * lines.length;
  const cx = text.x * W;
  const cy = text.y * H;
  const pad = text.style === 'box' ? size * 0.35 : size * 0.1;
  return { x: cx - w / 2 - pad, y: cy - h / 2 - pad, w: w + pad * 2, h: h + pad * 2, lines, widths, lineH, size, css };
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// dy: extra downward offset as a fraction of H (used by the "rise" animation).
export function drawText(ctx, text, W, H, alpha = 1, dy = 0) {
  if (!text.text || alpha <= 0) return;
  const box = measureText(ctx, text, W, H);
  const { lines, lineH, size, css } = box;
  ctx.save();
  if (dy) ctx.translate(0, dy * H);
  ctx.globalAlpha = alpha;
  ctx.font = css;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = textDirection(text.text);

  if (text.style === 'box') {
    ctx.fillStyle = hexToRgba(text.boxColor, text.boxOpacity ?? 0.65);
    const r = size * 0.25;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, r);
    ctx.fill();
  }

  const cx = text.x * W;
  const top = text.y * H - (lineH * lines.length) / 2 + lineH / 2;
  lines.forEach((line, i) => {
    const y = top + i * lineH;
    if (text.style === 'outline') {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.14);
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(line, cx, y);
    }
    if (text.style === 'shadow') {
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = size * 0.18;
      ctx.shadowOffsetY = size * 0.05;
    }
    ctx.fillStyle = text.color;
    ctx.fillText(line, cx, y);
    ctx.shadowColor = 'transparent';
  });
  ctx.restore();
}

// Alpha of a text at timeline time t (fade in/out when animated).
export function textAlpha(text, t) {
  if (t < text.start || t >= text.end) return 0;
  if (text.animation !== 'fade' && text.animation !== 'rise') return 1;
  const f = Math.min(0.4, (text.end - text.start) / 2);
  return Math.min(1, (t - text.start) / f, (text.end - t) / f);
}

// Render one text to a transparent PNG at export resolution.
export async function renderTextPng(text, W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  // Make sure a bundled font has loaded before drawing with it.
  const family = FONTS[text.font]?.css ?? FONTS.sans.css;
  await document.fonts.load(`${text.bold ? 'bold ' : ''}40px ${family}`, text.text).catch(() => {});
  drawText(canvas.getContext('2d'), text, W, H, 1);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
