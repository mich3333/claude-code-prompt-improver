import React from 'react';
import { COLORS } from './ui';

// A drawn news anchor, animated in code. `talk` (0-1) opens the mouth, `gesture`
// (0-1) raises the right hand above the desk, `blink` (0-1) closes the eyes and
// `tilt` (degrees) turns the head slightly. The lower body is meant to sit
// behind a desk, so nothing below y≈560 needs to look finished.

const SKIN = '#d9a77e';
const SKIN_SHADE = '#c08c66';
const HAIR = '#1f1a14';
const SUIT = '#201c16';

export const ANCHOR_BOX = { w: 600, h: 640 };

export const Anchor: React.FC<{ talk: number; gesture: number; blink: number; tilt: number; look: number }> = ({ talk, gesture, blink, tilt, look }) => {
  const eyeRy = 11 * (1 - blink * 0.9);
  const handY = 600 - gesture * 175;
  const handX = 470 - gesture * 25;
  const brow = -gesture * 6 - talk * 2;
  return (
    <svg width={ANCHOR_BOX.w} height={ANCHOR_BOX.h} viewBox="0 0 600 640" style={{ overflow: 'visible' }}>
      {/* Body */}
      <path d="M60 640 C 70 470, 170 418, 300 416 C 430 418, 530 470, 540 640 Z" fill={SUIT} />
      <path d="M300 416 C 430 418, 530 470, 540 640" fill="none" stroke={COLORS.goldDark} strokeWidth={3} opacity={0.6} />
      <path d="M300 416 C 170 418, 70 470, 60 640" fill="none" stroke={COLORS.goldDark} strokeWidth={3} opacity={0.6} />
      <rect x={268} y={350} width={64} height={80} rx={20} fill={SKIN_SHADE} />
      <path d="M248 418 L300 525 L352 418 Z" fill={COLORS.ink} />
      <path d="M289 432 L311 432 L320 520 L300 548 L280 520 Z" fill={COLORS.gold} />
      <path d="M244 416 L292 520 L262 540 L208 436 Z" fill="#2c271f" />
      <path d="M356 416 L308 520 L338 540 L392 436 Z" fill="#2c271f" />
      <circle cx={420} cy={480} r={9} fill={COLORS.gold} />

      {/* Raised hand: an arm from the shoulder, hidden behind the desk when lowered */}
      <path d={`M455 470 Q ${handX + 40} ${(470 + handY) / 2 + 30}, ${handX} ${handY}`} fill="none" stroke={SUIT} strokeWidth={64} strokeLinecap="round" />
      <g transform={`translate(${handX} ${handY - 12}) rotate(${-10 - gesture * 12})`}>
        <rect x={-26} y={-58} width={52} height={74} rx={24} fill={SKIN} />
        <rect x={-34} y={-30} width={18} height={40} rx={9} fill={SKIN_SHADE} transform="rotate(-25 -25 -10)" />
      </g>

      {/* Head */}
      <g transform={`rotate(${tilt} 300 380)`}>
        <ellipse cx={190} cy={262} rx={18} ry={30} fill={SKIN_SHADE} />
        <ellipse cx={410} cy={262} rx={18} ry={30} fill={SKIN_SHADE} />
        <ellipse cx={300} cy={252} rx={112} ry={132} fill={SKIN} />
        <path d="M184 250 C 172 138, 230 92, 302 92 C 382 92, 432 140, 418 250 C 408 186, 372 160, 318 168 C 296 140, 236 160, 212 182 C 196 200, 188 224, 184 250 Z" fill={HAIR} />
        <g transform={`translate(0 ${brow})`}>
          <path d="M232 206 Q 256 192 282 204" fill="none" stroke={HAIR} strokeWidth={9} strokeLinecap="round" />
          <path d="M318 204 Q 344 192 368 206" fill="none" stroke={HAIR} strokeWidth={9} strokeLinecap="round" />
        </g>
        <ellipse cx={258} cy={238} rx={17} ry={eyeRy} fill="#fff" />
        <ellipse cx={342} cy={238} rx={17} ry={eyeRy} fill="#fff" />
        {blink < 0.6 && (
          <>
            <circle cx={258 + look * 6} cy={239} r={8} fill="#2a1d12" />
            <circle cx={342 + look * 6} cy={239} r={8} fill="#2a1d12" />
          </>
        )}
        <path d="M300 250 Q 290 284 300 292 Q 308 293 313 287" fill="none" stroke={SKIN_SHADE} strokeWidth={6} strokeLinecap="round" />
        <ellipse cx={232} cy={292} rx={22} ry={12} fill="#e08f7a" opacity={0.25} />
        <ellipse cx={368} cy={292} rx={22} ry={12} fill="#e08f7a" opacity={0.25} />
        {talk > 0.06 ? (
          <g>
            <ellipse cx={300} cy={326} rx={30 - talk * 6} ry={4 + talk * 17} fill="#5a2a22" />
            <rect x={282} y={326 - (4 + talk * 17)} width={36} height={Math.min(8, 2 + talk * 10)} rx={3} fill="#fff" />
          </g>
        ) : (
          <path d="M272 320 Q 300 338 328 320" fill="none" stroke="#8a4a3a" strokeWidth={7} strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
};
