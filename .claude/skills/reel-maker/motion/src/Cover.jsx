import { AbsoluteFill, Img, staticFile } from 'remotion';
import { HEAVY, FONT, splitBidi, theme } from './theme.js';

// Reel cover (rendered as a still). Text stays inside the 1080x1440 middle
// band (y 240-1680) so the Instagram grid's 3:4 crop keeps it, and clear of
// the TikTok/Shorts side buttons.
//   props: { image: "frame.jpg" (in the public dir), title, highlight, subtitle, theme }
export function Cover({ image, title = '', highlight = [], subtitle = '', theme: name = 'gold' }) {
  const t = theme(name);
  const marks = new Set(highlight);
  const words = String(title).split(/\s+/).filter(Boolean);
  const size = Math.min(170, Math.max(96, 1100 / Math.max(2.5, words.length * 0.75)));
  return (
    <AbsoluteFill style={{ background: t.bg === 'transparent' ? '#000' : t.bg }}>
      {image ? <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.78) 75%)' }} />
      <div style={{
        position: 'absolute', left: 70, right: 150, top: 1000, bottom: 300, direction: 'rtl',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 24,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.25, lineHeight: 1.02 }}>
          {words.map((w, i) => (
            <span key={i} style={{
              fontFamily: HEAVY, fontWeight: 900, fontSize: size, color: marks.has(w) ? t.accent : '#fff',
              textShadow: '0 6px 24px rgba(0,0,0,0.6)',
            }}><bdi>{w}</bdi></span>
          ))}
        </div>
        {subtitle ? <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: size * 0.34, color: '#f4f1ea' }}>
          {splitBidi(subtitle).map((p, i) => <bdi key={i}>{p}</bdi>)}
        </div> : null}
      </div>
    </AbsoluteFill>
  );
}
