import { createTikTokStyleCaptions, type Caption } from '@remotion/captions';
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { DUR, enterProgress, enterStyle, moveProgress } from './motion';
import { COLORS, H, W } from './ui';

// The personal reel style: the presenter's own footage, raw, inside a thin
// green frame on graphite. A hook line opens, word-by-word captions follow the
// voice, B-roll comes in as a split (face on top) or full screen (face in a
// corner circle), and an end card closes with the handle. Everything is driven
// by a reel.json made from the recording and its transcript.

export type Broll = {
  /** Video or image in public/. */
  src: string;
  /** When it appears and leaves, in ms of the face recording. */
  startMs: number;
  endMs: number;
  /** split: face on top, B-roll below. full: B-roll fills, face in a corner circle. */
  layout: 'split' | 'full';
};

export type ReelProps = {
  /** The recording in public/: a video (its sound is the reel's sound) or a still image. */
  face: string;
  /** Word-level transcript in Remotion's Caption format, times in ms of the recording. */
  captions: Caption[];
  /** Opening line shown over the first seconds. */
  hook: string;
  hookMs: number;
  broll: Broll[];
  handle: string;
  cta: string;
  /** Length of the recording in seconds. */
  durationSec: number;
};

const isVideo = (src: string) => /\.(mp4|webm|mov)$/i.test(src);
const ms = (frame: number, fps: number) => (frame / fps) * 1000;
const FRAME_INSET = 22;
const END_CARD_MS = 2600;

const Media: React.FC<{ src: string; muted?: boolean; zoom?: number }> = ({ src, muted, zoom = 1 }) =>
  isVideo(src) ? (
    <OffthreadVideo src={staticFile(src)} muted={muted} style={{ width: '100%', height: '100%', objectFit: 'cover', scale: String(zoom) }} />
  ) : (
    <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%', scale: String(zoom) }} />
  );

const Hook: React.FC<{ text: string; endFrame: number }> = ({ text, endFrame }) => {
  const frame = useCurrentFrame();
  const line = enterProgress(frame, 6, DUR.move);
  return (
    <div style={{ position: 'absolute', top: 230, left: 70, right: 70, display: 'flex', justifyContent: 'center', ...enterStyle(frame, 2, { exitAt: endFrame - DUR.quick }) }}>
      <div style={{ padding: '26px 38px 30px', borderRadius: 30, background: `rgba(${COLORS.deepRGB},0.82)`, border: `2px solid rgba(${COLORS.glow},0.55)`, direction: 'rtl', textAlign: 'center' }}>
        <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.1, color: COLORS.white }}>{text}</div>
        <div style={{ height: 6, marginTop: 16, borderRadius: 3, background: COLORS.gold, clipPath: `inset(0 0 0 ${(1 - line) * 100}%)` }} />
      </div>
    </div>
  );
};

const Captions: React.FC<{ captions: Caption[]; top: number }> = ({ captions, top }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = React.useMemo(() => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 900 }), [captions]);
  const t = ms(frame, fps);
  const page = pages.find((p, i) => t >= p.startMs && t < (pages[i + 1]?.startMs ?? p.startMs + p.durationMs));
  if (!page) return null;
  const pageFrame = Math.round((page.startMs / 1000) * fps);
  return (
    <div style={{ position: 'absolute', top, left: 60, right: 60, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 20px', direction: 'rtl', ...enterStyle(frame, pageFrame, { dur: DUR.quick, rise: 12 }) }}>
      {page.tokens.map((tok, i) => {
        const active = t >= tok.fromMs && t < tok.toMs;
        const shown = t >= tok.fromMs - 40;
        const under = enterProgress(frame, Math.round((tok.fromMs / 1000) * fps), DUR.quick);
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', fontSize: 88, fontWeight: 800, lineHeight: 1.2, color: COLORS.white, opacity: shown ? (active ? 1 : 0.78) : 0.35, textShadow: '0 4px 22px rgba(0,0,0,0.75)', unicodeBidi: 'isolate' }}>
            {tok.text.trim()}
            {active && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 2, height: 7, borderRadius: 4, background: COLORS.gold, clipPath: `inset(0 0 0 ${(1 - under) * 100}%)` }} />}
          </span>
        );
      })}
    </div>
  );
};

