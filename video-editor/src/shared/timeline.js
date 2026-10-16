// Project model and timeline math, shared by the renderer (preview, timeline
// UI) and the main process (export). Pure functions only.

import { FRAMING_DEFAULTS } from './framing.js';

export const ASPECTS = {
  '16:9': { label: 'רוחבי 16:9', w: 16, h: 9 },
  '9:16': { label: 'אנכי 9:16', w: 9, h: 16 },
  '1:1': { label: 'ריבוע 1:1', w: 1, h: 1 },
  '4:5': { label: 'דיוקן 4:5', w: 4, h: 5 },
};

export const TRANSITIONS = {
  none: 'חיתוך ישיר',
  fade: 'מעבר הדרגתי',
  fadeblack: 'דעיכה דרך שחור',
  fadewhite: 'דעיכה דרך לבן',
  wipeleft: 'ניגוב שמאלה',
  wiperight: 'ניגוב ימינה',
  slideleft: 'החלקה שמאלה',
  slideright: 'החלקה ימינה',
  circleopen: 'עיגול נפתח',
};

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

// URL the editor uses to load a local file (served by the main process).
export function mediaUrl(filePath) {
  return `media://file/${encodeURIComponent(filePath)}`;
}

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
export const DEFAULT_IMAGE_DURATION = 4;
export const MIN_CLIP_DURATION = 0.1;

// Output frame size for an aspect ratio; `short` is the shorter side.
// Always even, which H.264 requires.
export function frameSize(aspect, short = 1080) {
  const a = ASPECTS[aspect] ?? ASPECTS['16:9'];
  const even = (x) => Math.round(x / 2) * 2;
  return a.w >= a.h
    ? { width: even((short * a.w) / a.h), height: short }
    : { width: short, height: even((short * a.h) / a.w) };
}

let idCounter = 0;
export function newId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function createProject() {
  return { version: 1, aspect: '16:9', clips: [], overlays: [], texts: [], music: null };
}

export function createClip(media) {
  const isImage = media.kind === 'image';
  const duration = isImage ? DEFAULT_IMAGE_DURATION : media.duration;
  return {
    id: newId('clip'),
    kind: isImage ? 'image' : 'video',
    path: media.path,
    url: media.url,
    name: media.name,
    thumbnail: media.thumbnail ?? null,
    sourceDuration: isImage ? null : media.duration,
    width: media.width ?? null,
    height: media.height ?? null,
    hasAudio: !isImage && Boolean(media.hasAudio),
    in: 0,
    out: duration,
    speed: 1,
    volume: 1,
    muted: false,
    fit: 'contain',
    ...FRAMING_DEFAULTS, // focus point, zoom, picture area, push-in (framing.js)
    filter: 'none',
    brightness: 100,
    contrast: 100,
    saturation: 100,
    transition: { type: 'none', duration: 0.8 }, // transition INTO this clip
  };
}

// A solid-colour clip (title cards, quotes, outros). No media file.
export function createCard(color, duration, name = 'כרטיס') {
  return {
    id: newId('clip'),
    kind: 'card',
    name,
    color,
    thumbnail: null,
    sourceDuration: null,
    hasAudio: false,
    in: 0,
    out: duration,
    speed: 1,
    volume: 1,
    muted: false,
    fit: 'contain',
    filter: 'none',
    brightness: 100,
    contrast: 100,
    saturation: 100,
    transition: { type: 'none', duration: 0.8 },
  };
}

export function createText(start, end) {
  return {
    id: newId('text'),
    text: 'הטקסט שלך',
    start,
    end,
    x: 0.5,
    y: 0.82,
    size: 0.07, // fraction of the frame's shorter side
    color: '#ffffff',
    font: 'sans',
    bold: true,
    style: 'shadow', // none | shadow | outline | box
    boxColor: '#000000',
    boxOpacity: 0.65,
    animation: 'fade', // none | fade | rise (fade in while rising into place)
  };
}

