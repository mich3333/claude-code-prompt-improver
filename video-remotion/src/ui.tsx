import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Logo, brandName } from './brands';
import type { Pose, Scene } from './scenes';

export const W = 1080;
export const H = 1920;

// The avatar-explainer layout, the same boxes as ClipCraft's presets.
export const CARD = { x: 43, y: 58, w: 994, h: 730 };
export const FULL_CARD = { x: 43, y: 58, w: 994, h: 830 };
export const AVATAR = { x: 560, y: 1190, w: 480, h: 690 };

// Themes. Keys keep their original names (gold = the accent colour) so every
// component reads the active theme the same way. Brand logos keep their own
// colours whatever the theme.
const THEMES = {
  // Black and gold, matching ClipCraft's gold templates.
  gold: {
    bgTop: '#1a1610',
    bgBottom: '#0a0908',
    line: 'rgba(226,181,76,0.14)',
    gold: '#e2b54c',
    goldLight: '#f7dc93',
    goldDark: '#a5761f',
    card: '#15130f',
    cardBorder: 'rgba(226,181,76,0.45)',
    ink: '#f4f1ea',
    muted: '#8c877c',
    onGold: '#0a0908',
    white: '#ffffff',
    raised: '#2a2216',
    panel: '#1d1a14',
    deep: '#0d0b08',
    surface: '#2a2620',
    edge: '#3a342a',
    paper: '#f6f3ec',
    paperBar: '#ece7dc',
    paperLine: '#dcd5c6',
    glow: '226,181,76',
    glowLight: '247,220,147',
    deepRGB: '13,11,8',
    numGradient: 'linear-gradient(180deg, #f7dc93, #e2b54c 55%, #a5761f)',
  },
  // Graphite gray with green only at the edges: outlines, glows, highlights.
  graphite: {
    bgTop: '#2a2c2f',
    bgBottom: '#17181a',
    line: 'rgba(74,222,128,0.10)',
    gold: '#4ade80',
    goldLight: '#86efac',
    goldDark: '#16a34a',
    card: '#222427',
    cardBorder: 'rgba(74,222,128,0.45)',
    ink: '#f3f4f6',
    muted: '#9ca3af',
    onGold: '#0b130e',
    white: '#ffffff',
    raised: '#303236',
    panel: '#26282c',
    deep: '#141517',
    surface: '#2b2d31',
    edge: '#3d4045',
    paper: '#f3f4f6',
    paperBar: '#e5e7eb',
    paperLine: '#d1d5db',
    glow: '74,222,128',
    glowLight: '134,239,172',
    deepRGB: '20,21,23',
    numGradient: 'linear-gradient(180deg, #ffffff, #e5e7eb 55%, #9ca3af)',
  },
};

/** The active look for every video. Switch to 'gold' for the black-and-gold one. */
export const THEME: keyof typeof THEMES = 'graphite';
export const COLORS = THEMES[THEME];

const pop = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });

const fadeIn = (frame: number, from: number, len = 10) =>
  interpolate(frame, [from, from + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// Navy background with slow flowing lines; one 6-second cycle repeats seamlessly.
export const Waves: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = ((frame / (6 * fps)) % 1) * Math.PI * 2;
  const lines = Array.from({ length: 14 }, (_, i) => {
    const y0 = 160 + i * 130;
    const amp = 40 + (i % 4) * 14;
    const pts = Array.from({ length: 25 }, (_, k) => {
      const x = (k / 24) * W;
      const y = y0 + Math.sin(k * 0.45 + phase + i * 0.7) * amp + Math.sin(k * 0.17 - phase * 2 + i) * amp * 0.4;
      return `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return <path key={i} d={pts.join(' ')} stroke={COLORS.line} strokeWidth={2} fill="none" />;
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.bgTop}, ${COLORS.bgBottom})` }}>
      <svg width={W} height={H}>{lines}</svg>
    </AbsoluteFill>
  );
};

// White rounded content card that pops in at the start of each scene.
export const Card: React.FC<{ children: React.ReactNode; full?: boolean }> = ({ children, full }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps);
  const box = full ? FULL_CARD : CARD;
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        background: COLORS.card,
        border: `2px solid ${COLORS.cardBorder}`,
        borderRadius: 36,
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        transform: `translateY(${(1 - s) * 60}px) scale(${0.94 + s * 0.06})`,
        opacity: Math.min(1, s * 1.4),
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};

// Dark "@source" pill on the card's bottom edge.
export const Badge: React.FC<{ text: string; bottom: number }> = ({ text, bottom }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        top: bottom - 34,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: fadeIn(frame, 12),
      }}
    >
      <div
        style={{
          background: COLORS.gold,
          color: COLORS.onGold,
          fontSize: 30,
          fontWeight: 700,
          padding: '12px 26px',
          borderRadius: 18,
          unicodeBidi: 'plaintext',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const Headline: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 6);
  return (
    <div
      style={{
        textAlign: 'center',
        color: COLORS.white,
        fontSize: 76,
        fontWeight: 800,
        lineHeight: 1.15,
        textShadow: '0 6px 24px rgba(0,0,0,0.55)',
        transform: `scale(${0.9 + s * 0.1})`,
        opacity: Math.min(1, s * 1.3),
        unicodeBidi: 'plaintext',
      }}
    >
      {text}
    </div>
  );
};

