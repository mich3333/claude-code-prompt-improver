import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Logo } from './brands';
import { COLORS, H, W, Waves } from './ui';
import { Captions, firstSpoken, type Word } from './captions';
import { AnimatedIcon } from './icons';
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

// The card nearest the centre of the screen while the wall scrolls.
const litIndex = (frame: number, S: Schedule) => {
  if (frame < S.scrollStart || frame >= S.explode) return -1;
  const cam = camY(frame, S);
  let best = 0;
  layout.cards.forEach((y, i) => {
    if (Math.abs(y - cam) < Math.abs(layout.cards[best] - cam)) best = i;
  });
  return best;
};

const StatCount: React.FC<{ stat: string; f: number }> = ({ stat, f }) => {
  const m = /^(\D*?)(\d+(?:\.\d+)?)(.*)$/.exec(stat);
  if (!m) return <>{stat}</>;
  const target = Number(m[2]);
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
  const p = interpolate(f, [4, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      {m[1]}
      {(target * p).toFixed(decimals)}
      {m[3]}
    </>
  );
};

// Which card the spotlight shows over time: the centred card, but only once it
// has stayed centred for a moment, so a fast camera move doesn't flicker it.
const spotlightSegments = (S: Schedule) => {
  const segs: { from: number; to: number; i: number }[] = [];
  for (let f = S.scrollStart; f < S.explode; f++) {
    const i = litIndex(f, S);
    const last = segs[segs.length - 1];
    if (last && last.i === i) last.to = f + 1;
    else segs.push({ from: f, to: f + 1, i });
  }
  const MIN = 14;
  const kept: typeof segs = [];
  for (const seg of segs) {
    const prev = kept[kept.length - 1];
    if (seg.to - seg.from < MIN && prev) prev.to = seg.to;
    else if (prev && prev.i === seg.i) prev.to = seg.to;
    else kept.push({ ...seg });
  }
  return kept;
};

// A panel at the top with the current card's animated icon and key number.
type Segment = { from: number; to: number; i: number };

const Spotlight: React.FC<{ S: Schedule; segs: Segment[] }> = ({ S, segs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seg = segs.find((x) => frame >= x.from && frame < x.to);
  if (!seg) return null;
  const i = seg.i;
  const f = frame - seg.from;
  const s = spring({ frame: f, fps, config: { damping: 13, stiffness: 170, mass: 0.7 } });
  const fadeOut =
    interpolate(frame, [S.scrollStart, S.scrollStart + 10], [0, 1], clamp) * interpolate(frame, [S.explode - 12, S.explode], [1, 0], clamp);
  const h = HEADLINES[i];
  if (h.shot) {
    // The real article: a screenshot of its top, slowly pushing in, with the
    // icon and key number on a badge in the corner.
    const zoom = 1 + f * 0.0012;
    return (
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 70,
          right: 70,
          height: 600,
          borderRadius: 34,
          overflow: 'hidden',
          background: '#ffffff',
          border: `3px solid ${COLORS.gold}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.65), 0 0 60px rgba(226,181,76,0.18)',
          transform: `scale(${0.9 + s * 0.1}) translateY(${(1 - s) * 40}px)`,
          opacity: fadeOut,
          zIndex: 5,
        }}
      >
        <Img
          src={staticFile(h.shot)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%', transform: `scale(${zoom})`, transformOrigin: '50% 0%' }}
        />
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
          }}
        >
          <AnimatedIcon kind={h.icon} f={f} fps={fps} size={110} />
          {h.stat && (
            <span
              style={{
                fontSize: 76,
                fontWeight: 800,
                lineHeight: 1,
                background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold} 55%, ${COLORS.goldDark})`,
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              <StatCount stat={h.stat} f={f} />
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: 150,
        left: 120,
        right: 120,
        height: 330,
        borderRadius: 40,
        background: '#0d0b08',
        border: `2px solid ${COLORS.cardBorder}`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(226,181,76,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        direction: 'rtl',
        transform: `scale(${0.9 + s * 0.1})`,
        opacity: fadeOut,
        zIndex: 5,
      }}
    >
      <AnimatedIcon kind={h.icon} f={f} fps={fps} size={230} />
      {h.stat ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <span
            style={{
              fontSize: 128,
              fontWeight: 800,
              lineHeight: 1,
              direction: 'ltr',
              background: `linear-gradient(180deg, ${COLORS.goldLight}, ${COLORS.gold} 55%, ${COLORS.goldDark})`,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            <StatCount stat={h.stat} f={f} />
          </span>
          <span style={{ fontSize: 30, color: COLORS.muted, unicodeBidi: 'plaintext' }}>{`${h.outlet} · ${h.date}`}</span>
        </div>
      ) : (
        <span style={{ fontSize: 40, fontWeight: 700, color: COLORS.gold, unicodeBidi: 'plaintext' }}>{`${h.outlet} · ${h.date}`}</span>
      )}
    </div>
  );
};

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
  const segs = React.useMemo(() => spotlightSegments(S), [S]);
  const spot = segs.find((x) => frame >= x.from && frame < x.to)?.i ?? -1;
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
            // The highlighted card is the one in the spotlight, so the two always match.
            const lit = i === spot ? 1 : 0;
            return <NewsCard key={i} h={HEADLINES[i]} pose={p} lit={lit} />;
          })}
        </div>
      </AbsoluteFill>
      <Spotlight S={S} segs={segs} />
      <Title S={S} />
      {words?.length ? <Captions words={words} top={1600} /> : null}
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
