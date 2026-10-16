import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Anchor, ANCHOR_BOX } from './anchor';
import { Logo } from './brands';
import type { Word } from './captions';
import { AnimatedIcon } from './icons';
import { COLORS, W } from './ui';
import { HEADLINES, type Headline } from './year2026';
import { StatCount } from './Year2026';

// "AI news" bulletin: a drawn anchor at a desk, a video wall showing the real
// article behind each story, a lower third with our headline and a ticker.
// Each script line is either the opening, a story (an index into HEADLINES) or
// the sign-off. Stories quote nothing: the headline is ours, the outlet and date
// are shown, and single-report items say "לפי".

export type NewsLine = { text: string; story: number | null };

export const NEWS_SCRIPT: NewsLine[] = [
  { text: 'ערב טוב, אלה חדשות ה-AI. הנה הסיפורים הגדולים של 2026.', story: null },
  { text: 'Anthropic גייסה 65 מיליארד דולר בשווי של 965 מיליארד, ועקפה את OpenAI.', story: 5 },
  { text: 'בכנס המפתחים של OpenAI נמסר של-ChatGPT יש כבר מיליארד ומאתיים מיליון משתמשים בשבוע.', story: 13 },
  { text: 'גוגל הציגה את Gemini 4 Argon, אחרי חודשים של עיכובים.', story: 14 },
  { text: 'לפי CNBC, שמונה מדינות בארצות הברית תובעות את OpenAI בגלל חששות לבטיחות של ChatGPT.', story: 20 },
  { text: 'ולפי SiliconANGLE, לקראת ההנפקה Anthropic חשפה הכנסות של 16.8 מיליארד דולר ברבעון השלישי.', story: 21 },
  { text: 'אלה היו חדשות ה-AI. נתראה בשבוע הבא.', story: null },
];

export type NewsProps = {
  /** Voice-over in public/, e.g. "voice-news.mp3". */
  voice: string | null;
  /** Word timings of the voice-over (or estimated ones for a preview); they drive the mouth and the story changes. */
  words: Word[] | null;
  /** A real presenter in public/ instead of the drawn anchor: an image or a HeyGen video. */
  anchor: string | null;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const WALL = { x: 60, y: 180, w: 960, h: 600 };
const DESK_TOP = 1330;
const LOWER = 1570;
const TICKER = 1795;

type Segment = { from: number; to: number; line: NewsLine; index: number };

// Splits the words into the script's lines by word count, so a transcript of the
// script read aloud lines up with it.
export function newsSegments(words: Word[], fps: number, total: number): Segment[] {
  const segs: Segment[] = [];
  let w = 0;
  NEWS_SCRIPT.forEach((line, index) => {
    const n = line.text.split(/\s+/).filter(Boolean).length;
    const first = words[w];
    w += n;
    if (!first) return;
    segs.push({ from: index === 0 ? 0 : Math.round(first.start * fps) - 6, to: total, line, index });
  });
  segs.forEach((s, i) => {
    if (segs[i + 1]) s.to = segs[i + 1].from;
  });
  return segs;
}

const Studio: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #17130d 0%, ${COLORS.bgBottom} 70%)` }}>
      {/* Light columns and drifting bokeh behind the anchor */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 40 + i * 180,
            top: 0,
            width: 70,
            height: 1400,
            background: `linear-gradient(180deg, rgba(226,181,76,0) , rgba(226,181,76,${0.05 + (i % 2) * 0.03}) 60%, rgba(226,181,76,0))`,
            filter: 'blur(6px)',
          }}
        />
      ))}
      {new Array(18).fill(0).map((_, i) => {
        const x = random(`bx${i}`) * W;
        const y = 820 + random(`by${i}`) * 520 - ((frame * (0.2 + random(`bs${i}`) * 0.5)) % 600);
        const r = 10 + random(`br${i}`) * 34;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(247,220,147,${0.12 + random(`bo${i}`) * 0.16}), rgba(247,220,147,0) 70%)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 880,
          width: 800,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(226,181,76,0.22), rgba(226,181,76,0) 65%)',
        }}
      />
    </AbsoluteFill>
  );
};

const TopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.55 + Math.abs(Math.sin(frame / 9)) * 0.45;
  return (
    <div style={{ position: 'absolute', top: 60, left: 60, right: 60, height: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 80, height: 80, borderRadius: 18, background: COLORS.gold, color: COLORS.onGold, fontSize: 40, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>AI</div>
        <div style={{ fontSize: 46, fontWeight: 800, color: COLORS.ink }}>חדשות</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, direction: 'ltr' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 12, background: '#c62828', color: '#fff', fontSize: 30, fontWeight: 800 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', opacity: pulse }} />
          LIVE
        </div>
        <div style={{ fontSize: 32, fontWeight: 600, color: COLORS.muted }}>16.10.2026</div>
      </div>
    </div>
  );
};

const wallFrame: React.CSSProperties = {
  position: 'absolute',
  left: WALL.x,
  top: WALL.y,
  width: WALL.w,
  height: WALL.h,
  borderRadius: 30,
  overflow: 'hidden',
  border: `3px solid ${COLORS.gold}`,
  boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 70px rgba(226,181,76,0.15)',
  boxSizing: 'border-box',
};

// Opening and sign-off: the show's title on the wall.
const WallSting: React.FC<{ f: number; title: string; sub: string }> = ({ f, title, sub }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 12, stiffness: 140, mass: 0.8 } });
  return (
    <div style={{ ...wallFrame, background: 'radial-gradient(circle at 50% 45%, #2a2216, #0d0b08 70%)' }}>
      {[0, 1, 2].map((i) => {
        const p = ((f / 40 + i / 3) % 1);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '45%',
              width: 200 + p * 900,
              height: 200 + p * 900,
              marginLeft: -(100 + p * 450),
              marginTop: -(100 + p * 450),
              borderRadius: '50%',
              border: `3px solid ${COLORS.gold}`,
              opacity: (1 - p) * 0.5,
            }}
          />
        );
      })}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            lineHeight: 1.05,
            transform: `scale(${0.6 + s * 0.4})`,
            opacity: s,
            background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold} 55%, ${COLORS.goldDark})`,
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 44, fontWeight: 600, color: COLORS.ink, opacity: interpolate(f, [14, 24], [0, 1], clamp) }}>{sub}</div>
      </div>
    </div>
  );
};

// A story: the real article on the wall, wiped in with a gold edge.
const WallStory: React.FC<{ h: Headline; f: number }> = ({ h, f }) => {
  const { fps } = useVideoConfig();
  const wipe = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const zoom = 1 + Math.min(f * 0.0006, 0.035);
  const badge = spring({ frame: f - 12, fps, config: { damping: 12, stiffness: 170, mass: 0.6 } });
  return (
    <div style={{ ...wallFrame, background: '#fff', clipPath: `inset(0 0 0 ${(1 - wipe) * 100}%)` }}>
      {h.shot ? (
        <Img src={staticFile(h.shot)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%', transform: `scale(${zoom})`, transformOrigin: '50% 25%' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedIcon kind={h.icon} f={f} fps={fps} size={300} />
        </div>
      )}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(1 - wipe) * 100}%`, width: 14, marginLeft: -7, background: COLORS.gold, opacity: wipe < 1 ? 1 : 0 }} />
      <div
        style={{
          position: 'absolute',
          left: 22,
          bottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 24px 12px 14px',
          borderRadius: 26,
          background: 'rgba(13,11,8,0.94)',
          border: `2px solid ${COLORS.cardBorder}`,
          direction: 'ltr',
          transform: `scale(${badge})`,
          transformOrigin: '0% 100%',
        }}
      >
        <AnimatedIcon kind={h.icon} f={Math.max(0, f - 12)} fps={fps} size={100} />
        {h.stat && (
          <span
            style={{
              fontSize: 70,
              fontWeight: 800,
              lineHeight: 1,
              background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold} 55%, ${COLORS.goldDark})`,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            <StatCount stat={h.stat} f={Math.max(0, f - 12)} />
          </span>
        )}
      </div>
    </div>
  );
};

const Desk: React.FC = () => (
  <>
    <svg width={W} height={260} viewBox={`0 0 ${W} 260`} style={{ position: 'absolute', left: 0, top: DESK_TOP }}>
      <defs>
        <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262017" />
          <stop offset="1" stopColor="#0b0a08" />
        </linearGradient>
      </defs>
      <polygon points={`90,0 ${W - 90},0 ${W - 20},240 20,240`} fill="url(#desk)" />
      <polygon points={`90,0 ${W - 90},0 ${W - 84},10 84,10`} fill={COLORS.gold} />
      <line x1={60} y1={120} x2={W - 60} y2={120} stroke={COLORS.goldDark} strokeWidth={2} opacity={0.5} />
    </svg>
    <div style={{ position: 'absolute', top: DESK_TOP + 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, direction: 'ltr' }}>
      <div style={{ padding: '4px 16px', borderRadius: 12, background: COLORS.gold, color: COLORS.onGold, fontSize: 52, fontWeight: 800 }}>AI</div>
      <div style={{ fontSize: 56, fontWeight: 800, color: COLORS.ink, letterSpacing: 6 }}>NEWS</div>
    </div>
  </>
);

const LowerThird: React.FC<{ f: number; tag: string; title: string; meta: string; brand?: Headline['brand'] }> = ({ f, tag, title, meta, brand }) => {
  const { fps } = useVideoConfig();
  const tagIn = spring({ frame: f, fps, config: { damping: 14, stiffness: 180, mass: 0.6 } });
  const bar = interpolate(f, [4, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const text = interpolate(f, [12, 20], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', top: LOWER, left: 40, right: 40, direction: 'rtl' }}>
      <div style={{ display: 'flex', minHeight: 120 }}>
        <div
          style={{
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            background: COLORS.gold,
            color: COLORS.onGold,
            fontSize: 46,
            fontWeight: 800,
            borderRadius: '0 20px 20px 0',
            transform: `translateX(${(1 - tagIn) * 260}px)`,
            zIndex: 2,
          }}
        >
          {tag}
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '14px 28px',
            background: '#f7f3ea',
            borderRadius: '20px 0 0 20px',
            transform: `scaleX(${bar})`,
            transformOrigin: '100% 50%',
          }}
        >
          <div style={{ flex: 1, fontSize: 40, fontWeight: 800, lineHeight: 1.18, color: COLORS.onGold, opacity: text }}>{title}</div>
          {brand && (
            <div style={{ opacity: text, display: 'flex' }}>
              <Logo brand={brand} size={72} />
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10, marginRight: 20, display: 'inline-block', padding: '6px 18px', borderRadius: 10, background: 'rgba(13,11,8,0.9)', border: `2px solid ${COLORS.cardBorder}`, color: COLORS.goldLight, fontSize: 30, fontWeight: 600, opacity: text }}>
        {meta}
      </div>
    </div>
  );
};

const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const items = HEADLINES.map((h) => `${h.text} · ${h.outlet}`);
  return (
    <div style={{ position: 'absolute', top: TICKER, left: 0, right: 0, height: 76, background: '#0d0b08', borderTop: `3px solid ${COLORS.gold}`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, transform: `translateX(${frame * 3}px)`, display: 'flex', alignItems: 'center', direction: 'rtl', whiteSpace: 'nowrap', paddingRight: 210 }}>
        {items.map((t, i) => (
          <span key={i} style={{ fontSize: 34, fontWeight: 600, color: COLORS.ink, marginLeft: 26 }}>
            {t}
            <span style={{ color: COLORS.gold, marginRight: 26 }}>◆</span>
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 190, background: COLORS.gold, color: COLORS.onGold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800 }}>
        עכשיו
      </div>
    </div>
  );
};

// Mouth openness from the word timings: syllable-rate flapping inside words, closed between them.
const mouth = (words: Word[], t: number) => {
  const i = words.findIndex((w) => t >= w.start && t < w.end);
  if (i < 0) return 0;
  const w = words[i];
  const rate = 4.5 + random(`m${i}`) * 2.5;
  return 0.25 + Math.abs(Math.sin((t - w.start) * Math.PI * rate)) * 0.75;
};

export const NewsCast: React.FC<NewsProps> = ({ voice, words, anchor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ws = words ?? [];
  const segs = React.useMemo(() => newsSegments(ws, fps, durationInFrames), [ws, fps, durationInFrames]);
  const seg = segs.find((s) => frame >= s.from && frame < s.to) ?? segs[0];
  const f = seg ? frame - seg.from : frame;
  const t = frame / fps;
  const h = seg?.line.story != null ? HEADLINES[seg.line.story] : null;
  const isLast = seg && seg.index === NEWS_SCRIPT.length - 1;

  const talk = mouth(ws, t);
  const gesture = h ? interpolate(f, [8, 18, 50, 64], [0, 1, 1, 0], clamp) : 0;
  const blink = (frame % 97) < 4 ? 1 : 0;
  const tilt = Math.sin(t * 1.3) * 1.8 + talk * 1.2;
  const look = h ? interpolate(f, [0, 10, 30, 45], [0, -1, -1, 0], clamp) : 0;
  const breathe = Math.sin(t * 2) * 3;
  const push = interpolate(frame, [0, 45], [1.06, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif', direction: 'rtl', background: COLORS.bgBottom }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 60%' }}>
        <Studio />
        {anchor ? (
          <div style={{ position: 'absolute', left: 240, top: 840, width: 600, height: 560, borderRadius: 36, overflow: 'hidden', border: `4px solid ${COLORS.gold}` }}>
            {/\.(mp4|webm|mov)$/i.test(anchor) ? (
              <OffthreadVideo src={staticFile(anchor)} muted={!!voice} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Img src={staticFile(anchor)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
            )}
          </div>
        ) : (
          <div style={{ position: 'absolute', left: (W - ANCHOR_BOX.w) / 2, top: 800 + breathe, transform: 'scale(1.12)', transformOrigin: '50% 100%' }}>
            <Anchor talk={talk} gesture={gesture} blink={blink} tilt={tilt} look={look} />
          </div>
        )}
        <Desk />
        {seg && (h ? <WallStory key={seg.index} h={h} f={f} /> : <WallSting f={f} title="חדשות ה-AI" sub={isLast ? 'נתראה בשבוע הבא' : 'מהדורה שבועית'} />)}
      </AbsoluteFill>
      <TopBar />
      {seg &&
        (h ? (
          <LowerThird key={seg.index} f={f} tag="מבזק" title={h.text} meta={`${h.reported ? 'לפי ' : ''}${h.outlet} · ${h.date}`} brand={h.brand} />
        ) : (
          <LowerThird key={seg.index} f={f} tag="AI" title={isLast ? 'זה היה סיכום השבוע' : 'הסיפורים הגדולים של 2026'} meta="16.10.2026 · הכותרות בניסוח שלנו" />
        ))}
      <Ticker />
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
