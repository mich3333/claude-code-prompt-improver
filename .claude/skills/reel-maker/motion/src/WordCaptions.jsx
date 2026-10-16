import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { HEAVY } from './theme.js';

// TikTok-style captions with the spoken word highlighted, from word timings
// (ElevenLabs Scribe / Whisper words.json: [{ text, start, end, type }]).
// Rendered on a transparent background as an overlay for the whole reel.
//   props: { words, perPage: 3, color, active, y: 0.62, size: 92, offset: 0 }
export function pages(words, perPage = 3, gap = 0.6) {
  const clean = words
    .filter((w) => (w.type ?? 'word') === 'word' && !/^\[.*\]$/.test(String(w.text).trim()) && String(w.text).trim())
    .map((w) => ({ text: String(w.text).trim(), start: Number(w.start), end: Number(w.end) }));
  const out = [];
  let cur = [];
  for (const w of clean) {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= perPage || w.start - prev.end > gap || /[.!?,:]$/.test(prev.text))) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out.map((ws, i) => ({ words: ws, start: ws[0].start, end: Math.min(ws[ws.length - 1].end + 0.25, out[i + 1]?.[0].start ?? Infinity) }));
}

export function WordCaptions({ words = [], perPage = 3, color = '#ffffff', active = '#ffd23f', y = 0.62, size = 92, offset = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps - offset;
  const page = pages(words, perPage).find((p) => time >= p.start && time < p.end);
  if (!page) return null;
  const pop = spring({ frame: frame - Math.round((page.start + offset) * fps), fps, config: { damping: 15, stiffness: 220 }, durationInFrames: 8 });

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 60, right: 60, top: `${y * 100}%`, transform: `translateY(-50%) scale(${0.9 + 0.1 * pop})`,
        direction: 'rtl', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.34,
      }}>
        {page.words.map((w, i) => {
          const on = time >= w.start && time < (page.words[i + 1]?.start ?? page.end);
          return (
            <span key={i} style={{
              fontFamily: HEAVY, fontWeight: 900, fontSize: size, lineHeight: 1.15, color: on ? active : color,
              WebkitTextStroke: `${Math.round(size / 14)}px #000`, paintOrder: 'stroke fill',
              textShadow: '0 6px 18px rgba(0,0,0,0.55)', transform: on ? 'scale(1.08)' : 'none', display: 'inline-block',
            }}><bdi>{w.text}</bdi></span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
