import React from 'react';
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Logo, brandName } from './brands';
import type { Brand } from './scenes';
import { COLORS, Waves } from './ui';
import { MATCHES, type Match, type Side, type Value } from './versus';
import { StatCount } from './Year2026';

// "Who wins?": an intro with both logos and a VS slam, one scored round per
// metric with the winner revealed, a running score, and a verdict that only
// adds up the rounds.

export const INTRO = 90;
export const ROUND = 135;
export const VERDICT = 165;
const REVEAL = 70;

export const versusDuration = (m: Match) => INTRO + m.rounds.length * ROUND + VERDICT;

export type VersusProps = { match: string; voice: string | null };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const goldText: React.CSSProperties = {
  background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold} 55%, ${COLORS.goldDark})`,
  WebkitBackgroundClip: 'text',
  color: 'transparent',
};

const LogoPlate: React.FC<{ brand: Brand; size: number }> = ({ brand, size }) => (
  <div style={{ padding: size * 0.16, borderRadius: size * 0.26, background: '#f4f1ea', display: 'flex', boxShadow: '0 14px 40px rgba(0,0,0,0.45)' }}>
    <Logo brand={brand} size={size} />
  </div>
);

const Intro: React.FC<{ m: Match }> = ({ m }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } });
  const vs = spring({ frame: f - 20, fps, config: { damping: 9, stiffness: 220, mass: 0.7 } });
  const shake = f >= 22 && f < 32 ? Math.sin(f * 3.1) * (32 - f) * 1.4 : 0;
  const out = interpolate(f, [INTRO - 14, INTRO], [1, 0], clamp);
  const half = (side: Side) => {
    const brand = side === 'a' ? m.a : m.b;
    const right = side === 'a';
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: right ? 'polygon(56% 0, 100% 0, 100% 100%, 44% 100%)' : 'polygon(0 0, 56% 0, 44% 100%, 0 100%)',
          background: right ? 'linear-gradient(200deg, #2a2216, #0d0b08 70%)' : 'linear-gradient(160deg, #1d1912, #0a0908 70%)',
          transform: `translateX(${(right ? 1 : -1) * (1 - s) * 700}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: right ? 360 : 1130,
            left: right ? 560 : 40,
            width: 480,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 28,
          }}
        >
          <LogoPlate brand={brand} size={200} />
          <div style={{ fontSize: 84, fontWeight: 800, color: COLORS.ink, direction: 'ltr' }}>{brandName(brand)}</div>
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ opacity: out, transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      {half('a')}
      {half('b')}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <line x1={1080 * 0.56} y1={0} x2={1080 * 0.44} y2={1920} stroke={COLORS.gold} strokeWidth={8} strokeDasharray={2000} strokeDashoffset={2000 * (1 - s)} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 820,
          textAlign: 'center',
          fontSize: 240,
          fontWeight: 800,
          fontStyle: 'italic',
          direction: 'ltr',
          transform: `scale(${2.4 - vs * 1.4})`,
          opacity: Math.min(1, vs * 1.5),
          filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.8))',
        }}
      >
        <span style={goldText}>VS</span>
      </div>
    </AbsoluteFill>
  );
};

const ScoreBar: React.FC<{ m: Match; frame: number }> = ({ m, frame }) => {
  const { fps } = useVideoConfig();
  const shown = interpolate(frame, [INTRO - 6, INTRO + 8], [0, 1], clamp);
  const score = (side: Side) => m.rounds.filter((r, i) => r.winner === side && frame >= INTRO + i * ROUND + REVEAL).length;
  const lastWin = (side: Side) => {
    let at = -1000;
    m.rounds.forEach((r, i) => {
      const t = INTRO + i * ROUND + REVEAL;
      if (r.winner === side && frame >= t) at = t;
    });
    return at;
  };
  const cell = (side: Side) => {
    const bump = spring({ frame: frame - lastWin(side), fps, config: { damping: 8, stiffness: 260, mass: 0.5 } });
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexDirection: side === 'a' ? 'row' : 'row-reverse' }}>
        <LogoPlate brand={side === 'a' ? m.a : m.b} size={64} />
        <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1, transform: `scale(${1 + (1 - bump) * 0.5 * (lastWin(side) > 0 ? 1 : 0)})`, ...goldText }}>{score(side)}</div>
      </div>
    );
  };
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 60,
        right: 60,
        height: 130,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30px',
        borderRadius: 30,
        background: 'rgba(13,11,8,0.92)',
        border: `2px solid ${COLORS.cardBorder}`,
        opacity: shown,
        direction: 'rtl',
      }}
    >
      {cell('a')}
      <div style={{ fontSize: 46, fontWeight: 800, fontStyle: 'italic', color: COLORS.muted, direction: 'ltr' }}>VS</div>
      {cell('b')}
    </div>
  );
};

