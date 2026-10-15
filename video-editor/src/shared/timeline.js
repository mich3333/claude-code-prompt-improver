// Project model and timeline math, shared by the renderer (preview, timeline
// UI) and the main process (export). Pure functions only.

export const ASPECTS = {
  '16:9': { label: 'Landscape 16:9', w: 16, h: 9 },
  '9:16': { label: 'Vertical 9:16', w: 9, h: 16 },
  '1:1': { label: 'Square 1:1', w: 1, h: 1 },
  '4:5': { label: 'Portrait 4:5', w: 4, h: 5 },
};

export const TRANSITIONS = {
  none: 'Cut',
  fade: 'Crossfade',
  fadeblack: 'Fade through black',
  fadewhite: 'Fade through white',
  wipeleft: 'Wipe left',
  wiperight: 'Wipe right',
  slideleft: 'Slide left',
  slideright: 'Slide right',
  circleopen: 'Circle open',
};

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

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
  return { version: 1, aspect: '16:9', clips: [], texts: [], music: null };
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
    filter: 'none',
    brightness: 100,
    contrast: 100,
    saturation: 100,
    transition: { type: 'none', duration: 0.8 }, // transition INTO this clip
  };
}

export function createText(start, end) {
  return {
    id: newId('text'),
    text: 'Your text',
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
    animation: 'fade', // none | fade
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
