import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word } from './captions';
import { COLORS, H, W } from './ui';

// A selfie video that reacts to spoken commands. Each cue fires when a word
// containing its trigger ends:
// - split: a gold line sweeps across, the face moves to the top half and a
//   second clip slides into the bottom half (stays to the end);
// - walk: the frame steps to the right with a walking sway, speed lines and
//   footprints crossing left to right, then settles back;
// - ball: a basketball drops in and bounces into the hand at (x, y), given as
//   percentages of the presenter's frame, and stays there.
// Word-timed captions run along the bottom, or on the divider after a split.

export type Cue =
  | { effect: 'split'; trigger: string; second: string }
  | { effect: 'walk'; trigger: string }
  | { effect: 'ball'; trigger: string; x: number; y: number };

export type VoiceSplitProps = {
  /** The presenter's video in public/, e.g. "face.mp4". Its own sound is used. */
  face: string;
  /** Word timings from the transcript. */
  words: Word[];
  cues: Cue[];
  /** Length of the face video in seconds. */
  durationSec: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const HALF = H / 2;
const WALK = 48;
const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

export const cueFrame = (words: Word[], trigger: string, fps: number) => {
  const w = words.find((x) => x.text.includes(trigger));
  return w ? Math.round(w.end * fps) : null;
};

const CaptionLine: React.FC<{ words: Word[]; top: number }> = ({ words, top }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const i = words.findIndex((w, k) => t >= w.start - 0.03 && t < (words[k + 1]?.start ?? w.end + 0.4));
  if (i < 0) return null;
  const w = words[i];
  const s = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
  return (
    <div style={{ position: 'absolute', top: top - 70, left: 0, right: 0, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', zIndex: 5 }}>
      <span
        style={{
          fontSize: 92,
          fontWeight: 800,
          color: /[A-Za-z]/.test(w.text) ? COLORS.goldLight : COLORS.white,
          transform: `scale(${0.7 + s * 0.3})`,
          textShadow: '0 6px 24px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)',
          unicodeBidi: 'isolate',
        }}
      >
        {w.text.replace(/[.,!?:;]+$/, '')}
      </span>
    </div>
  );
};

const Basketball: React.FC<{ size: number; spin: number }> = ({ size, spin }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${spin}deg)`, filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.5))' }}>
    <defs>
      <radialGradient id="ball" cx="35%" cy="30%" r="75%">
        <stop offset="0" stopColor="#f6a04d" />
        <stop offset="1" stopColor="#c45a14" />
      </radialGradient>
    </defs>
    <circle cx={50} cy={50} r={47} fill="url(#ball)" stroke="#2a1508" strokeWidth={2.5} />
    <path d="M3 50 H97 M50 3 V97 M17 17 C 37 37, 37 63, 17 83 M83 17 C 63 37, 63 63, 83 83" fill="none" stroke="#2a1508" strokeWidth={2.5} />
  </svg>
);

// Footprints stepping left to right along the bottom of the frame.
const Footprints: React.FC<{ f: number; top: number }> = ({ f, top }) => (
  <>
    {new Array(7).fill(0).map((_, k) => {
      const appear = k * 5;
      const o = interpolate(f, [appear, appear + 3, appear + 18, appear + 26], [0, 1, 1, 0], clamp);
      return (
        <div key={k} style={{ position: 'absolute', left: 90 + k * 140, top: top + (k % 2 ? 40 : 0), opacity: o, transform: 'rotate(90deg)', zIndex: 3 }}>
          <svg width={60} height={90} viewBox="0 0 40 60">
            <ellipse cx={20} cy={24} rx={12} ry={18} fill={COLORS.gold} />
            <ellipse cx={20} cy={50} rx={8} ry={8} fill={COLORS.gold} />
          </svg>
        </div>
      );
    })}
  </>
);

export const VoiceSplit: React.FC<VoiceSplitProps> = ({ face, words, cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (c: Cue) => cueFrame(words, c.trigger, fps) ?? Number.POSITIVE_INFINITY;

  const split = cues.find((c): c is Extract<Cue, { effect: 'split' }> => c.effect === 'split');
  const splitAt = split ? at(split) : Number.POSITIVE_INFINITY;
  const p = interpolate(frame, [splitAt, splitAt + 14], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const line = interpolate(frame, [splitAt - 4, splitAt + 6], [0, 1], clamp);
  const faceH = H - p * HALF;

  // Walking: step right with a sway, then spring back.
  const walks = cues.filter((c) => c.effect === 'walk').map(at);
  const walkAt = walks.filter((a) => frame >= a && frame < a + WALK + 30).pop();
  let dx = 0;
  let sway = 0;
  if (walkAt !== undefined) {
    const f = frame - walkAt;
    const out = interpolate(f, [0, WALK], [0, 1], clamp);
    const back = spring({ frame: f - WALK, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
    dx = out * 180 * (1 - back);
    sway = f < WALK ? Math.sin(f / 2.2) * 3 : 0;
  }

  const balls = cues.filter((c): c is Extract<Cue, { effect: 'ball' }> => c.effect === 'ball');
  const flash = interpolate(frame, [splitAt, splitAt + 3, splitAt + 12], [0, 0.5, 0], clamp);

  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: 'Rubik, sans-serif' }}>
      {/* Presenter: full frame, then the top half */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: faceH, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: -60, transform: `translateX(${dx}px) rotate(${sway}deg) scale(${1 + Math.abs(sway) * 0.004})` }}>
          <OffthreadVideo src={staticFile(face)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
        </div>
        {walkAt !== undefined && frame - walkAt < WALK && (
          <>
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const f = frame - walkAt;
              const x = ((f * 40 + k * 230) % (W + 300)) - 300;
              return <div key={k} style={{ position: 'absolute', left: W - x, top: 200 + k * (faceH / 7), width: 260, height: 6, borderRadius: 3, background: `rgba(${COLORS.glowLight},0.7)`, opacity: interpolate(f, [0, 6, WALK - 8, WALK], [0, 1, 1, 0], clamp) }} />;
            })}
            <Footprints f={frame - walkAt} top={faceH - 260} />
          </>
        )}
        {balls.map((b, k) => {
          const a = at(b);
          if (frame < a) return null;
          const f = frame - a;
          const drop = spring({ frame: f, fps, config: { damping: 6, stiffness: 120, mass: 0.9 } });
          const size = 230;
          const y = (b.y / 100) * faceH - size / 2;
          return (
            <div key={k} style={{ position: 'absolute', left: (b.x / 100) * W - size / 2 + dx, top: -size + drop * (y + size) + Math.sin(f / 9) * 4 * (f > 30 ? 1 : 0), zIndex: 3 }}>
              <Basketball size={size} spin={f * 4 * (1 - Math.min(1, f / 40)) + 20} />
            </div>
          );
        })}
      </div>
      {/* Second half slides up from below once the split cue is spoken */}
      {split && Number.isFinite(splitAt) && (
        <div style={{ position: 'absolute', left: 0, top: HALF + (1 - p) * HALF, width: W, height: HALF, overflow: 'hidden', background: COLORS.deep }}>
          {isVideo(split.second) ? (
            <Sequence from={splitAt} layout="none">
              <OffthreadVideo src={staticFile(split.second)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Sequence>
          ) : (
            <Img src={staticFile(split.second)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      )}
      {split && Number.isFinite(splitAt) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: faceH - 4,
            width: `${line * 100}%`,
            height: 8,
            background: `linear-gradient(90deg, ${COLORS.goldDark}, ${COLORS.goldLight}, ${COLORS.gold})`,
            boxShadow: `0 0 30px rgba(${COLORS.glowLight},0.8)`,
            zIndex: 4,
          }}
        />
      )}
      <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
      <CaptionLine words={words} top={frame >= splitAt ? HALF : H - 420} />
    </AbsoluteFill>
  );
};
