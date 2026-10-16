// Slide-in/slide-out of overlay layers, shared by the preview (player.js) and
// the export (ffmpeg.js) so a layer moves along the same curve in both.

import { overlayAnimation, overlayRect } from './timeline.js';

export const OVERLAY_ANIMATIONS = {
  none: 'ללא',
  fade: 'הופעה רכה',
  slideright: 'החלקה מימין',
  slideleft: 'החלקה משמאל',
  slidebottom: 'החלקה מלמטה',
};

// Short, with a strong ease-out (quint, close to cubic-bezier(0.23, 1, 0.32, 1)).
// Exits are quicker than entrances, and leave the way the layer came in.
export const SLIDE_IN = 0.3;
export const SLIDE_OUT = 0.24;
const EASE_POWER = 5;

const num = (x) => Number(x.toFixed(4)).toString();
const clip01 = (x) => Math.min(1, Math.max(0, x));

function slideTimes(o, D) {
  return { inD: Math.min(SLIDE_IN, D / 2), outD: Math.min(SLIDE_OUT, D / 2), exitAt: o.start + D - Math.min(SLIDE_OUT, D / 2) };
}

// Full travel of a sliding layer (from its resting place to just off-frame), or null.
export function slideVector(o, W, H) {
  switch (overlayAnimation(o)) {
    case 'slideright': return { x: W, y: 0 };
    case 'slideleft': return { x: -W, y: 0 };
    case 'slidebottom': return { x: 0, y: H - overlayRect(o, W, H).y };
    default: return null;
  }
}

// Share of the travel still to go at timeline time t: 1 off-frame, 0 at rest.
// D is how long the layer is shown. Mirrors slideAmountExpr() exactly.
export function slideAmount(o, t, D) {
  const { inD, outD, exitAt } = slideTimes(o, D);
  return (1 - clip01((t - o.start) / inD)) ** EASE_POWER + 1 - (1 - clip01((t - exitAt) / outD)) ** EASE_POWER;
}

// The same curve as an FFmpeg expression of `t`, for overlay x/y with eval=frame.
export function slideAmountExpr(o, D) {
  const { inD, outD, exitAt } = slideTimes(o, D);
  return `pow(1-clip((t-${num(o.start)})/${num(inD)},0,1),${EASE_POWER})+1-pow(1-clip((t-${num(exitAt)})/${num(outD)},0,1),${EASE_POWER})`;
}

// Offset (px) from the layer's resting place at time t, for the preview.
export function overlayOffset(o, t, W, H, D) {
  const v = slideVector(o, W, H);
  if (!v) return { dx: 0, dy: 0 };
  const a = slideAmount(o, t, D);
  return { dx: v.x * a, dy: v.y * a };
}

// overlay filter position for the export: `x=...:y=...` (animated when sliding).
export function overlayPosition(o, W, H, D) {
  const r = overlayRect(o, W, H);
  const v = slideVector(o, W, H);
  if (!v) return `x=${r.x}:y=${r.y}`;
  const e = slideAmountExpr(o, D);
  const axis = (base, d) => {
    if (!d) return String(base);
    return `'${base}${d < 0 ? '-' : '+'}${num(Math.abs(d))}*(${e})'`;
  };
  return `x=${axis(r.x, v.x)}:y=${axis(r.y, v.y)}:eval=frame`;
}
