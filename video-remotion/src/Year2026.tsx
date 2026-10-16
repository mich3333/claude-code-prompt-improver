import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Logo } from './brands';
import { COLORS, H, W, Waves } from './ui';
import { Captions, firstSpoken, type Word } from './captions';
import { HEADLINES, MONTHS, type Headline } from './year2026';

// "News storm": the year's headline cards fly in and pile up, line up into a
// month-by-month wall the camera travels down, then blow apart toward the camera
// to reveal the title.

export const YEAR_DURATION = 750; // 25 s at 30 fps without a voice-over

const CARD_W = 920;
const CARD_H = 196;
const GAP = 34;
const DIVIDER = 150;
const CENTER = H / 2;


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

// Timing of the piece. Without a transcription it runs on fixed beats; with one,
// the camera moves to each month as it is spoken and the title lands on the
// last "2026".
type Schedule = {
  inStep: number;
  arrange: number;
  scrollStart: number;
  explode: number;
  title: number;
  camFrames: number[];
  camValues: number[];
};

const FIRST_CAM = () => layout.cards[0] + 380;
const LAST_CAM = () => layout.cards[layout.cards.length - 1] - 250;
const monthCam = (month: number) => {
  const d = layout.dividers.find((x) => x.month === month);
  return d ? Math.min(LAST_CAM(), d.y + 330) : null;
};

export const fixedSchedule: Schedule = {
  inStep: 3,
  arrange: 95,
  scrollStart: 135,
  explode: 585,
  title: 615,
  camFrames: [135, 570],
  camValues: [FIRST_CAM(), LAST_CAM()],
};

export function scheduleFromWords(words: Word[], fps: number): Schedule {
  const f = (sec: number) => Math.round(sec * fps);
  const cues: { frame: number; cam: number }[] = [];
  MONTHS.forEach((name, i) => {
    const t = firstSpoken(words, name);
    const cam = monthCam(i + 1);
    if (t !== null && cam !== null) cues.push({ frame: f(t), cam });
  });
  const lastYear = [...words].reverse().find((w) => w.text.includes('2026'));
  const end = words.length ? words[words.length - 1].end : 20;
  const title = lastYear && lastYear !== words.find((w) => w.text.includes('2026')) ? f(lastYear.start) : f(end - 1.5);
  const explode = title - 30;
  cues.sort((a, b) => a.frame - b.frame);
  const scrollStart = Math.max(60, (cues[0]?.frame ?? 120) - 15);
  const camFrames = [scrollStart];
  const camValues = [FIRST_CAM()];
  for (const c of cues) {
    const from = Math.max(camFrames[camFrames.length - 1] + 1, c.frame - 9);
    camFrames.push(from, from + 21);
    camValues.push(camValues[camValues.length - 1], c.cam);
  }
  // Drift on to the end of the wall before the explosion.
  if (explode - 20 > camFrames[camFrames.length - 1] + 1) {
    camFrames.push(explode - 20);
    camValues.push(LAST_CAM());
  }
  const arrange = Math.max(40, scrollStart - 40);
  return {
    inStep: Math.max(1, Math.min(3, Math.floor((arrange - 8) / HEADLINES.length))),
    arrange,
    scrollStart,
    explode,
    title,
    camFrames,
    camValues,
  };
}

const camY = (frame: number, S: Schedule) =>
  interpolate(frame, S.camFrames, S.camValues, { ...clamp, easing: Easing.inOut(Easing.cubic) });

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

const cardPose = (i: number, frame: number, fps: number, S: Schedule): Pose => {
  const r = (k: string) => random(`${i}-${k}`) * 2 - 1;
  const start: Pose = { x: r('sx') * 1500, y: CENTER + r('sy') * 1800, z: -2500 + r('sz') * 1500, rx: r('srx') * 80, ry: r('sry') * 90, rz: r('srz') * 120, s: 1, o: 0 };
  const pile: Pose = { x: r('px') * 220, y: CENTER + r('py') * 420, z: r('pz') * 220, rx: 0, ry: r('pry') * 18, rz: r('prz') * 24, s: 0.92, o: 1 };
  const wallY = layout.cards[i] - camY(frame, S) + CENTER;
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

  const pIn = spring({ frame: frame - (4 + i * S.inStep), fps, config: { damping: 16, stiffness: 90, mass: 0.9 } });
  const pWall = interpolate(frame, [S.arrange + i * 1.5, S.arrange + 40 + i * 1.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const delay = random(`${i}-ed`) * 24;
  const pOut = interpolate(frame, [S.explode + delay, S.explode + 40 + delay], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

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

const Title: React.FC<{ S: Schedule }> = ({ S }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - S.title, fps, config: { damping: 12, stiffness: 120 } });
  const sub = interpolate(frame, [S.title + 18, S.title + 34], [0, 1], clamp);
  const year = Math.round(interpolate(frame, [S.title, S.title + 30], [2015, 2026], { ...clamp, easing: Easing.out(Easing.cubic) }));
  if (frame < S.title) return null;
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

export type YearProps = {
  /** Voice-over in public/, e.g. "voice-2026.mp3". */
  voice: string | null;
  /** Word timings of the voice-over (from a transcription); drives captions and camera. */
  words: Word[] | null;
};

export const Year2026: React.FC<YearProps> = ({ voice, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = React.useMemo(() => (words?.length ? scheduleFromWords(words, fps) : fixedSchedule), [words, fps]);
  const cam = camY(frame, S);
  const dividerOpacity =
    interpolate(frame, [S.scrollStart - 20, S.scrollStart + 10], [0, 1], clamp) *
    interpolate(frame, [S.explode - 10, S.explode + 15], [1, 0], clamp);
  const poses = HEADLINES.map((_, i) => cardPose(i, frame, fps, S));
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
            const lit = frame > S.scrollStart && frame < S.explode ? Math.max(0, 1 - Math.abs(wallY - CENTER) / 260) : 0;
            return <NewsCard key={i} h={HEADLINES[i]} pose={p} lit={lit} />;
          })}
        </div>
      </AbsoluteFill>
      <Title S={S} />
      {words?.length ? <Captions words={words} top={1600} /> : null}
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
