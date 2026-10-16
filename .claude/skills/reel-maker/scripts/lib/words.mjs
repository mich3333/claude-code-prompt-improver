// Word timings: one format for every transcriber, script alignment, cue lookup,
// jump-cut planning and SRT. Pure functions (no I/O) so they are easy to test.
//
// The standard format is ElevenLabs Scribe's: [{ text, start, end, type: 'word' }]
// with times in seconds. Only words are kept; spacing/audio events are dropped.

const HEB_PUNCT = /[֑-ׇ]/g; // niqqud and cantillation marks
const EDGE = /^[\s"'“”„«»()[\]{}.,!?:;…\-–—׳״]+|[\s"'“”„«»()[\]{}.,!?:;…\-–—׳״]+$/g;

// Comparable form of a word: no niqqud, no edge punctuation, lower case,
// and the Hebrew final letters folded (ם→מ etc.), so ASR spelling slips still match.
export function norm(word) {
  return String(word).normalize('NFC').replace(HEB_PUNCT, '').replace(EDGE, '').toLowerCase()
    .replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ');
}

const word = (text, start, end) => ({ text: String(text).trim(), start: +Number(start).toFixed(3), end: +Number(end).toFixed(3), type: 'word' });
const isBracketTag = (t) => /^\[[^\]]*\]$/.test(String(t).trim()); // eleven_v3 delivery tags like [excited]

// Any transcriber's JSON -> standard words.
//  - ElevenLabs Scribe (API, or the connector's transcripts[0].words)
//  - OpenAI Whisper / mlx-whisper / faster-whisper dumps / stable-ts (segments[].words[] {word,start,end})
//  - whisper.cpp -oj / -ojf (transcription[] with offsets in ms, or tokens with offsets)
//  - a plain array of {text|word, start, end}
export function normalizeWords(data) {
  let out = [];
  const pick = (list) => list.map((w) => word(w.text ?? w.word, w.start, w.end));
  if (Array.isArray(data)) out = pick(data.filter((w) => (w.type ?? 'word') === 'word'));
  else if (data?.transcripts?.[0]?.words) out = pick(data.transcripts[0].words.filter((w) => (w.type ?? 'word') === 'word'));
  else if (Array.isArray(data?.words)) out = pick(data.words.filter((w) => (w.type ?? 'word') === 'word'));
  else if (Array.isArray(data?.segments)) out = pick(data.segments.flatMap((s) => s.words ?? []));
  else if (Array.isArray(data?.transcription)) out = whisperCpp(data.transcription);
  else throw new Error('unknown transcript format (expected Scribe, Whisper or whisper.cpp JSON)');
  return out.filter((w) => w.text && !isBracketTag(w.text) && w.end >= w.start);
}

