import React from 'react';
import { COLORS } from './ui';

// A generic phone frame drawn in code: rounded body, side buttons, a camera
// pill and a status bar. The screen is whatever `children` renders.

export const Phone: React.FC<{ w: number; h: number; children: React.ReactNode; glow?: number }> = ({ w, h, children, glow = 1 }) => {
  const bezel = Math.round(w * 0.035);
  const radius = Math.round(w * 0.16);
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -6, top: h * 0.2, width: 6, height: h * 0.06, borderRadius: 3, background: COLORS.edge }} />
      <div style={{ position: 'absolute', left: -6, top: h * 0.29, width: 6, height: h * 0.09, borderRadius: 3, background: COLORS.edge }} />
      <div style={{ position: 'absolute', right: -6, top: h * 0.25, width: 6, height: h * 0.12, borderRadius: 3, background: COLORS.edge }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: '#0b0c0d',
          border: `3px solid ${COLORS.edge}`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${60 * glow}px rgba(${COLORS.glow},${0.22 * glow})`,
          padding: bezel,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: radius - bezel, overflow: 'hidden', background: COLORS.bgBottom }}>
          {/* Status bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px', fontSize: 24, fontWeight: 700, color: COLORS.ink, direction: 'ltr', zIndex: 3 }}>
            <span>9:41</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[8, 12, 16, 20].map((hh) => (
                <span key={hh} style={{ width: 5, height: hh, borderRadius: 2, background: COLORS.ink, display: 'inline-block' }} />
              ))}
              <span style={{ marginLeft: 8, width: 34, height: 16, borderRadius: 5, border: `2px solid ${COLORS.ink}`, display: 'inline-block', position: 'relative' }}>
                <span style={{ position: 'absolute', inset: 2, right: 8, borderRadius: 2, background: COLORS.gold }} />
              </span>
            </span>
          </div>
          {/* Camera pill */}
          <div style={{ position: 'absolute', top: 14, left: '50%', width: w * 0.28, height: 36, marginLeft: -(w * 0.14), borderRadius: 18, background: '#000', zIndex: 4 }} />
          <div style={{ position: 'absolute', inset: 0, paddingTop: 70 }}>{children}</div>
          {/* Home indicator */}
          <div style={{ position: 'absolute', bottom: 12, left: '50%', width: w * 0.34, marginLeft: -(w * 0.17), height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.55)', zIndex: 3 }} />
        </div>
      </div>
    </div>
  );
};
