import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Logo } from './brands';
import { COLORS, H, W, Waves } from './ui';
import { HEADLINES, MONTHS, type Headline } from './year2026';

// "News storm": the year's headline cards fly in and pile up, line up into a
// month-by-month wall the camera travels down, then blow apart toward the camera
// to reveal the title.

export const YEAR_DURATION = 750; // 25 s at 30 fps

const CARD_W = 920;
const CARD_H = 196;
const GAP = 34;
const DIVIDER = 150;
const CENTER = H / 2;

const T = {
  inStep: 3, // frames between card entries
  arrange: 95, // pile -> wall starts
  scrollStart: 135,
  scrollEnd: 570,
  explode: 585,
  title: 615,
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// World positions on the wall, with a divider before each new month.
const layout = (() => {
  let y = 0;
  let month = 0;
  const cards: number[] = [];
  const dividers: { month: number; y: number }[] = [];
  for (const h of HEADLINES) {
    if (h.month !== month) {
      month = h.month;
      dividers.push({ month, y: y + DIVIDER / 2 });
      y += DIVIDER;
    }
    cards.push(y + CARD_H / 2);
    y += CARD_H + GAP;
  }
  return { cards, dividers };
})();

const camY = (frame: number) => {
  const first = layout.cards[0] + 380; // first card a little above centre
  const last = layout.cards[layout.cards.length - 1] - 250;
  return interpolate(frame, [T.scrollStart, T.scrollEnd], [first, last], { ...clamp, easing: Easing.inOut(Easing.cubic) });
};

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number; o: number };

const mix = (a: Pose, b: Pose, t: number): Pose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  rx: lerp(a.rx, b.rx, t),
  ry: lerp(a.ry, b.ry, t),
  rz: lerp(a.rz, b.rz, t),
  s: lerp(a.s, b.s, t),
  o: lerp(a.o, b.o, t),
});