// whisper.cpp: with -ml 1 -sow every entry is one word; with -ojf the tokens
// carry their own offsets, and a token starting with a space begins a new word.
function whisperCpp(entries) {
  const ms = (o) => Number(o) / 1000;
  const words = [];
  for (const e of entries) {
    const tokens = (e.tokens ?? []).filter((t) => !/^\[_|^\[/.test(t.text) && t.offsets);
    if (!tokens.length) {
      if (e.text?.trim()) for (const part of splitEvenly(e.text, ms(e.offsets.from), ms(e.offsets.to))) words.push(part);
      continue;
    }
    for (const t of tokens) {
      const last = words[words.length - 1];
      if (last && !/^\s/.test(t.text) && words.length && last._open) {
        last.text += t.text;
        last.end = ms(t.offsets.to);
      } else {
        words.push({ ...word(t.text, ms(t.offsets.from), ms(t.offsets.to)), _open: true });
      }
    }
    if (words.length) words[words.length - 1]._open = false;
  }
  return words.map(({ _open, ...w }) => word(w.text, w.start, w.end));
}

// A segment without word times: spread its words over it by length.
function splitEvenly(text, start, end) {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  const total = parts.reduce((n, p) => n + p.length, 0) || 1;
  let t = start;
  return parts.map((p) => {
    const d = ((end - start) * p.length) / total;
    const w = word(p, t, t + d);
    t += d;
    return w;
  });
}

// Replace what the recogniser heard with the script that was actually read,
// keeping the recogniser's timings: the words are matched in order (LCS on the
// normalized forms); script words with no match get times interpolated between
// their matched neighbours. Use it when the narration text is known (TTS or a
// read script) so captions show exact spelling, names and numbers.
export function alignToScript(words, script) {
  const target = String(script).replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter((t) => norm(t));
  const a = words.map((w) => norm(w.text));
  const b = target.map(norm);
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i][j] = a[i] === b[j] || similar(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const match = new Array(m).fill(-1);
  for (let i = 0, j = 0; i < n && j < m;) {
    if ((a[i] === b[j] || similar(a[i], b[j])) && L[i][j] === L[i + 1][j + 1] + 1) { match[j] = i; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  // Unmatched runs of script words share the time between matched neighbours.
  const out = [];
  for (let j = 0; j < m;) {
    if (match[j] >= 0) { const w = words[match[j]]; out.push(word(target[j], w.start, w.end)); j++; continue; }
    let k = j;
    while (k < m && match[k] < 0) k++;
    const from = out.length ? out[out.length - 1].end : (words[0]?.start ?? 0);
    const to = k < m ? words[match[k]].start : (words[words.length - 1]?.end ?? from + 0.4 * (k - j));
    const span = Math.max(0.12 * (k - j), to - from);
    for (let x = j; x < k; x++) out.push(word(target[x], from + (span * (x - j)) / (k - j), from + (span * (x - j + 1)) / (k - j)));
    j = k;
  }
  return out;
}

// Two words are "similar" when one letter at most differs (typical ASR slips).
function similar(x, y) {
  if (!x || !y || Math.abs(x.length - y.length) > 1 || Math.min(x.length, y.length) < 3) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (x.length > y.length) i++;
    else if (y.length > x.length) j++;
    else { i++; j++; }
  }
  return edits + (x.length - i) + (y.length - j) <= 1;
}

// Start time of the first occurrence of `phrase` at or after `after` seconds
// (whole words, normalized), or null. Used to cut scenes on the word.
export function findPhrase(words, phrase, after = 0) {
  const p = String(phrase).split(/\s+/).map(norm).filter(Boolean);
  if (!p.length) return null;
  for (let i = 0; i + p.length <= words.length; i++) {
    if (words[i].start + 1e-6 < after) continue;
    if (p.every((t, k) => norm(words[i + k].text) === t || norm(words[i + k].text).endsWith(t) && t.length >= 3)) {
      return { start: words[i].start, end: words[i + p.length - 1].end, index: i };
    }
  }
  return null;
}

// Hebrew (and English) hesitation sounds that are always safe to cut.
// "כאילו", "בעצם", "כזה" are often real words: list them in `extraFillers` only on purpose.
export const FILLERS = ['אממ', 'אמ', 'אה', 'אהה', 'אהם', 'אמממ', 'הממ', 'ממ', 'מממ', 'אההה', 'uh', 'um', 'umm', 'uhm', 'erm', 'hmm'];

// Which parts of the recording to keep: speech, minus fillers, minus pauses
// longer than `maxGap` (each kept part gets `pad` seconds of air on both sides).
// Returns segments [{ start, end }] in source time.
export function planCuts(words, { duration, maxGap = 0.35, pad = 0.08, fillers = true, extraFillers = [] } = {}) {
  const drop = new Set([...(fillers ? FILLERS : []), ...extraFillers].map(norm));
  const spoken = words.filter((w) => !drop.has(norm(w.text)));
  if (!spoken.length) return [{ start: 0, end: duration ?? 0 }];
  const end = duration ?? spoken[spoken.length - 1].end + pad;
  const segs = [];
  for (const w of spoken) {
    const s = Math.max(0, w.start - pad);
    const e = Math.min(end, w.end + pad);
    const last = segs[segs.length - 1];
    if (last && s - last.end <= Math.max(0, maxGap - 2 * pad)) last.end = Math.max(last.end, e);
    else segs.push({ start: s, end: e });
  }
  // Overlapping pads after a short drop (e.g. a cut filler) just merge.
  return segs.reduce((acc, sg) => {
    const last = acc[acc.length - 1];
    if (last && sg.start <= last.end) last.end = Math.max(last.end, sg.end);
    else acc.push({ ...sg });
    return acc;
  }, []).map((sg) => ({ start: +sg.start.toFixed(3), end: +sg.end.toFixed(3) }));
}

// Move word times from source time to the cut timeline (words inside dropped
// parts disappear).
export function remapWords(words, segments) {
  const out = [];
  let offset = 0;
  for (const sg of segments) {
    for (const w of words) {
      if (w.start >= sg.start - 1e-6 && w.end <= sg.end + 1e-6) out.push(word(w.text, w.start - sg.start + offset, w.end - sg.start + offset));
    }
    offset += sg.end - sg.start;
  }
  return out;
}

// SRT subtitles from words, `perLine` words per cue (also breaks on pauses and
// sentence ends). Handy for uploading captions to TikTok/YouTube or CapCut.
export function toSrt(words, perLine = 4, gap = 0.6) {
  const cues = [];
  let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= perLine || w.start - prev.end > gap || /[.!?]$/.test(prev.text))) { cues.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) cues.push(cur);
  const ts = (s) => {
    const msAll = Math.round(s * 1000);
    const h = Math.floor(msAll / 3600000);
    const mi = Math.floor((msAll % 3600000) / 60000);
    const se = Math.floor((msAll % 60000) / 1000);
    const ms = msAll % 1000;
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };
  return cues.map((c, i) => `${i + 1}\n${ts(c[0].start)} --> ${ts(c[c.length - 1].end)}\n${c.map((w) => w.text).join(' ')}\n`).join('\n');
}