export function createMusic(media) {
  return {
    path: media.path,
    url: media.url,
    name: media.name,
    sourceDuration: media.duration,
    start: 0, // timeline time where the music begins
    offset: 0, // seconds skipped at the start of the song
    volume: 0.6,
    loop: true,
    fadeIn: 1,
    fadeOut: 2,
  };
}

// ---- Overlay layer (split screen) -------------------------------------
// Videos or photos drawn above the main track at a fixed timeline time:
// in the top or bottom part of the frame (a split screen) or full frame.
// The edge facing the other half fades out, so the two halves blend.

export const OVERLAY_REGIONS = { top: 'למעלה', bottom: 'למטה', full: 'מסך מלא' };
export const OVERLAY_FADE = 0.25;

export function createOverlay(media, start = 0) {
  const isImage = media.kind === 'image';
  return {
    id: newId('ovl'),
    kind: isImage ? 'image' : 'video',
    path: media.path,
    url: media.url,
    name: media.name,
    thumbnail: media.thumbnail ?? null,
    sourceDuration: isImage ? null : media.duration,
    width: media.width ?? null,
    height: media.height ?? null,
    hasAudio: !isImage && Boolean(media.hasAudio),
    start,
    in: 0,
    out: isImage ? DEFAULT_IMAGE_DURATION : media.duration,
    speed: 1,
    region: 'top',
    split: 0.5, // share of the frame height the region covers (top/bottom)
    feather: 0.08, // soft edge, as a share of the frame height
    fit: 'cover',
    fade: true,
    volume: 1,
    muted: true, // the main track usually carries the voice
  };
}

export function overlayDuration(o) {
  return Math.max(MIN_CLIP_DURATION, o.out - o.in);
}

// Pixel rectangle of an overlay and which edge (if any) is feathered.
// Heights are even so the export stays H.264-friendly.
export function overlayRect(o, W, H) {
  const even = (x) => Math.max(2, Math.round(x / 2) * 2);
  if (o.region === 'full') return { x: 0, y: 0, w: W, h: H, edge: null, feather: 0 };
  const h = Math.min(H, even(H * o.split));
  const feather = Math.min(h, Math.round((o.feather ?? 0) * H));
  return o.region === 'bottom'
    ? { x: 0, y: H - h, w: W, h, edge: 'top', feather }
    : { x: 0, y: 0, w: W, h, edge: 'bottom', feather };
}

// Opacity of an overlay at timeline time t (short fade in/out when enabled).
export function overlayAlpha(o, t) {
  const end = o.start + overlayDuration(o);
  if (t < o.start || t >= end) return 0;
  if (!o.fade) return 1;
  const f = Math.min(OVERLAY_FADE, (end - o.start) / 2);
  return Math.min(1, (t - o.start) / f, (end - t) / f);
}

// Duration a clip occupies on the timeline (after trimming and speed).
export function clipDuration(clip) {
  return Math.max(MIN_CLIP_DURATION, (clip.out - clip.in) / clip.speed);
}

// Effective transition into clip i. A transition may use at most half of
// either neighbor, so a clip's incoming and outgoing transitions never overlap.
export function effectiveTransition(clips, i) {
  if (i <= 0 || i >= clips.length) return { type: 'none', duration: 0 };
  const t = clips[i].transition;
  if (!t || t.type === 'none' || !(t.duration > 0)) return { type: 'none', duration: 0 };
  const max = Math.min(clipDuration(clips[i - 1]), clipDuration(clips[i])) / 2;
  const duration = Math.min(t.duration, max);
  if (duration < 0.05) return { type: 'none', duration: 0 };
  return { type: t.type, duration: Number(duration.toFixed(3)) };
}

// Start/end of each clip on the timeline, including transition overlaps.
export function layoutClips(clips) {
  const out = [];
  let cursor = 0;
  clips.forEach((clip, i) => {
    const transition = effectiveTransition(clips, i);
    const start = cursor - transition.duration;
    const end = start + clipDuration(clip);
    out.push({ clip, index: i, start, end, transition });
    cursor = end;
  });
  return out;
}