const cardPose = (i: number, frame: number, fps: number): Pose => {
  const r = (k: string) => random(`${i}-${k}`) * 2 - 1;
  const start: Pose = { x: r('sx') * 1500, y: CENTER + r('sy') * 1800, z: -2500 + r('sz') * 1500, rx: r('srx') * 80, ry: r('sry') * 90, rz: r('srz') * 120, s: 1, o: 0 };
  const pile: Pose = { x: r('px') * 220, y: CENTER + r('py') * 420, z: r('pz') * 220, rx: 0, ry: r('pry') * 18, rz: r('prz') * 24, s: 0.92, o: 1 };
  const wallY = layout.cards[i] - camY(frame) + CENTER;
  const wall: Pose = { x: 0, y: wallY, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 1 };
  const out: Pose = {
    x: r('ex') * 2200,
    y: wallY + r('ey') * 1600,
    z: 1300 + random(`${i}-ez`) * 900,
    rx: r('erx') * 140,
    ry: r('ery') * 160,
    rz: r('erz') * 180,
    s: 1.2,
    o: 0,
  };

  const pIn = spring({ frame: frame - (4 + i * T.inStep), fps, config: { damping: 16, stiffness: 90, mass: 0.9 } });
  const pWall = interpolate(frame, [T.arrange + i * 1.5, T.arrange + 40 + i * 1.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const delay = random(`${i}-ed`) * 24;
  const pOut = interpolate(frame, [T.explode + delay, T.explode + 40 + delay], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

  let p = mix(start, pile, pIn);
  p = mix(p, wall, pWall);
  p = mix(p, out, pOut);
  // The card nearest the centre of the screen is "read": a little larger.
  if (pWall > 0.99 && pOut === 0) {
    const near = Math.max(0, 1 - Math.abs(wallY - CENTER) / 320);
    p.s += 0.07 * near;
  }
  return p;
};

const NewsCard: React.FC<{ h: Headline; pose: Pose; lit: number }> = ({ h, pose, lit }) => (
  <div
    style={{
      position: 'absolute',
      left: W / 2 - CARD_W / 2,
      top: -CARD_H / 2,
      width: CARD_W,
      height: CARD_H,
      transform: `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.s})`,
      opacity: pose.o,
      background: COLORS.card,
      border: `2px solid ${lit > 0.5 ? COLORS.gold : COLORS.cardBorder}`,
      borderRadius: 26,
      boxShadow: `0 20px 50px rgba(0,0,0,0.5)${lit > 0.5 ? `, 0 0 40px rgba(226,181,76,${0.35 * lit})` : ''}`,
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      padding: '0 34px',
      boxSizing: 'border-box',
      direction: 'rtl',
    }}
  >
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.gold, unicodeBidi: 'plaintext', textAlign: 'right' }}>
        {`${h.outlet} · ${h.date}${h.reported ? ' · לפי דיווח' : ''}`}
      </div>
      <div style={{ fontSize: 40, fontWeight: 700, color: COLORS.ink, lineHeight: 1.22, direction: 'rtl', textAlign: 'right' }}>
        {h.text}
      </div>
    </div>
    {h.brand && (
      // A light plate keeps every logo legible on the dark card without recolouring it.
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: 24,
          background: '#f4f1ea',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <Logo brand={h.brand} size={h.brand === 'openai' || h.brand === 'xai' ? 44 : 66} />
      </div>
    )}
  </div>
);

const MonthDivider: React.FC<{ month: number; y: number; opacity: number }> = ({ month, y, opacity }) => (
  <div
    style={{
      position: 'absolute',
      left: 80,
      right: 80,
      top: y - 40,
      height: 80,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      opacity,
      direction: 'rtl',
    }}
  >
    <span style={{ fontSize: 62, fontWeight: 800, color: COLORS.gold }}>{MONTHS[month - 1]}</span>
    <div style={{ flex: 1, height: 3, background: `linear-gradient(270deg, ${COLORS.gold}, transparent)` }} />
  </div>
);

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - T.title, fps, config: { damping: 12, stiffness: 120 } });
  const sub = interpolate(frame, [T.title + 18, T.title + 34], [0, 1], clamp);
  const year = Math.round(interpolate(frame, [T.title, T.title + 30], [2015, 2026], { ...clamp, easing: Easing.out(Easing.cubic) }));
  if (frame < T.title) return null;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, direction: 'rtl' }}>
      <div
        style={{
          fontSize: 300,
          fontWeight: 800,
          lineHeight: 1,
          transform: `scale(${0.6 + s * 0.4})`,
          opacity: Math.min(1, s * 1.4),
          background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold} 55%, ${COLORS.goldDark})`,
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(0 12px 40px rgba(226,181,76,0.35))',
        }}
      >
        {year}
      </div>
      <div style={{ fontSize: 96, fontWeight: 800, color: COLORS.white, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>
        שנת ה-AI
      </div>
      <div style={{ fontSize: 36, color: COLORS.muted, opacity: sub, marginTop: 18, unicodeBidi: 'plaintext' }}>
        {`${HEADLINES.length} כותרות · ינואר–אוקטובר`}
      </div>
      <div style={{ position: 'absolute', bottom: 90, fontSize: 26, color: COLORS.muted, opacity: sub }}>
        הכותרות בניסוח שלנו · המקור והתאריך מצוינים בכל כרטיס
      </div>
    </AbsoluteFill>
  );
};

export const Year2026: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = camY(frame);
  const dividerOpacity =
    interpolate(frame, [T.scrollStart - 20, T.scrollStart + 10], [0, 1], clamp) *
    interpolate(frame, [T.explode - 10, T.explode + 15], [1, 0], clamp);
  const poses = HEADLINES.map((_, i) => cardPose(i, frame, fps));
  // Draw far cards first so nearer ones overlap them.
  const order = poses.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z);
  return (
    <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif' }}>
      <Waves />
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: '50% 50%' }}>
        {layout.dividers.map((d) => (
          <MonthDivider key={d.month} month={d.month} y={d.y - cam + CENTER} opacity={dividerOpacity} />
        ))}
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
          {order.map(({ p, i }) => {
            const wallY = layout.cards[i] - cam + CENTER;
            const lit = frame > T.scrollStart && frame < T.explode ? Math.max(0, 1 - Math.abs(wallY - CENTER) / 260) : 0;
            return <NewsCard key={i} h={HEADLINES[i]} pose={p} lit={lit} />;
          })}
        </div>
      </AbsoluteFill>
      <Title />
    </AbsoluteFill>
  );
};
