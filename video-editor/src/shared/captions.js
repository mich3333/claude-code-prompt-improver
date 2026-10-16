// Automatic captions: which audio to transcribe, mapping the transcript's
// word timings onto the timeline, and grouping words into short captions.

import { createText, layoutClips } from './timeline.js';

export const CAPTION_POSITIONS = { top: 'למעלה', middle: 'באמצע', bottom: 'למטה' };
const POSITION_Y = { top: 0.16, middle: 0.5, bottom: 0.78 };

export const CAPTION_LANGUAGES = { auto: 'זיהוי אוטומטי', heb: 'עברית', eng: 'אנגלית', ara: 'ערבית', rus: 'רוסית' };

const MIN_CAPTION = 0.35; // seconds a caption stays up at least
const BRIDGE_GAP = 0.4; // shorter pauses keep the previous caption up (no flicker)

// One piece of audio per audible video clip, with where it sits on the timeline.
export function captionSources(project) {
  return layoutClips(project.clips)
    .filter(({ clip }) => clip.kind === 'video' && clip.hasAudio && !clip.muted && clip.volume > 0)
    .map(({ clip, start, end }) => ({
      id: clip.id, path: clip.path, in: clip.in, out: clip.out, speed: clip.speed, start, end,
    }));
}

// Transcript words (seconds from the start of the extracted piece) -> timeline
// words. Spacing and sound tags are dropped; words past the clip's end are cut.
export function toTimelineWords(source, words) {
  const out = [];
  for (const w of words ?? []) {
    if ((w.type ?? 'word') !== 'word') continue;
    const text = String(w.text ?? '').trim();
    // Sound and delivery tags ("[excited]", "(laughs)") can come back typed as words.
    if (!text || /^[[(].*[\])]$/u.test(text) || !(w.end >= w.start)) continue;
    const start = source.start + w.start / source.speed;
    if (start >= source.end - 0.05) continue;
    out.push({ text, start, end: Math.min(source.end, source.start + w.end / source.speed) });
  }
  return out;
}

const round = (t) => Math.round(t * 1000) / 1000;
const ENDS_PHRASE = /[.!?,;:…]["'”״׳)]*$/u;

// Short captions of up to maxWords words (and maxChars characters), breaking
// at punctuation and pauses. Captions never overlap.
export function groupWords(words, { maxWords = 3, maxChars = 18, maxGap = 0.5 } = {}) {
  const chunks = [];
  let cur = null;
  for (const w of [...words].sort((a, b) => a.start - b.start)) {
    const breaks = !cur || cur.endsPhrase || w.start - cur.end > maxGap
      || cur.words.length >= maxWords || `${cur.text} ${w.text}`.length > maxChars;
    if (breaks) {
      cur = { words: [], text: '', start: w.start, end: w.end };
      chunks.push(cur);
    }
    cur.words.push(w);
    cur.text = cur.text ? `${cur.text} ${w.text}` : w.text;
    cur.end = Math.max(cur.end, w.end);
    cur.endsPhrase = ENDS_PHRASE.test(w.text);
  }
  return chunks.map((c, i) => {
    const next = chunks[i + 1];
    let end = Math.max(c.end, c.start + MIN_CAPTION);
    if (next && next.start - c.end < BRIDGE_GAP) end = Math.max(end, next.start);
    if (next) end = Math.min(end, next.start);
    // A trailing comma or full stop reads as noise in a short caption; keep ? and !.
    const text = c.text.replace(/[,.;:،]+$/u, '');
    return { start: round(c.start), end: round(Math.max(end, c.start + 0.05)), text };
  });
}

// Caption looks: big white with an outline, or red on the split-screen seam
// (the black-and-gold reference style).
export const CAPTION_LOOKS = {
  classic: { label: 'לבן', look: { size: 0.085, color: '#ffffff', font: 'rubik', bold: true, style: 'outline' } },
  red: { label: 'אדום (כמו ברפרנס)', look: { size: 0.062, color: '#ef4444', font: 'rubik', bold: true, style: 'shadow' } },
  headline: { label: 'כותרת לבנה גדולה', look: { size: 0.078, color: '#ffffff', font: 'rubik', bold: true, style: 'shadow' } },
};

// Caption texts in the editor's text format, marked so they can be replaced.
export function captionTexts(chunks, { position = 'bottom', look = 'classic' } = {}) {
  return chunks.map((c) => ({
    ...createText(c.start, c.end),
    text: c.text,
    y: POSITION_Y[position] ?? POSITION_Y.bottom,
    ...(CAPTION_LOOKS[look] ?? CAPTION_LOOKS.classic).look,
    animation: 'none',
    caption: true,
  }));
}

// Where captions go by default: on the seam of a split screen, else at the bottom.
export function defaultCaptionPosition(project) {
  return (project.overlays ?? []).some((o) => o.region !== 'full') ? 'middle' : 'bottom';
}

// Look shared by all captions (copied by "apply to all captions").
export const CAPTION_LOOK = ['x', 'y', 'size', 'color', 'font', 'bold', 'style', 'boxColor', 'boxOpacity', 'animation'];