// Narration shown as captions until a voice-over is added; sits left of the avatar.
export const Narration: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        width: 480,
        top: 1210,
        color: COLORS.white,
        fontSize: 40,
        fontWeight: 600,
        lineHeight: 1.35,
        textShadow: '0 3px 12px rgba(0,0,0,0.7)',
        opacity: fadeIn(frame, 8, 12),
        unicodeBidi: 'plaintext',
        textAlign: 'right',
      }}
    >
      {text}
    </div>
  );
};

// The presenter in the bottom corner: a pose image/video from public/ when one is
// given, otherwise a placeholder silhouette. A gentle bob keeps it alive.
export const Avatar: React.FC<{ src: string | null; pose: Pose; withAudio?: boolean }> = ({ src, pose, withAudio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bob = Math.sin((frame / fps) * Math.PI * 0.9) * 6;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: AVATAR.x,
    top: AVATAR.y + bob,
    width: AVATAR.w,
    height: AVATAR.h,
  };
  if (!src) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <svg width={480} height={646} viewBox="0 0 520 700">
          <circle cx={260} cy={230} r={150} fill="#c99a74" />
          <path d="M40 700 C 60 470, 160 410, 260 410 C 360 410, 460 470, 480 700 Z" fill="#2a241a" />
          <text x={260} y={600} textAnchor="middle" fill={COLORS.muted} fontSize={34} fontFamily="Rubik">
            {`אווטאר · ${pose}`}
          </text>
        </svg>
      </div>
    );
  }
  return (
    <div style={{ ...style, borderRadius: 40, overflow: 'hidden', border: '5px solid rgba(255,255,255,0.9)', boxShadow: '0 20px 50px rgba(0,0,0,0.45)', boxSizing: 'border-box' }}>
      {/\.(mp4|webm|mov)$/i.test(src) ? (
        <OffthreadVideo src={staticFile(src)} muted={!withAudio} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%' }} />
      )}
    </div>
  );
};

const CountUp: React.FC<{ value: number; prefix?: string; suffix?: string; delay?: number; size: number }> = ({
  value,
  prefix = '',
  suffix = '',
  delay = 6,
  size,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 800,
        direction: 'ltr',
        background: `${COLORS.numGradient}`,
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        lineHeight: 1,
      }}
    >
      {prefix}
      {Math.round(value * p)}
      {suffix}
    </span>
  );
};

const LogoRow: React.FC<{ brands: Extract<Scene, { kind: 'logos' }>['brands'] }> = ({ brands }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', gap: 30, justifyContent: 'center', alignItems: 'flex-end', direction: 'ltr' }}>
      {brands.map((b, i) => {
        const s = pop(frame, fps, 8 + i * 6);
        return (
          <div
            key={b}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              transform: `scale(${s})`,
              opacity: Math.min(1, s * 1.5),
            }}
          >
            <Logo brand={b} size={104} />
            <span style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink }}>{brandName(b)}</span>
          </div>
        );
      })}
    </div>
  );
};

