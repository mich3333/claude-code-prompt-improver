import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from './Background.jsx';
import { FONT, HEAVY, splitBidi, theme } from './theme.js';

// Kinetic typography: a small kicker, then the title words spring in one by one
// (right to left, as Hebrew is read). Words listed in `highlight` are drawn in
// the accent colour with an underline that wipes in.
//   props: { kicker, lines: ["שורה", ...], highlight: ["מילה"], theme, region, duration }
export function KineticTitle({ kicker = '', lines = [], highlight = [], theme: name = 'gold', region = 'full' }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = theme(name);
  const marks = new Set(highlight.map((w) => w.trim()));
  const words = lines.map((line) => String(line).split(/\s+/).filter(Boolean));
  const total = words.flat().length;
  const size = Math.min(150, Math.max(78, (region === 'top' ? 900 : 1500) / Math.max(3, total * 0.9)));
  const kickerIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  let index = 0;

  return (
    <AbsoluteFill>
      <Background t={t} />
      <AbsoluteFill style={{ direction: 'rtl', alignItems: 'center', justifyContent: 'center', padding: '0 80px', gap: size * 0.25 }}>
        {kicker ? (
          <div style={{
            fontFamily: FONT, fontWeight: 500, fontSize: size * 0.38, color: t.accent, opacity: kickerIn,
            transform: `translateY(${(1 - kickerIn) * 20}px)`,
          }}>{splitBidi(kicker).map((p, i) => <bdi key={i}>{p}</bdi>)}</div>
        ) : null}
        {words.map((line, li) => (
          <div key={li} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.28, rowGap: size * 0.1 }}>
            {line.map((word) => {
              const start = 6 + index++ * 4;
              const s = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
              const hot = marks.has(word.replace(/[.,!?:]/g, ''));
              const wipe = interpolate(frame - start - 6, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return (
                <span key={start} style={{
                  position: 'relative', display: 'inline-block', fontFamily: HEAVY, fontWeight: 900, fontSize: size, lineHeight: 1.05,
                  color: hot ? t.accent : t.text, opacity: Math.min(1, s * 1.5),
                  transform: `translateY(${(1 - s) * size * 0.45}px) scale(${0.85 + 0.15 * s})`,
                  textShadow: t.bg === 'transparent' ? '0 4px 18px rgba(0,0,0,0.6)' : 'none',
                }}>
                  <bdi>{word}</bdi>
                  {hot ? <span style={{
                    position: 'absolute', right: 0, bottom: -size * 0.06, height: size * 0.08, width: `${wipe * 100}%`,
                    background: t.accentLight, borderRadius: size * 0.04,
                  }} /> : null}
                </span>
              );
            })}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
