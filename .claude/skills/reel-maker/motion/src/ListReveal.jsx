import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from './Background.jsx';
import { FONT, HEAVY, splitBidi, theme } from './theme.js';

// "3 reasons" style list: a title, then numbered cards that slide in from the
// right one after another. `at` (seconds, optional, one per item) lets each
// item land on the word that introduces it; otherwise they are spaced evenly.
//   props: { title, items: ["...", ...], at: [0.4, 1.6, ...], theme, region, duration }
export function ListReveal({ title = '', items = [], at = [], theme: name = 'gold', region = 'full', duration = 4 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = theme(name);
  const n = Math.max(1, items.length);
  const top = region === 'top';
  const fs = top ? (n > 3 ? 46 : 54) : (n > 4 ? 58 : 68);
  const step = Math.min(1.1, Math.max(0.35, (duration * 0.6) / n));
  const titleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });

  return (
    <AbsoluteFill>
      <Background t={t} />
      <AbsoluteFill style={{ direction: 'rtl', justifyContent: 'center', padding: top ? '40px 70px' : '0 70px', gap: top ? 18 : 30 }}>
        {title ? (
          <div style={{
            fontFamily: HEAVY, fontWeight: 900, fontSize: fs * 1.35, color: t.text, opacity: titleIn, marginBottom: top ? 6 : 20,
            transform: `translateY(${(1 - titleIn) * 24}px)`, textAlign: 'center',
          }}>{splitBidi(title).map((p, i) => <bdi key={i}>{p}</bdi>)}</div>
        ) : null}
        {items.map((item, i) => {
          const start = Math.round(((at[i] ?? 0.45 + i * step)) * fps);
          const s = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 170, mass: 0.7 } });
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: fs * 0.45, padding: `${fs * 0.32}px ${fs * 0.45}px`, borderRadius: fs * 0.35,
              background: t.card, border: t.bg === '#0a0908' ? '2px solid rgba(226,181,76,0.35)' : 'none',
              boxShadow: t.bg === '#f4f1ea' ? '0 10px 30px rgba(0,0,0,0.08)' : 'none',
              opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * -380}px)`,
            }}>
              <div style={{
                flex: 'none', width: fs * 1.25, height: fs * 1.25, borderRadius: '50%', background: t.accent, color: t.bg === '#0a0908' ? '#0a0908' : '#fff',
                fontFamily: HEAVY, fontWeight: 900, fontSize: fs * 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</div>
              <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: fs, color: t.text, lineHeight: 1.2 }}>
                {splitBidi(item).map((p, k) => <bdi key={k}>{p}</bdi>)}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