const Post: React.FC<{ scene: Extract<Scene, { kind: 'post' }> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  if (scene.screenshot) {
    return <Img src={staticFile(scene.screenshot)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
  }
  // No screenshot yet: an attributed quote, deliberately not styled like an X post.
  const long = scene.quote.length > 90;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: '100%', alignItems: 'center' }}>
      {scene.brand && <Logo brand={scene.brand} size={90} />}
      <div
        style={{
          direction: 'ltr',
          textAlign: 'center',
          fontSize: long ? 40 : 54,
          fontWeight: 600,
          color: COLORS.ink,
          lineHeight: 1.3,
          opacity: fadeIn(frame, 6, 14),
        }}
      >
        “{scene.quote}”
      </div>
      <div style={{ direction: 'ltr', fontSize: 28, color: COLORS.muted, opacity: fadeIn(frame, 14) }}>
        — {scene.author} ({scene.handle}), {scene.date}
      </div>
      {long && (
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: COLORS.goldLight,
            textAlign: 'center',
            lineHeight: 1.35,
            opacity: fadeIn(frame, 24),
            unicodeBidi: 'plaintext',
          }}
        >
          {`תרגום: ${scene.translation}`}
        </div>
      )}
      {scene.counter && (
        <div style={{ display: 'flex', gap: 70, direction: 'ltr', marginTop: 4 }}>
          {scene.counter.map((c, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CountUp value={c.value} prefix={c.prefix} suffix={c.suffix} delay={18 + i * 8} size={110} />
              {c.note && <span style={{ fontSize: 26, color: COLORS.muted }}>{c.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Translation: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        textAlign: 'center',
        color: COLORS.goldLight,
        fontSize: 34,
        fontWeight: 600,
        opacity: fadeIn(frame, 20),
        unicodeBidi: 'plaintext',
      }}
    >
      {`תרגום: ${text}`}
    </div>
  );
};

const BigCounter: React.FC<{ scene: Extract<Scene, { kind: 'counter' }> }> = ({ scene }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
    <Logo brand={scene.brand} size={80} />
    <CountUp value={scene.value} size={260} delay={8} />
    <div style={{ fontSize: 46, fontWeight: 800, color: COLORS.ink }}>{scene.label}</div>
    <div style={{ fontSize: 28, color: COLORS.muted, textAlign: 'center', unicodeBidi: 'plaintext' }}>{scene.detail}</div>
  </div>
);

const Timeline: React.FC<{ items: Extract<Scene, { kind: 'timeline' }>['items'] }> = ({ items }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {items.map((it, i) => {
        const o = fadeIn(frame, 6 + i * 7, 8);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              opacity: o,
              transform: `translateX(${(1 - o) * 40}px)`,
            }}
          >
            <span style={{ width: 120, fontSize: 32, fontWeight: 800, color: COLORS.gold, direction: 'ltr', textAlign: 'center' }}>
              {it.date}
            </span>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: COLORS.gold, flex: 'none' }} />
            {it.brand && <Logo brand={it.brand} size={44} />}
            <span style={{ fontSize: 34, fontWeight: 700, color: COLORS.ink, unicodeBidi: 'plaintext' }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const Bars: React.FC<{ scene: Extract<Scene, { kind: 'bars' }> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const max = Math.max(...scene.bars.map((b) => b.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', direction: 'ltr' }}>
      {scene.bars.map((b, i) => {
        const p = interpolate(frame, [6 + i * 5, 30 + i * 5], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 280, fontSize: 30, fontWeight: 700, color: COLORS.ink }}>{b.label}</span>
            <div style={{ flex: 1, height: 58, position: 'relative' }}>
              <div
                style={{
                  width: `${(b.value / max) * 100 * p}%`,
                  height: '100%',
                  borderRadius: 14,
                  background: `linear-gradient(90deg, ${COLORS.goldDark}, ${COLORS.gold}, ${COLORS.goldLight})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 12,
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.onGold, opacity: p }}>{Math.round(b.value * p)}</span>
              </div>
            </div>
            <div style={{ width: 120, display: 'flex', justifyContent: 'center', opacity: p }}>
              {b.brand && <Logo brand={b.brand} size={46} />}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 24, color: COLORS.muted, textAlign: 'center', marginTop: 8 }}>{scene.footnote}</div>
    </div>
  );
};

// One scene: card content, badge, headline, translation, narration, avatar.
// The presenter is drawn by WeeklyAI, outside the scenes, so a talking-head video
// plays continuously instead of restarting at every cut.
export const SceneView: React.FC<{ scene: Scene; captions: boolean }> = ({ scene, captions }) => {
  const fullQuote = scene.kind === 'post' && scene.quote.length > 90 && !scene.screenshot;
  const cardBottom = fullQuote ? FULL_CARD.y + FULL_CARD.h : CARD.y + CARD.h;
  const headlineTop = scene.kind === 'outro' ? 640 : cardBottom + 60;
  return (
    <AbsoluteFill>
      {scene.kind !== 'outro' && (
        <Card full={fullQuote}>
          {scene.kind === 'logos' && <LogoRow brands={scene.brands} />}
          {scene.kind === 'post' && <Post scene={scene} />}
          {scene.kind === 'counter' && <BigCounter scene={scene} />}
          {scene.kind === 'timeline' && <Timeline items={scene.items} />}
          {scene.kind === 'bars' && <Bars scene={scene} />}
        </Card>
      )}
      {scene.kind !== 'outro' && <Badge text={scene.badge} bottom={cardBottom} />}
      <div style={{ position: 'absolute', top: headlineTop, left: 50, right: 50, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Headline text={scene.headline} />
        {scene.kind === 'post' && !fullQuote && <Translation text={scene.translation} />}
      </div>
      {scene.kind === 'outro' && (
        <>
          <Badge text={scene.badge} bottom={headlineTop + 220} />
          <div
            style={{
              position: 'absolute',
              top: headlineTop + 260,
              left: 60,
              right: 60,
              textAlign: 'center',
              color: COLORS.muted,
              fontSize: 30,
            }}
          >
            {scene.disclaimer}
          </div>
        </>
      )}
      {captions && <Narration text={scene.narration} />}
    </AbsoluteFill>
  );
};
