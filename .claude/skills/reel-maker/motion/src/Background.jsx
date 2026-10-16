import { AbsoluteFill, useCurrentFrame } from 'remotion';

// Deterministic background per theme: a warm glow with drifting gold dust
// (gold), a soft wave (light), or nothing (none = transparent).
export function Background({ t }) {
  const frame = useCurrentFrame();
  if (t.bg === 'transparent') return null;
  if (t.bg === '#0a0908') {
    const dots = Array.from({ length: 60 }, (_, i) => {
      const r1 = Math.sin(i * 12.9898) * 43758.5453;
      const r2 = Math.sin(i * 78.233) * 12345.6789;
      const x = (((r1 - Math.floor(r1)) + frame * 0.0003 * ((i % 5) - 2)) % 1 + 1) % 1;
      const y = (((r2 - Math.floor(r2)) - frame * 0.0004 * ((i % 3) + 1)) % 1 + 1) % 1;
      return <div key={i} style={{
        position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3,
        borderRadius: '50%', background: t.accentLight, opacity: 0.08 + 0.22 * ((i * 7) % 10) / 10,
      }} />;
    });
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 58%, rgba(226,181,76,0.16), rgba(226,181,76,0) 65%), ${t.bg}` }}>
        {dots}
      </AbsoluteFill>
    );
  }
  const shift = Math.sin(frame / 40) * 30;
  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <path d={`M0 ${1500 + shift} C 300 ${1380 - shift}, 700 ${1650 + shift}, 1080 ${1480 - shift} L1080 1920 L0 1920 Z`} fill={t.accent} opacity="0.12" />
        <path d={`M0 ${1600 - shift} C 360 ${1720 + shift}, 760 ${1500 - shift}, 1080 ${1640 + shift} L1080 1920 L0 1920 Z`} fill={t.accent} opacity="0.18" />
      </svg>
    </AbsoluteFill>
  );
}
