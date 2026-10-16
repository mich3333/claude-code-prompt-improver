import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word } from './captions';
import { COLORS, H, W } from './ui';

// A selfie video that splits on a spoken cue: full screen until the presenter
// says the trigger (e.g. "Claude, תפצל את המסך לשניים"), then a gold line
// sweeps across, the face moves to the top half and the second clip slides
// into the bottom half. Word-timed captions sit on the dividing line.

export type VoiceSplitProps = {
  /** The presenter's video in public/, e.g. "face.mp4". Its own sound is used. */
  face: string;
  /** What fills the bottom half: a video or image in public/. */
  second: string;
  /** Word timings from the transcript. */
  words: Word[];
  /** The split happens when a word containing this text ends. */
  trigger: string;
  /** Length of the face video in seconds. */
  durationSec: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const HALF = H / 2;
const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);

export const splitFrame = (words: Word[], trigger: string, fps: number) => {
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

export const VoiceSplit: React.FC<VoiceSplitProps> = ({ face, second, words, trigger }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = splitFrame(words, trigger, fps) ?? Number.POSITIVE_INFINITY;
  const p = interpolate(frame, [at, at + 14], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const line = interpolate(frame, [at - 4, at + 6], [0, 1], clamp);
  const flash = interpolate(frame, [at, at + 3, at + 12], [0, 0.5, 0], clamp);
  const faceH = H - p * HALF;
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: 'Rubik, sans-serif' }}>
      {/* Presenter: full frame, then the top half */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: faceH, overflow: 'hidden' }}>
        <OffthreadVideo src={staticFile(face)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
      </div>
      {/* Second half slides up from below once the cue is spoken */}
      {Number.isFinite(at) && (
        <div style={{ position: 'absolute', left: 0, top: HALF + (1 - p) * HALF, width: W, height: HALF, overflow: 'hidden', background: '#0d0b08' }}>
          {isVideo(second) ? (
            <Sequence from={at} layout="none">
              <OffthreadVideo src={staticFile(second)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Sequence>
          ) : (
            <Img src={staticFile(second)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      )}
      {/* The gold line sweeps across, then becomes the divider */}
      {Number.isFinite(at) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: faceH - 4,
            width: `${line * 100}%`,
            height: 8,
            background: `linear-gradient(90deg, ${COLORS.goldDark}, ${COLORS.goldLight}, ${COLORS.gold})`,
            boxShadow: '0 0 30px rgba(247,220,147,0.8)',
            zIndex: 4,
          }}
        />
      )}
      <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
      <CaptionLine words={words} top={frame >= at ? HALF : H - 420} />
    </AbsoluteFill>
  );
};
