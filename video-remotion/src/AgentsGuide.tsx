import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Anchor, ANCHOR_BOX } from './anchor';
import { AGENTS_SCRIPT, type Screen } from './agents';
import type { Word } from './captions';
import { Phone } from './phone';
import { COLORS, W } from './ui';

// "Which AI agents actually make you money": the presenter talks at the
// bottom, a phone above shows one screen per sentence (lists, tool cards with
// prices, a side-by-side comparison, a "which one fits you" guide), and one
// big caption word sits between them. Every figure on screen comes from
// agents.ts, where each has a source.

export type AgentsProps = {
  voice: string | null;
  words: Word[] | null;
  /** Filmed presenter in public/, e.g. "face.mp4". null shows the drawn anchor. */
  face: string | null;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const PHONE = { w: 660, h: 1110, top: 270 };
const FACE = { x: 40, y: 1490, w: 1000, h: 390 };

type Seg = { from: number; to: number; i: number };
const segments = (words: Word[], fps: number, total: number): Seg[] => {
  const segs: Seg[] = [];
  let w = 0;
  AGENTS_SCRIPT.forEach((line, i) => {
    const first = words[w];
    w += line.text.split(/\s+/).filter(Boolean).length;
    if (first) segs.push({ from: i === 0 ? 0 : Math.round(first.start * fps) - 4, to: total, i });
  });
  segs.forEach((s, k) => {
    if (segs[k + 1]) s.to = segs[k + 1].from;
  });
  return segs;
};

const pop = (f: number, delay: number, fps: number) => spring({ frame: f - delay, fps, config: { damping: 15, stiffness: 190, mass: 0.6 } });

const Kicker: React.FC<{ text: string; title: string; f: number }> = ({ text, title, f }) => {
  const { fps } = useVideoConfig();
  const s = pop(f, 0, fps);
  return (
    <div style={{ padding: '18px 30px 10px', opacity: s, transform: `translateY(${(1 - s) * 20}px)` }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.gold, letterSpacing: 1 }}>{text}</div>
      <div style={{ fontSize: 55, fontWeight: 800, color: COLORS.ink, lineHeight: 1.12, marginTop: 6 }}>{title}</div>
    </div>
  );
};

const Row: React.FC<{ f: number; k: number; children: React.ReactNode }> = ({ f, k, children }) => {
  const { fps } = useVideoConfig();
  const s = pop(f, 8 + k * 7, fps);
  return (
    <div
      style={{
        margin: '0 24px 18px',
        padding: '20px 24px',
        borderRadius: 22,
        background: COLORS.card,
        border: `2px solid ${COLORS.cardBorder}`,
        opacity: Math.min(1, s * 1.4),
        transform: `translateX(${(1 - s) * 80}px)`,
      }}
    >
      {children}
    </div>
  );
};

const ScreenView: React.FC<{ screen: Screen; f: number }> = ({ screen, f }) => {
  const { fps } = useVideoConfig();
  switch (screen.kind) {
    case 'title': {
      const s = pop(f, 4, fps);
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', gap: 18 }}>
          <div style={{ fontSize: 35, fontWeight: 700, color: COLORS.gold, opacity: s }}>{screen.kicker}</div>
          <div style={{ fontSize: 82, fontWeight: 800, color: COLORS.ink, lineHeight: 1.08, transform: `scale(${0.85 + s * 0.15})`, transformOrigin: '100% 50%', opacity: s }}>{screen.title}</div>
          {screen.sub && <div style={{ fontSize: 38, color: COLORS.muted, lineHeight: 1.3, opacity: interpolate(f, [16, 26], [0, 1], clamp) }}>{screen.sub}</div>}
        </div>
      );
    }
    case 'list':
      return (
        <>
          <Kicker text={screen.kicker} title={screen.title} f={f} />
          {screen.items.map((it, k) => (
            <Row key={k} f={f} k={k}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 54, height: 54, borderRadius: 27, border: `2px solid ${COLORS.gold}`, color: COLORS.gold, fontSize: 30, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k + 1}</div>
                <div>
                  <div style={{ fontSize: 39, fontWeight: 700, color: COLORS.ink, lineHeight: 1.2 }}>{it.text}</div>
                  {it.note && <div style={{ fontSize: 29, color: COLORS.muted, marginTop: 4, lineHeight: 1.25 }}>{it.note}</div>}
                </div>
              </div>
            </Row>
          ))}
        </>
      );
    case 'tools':
      return (
        <>
          <Kicker text={screen.kicker} title={screen.title} f={f} />
          {screen.items.map((it, k) => (
            <Row key={k} f={f} k={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.ink, direction: 'ltr' }}>{it.name}</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.gold, direction: 'ltr', whiteSpace: 'nowrap' }}>{it.price}</div>
              </div>
              <div style={{ fontSize: 30, color: COLORS.muted, marginTop: 4, lineHeight: 1.25 }}>{it.what}</div>
            </Row>
          ))}
        </>
      );
    case 'compare':
      return (
        <>
          <Kicker text={screen.kicker} title={screen.title} f={f} />
          <div style={{ display: 'flex', margin: '6px 22px 10px', gap: 10, direction: 'rtl' }}>
            <div style={{ width: 150 }} />
            {[screen.a, screen.b].map((n) => (
              <div key={n} style={{ flex: 1, textAlign: 'center', fontSize: 35, fontWeight: 800, color: COLORS.ink, padding: '10px 0', borderRadius: 16, border: `2px solid ${COLORS.cardBorder}`, direction: 'ltr' }}>{n}</div>
            ))}
          </div>
          {screen.rows.map((r, k) => {
            const s = pop(f, 10 + k * 7, fps);
            return (
              <div key={k} style={{ display: 'flex', margin: '0 22px 10px', gap: 10, alignItems: 'stretch', opacity: s, transform: `translateY(${(1 - s) * 20}px)`, direction: 'rtl' }}>
                <div style={{ width: 150, fontSize: 29, fontWeight: 700, color: COLORS.gold, display: 'flex', alignItems: 'center' }}>{r.label}</div>
                {[r.a, r.b].map((v, j) => (
                  <div key={j} style={{ flex: 1, padding: '12px 10px', borderRadius: 16, background: COLORS.card, fontSize: 28, fontWeight: 600, color: COLORS.ink, textAlign: 'center', lineHeight: 1.25 }}>{v}</div>
                ))}
              </div>
            );
          })}
          {screen.source && <div style={{ margin: '8px 26px', fontSize: 22, color: COLORS.muted }}>{screen.source}</div>}
        </>
      );
    case 'match':
      return (
        <>
          <Kicker text={screen.kicker} title={screen.title} f={f} />
          {screen.items.map((it, k) => (
            <Row key={k} f={f} k={k}>
              <div style={{ fontSize: 32, color: COLORS.muted, lineHeight: 1.2 }}>{it.when}</div>
              <div style={{ fontSize: 39, fontWeight: 800, color: COLORS.ink, marginTop: 6, lineHeight: 1.2 }}>← {it.use}</div>
            </Row>
          ))}
        </>
      );
    case 'cta': {
      const s = pop(f, 10, fps);
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: '0 34px', textAlign: 'center' }}>
          <div style={{ fontSize: 70, fontWeight: 800, color: COLORS.ink, lineHeight: 1.12 }}>{screen.title}</div>
          <div style={{ padding: '18px 36px', borderRadius: 40, border: `3px solid ${COLORS.gold}`, color: COLORS.gold, fontSize: 45, fontWeight: 800, transform: `scale(${s})` }}>{screen.button}</div>
        </div>
      );
    }
  }
};