const countable = (v: Value) => v.count !== false && /\d/.test(v.value);

const SideCard: React.FC<{ brand: Brand; v: Value; side: Side; f: number; result: 'win' | 'lose' | 'tie' }> = ({ brand, v, side, f, result }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 6, fps, config: { damping: 15, stiffness: 150, mass: 0.8 } });
  const r = spring({ frame: f - REVEAL, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });
  const win = result === 'win' ? r : 0;
  const dim = result === 'lose' ? interpolate(f, [REVEAL, REVEAL + 10], [1, 0.45], clamp) : 1;
  return (
    <div
      style={{
        position: 'absolute',
        top: 540,
        left: side === 'a' ? 560 : 50,
        width: 470,
        height: 700,
        borderRadius: 36,
        background: COLORS.card,
        border: `${3 + win * 4}px solid ${win > 0.05 ? COLORS.gold : COLORS.cardBorder}`,
        boxShadow: `0 30px 70px rgba(0,0,0,0.55), 0 0 ${win * 90}px rgba(226,181,76,${win * 0.45})`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '46px 24px 30px',
        gap: 18,
        opacity: dim * Math.min(1, s * 1.4),
        transform: `translateX(${(side === 'a' ? 1 : -1) * (1 - s) * 520}px) scale(${1 + win * 0.04})`,
      }}
    >
      {result === 'win' && (
        <div
          style={{
            position: 'absolute',
            top: -34,
            padding: '10px 30px',
            borderRadius: 40,
            background: COLORS.gold,
            color: COLORS.onGold,
            fontSize: 38,
            fontWeight: 800,
            transform: `scale(${r})`,
          }}
        >
          ✓ מובילה
        </div>
      )}
      <LogoPlate brand={brand} size={110} />
      <div style={{ fontSize: 46, fontWeight: 700, color: COLORS.ink, direction: 'ltr' }}>{brandName(brand)}</div>
      <div style={{ fontSize: 124, fontWeight: 800, lineHeight: 1.05, direction: 'ltr', marginTop: 10, ...goldText }}>
        {countable(v) ? <StatCount stat={v.value} f={Math.max(0, f - 14)} /> : v.value}
      </div>
      <div style={{ fontSize: 36, fontWeight: 600, color: COLORS.ink, textAlign: 'center', lineHeight: 1.25 }}>{v.caption}</div>
      <div style={{ flex: 1 }} />
      {v.source && (
        <div style={{ padding: '8px 20px', borderRadius: 14, border: `2px solid ${COLORS.cardBorder}`, color: COLORS.goldLight, fontSize: 28, fontWeight: 600 }}>{v.source}</div>
      )}
    </div>
  );
};

