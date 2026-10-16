import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from './ui';

// Word-timed captions. Words come from a transcription (ElevenLabs Scribe gives
// { text, start, end } per word, in seconds); until there is a recording,
// estimateWords() spreads the script at a speaking pace for a preview.

export type Word = { text: string; start: number; end: number };

export const SCRIPT_2026 = [
  '2026. השנה שבה ה-AI השתגע.',
  'בינואר, אמודיי דיבר על מדינה של גאונים במרכז נתונים.',
  'במרץ, OpenAI הגיעה לשווי של 852 מיליארד דולר.',
  'במאי, Anthropic עקפה אותה, עם 965 מיליארד.',
  'ובספטמבר, ל-ChatGPT כבר היו מיליארד ומאתיים מיליון משתמשים בשבוע.',
  'ועוד לא סיימנו את השנה. 2026, שנת ה-AI.',
];

export function estimateWords(sentences: string[], { start = 0.4, wordsPerSecond = 2.6, pause = 0.35 } = {}): Word[] {
  const words: Word[] = [];
  let t = start;
  for (const sentence of sentences) {
    for (const text of sentence.split(/\s+/).filter(Boolean)) {
      const len = Math.max(0.22, (0.75 + text.length * 0.06) / wordsPerSecond);
      words.push({ text, start: t, end: t + len });
      t += len;
    }
    t += pause;
  }
  return words;
}

// Short captions (up to `max` words), breaking after punctuation or a pause.
export function groupWords(words: Word[], max = 3): Word[][] {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const brk = /[.,!?:;]$/.test(w.text) || !next || next.start - w.end > 0.35 || cur.length >= max;
    if (brk) {
      groups.push(cur);
      cur = [];
    }
  });
  return groups;
}

const clean = (t: string) => t.replace(/[.,!?:;]+$/, '');

export const Captions: React.FC<{ words: Word[]; top?: number }> = ({ words, top = 1380 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const groups = React.useMemo(() => groupWords(words), [words]);
  const group = groups.find((g, i) => t >= g[0].start - 0.05 && t < (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.6));
  if (!group) return null;
  return (
    <>
    {/* A dark band behind the words keeps them readable over moving cards. */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: top - 140,
        bottom: 0,
        background: `linear-gradient(180deg, rgba(${COLORS.deepRGB},0), rgba(${COLORS.deepRGB},0.88) 38%, rgba(${COLORS.deepRGB},0.95))`,
        zIndex: 9,
      }}
    />
    <div
      style={{
        position: 'absolute',
        top,
        left: 60,
        right: 60,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 22px',
        direction: 'rtl',
        zIndex: 10,
      }}
    >
      {group.map((w, i) => {
        const appear = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
        const speaking = t >= w.start && t < w.end + 0.08;
        const shown = t >= w.start - 0.02;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.15,
              color: speaking ? COLORS.gold : COLORS.white,
              opacity: shown ? 1 : 0.0,
              transform: `translateY(${(1 - appear) * 26}px) scale(${shown ? 0.82 + appear * 0.18 + (speaking ? 0.05 : 0) : 0.82})`,
              textShadow: '0 6px 28px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)',
              unicodeBidi: 'isolate',
            }}
          >
            {clean(w.text)}
          </span>
        );
      })}
    </div>
    </>
  );
};

/** Seconds at which a word containing `needle` is first spoken, or null. */
export const firstSpoken = (words: Word[], needle: string) => words.find((w) => w.text.includes(needle))?.start ?? null;

export const fadeWindow = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, from + 8, to - 8, to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