const BigWord: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const i = words.findIndex((w, k) => t >= w.start - 0.03 && t < (words[k + 1]?.start ?? w.end + 0.5));
  if (i < 0) return null;
  const w = words[i];
  const s = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
  return (
    <div style={{ position: 'absolute', top: 1392, left: 0, right: 0, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', zIndex: 6 }}>
      <span style={{ fontSize: 76, fontWeight: 800, color: /[A-Za-z]/.test(w.text) ? COLORS.goldLight : COLORS.white, transform: `scale(${0.7 + s * 0.3})`, textShadow: '0 6px 24px rgba(0,0,0,0.85)', unicodeBidi: 'isolate' }}>
        {w.text.replace(/[.,!?:;]+$/, '')}
      </span>
    </div>
  );
};

const mouth = (words: Word[], t: number) => {
  const i = words.findIndex((w) => t >= w.start && t < w.end);
  if (i < 0) return 0;
  return 0.25 + Math.abs(Math.sin((t - words[i].start) * Math.PI * (4.5 + random(`m${i}`) * 2.5))) * 0.75;
};

const Presenter: React.FC<{ face: string | null; words: Word[]; voice: string | null }> = ({ face, words, voice }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <div style={{ position: 'absolute', left: FACE.x, top: FACE.y, width: FACE.w, height: FACE.h, borderRadius: 40, overflow: 'hidden', border: `3px solid ${COLORS.cardBorder}`, background: `radial-gradient(ellipse at 50% 70%, ${COLORS.raised}, ${COLORS.deep} 75%)` }}>
      {face ? (
        /\.(mp4|webm|mov)$/i.test(face) ? (
          <OffthreadVideo src={staticFile(face)} muted={!!voice} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={staticFile(face)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%' }} />
        )
      ) : (
        <div style={{ position: 'absolute', left: (FACE.w - ANCHOR_BOX.w) / 2, top: 8 + Math.sin(t * 2) * 3 }}>
          <Anchor talk={mouth(words, t)} gesture={0} blink={frame % 97 < 4 ? 1 : 0} tilt={Math.sin(t * 1.3) * 2} look={0} />
        </div>
      )}
    </div>
  );
};

export const AgentsGuide: React.FC<AgentsProps> = ({ voice, words, face }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ws = words ?? [];
  const segs = React.useMemo(() => segments(ws, fps, durationInFrames), [ws, fps, durationInFrames]);
  const seg = segs.find((s) => frame >= s.from && frame < s.to) ?? segs[0];
  const f = seg ? frame - seg.from : frame;
  const screen = AGENTS_SCRIPT[seg?.i ?? 0].screen;
  const swap = interpolate(f, [0, 8], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif', background: `radial-gradient(ellipse at 50% 30%, ${COLORS.bgTop}, ${COLORS.bgBottom} 75%)`, direction: 'rtl' }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(rgba(${COLORS.glow},0.14) 1.6px, transparent 1.6px)`,
          backgroundSize: '28px 28px',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 80%)',
        }}
      />
      <div style={{ position: 'absolute', top: 96, left: 40, right: 40, textAlign: 'center', fontSize: 62, fontWeight: 800, color: COLORS.white, lineHeight: 1.1 }}>
        סוכני AI שבאמת
        <br />
        <span style={{ color: COLORS.goldLight }}>מכניסים כסף</span>
      </div>
      <div style={{ position: 'absolute', top: PHONE.top, left: (W - PHONE.w) / 2 }}>
        <Phone w={PHONE.w} h={PHONE.h}>
          <div key={seg?.i} style={{ height: '100%', paddingBottom: 60, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: swap, transform: `translateY(${(1 - swap) * 30}px)` }}>
            <ScreenView screen={screen} f={f} />
          </div>
        </Phone>
      </div>
      <BigWord words={ws} />
      <Presenter face={face} words={ws} voice={voice} />
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