const RoundView: React.FC<{ m: Match; i: number; f: number }> = ({ m, i, f }) => {
  const { fps } = useVideoConfig();
  const r = m.rounds[i];
  const head = spring({ frame: f, fps, config: { damping: 14, stiffness: 170, mass: 0.6 } });
  const out = interpolate(f, [ROUND - 10, ROUND], [1, 0], clamp);
  const result = (side: Side) => (r.winner === 'tie' ? 'tie' : r.winner === side ? 'win' : 'lose');
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: 'absolute', top: 290, left: 0, right: 0, textAlign: 'center', transform: `scale(${0.7 + head * 0.3})`, opacity: head }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: COLORS.gold }}>סיבוב {i + 1}</div>
        <div style={{ fontSize: 100, fontWeight: 800, color: COLORS.ink, lineHeight: 1.05 }}>{r.label}</div>
      </div>
      <SideCard brand={m.a} v={r.a} side="a" f={f} result={result('a')} />
      <SideCard brand={m.b} v={r.b} side="b" f={f} result={result('b')} />
      <div
        style={{
          position: 'absolute',
          top: 1330,
          left: 90,
          right: 90,
          textAlign: 'center',
          fontSize: 54,
          fontWeight: 700,
          lineHeight: 1.3,
          color: COLORS.ink,
          opacity: interpolate(f, [REVEAL + 6, REVEAL + 16], [0, 1], clamp),
          transform: `translateY(${interpolate(f, [REVEAL + 6, REVEAL + 16], [24, 0], clamp)}px)`,
        }}
      >
        {r.note}
      </div>
    </AbsoluteFill>
  );
};

const Verdict: React.FC<{ m: Match; f: number }> = ({ m, f }) => {
  const { fps } = useVideoConfig();
  const a = m.rounds.filter((r) => r.winner === 'a').length;
  const b = m.rounds.filter((r) => r.winner === 'b').length;
  const title = a === b ? m.verdict.title : `${brandName(a > b ? m.a : m.b)} מנצחת`;
  const s = spring({ frame: f - 4, fps, config: { damping: 10, stiffness: 170, mass: 0.7 } });
  const line = (k: number) => interpolate(f, [26 + k * 10, 38 + k * 10], [0, 1], clamp);
  const col = (side: Side, k: number) => (
    <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, opacity: line(k), transform: `translateY(${(1 - line(k)) * 30}px)` }}>
      <LogoPlate brand={side === 'a' ? m.a : m.b} size={100} />
      <div style={{ fontSize: 46, fontWeight: 700, color: COLORS.ink, textAlign: 'center', lineHeight: 1.3 }}>{side === 'a' ? m.verdict.a : m.verdict.b}</div>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center', transform: `scale(${0.5 + s * 0.5})`, opacity: Math.min(1, s * 1.3) }}>
        <div style={{ fontSize: 210, fontWeight: 800, lineHeight: 1, direction: 'ltr', ...goldText }}>
          {b} : {a}
        </div>
        <div style={{ fontSize: 120, fontWeight: 800, color: COLORS.ink, marginTop: 10 }}>{title}</div>
      </div>
      <div style={{ position: 'absolute', top: 900, left: 50, right: 50, display: 'flex', justifyContent: 'space-between', direction: 'rtl' }}>
        {col('a', 0)}
        {col('b', 1)}
      </div>
      <div style={{ position: 'absolute', top: 1430, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: line(3) }}>
        <div style={{ padding: '22px 44px', borderRadius: 50, background: COLORS.gold, color: COLORS.onGold, fontSize: 50, fontWeight: 800, transform: `scale(${0.9 + Math.sin(f / 8) * 0.03})` }}>
          {m.verdict.ask}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Versus: React.FC<VersusProps> = ({ match, voice }) => {
  const frame = useCurrentFrame();
  const m = MATCHES[match];
  if (!m) return null;
  const roundsEnd = INTRO + m.rounds.length * ROUND;
  const i = Math.floor((frame - INTRO) / ROUND);
  return (
    <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif', direction: 'rtl', background: COLORS.bgBottom }}>
      <Waves />
      {frame < INTRO && <Intro m={m} />}
      {frame >= INTRO && frame < roundsEnd && <RoundView key={i} m={m} i={i} f={frame - INTRO - i * ROUND} />}
      {frame >= roundsEnd && <Verdict m={m} f={frame - roundsEnd} />}
      <ScoreBar m={m} frame={frame} />
      <div style={{ position: 'absolute', top: 1760, left: 60, right: 60, textAlign: 'center', fontSize: 28, color: COLORS.muted, opacity: frame >= INTRO ? 1 : 0 }}>
        הנתונים מכותרות 2026 · המקור מצוין בכל סיבוב · לא המלצת השקעה
      </div>
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
