import '@fontsource/playfair-display/700-italic.css';
import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Anchor, ANCHOR_BOX } from './anchor';
import type { Word } from './captions';
import { COLORS, W } from './ui';

// "How to get Claude to build your videos": the split layout from talking-head
// explainers. A fixed title on top, a glowing screen that changes with each
// sentence, one big caption word at a time, and the presenter in a card at the
// bottom (a filmed face video, or the drawn anchor until there is one).
// Facts about the skill come from github.com/remotion-dev/skills (16.10.2026).

type Shot =
  | { kind: 'hook' }
  | { kind: 'repo' }
  | { kind: 'install' }
  | { kind: 'skills' }
  | { kind: 'example'; prompt: string; reply: string; clip: string; from: number }
  | { kind: 'outro' };

export const SKILL_SCRIPT: { text: string; shot: Shot }[] = [
  { text: 'כתבתי ל-Claude פקודה אחת, וקיבלתי סרטון שלם.', shot: { kind: 'hook' } },
  { text: 'הסוד הוא הסקיל של Remotion: חבילת הוראות שמלמדת את Claude לבנות סרטונים בקוד.', shot: { kind: 'repo' } },
  { text: 'מתקינים אותו בפקודה אחת בטרמינל.', shot: { kind: 'install' } },
  { text: 'ויש בו סקילים לכל דבר: ליצור סרטון, להנפיש טקסט, כתוביות, מפות ורינדור.', shot: { kind: 'skills' } },
  {
    text: 'ואז פשוט כותבים לו, כמו שכותבים לחבר: תעשה לי מהדורת חדשות עם מגיש מונפש.',
    shot: { kind: 'example', prompt: 'תעשה לי מהדורת חדשות עם מגיש מונפש', reply: 'בניתי מהדורה: מגיש באולפן, מסך עם הכתבות ופס מבזקים.', clip: 'demos/ai-news.mp4', from: 6 },
  },
  {
    text: 'או: תשווה בין OpenAI ל-Anthropic.',
    shot: { kind: 'example', prompt: 'תשווה בין OpenAI ל-Anthropic', reply: 'ארבעה סיבובים, ולכל מספר יש מקור.', clip: 'demos/openai-vs-anthropic.mp4', from: 3 },
  },
  {
    text: 'או: קח כתבות אמיתיות ותשייך אחת לכל אירוע.',
    shot: { kind: 'example', prompt: 'קח כתבות אמיתיות ותשייך אחת לכל אירוע', reply: 'צילמתי 17 כתבות וחיברתי כל אחת לכרטיס שלה.', clip: 'demos/ai-2026-articles.mp4', from: 8 },
  },
  { text: 'כל הסרטונים האלה נבנו ככה. שמרו את הסרטון, ובפעם הבאה אני מראה את כל התהליך.', shot: { kind: 'outro' } },
];

export type SkillProps = {
  /** Voice-over in public/ (or leave null when the face video carries the sound). */
  voice: string | null;
  /** Word timings from the transcript, or estimated ones for a preview. */
  words: Word[] | null;
  /** Filmed presenter in public/, e.g. "face.mp4". null shows the drawn anchor. */
  face: string | null;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const PANEL = { x: 60, y: 370, w: 960, h: 780 };
const FACE = { x: 40, y: 1330, w: 1000, h: 520 };
const MONO = '"DejaVu Sans Mono", "Menlo", monospace';
const SERIF = '"Playfair Display", serif';

type Seg = { from: number; to: number; i: number };

const segments = (words: Word[], fps: number, total: number): Seg[] => {
  const segs: Seg[] = [];
  let w = 0;
  SKILL_SCRIPT.forEach((line, i) => {
    const first = words[w];
    w += line.text.split(/\s+/).filter(Boolean).length;
    if (first) segs.push({ from: i === 0 ? 0 : Math.round(first.start * fps) - 4, to: total, i });
  });
  segs.forEach((s, k) => {
    if (segs[k + 1]) s.to = segs[k + 1].from;
  });
  return segs;
};

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 35%, ${COLORS.raised}, ${COLORS.bgBottom} 70%)`,
    }}
  >
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(rgba(${COLORS.glow},0.16) 1.6px, transparent 1.6px)`,
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse at 50% 45%, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, black 30%, transparent 80%)',
      }}
    />
  </AbsoluteFill>
);

const Title: React.FC = () => (
  <div style={{ position: 'absolute', top: 120, left: 40, right: 40, textAlign: 'center', color: COLORS.white, fontWeight: 800, fontSize: 76, lineHeight: 1.12, direction: 'rtl' }}>
    <div>
      איך לגרום ל-
      <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, color: COLORS.goldLight, fontSize: 84, unicodeBidi: 'isolate' }}>Claude</span>
    </div>
    <div>לבנות לכם סרטונים</div>
  </div>
);

