import React from 'react';
import { interpolate, spring } from 'remotion';
import { COLORS } from './ui';

// Small animated line icons, drawn in code in the gold theme. `f` is frames
// since the icon appeared; most icons also keep a gentle loop going after.

export type IconKind = 'rocket' | 'money' | 'chart' | 'users' | 'document' | 'merge' | 'chip' | 'flask' | 'calendar' | 'gavel' | 'globe';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const stroke = { stroke: COLORS.gold, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
const draw = (f: number, from: number, len: number, total: number) => total * (1 - interpolate(f, [from, from + len], [0, 1], clamp));

export const AnimatedIcon: React.FC<{ kind: IconKind; f: number; fps: number; size: number }> = ({ kind, f, fps, size }) => {
  const pop = (delay = 0) => spring({ frame: f - delay, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } });
  const loop = (period: number) => (f / period) % 1;
  let body: React.ReactNode = null;

  switch (kind) {
    case 'rocket': {
      const lift = -interpolate(f, [0, 20], [0, 18], clamp) + Math.sin(f / 4) * 3;
      const flame = 0.8 + Math.abs(Math.sin(f / 2.3)) * 0.5;
      body = (
        <>
          {[0, 1, 2].map((i) => {
            const y = 40 + ((loop(14) + i / 3) % 1) * 140;
            return <line key={i} x1={40 + i * 60} y1={y} x2={40 + i * 60} y2={y + 26} {...stroke} strokeWidth={5} opacity={0.5} />;
          })}
          <g transform={`translate(0 ${lift})`}>
            <path d="M100 30 C 128 55, 130 100, 122 135 L 78 135 C 70 100, 72 55, 100 30 Z" {...stroke} />
            <circle cx={100} cy={82} r={12} {...stroke} />
            <path d="M78 112 L 58 140 L 80 136 M122 112 L 142 140 L 120 136" {...stroke} />
            <path d={`M88 140 Q 100 ${140 + 40 * flame} 112 140`} {...stroke} stroke={COLORS.goldLight} />
          </g>
        </>
      );
      break;
    }
    case 'money': {
      body = (
        <>
          {[0, 1, 2, 3].map((i) => {
            const p = pop(i * 5);
            const y = 150 - i * 22 - (1 - p) * 60;
            return <ellipse key={i} cx={100} cy={y} rx={46} ry={14} {...stroke} opacity={Math.min(1, p * 1.5)} />;
          })}
          <text
            x={100}
            y={70}
            textAnchor="middle"
            fontSize={64}
            fontWeight={800}
            fill={COLORS.goldLight}
            opacity={pop(22)}
            transform={`translate(0 ${-Math.sin(f / 8) * 4})`}
          >
            $
          </text>
        </>
      );
      break;
    }
    case 'chart': {
      const len = 260;
      body = (
        <>
          <path d="M30 30 L 30 170 L 175 170" {...stroke} />
          {[0, 1, 2].map((i) => {
            const h = interpolate(f, [i * 4, i * 4 + 14], [0, 30 + i * 30], clamp);
            return <rect key={i} x={50 + i * 40} y={165 - h} width={22} height={h} fill={COLORS.goldDark} rx={4} />;
          })}
          <path d="M45 140 L 85 115 L 115 125 L 165 55" {...stroke} stroke={COLORS.goldLight} strokeDasharray={len} strokeDashoffset={draw(f, 8, 18, len)} />
          <path d="M140 55 L 165 55 L 165 80" {...stroke} stroke={COLORS.goldLight} opacity={f > 24 ? 1 : 0} />
        </>
      );
      break;
    }
    case 'users': {
      const person = (x: number, y: number, s: number, p: number, key: number) => (
        <g key={key} transform={`translate(${x} ${y}) scale(${s * p})`} opacity={Math.min(1, p * 1.5)}>
          <circle cx={0} cy={-22} r={16} {...stroke} />
          <path d="M-30 30 C -28 0, 28 0, 30 30" {...stroke} />
        </g>
      );
      const ring = loop(36);
      body = (
        <>
          <circle cx={100} cy={100} r={40 + ring * 60} {...stroke} strokeWidth={4} opacity={(1 - ring) * 0.6} />
          {person(55, 120, 0.8, pop(6), 1)}
          {person(145, 120, 0.8, pop(10), 2)}
          {person(100, 105, 1.1, pop(0), 3)}
        </>
      );
      break;
    }
    case 'document': {
      const pen = Math.min(3, Math.floor(f / 10));
      body = (
        <>
          <path d="M50 25 L 125 25 L 155 55 L 155 178 L 50 178 Z M125 25 L 125 55 L 155 55" {...stroke} />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={70} y1={80 + i * 24} x2={135} y2={80 + i * 24} {...stroke} strokeWidth={6} strokeDasharray={65} strokeDashoffset={draw(f, i * 10, 10, 65)} />
          ))}
          <g transform={`translate(${70 + ((f % 10) / 10) * 65} ${80 + pen * 24 - 30}) rotate(30)`} opacity={f < 42 ? 1 : 0}>
            <path d="M0 0 L 0 40 L 6 52 L 12 40 L 12 0 Z" {...stroke} strokeWidth={5} stroke={COLORS.goldLight} />
          </g>
        </>
      );
      break;
    }
    case 'merge': {
      const m = interpolate(f, [0, 22], [0, 1], { ...clamp, easing: (x) => x * x * (3 - 2 * x) });
      const flash = interpolate(f, [22, 26, 40], [0, 1, 0], clamp);
      body = (
        <>
          <circle cx={100 - 45 * (1 - m)} cy={100} r={34 + m * 12} {...stroke} />
          <circle cx={100 + 45 * (1 - m)} cy={100} r={34 + m * 12} {...stroke} opacity={1 - m * 0.9} />
          <circle cx={100} cy={100} r={46 + flash * 40} {...stroke} strokeWidth={4} stroke={COLORS.goldLight} opacity={flash} />
        </>
      );
      break;
    }
    case 'chip': {
      const glow = 0.5 + Math.sin(f / 5) * 0.5;
      body = (
        <>
          <rect x={60} y={60} width={80} height={80} rx={10} {...stroke} />
          <rect x={82} y={82} width={36} height={36} rx={4} fill={COLORS.gold} opacity={0.3 + glow * 0.6} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <line x1={78 + i * 22} y1={60} x2={78 + i * 22} y2={30} {...stroke} strokeWidth={6} strokeDasharray="8 10" strokeDashoffset={-f * 2} />
              <line x1={78 + i * 22} y1={140} x2={78 + i * 22} y2={170} {...stroke} strokeWidth={6} strokeDasharray="8 10" strokeDashoffset={f * 2} />
              <line x1={60} y1={78 + i * 22} x2={30} y2={78 + i * 22} {...stroke} strokeWidth={6} strokeDasharray="8 10" strokeDashoffset={-f * 2} />
              <line x1={140} y1={78 + i * 22} x2={170} y2={78 + i * 22} {...stroke} strokeWidth={6} strokeDasharray="8 10" strokeDashoffset={f * 2} />
            </g>
          ))}
        </>
      );
      break;
    }
    case 'flask': {
      body = (
        <>
          <path d="M80 25 L 120 25 M88 25 L 88 75 L 45 165 Q 42 175, 55 175 L 145 175 Q 158 175, 155 165 L 112 75 L 112 25" {...stroke} />
          <path d="M60 140 L 140 140" {...stroke} strokeWidth={5} opacity={0.6} />
          {[0, 1, 2, 3].map((i) => {
            const t = (loop(30) + i / 4) % 1;
            return <circle key={i} cx={85 + i * 10 + Math.sin((t + i) * 6) * 6} cy={165 - t * 110} r={5 + i} fill={COLORS.goldLight} opacity={1 - t} />;
          })}
        </>
      );
      break;
    }
    case 'calendar': {
      const flip = interpolate(f, [8, 20], [0, 1], clamp);
      body = (
        <>
          <rect x={35} y={45} width={130} height={125} rx={14} {...stroke} />
          <line x1={35} y1={80} x2={165} y2={80} {...stroke} />
          <line x1={70} y1={30} x2={70} y2={55} {...stroke} />
          <line x1={130} y1={30} x2={130} y2={55} {...stroke} />
          <text x={100} y={142} textAnchor="middle" fontSize={44} fontWeight={800} fill={COLORS.goldLight} opacity={1 - flip}>
            2026
          </text>
          <text x={100} y={142} textAnchor="middle" fontSize={44} fontWeight={800} fill={COLORS.gold} opacity={flip} transform={`translate(0 ${(1 - flip) * 20})`}>
            2027
          </text>
        </>
      );
      break;
    }
    case 'gavel': {
      const hit = interpolate(f, [0, 10, 14], [-50, 8, 0], clamp);
      const ring = interpolate(f, [10, 30], [0, 1], clamp);
      body = (
        <>
          <line x1={40} y1={172} x2={160} y2={172} {...stroke} />
          <ellipse cx={95} cy={160} rx={70 * ring} ry={14 * ring} {...stroke} strokeWidth={4} opacity={1 - ring} />
          <g transform={`rotate(${hit} 150 150)`}>
            <rect x={55} y={60} width={70} height={36} rx={8} transform="rotate(-35 90 78)" {...stroke} />
            <line x1={100} y1={92} x2={150} y2={150} {...stroke} />
          </g>
        </>
      );
      break;
    }
    case 'globe': {
      const spin = loop(60) * Math.PI * 2;
      body = (
        <>
          <circle cx={100} cy={100} r={70} {...stroke} />
          <line x1={30} y1={100} x2={170} y2={100} {...stroke} strokeWidth={5} />
          <ellipse cx={100} cy={100} rx={70} ry={26} {...stroke} strokeWidth={5} />
          {[0, 1].map((i) => (
            <ellipse key={i} cx={100} cy={100} rx={Math.abs(Math.cos(spin + i * 1.2)) * 70} ry={70} {...stroke} strokeWidth={5} />
          ))}
        </>
      );
      break;
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
      {body}
    </svg>
  );
};