export const MyReel: React.FC<ReelProps> = ({ face, captions, hook, hookMs, broll, handle, cta, durationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = (msv: number) => Math.round((msv / 1000) * fps);
  const t = ms(frame, fps);
  const total = f(durationSec * 1000);

  const split = broll.find((b) => b.layout === 'split' && t >= b.startMs - 600 && t < b.endMs + 600);
  const full = broll.find((b) => b.layout === 'full' && t >= b.startMs && t < b.endMs);
  // Split: the face reframes into the top half and back out, with ease-in-out.
  const splitP = split ? moveProgress(frame, f(split.startMs)) * (1 - moveProgress(frame, f(split.endMs))) : 0;
  const faceH = H - splitP * (H / 2);
  const endCard = enterProgress(frame, total - f(END_CARD_MS));
  const progress = interpolate(frame, [0, total], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bgBottom, fontFamily: 'Rubik, sans-serif' }}>
      {/* The recording, carrying the sound for the whole reel */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: faceH, overflow: 'hidden' }}>
        <Media src={face} zoom={isVideo(face) ? 1 : 1 + frame * 0.0004} />
      </div>

      {broll.map((b, i) => {
        const from = f(b.startMs);
        const len = f(b.endMs) - from;
        const slide = moveProgress(frame, from) * (1 - moveProgress(frame, from + len));
        return b.layout === 'split' ? (
          <Sequence key={i} name={`B-roll ${i + 1} (split)`} from={from - 4} durationInFrames={len + DUR.move + 8} layout="none">
            <div style={{ position: 'absolute', left: 0, top: H / 2, width: W, height: H / 2, overflow: 'hidden', translate: `0px ${(1 - slide) * (H / 2)}px` }}>
              <Media src={b.src} muted />
            </div>
          </Sequence>
        ) : (
          <Sequence key={i} name={`B-roll ${i + 1} (full)`} from={from} durationInFrames={len} layout="none">
            <div style={{ position: 'absolute', inset: 0, opacity: enterProgress(frame, from, DUR.quick) * (1 - enterProgress(frame, from + len - DUR.quick, DUR.quick)) }}>
              <Media src={b.src} muted zoom={1.02 + (frame - from) * 0.0006} />
            </div>
          </Sequence>
        );
      })}

      {/* Face in a corner circle while B-roll is full screen */}
      {full && (
        <div style={{ position: 'absolute', left: 64, top: 96, width: 280, height: 280, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${COLORS.gold}`, boxShadow: `0 20px 50px rgba(0,0,0,0.5)`, ...enterStyle(frame, f(full.startMs), { exitAt: f(full.endMs) - DUR.quick }) }}>
          <Media src={face} muted />
        </div>
      )}

      {/* Divider on the split */}
      {splitP > 0 && <div style={{ position: 'absolute', left: 0, right: 0, top: faceH - 3, height: 6, background: COLORS.gold, opacity: splitP, boxShadow: `0 0 24px rgba(${COLORS.glow},0.6)` }} />}

      {/* The signature: a thin green frame around everything */}
      <div style={{ position: 'absolute', inset: FRAME_INSET, borderRadius: 44, border: `3px solid rgba(${COLORS.glow},0.55)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: FRAME_INSET + 18, left: 70, right: 70, height: 6, borderRadius: 3, background: `rgba(${COLORS.glow},0.18)` }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 3, background: COLORS.gold }} />
      </div>

      {hookMs > 0 && (
        <Sequence name="Hook" durationInFrames={f(hookMs)} layout="none">
          <Hook text={hook} endFrame={f(hookMs)} />
        </Sequence>
      )}

      <Captions captions={captions} top={splitP > 0.5 ? H / 2 - 160 : H - 560} />

      {/* End card */}
      {endCard > 0 && (
        <AbsoluteFill style={{ background: `rgba(${COLORS.deepRGB},${0.78 * endCard})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: COLORS.white, direction: 'ltr', ...enterStyle(frame, total - f(END_CARD_MS)) }}>{handle}</div>
          <div style={{ padding: '20px 48px', borderRadius: 50, border: `3px solid ${COLORS.gold}`, color: COLORS.gold, fontSize: 48, fontWeight: 800, direction: 'rtl', ...enterStyle(frame, total - f(END_CARD_MS) + DUR.stagger * 3) }}>{cta}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