export function totalDuration(project) {
  const layout = layoutClips(project.clips);
  return layout.length ? layout[layout.length - 1].end : 0;
}

// What is visible at timeline time t: the main clip, plus the incoming
// clip and its progress (0..1) while a transition is running.
export function locate(project, t) {
  const layout = layoutClips(project.clips);
  if (!layout.length) return null;
  const total = layout[layout.length - 1].end;
  const time = Math.min(Math.max(t, 0), Math.max(0, total - 1e-4));
  for (let i = 0; i < layout.length; i++) {
    const seg = layout[i];
    if (time < seg.start || time >= seg.end) continue;
    const next = layout[i + 1];
    if (next && next.transition.duration > 0 && time >= next.start) {
      return {
        current: seg,
        next,
        progress: (time - next.start) / next.transition.duration,
        type: next.transition.type,
      };
    }
    return { current: seg, next: null, progress: 0, type: 'none' };
  }
  return { current: layout[layout.length - 1], next: null, progress: 0, type: 'none' };
}

// Source-media time shown for a clip at timeline time t.
export function sourceTime(seg, t) {
  const local = Math.min(Math.max(t - seg.start, 0), seg.end - seg.start);
  return seg.clip.in + local * seg.clip.speed;
}

// Split the clip under timeline time t into two clips. Returns the new
// clips array, or null when t is too close to an edge.
export function splitClipAt(clips, t) {
  const layout = layoutClips(clips);
  const seg = layout.find((s) => t > s.start && t < s.end);
  if (!seg) return null;
  const cut = sourceTime(seg, t);
  const { clip } = seg;
  if (cut - clip.in < MIN_CLIP_DURATION || clip.out - cut < MIN_CLIP_DURATION) return null;
  const first = { ...clip, out: cut };
  const second = {
    ...structuredClone(clip),
    id: newId('clip'),
    in: cut,
    transition: { type: 'none', duration: clip.transition?.duration ?? 0.8 },
  };
  const result = [...clips];
  result.splice(seg.index, 1, first, second);
  return result;
}

// Insert a clip at `index` and keep everything after it in sync: texts
// (and music) that started at or after the insertion point move by however
// much the following clip moved. Returns the new clips/texts/music and the
// timeline time where the inserted clip starts. `prepare(clips)` may adjust
// the new clip list (e.g. add a transition) before positions are measured.
export function insertClip(project, index, clip, prepare) {
  const before = layoutClips(project.clips);
  const clips = project.clips.map((c) => ({ ...c, transition: { ...c.transition } }));
  clips.splice(index, 0, clip);
  prepare?.(clips);
  const after = layoutClips(clips);
  const anchor = before[index];
  const at = anchor ? anchor.start : (before.at(-1)?.end ?? 0);
  const shift = anchor ? after[index + 1].start - anchor.start : 0;
  const moved = (start) => start >= at - 1e-6 && shift !== 0;
  const texts = project.texts.map((t) => (moved(t.start) ? { ...t, start: t.start + shift, end: t.end + shift } : t));
  const overlays = (project.overlays ?? []).map((o) => (moved(o.start) ? { ...o, start: o.start + shift } : o));
  let { music } = project;
  if (music && music.start > 0 && moved(music.start)) music = { ...music, start: music.start + shift };
  return { clips, texts, overlays, music, start: after[index].start, end: after[index].end };
}

// Text direction from the first strong character (Hebrew/Arabic => rtl).
export function textDirection(text) {
  const m = /[A-Za-zÀ-ɏ֐-׿؀-ۿ]/.exec(text || '');
  return m && /[֐-׿؀-ۿ]/.test(m[0]) ? 'rtl' : 'ltr';
}

export function formatTime(seconds, withFrames = false) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const base = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (!withFrames) return base;
  const tenths = Math.floor((s * 10) % 10);
  return `${base}.${tenths}`;
}
