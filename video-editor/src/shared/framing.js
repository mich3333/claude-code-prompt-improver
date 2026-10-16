// Picture framing for photos and videos on the main track: which part of the
// frame the picture fills (the area), the focus point the crop centers on,
// a zoom level, and a slow push-in (Ken Burns) with an optional subtle drift.
// The preview (player.js) and the export (ffmpeg.js) both place the picture
// with placePicture(), so what you see is what you export.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 1.5;
export const AREA_TOP_MAX = 0.6;
// The push-in grows the picture by this much over the clip (1.0 to 1.07).
export const PUSH_IN = 0.07;
// With drift on, the focus point travels this far (each way) across the slack.
export const DRIFT = 0.15;

export const FRAMING_DEFAULTS = { focusX: 0.5, focusY: 0.5, zoom: 1, areaTop: 0, pushIn: false, drift: false };

// "Presenter for split screen": the picture fills the lower part of the frame,
// from just above the middle so it runs under the soft edge of a top layer
// (split 50%, edge 8%), with faces (usually in the upper third of a selfie)
// in view, and a slow push-in.
export const PRESENTER = { fit: 'cover', areaTop: 0.42, focusX: 0.5, focusY: 0.3, zoom: 1, pushIn: true, drift: false };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);

// The clip's framing settings with defaults (older projects have none) and clamps.
export function framingOf(clip) {
  return {
    focusX: clamp(num(clip.focusX, 0.5), 0, 1),
    focusY: clamp(num(clip.focusY, 0.5), 0, 1),
    zoom: clamp(num(clip.zoom, 1), ZOOM_MIN, ZOOM_MAX),
    areaTop: clamp(num(clip.areaTop, 0), 0, AREA_TOP_MAX),
    pushIn: Boolean(clip.pushIn),
    drift: Boolean(clip.pushIn && clip.drift),
  };
}

// True when the clip is placed exactly as plain fit/fill would place it.
export function isDefaultFraming(clip) {
  const f = framingOf(clip);
  return f.focusX === 0.5 && f.focusY === 0.5 && f.zoom === 1 && f.areaTop === 0 && !f.pushIn;
}

// The part of a W×H frame the picture fills: full width, from areaTop down to
// the bottom. The height is even so the export stays H.264-friendly.
export function framingArea(clip, W, H) {
  const { areaTop } = framingOf(clip);
  const h = areaTop > 0 ? Math.max(2, Math.round((H * (1 - areaTop)) / 2) * 2) : H;
  return { x: 0, y: H - h, w: W, h };
}

// How far through a clip segment ({ start, end }) timeline time t is (0..1).
export function framingProgress(seg, t) {
  const d = seg.end - seg.start;
  return d > 0 ? clamp((t - seg.start) / d, 0, 1) : 0;
}

// Coefficients of the motion, so the export can turn them into FFmpeg
// expressions: at progress p the picture is (w0, h0) * (1 + push * p) big and
// the focus point is (ax + (bx - ax) * p, ay + (by - ay) * p).
export function framingMotion(clip, sw, sh, w, h) {
  const f = framingOf(clip);
  const fit = clip.fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const s = fit * f.zoom;
  const d = f.drift ? DRIFT : 0;
  return {
    w0: sw * s,
    h0: sh * s,
    push: f.pushIn ? PUSH_IN : 0,
    // Drift: a gentle pan across and up, within whatever slack the zoom leaves.
    ax: clamp(f.focusX - d, 0, 1),
    bx: clamp(f.focusX + d, 0, 1),
    ay: clamp(f.focusY + d, 0, 1),
    by: clamp(f.focusY - d, 0, 1),
  };
}

// Where to draw an sw×sh picture inside a w×h area at progress p, relative to
// the area's top-left. The focus point works like CSS object-position: at 0%
// the picture's left/top edge meets the area's, at 100% the right/bottom does,
// so the point at (focusX, focusY) of the picture stays put while zooming.
export function placePicture(clip, sw, sh, w, h, p = 0) {
  const m = framingMotion(clip, sw, sh, w, h);
  const k = 1 + m.push * p;
  const dw = m.w0 * k;
  const dh = m.h0 * k;
  const fx = m.ax + (m.bx - m.ax) * p;
  const fy = m.ay + (m.by - m.ay) * p;
  return { x: (w - dw) * fx, y: (h - dh) * fy, w: dw, h: dh };
}

const even = (x) => Math.max(2, Math.round(x / 2) * 2);

/**
 * Geometry for exporting a framed clip: the picture is scaled to its starting
 * on-screen size (times `supersample`) and padded onto a canvas with the
 * area's aspect that holds every window the motion visits; the export then
 * maps the window for each frame onto the area with sub-pixel precision.
 * Coordinates are in pixels of the scaled picture (pw×ph).
 */
export function framingCanvas(clip, sw, sh, w, h, { supersample = 1, samples = 32 } = {}) {
  const m = framingMotion(clip, sw, sh, w, h);
  const pw = even(m.w0 * supersample);
  const ph = even(m.h0 * supersample);
  const moving = m.push > 0 || m.ax !== m.bx || m.ay !== m.by;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i <= (moving ? samples : 0); i++) {
    const pl = placePicture(clip, sw, sh, w, h, i / samples);
    const r = pl.w / pw; // output pixels per picture pixel
    x0 = Math.min(x0, -pl.x / r);
    y0 = Math.min(y0, -pl.y / r);
    x1 = Math.max(x1, (w - pl.x) / r);
    y1 = Math.max(y1, (h - pl.y) / r);
  }
  // Grow the windows' bounding box to the area's aspect, plus a pixel of margin.
  const bw = x1 - x0 + 2;
  const bh = y1 - y0 + 2;
  const cw = Math.ceil(Math.max(bw, (bh * w) / h) / 2) * 2;
  const ch = even((cw * h) / w);
  const cx = Math.floor((x0 + x1 - cw) / 2); // canvas origin in picture pixels
  const cy = Math.floor((y0 + y1 - ch) / 2);
  // Pad the picture onto a surface holding both it and the canvas, then crop the canvas.
  const ux = Math.min(0, cx);
  const uy = Math.min(0, cy);
  return {
    pw, ph, cw, ch, cx, cy, moving,
    padW: Math.max(pw, cx + cw) - ux,
    padH: Math.max(ph, cy + ch) - uy,
    padX: -ux,
    padY: -uy,
    cropX: cx - ux,
    cropY: cy - uy,
    motion: m,
  };
}