const Screen: React.FC<{ children: React.ReactNode; f: number; light?: boolean }> = ({ children, f, light }) => {
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 15, stiffness: 170, mass: 0.7 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        height: PANEL.h,
        borderRadius: 34,
        padding: 14,
        boxSizing: 'border-box',
        border: '4px solid rgba(255,255,255,0.92)',
        boxShadow: `0 0 40px rgba(255,255,255,0.25), 0 0 90px rgba(${COLORS.glow},0.18)`,
        background: `rgba(${COLORS.deepRGB},0.6)`,
        transform: `scale(${0.94 + s * 0.06})`,
        opacity: Math.min(1, s * 1.5),
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden', background: light ? COLORS.ink : COLORS.deep, position: 'relative' }}>{children}</div>
    </div>
  );
};

const typed = (text: string, f: number, start = 0, cps = 1.1) => text.slice(0, Math.max(0, Math.floor((f - start) * cps)));
const Cursor: React.FC<{ f: number; color?: string }> = ({ f, color = COLORS.gold }) => (
  <span style={{ display: 'inline-block', width: 16, height: 46, marginInline: 4, background: color, opacity: Math.floor(f / 12) % 2 ? 0 : 1, verticalAlign: 'middle' }} />
);

// A chat-style prompt box: the request typed out, then a send arrow.
const PromptBox: React.FC<{ text: string; f: number; size?: number }> = ({ text, f, size = 44 }) => {
  const shown = typed(text, f, 4, 1.2);
  const done = shown.length >= text.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px 26px', borderRadius: 26, background: COLORS.panel, border: `2px solid ${COLORS.cardBorder}`, direction: 'rtl' }}>
      <div style={{ flex: 1, fontSize: size, fontWeight: 600, color: COLORS.ink, minHeight: size * 1.25 }}>
        {shown}
        {!done && <Cursor f={f} />}
      </div>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: done ? COLORS.gold : COLORS.edge,
          color: COLORS.onGold,
          fontSize: 38,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${done ? 1 + Math.max(0, 0.25 - (f - 4 - text.length / 1.2) * 0.03) : 1})`,
        }}
      >
        ↑
      </div>
    </div>
  );
};

const RepoShot: React.FC<{ f: number }> = ({ f }) => {
  const stars = interpolate(f, [10, 40], [0, 5.2], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tag = (t: string, k: number) => (
    <div key={t} style={{ padding: '10px 22px', borderRadius: 30, border: `2px solid ${COLORS.cardBorder}`, color: COLORS.goldLight, fontSize: 34, fontWeight: 600, opacity: interpolate(f, [26 + k * 5, 34 + k * 5], [0, 1], clamp) }}>
      {t}
    </div>
  );
  return (
    <Screen f={f}>
      <div style={{ position: 'absolute', inset: 50, display: 'flex', flexDirection: 'column', gap: 34, direction: 'ltr' }}>
        <div style={{ fontFamily: MONO, fontSize: 34, color: COLORS.muted }}>github.com/</div>
        <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 700, color: COLORS.ink, marginTop: -24 }}>remotion-dev/skills</div>
        <div style={{ fontSize: 40, color: COLORS.ink, direction: 'rtl', textAlign: 'right' }}>הוראות לסוכני AI: איך בונים סרטונים בקוד</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 110, color: COLORS.gold, lineHeight: 1 }}>★</span>
          <span style={{ fontSize: 120, fontWeight: 800, color: COLORS.goldLight, lineHeight: 1 }}>{stars.toFixed(1)}k</span>
          <span style={{ fontSize: 34, color: COLORS.muted, alignSelf: 'flex-end', marginBottom: 14 }}>stars</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{['Claude Code', 'Codex', 'Cursor'].map(tag)}</div>
      </div>
    </Screen>
  );
};

const InstallShot: React.FC<{ f: number }> = ({ f }) => {
  const cmd = 'npx skills add remotion-dev/skills';
  const shown = typed(cmd, f, 6, 1.4);
  const done = f > 6 + cmd.length / 1.4 + 8;
  return (
    <Screen f={f}>
      <div style={{ height: 70, background: COLORS.panel, display: 'flex', alignItems: 'center', gap: 14, padding: '0 26px', direction: 'ltr' }}>
        {['#e0605e', '#e2b54c', '#6abf69'].map((c) => (
          <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />
        ))}
        <div style={{ marginLeft: 20, fontSize: 28, color: COLORS.muted, fontFamily: MONO }}>terminal</div>
      </div>
      <div style={{ padding: '50px 36px', fontFamily: MONO, fontSize: 38, lineHeight: 1.5, direction: 'ltr', color: COLORS.ink }}>
        <div>
          <span style={{ color: COLORS.gold }}>$ </span>
          {shown}
          {!done && <Cursor f={f} />}
        </div>
        {done && (
          <div style={{ color: '#7fd18a', opacity: interpolate(f, [6 + cmd.length / 1.4 + 8, 6 + cmd.length / 1.4 + 16], [0, 1], clamp) }}>
            ✓ skills installed
          </div>
        )}
      </div>
    </Screen>
  );
};

const SKILLS: [string, string][] = [
  ['/remotion-create', 'סרטון חדש'],
  ['/remotion-markup', 'אנימציה וטקסט'],
  ['/remotion-captions', 'כתוביות'],
  ['/remotion-maps', 'מפות ומסלולים'],
  ['/remotion-render', 'רינדור לקובץ'],
];

const SkillsShot: React.FC<{ f: number }> = ({ f }) => {
  const { fps } = useVideoConfig();
  return (
    <Screen f={f}>
      <div style={{ position: 'absolute', inset: '34px 40px', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
        {SKILLS.map(([cmd, he], k) => {
          const s = spring({ frame: f - 6 - k * 9, fps, config: { damping: 14, stiffness: 190, mass: 0.6 } });
          return (
            <div
              key={cmd}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 26px',
                borderRadius: 22,
                background: COLORS.panel,
                border: `2px solid ${COLORS.cardBorder}`,
                transform: `translateX(${(1 - s) * -120}px)`,
                opacity: Math.min(1, s * 1.4),
                direction: 'ltr',
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: COLORS.goldLight }}>{cmd}</span>
              <span style={{ fontSize: 38, fontWeight: 700, color: COLORS.ink, direction: 'rtl' }}>{he}</span>
            </div>
          );
        })}
      </div>
    </Screen>
  );
};

// A laptop with a chat on its screen: the request is typed and sent, the
// assistant "types", answers in a line, and the finished video appears in the
// chat and plays. The chat is our own neutral design, not any product's UI.
const LaptopChat: React.FC<{ f: number; prompt: string; reply: string; clip: string; from: number }> = ({ f, prompt, reply, clip, from }) => {
  const { fps } = useVideoConfig();
  const segStart = useCurrentFrame() - f;
  const enter = spring({ frame: f, fps, config: { damping: 16, stiffness: 150, mass: 0.8 } });
  const cpsIn = 1.3;
  const sendAt = 4 + Math.ceil(prompt.length / cpsIn) + 3;
  const dotsAt = sendAt + 5;
  const replyAt = dotsAt + 14;
  const replyShown = typed(reply, f, replyAt, 3);
  const videoAt = replyAt + Math.ceil(reply.length / 3) + 2;
  const bubble = spring({ frame: f - sendAt, fps, config: { damping: 13, stiffness: 220, mass: 0.5 } });
  const vid = spring({ frame: f - videoAt, fps, config: { damping: 14, stiffness: 170, mass: 0.6 } });
  const inputText = f < sendAt ? typed(prompt, f, 4, cpsIn) : '';
  const SCREEN = { w: 900, h: 600 };
  const vidH = 230;
  return (
    <div style={{ position: 'absolute', left: PANEL.x, top: PANEL.y + 10, width: PANEL.w, height: PANEL.h, transform: `translateY(${(1 - enter) * 60}px) scale(${0.92 + enter * 0.08})`, opacity: Math.min(1, enter * 1.4) }}>
      {/* Lid */}
      <div style={{ position: 'absolute', left: (PANEL.w - SCREEN.w - 36) / 2, top: 0, width: SCREEN.w + 36, height: SCREEN.h + 36, borderRadius: 30, background: COLORS.surface, border: `2px solid ${COLORS.edge}`, boxShadow: `0 0 60px rgba(255,255,255,0.12), 0 0 90px rgba(${COLORS.glow},0.15)` }}>
        <div style={{ position: 'absolute', top: 7, left: '50%', marginLeft: -5, width: 10, height: 10, borderRadius: 5, background: '#111' }} />
        <div style={{ position: 'absolute', left: 18, top: 18, width: SCREEN.w, height: SCREEN.h, borderRadius: 12, overflow: 'hidden', background: COLORS.paper, direction: 'rtl' }}>
          {/* App bar */}
          <div style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: COLORS.paperBar, borderBottom: `1px solid ${COLORS.paperLine}` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.surface }}>שיחה חדשה</div>
            <div style={{ display: 'flex', gap: 10, direction: 'ltr' }}>
              {['#e0605e', '#e2b54c', '#6abf69'].map((c) => (
                <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
              ))}
            </div>
          </div>
          {/* Messages */}
          <div style={{ position: 'absolute', top: 76, left: 24, right: 24, bottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {f >= sendAt && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '78%', padding: '14px 22px', borderRadius: '24px 24px 6px 24px', background: COLORS.surface, color: COLORS.paper, fontSize: 34, fontWeight: 600, transform: `scale(${bubble})`, transformOrigin: '100% 100%' }}>
                {prompt}
              </div>
            )}
            {f >= dotsAt && (
              <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 14, alignItems: 'flex-start', direction: 'rtl', flexDirection: 'row-reverse', maxWidth: '86%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
                  {f < replyAt ? (
                    <div style={{ display: 'flex', gap: 8, padding: '18px 22px', borderRadius: 22, background: '#ffffff', border: `1px solid ${COLORS.paperLine}` }}>
                      {[0, 1, 2].map((k) => (
                        <div key={k} style={{ width: 12, height: 12, borderRadius: 6, background: COLORS.goldDark, opacity: 0.35 + 0.65 * Math.abs(Math.sin((f - dotsAt) / 4 - k * 0.8)) }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '14px 22px', borderRadius: 22, background: '#ffffff', border: `1px solid ${COLORS.paperLine}`, color: COLORS.surface, fontSize: 31, fontWeight: 500, lineHeight: 1.35 }}>{replyShown}</div>
                  )}
                  {f >= videoAt - 1 && (
                    <div style={{ width: Math.round((vidH * 9) / 16), height: vidH, borderRadius: 16, overflow: 'hidden', border: `3px solid ${COLORS.gold}`, background: '#000', transform: `scale(${vid})`, transformOrigin: '0% 0%', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
                      {/* Media time runs from when the clip appears, not from the start of the reel. */}
                      <Sequence from={segStart + videoAt - 1} layout="none">
                        <OffthreadVideo src={staticFile(clip)} startFrom={Math.round(from * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </Sequence>
                    </div>
                  )}
                </div>
                <div style={{ width: 46, height: 46, borderRadius: 23, background: COLORS.gold, color: COLORS.onGold, fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, direction: 'ltr' }}>AI</div>
              </div>
            )}
          </div>
          {/* Input */}
          <div style={{ position: 'absolute', left: 22, right: 22, bottom: 20, height: 66, borderRadius: 33, background: '#ffffff', border: `2px solid ${COLORS.paperLine}`, display: 'flex', alignItems: 'center', padding: '0 12px 0 24px', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 32, color: inputText ? COLORS.surface : COLORS.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {inputText || 'כתבו הודעה…'}
              {f < sendAt && inputText && <Cursor f={f} color={COLORS.surface} />}
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: inputText ? COLORS.gold : COLORS.paperLine, color: COLORS.onGold, fontSize: 28, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</div>
          </div>
        </div>
      </div>
      {/* Base */}
      <div style={{ position: 'absolute', left: 10, right: 10, top: SCREEN.h + 36, height: 34, background: `linear-gradient(180deg, ${COLORS.edge}, ${COLORS.panel})`, clipPath: 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)', borderRadius: '0 0 18px 18px' }} />
      <div style={{ position: 'absolute', left: '50%', marginLeft: -90, top: SCREEN.h + 36, width: 180, height: 10, borderRadius: '0 0 10px 10px', background: COLORS.deep }} />
    </div>
  );
};

const OutroShot: React.FC<{ f: number }> = ({ f }) => {
  const { fps } = useVideoConfig();
  const segStart = useCurrentFrame() - f;
  const clips = SKILL_SCRIPT.flatMap((l) => (l.shot.kind === 'example' ? [l.shot] : []));
  const save = spring({ frame: f - 30, fps, config: { damping: 10, stiffness: 170, mass: 0.6 } });
  return (
    <Screen f={f}>
      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 22 }}>
        {clips.map((c, k) => {
          const s = spring({ frame: f - k * 6, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
          return (
            <div key={c.clip} style={{ width: 270, height: 480, borderRadius: 22, overflow: 'hidden', border: `3px solid ${COLORS.gold}`, transform: `scale(${s}) rotate(${(k - 1) * 3}deg)` }}>
              <Sequence from={segStart} layout="none">
                <OffthreadVideo src={staticFile(c.clip)} startFrom={Math.round((c.from + 4) * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Sequence>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 46, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '18px 44px', borderRadius: 50, background: COLORS.gold, color: COLORS.onGold, fontSize: 50, fontWeight: 800, transform: `scale(${save})` }}>שמרו את הסרטון 🔖</div>
      </div>
    </Screen>
  );
};

const BigWord: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const i = words.findIndex((w, k) => t >= w.start - 0.03 && t < (words[k + 1]?.start ?? w.end + 0.5));
  if (i < 0) return null;
  const w = words[i];
  const s = spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
  const latin = /[A-Za-z]/.test(w.text);
  return (
    <div style={{ position: 'absolute', top: 1180, left: 0, right: 0, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <span
        style={{
          fontSize: 100,
          fontWeight: 800,
          color: latin ? COLORS.goldLight : COLORS.white,
          transform: `scale(${0.7 + s * 0.3})`,
          textShadow: '0 8px 30px rgba(0,0,0,0.8)',
          unicodeBidi: 'isolate',
        }}
      >
        {w.text.replace(/[.,!?:;]+$/, '')}
      </span>
    </div>
  );
};

const mouth = (words: Word[], t: number) => {
  const i = words.findIndex((w) => t >= w.start && t < w.end);
  if (i < 0) return 0;
  return 0.25 + Math.abs(Math.sin((t - words[i].start) * Math.PI * (4.5 + random(`m${i}`) * 2.5))) * 0.75;
};

const Presenter: React.FC<{ face: string | null; words: Word[]; voice: string | null }> = ({ face, words, voice }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <div style={{ position: 'absolute', left: FACE.x, top: FACE.y, width: FACE.w, height: FACE.h, borderRadius: 40, overflow: 'hidden', border: `3px solid ${COLORS.cardBorder}`, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
      {face ? (
        /\.(mp4|webm|mov)$/i.test(face) ? (
          <OffthreadVideo src={staticFile(face)} muted={!!voice} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={staticFile(face)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%' }} />
        )
      ) : (
        <div style={{ width: '100%', height: '100%', background: `radial-gradient(ellipse at 50% 70%, ${COLORS.raised}, ${COLORS.deep} 75%)`, position: 'relative' }}>
          {[0, 1, 2, 3, 4].map((k) => (
            <div key={k} style={{ position: 'absolute', left: 80 + k * 200, top: 60 + (k % 2) * 90, width: 70, height: 70, borderRadius: 35, background: `radial-gradient(circle, rgba(${COLORS.glowLight},0.35), rgba(${COLORS.glowLight},0) 70%)` }} />
          ))}
          <div style={{ position: 'absolute', left: (FACE.w - ANCHOR_BOX.w) / 2, top: 10 + Math.sin(t * 2) * 3, transform: 'scale(1.02)', transformOrigin: '50% 0%' }}>
            <Anchor talk={mouth(words, t)} gesture={0} blink={frame % 97 < 4 ? 1 : 0} tilt={Math.sin(t * 1.3) * 2} look={0} />
          </div>
        </div>
      )}
    </div>
  );
};

export const SkillExplainer: React.FC<SkillProps> = ({ voice, words, face }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ws = words ?? [];
  const segs = React.useMemo(() => segments(ws, fps, durationInFrames), [ws, fps, durationInFrames]);
  const seg = segs.find((s) => frame >= s.from && frame < s.to) ?? segs[0];
  const f = seg ? frame - seg.from : frame;
  const shot = seg ? SKILL_SCRIPT[seg.i].shot : SKILL_SCRIPT[0].shot;
  return (
    <AbsoluteFill style={{ fontFamily: 'Rubik, sans-serif', background: COLORS.bgBottom, width: W }}>
      <Backdrop />
      <Title />
      {shot.kind === 'hook' && <LaptopChat key={seg?.i} f={f} prompt="תעשה לי סרטון על חדשות ה-AI" reply="מתחיל לבנות. הנה הסרטון:" clip="demos/ai-2026-articles.mp4" from={2} />}
      {shot.kind === 'repo' && <RepoShot key={seg?.i} f={f} />}
      {shot.kind === 'install' && <InstallShot key={seg?.i} f={f} />}
      {shot.kind === 'skills' && <SkillsShot key={seg?.i} f={f} />}
      {shot.kind === 'example' && <LaptopChat key={seg?.i} f={f} prompt={shot.prompt} reply={shot.reply} clip={shot.clip} from={shot.from} />}
      {shot.kind === 'outro' && <OutroShot key={seg?.i} f={f} />}
      <BigWord words={ws} />
      <Presenter face={face} words={ws} voice={voice} />
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
