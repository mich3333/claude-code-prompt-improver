// Ready-made templates in a Claude-inspired style: warm cream and charcoal
// backgrounds, a terracotta accent, an editorial serif for headlines, and
// calm motion (text rises gently into place, scenes dissolve). Style only;
// no logos or brand marks.

import { createCard, createText, insertClip, layoutClips, newId } from './timeline.js';

export const PALETTE = {
  cream: '#F0EEE6',
  ivory: '#FAF9F5',
  ink: '#141413',
  charcoal: '#1F1E1D',
  clay: '#D97757',
  stone: '#87867F',
};

const DISSOLVE = 0.6;

function text(overrides) {
  return { ...createText(0, 1), id: newId('text'), style: 'none', bold: false, animation: 'rise', ...overrides };
}

// Title + subtitle sitting on a card that spans [start, end].
function titleTexts(start, end, { title, subtitle, titleColor, subtitleColor }) {
  return [
    text({ text: title, start: start + 0.2, end: end - 0.25, x: 0.5, y: 0.45, size: 0.11, color: titleColor, font: 'serifHe' }),
    // Staggered by 0.25s so the two lines arrive one after the other.
    text({ text: subtitle, start: start + 0.45, end: end - 0.25, x: 0.5, y: 0.6, size: 0.045, color: subtitleColor, font: 'rubik' }),
  ];
}

// Dissolve into the clip that follows an inserted card, unless it already has a transition.
function dissolveInto(clips, index) {
  const next = clips[index];
  if (next && next.transition.type === 'none') next.transition = { type: 'fade', duration: DISSOLVE };
}

function insertCard(project, index, card, makeTexts) {
  const res = insertClip(project, index, card, (clips) => dissolveInto(clips, index + 1));
  const added = makeTexts(res.start, res.end);
  return {
    project: { ...project, clips: res.clips, texts: [...res.texts, ...added], music: res.music },
    select: { type: 'text', id: added[0].id },
    seek: added[0].start + 0.7,
  };
}

// Index after the clip under the playhead (or the end of the timeline).
function indexAfterPlayhead(project, playhead) {
  const seg = layoutClips(project.clips).find((s) => playhead >= s.start && playhead < s.end);
  return seg ? seg.index + 1 : project.clips.length;
}

export const TEMPLATES = [
  {
    id: 'intro',
    name: 'פתיח בהיר',
    description: 'כרטיס שמנת עם כותרת סריף בתחילת הסרטון',
    preview: { bg: PALETTE.cream, title: PALETTE.ink, sub: PALETTE.stone },
    apply(project) {
      const card = createCard(PALETTE.cream, 4, 'פתיח');
      return insertCard(project, 0, card, (s, e) =>
        titleTexts(s, e, { title: 'הכותרת שלך', subtitle: 'כמה מילים על הסרטון', titleColor: PALETTE.ink, subtitleColor: PALETTE.stone }));
    },
  },
  {
    id: 'intro-dark',
    name: 'פתיח כהה',
    description: 'רקע פחם, כותרת בהירה ונגיעת טרקוטה',
    preview: { bg: PALETTE.charcoal, title: PALETTE.ivory, sub: PALETTE.clay },
    apply(project) {
      const card = createCard(PALETTE.charcoal, 4, 'פתיח');
      return insertCard(project, 0, card, (s, e) =>
        titleTexts(s, e, { title: 'הכותרת שלך', subtitle: 'כמה מילים על הסרטון', titleColor: PALETTE.ivory, subtitleColor: PALETTE.clay }));
    },
  },
  {
    id: 'quote',
    name: 'ציטוט',
    description: 'משפט מרכזי על רקע טרקוטה, אחרי הקליפ הנוכחי',
    preview: { bg: PALETTE.clay, title: PALETTE.ivory, sub: PALETTE.ivory },
    apply(project, playhead) {
      const card = createCard(PALETTE.clay, 4.5, 'ציטוט');
      card.transition = { type: 'fade', duration: DISSOLVE };
      return insertCard(project, indexAfterPlayhead(project, playhead), card, (s, e) => [
        text({ text: '״רעיון טוב מתחיל\nבשאלה טובה״', start: s + 0.3, end: e - 0.3, y: 0.46, size: 0.085, color: PALETTE.ivory, font: 'serifHe' }),
        text({ text: 'שם האומר', start: s + 0.6, end: e - 0.3, y: 0.7, size: 0.04, color: PALETTE.ivory, font: 'rubik' }),
      ]);
    },
  },
  {
    id: 'lower-third',
    name: 'כותרת תחתונה',
    description: 'שם ותפקיד על גבי הווידאו, בנקודת הסמן',
    preview: { bg: '#3b4a5a', title: PALETTE.ink, sub: PALETTE.ink, box: PALETTE.ivory },
    apply(project, playhead) {
      const t = text({
        text: 'שם מלא · תפקיד', start: playhead, end: playhead + 4, y: 0.84, size: 0.045, color: PALETTE.ink,
        font: 'rubik', bold: true, style: 'box', boxColor: PALETTE.ivory, boxOpacity: 0.94,
      });
      return { project: { ...project, texts: [...project.texts, t] }, select: { type: 'text', id: t.id }, seek: playhead + 0.7 };
    },
  },
  {
    id: 'outro',
    name: 'סיום',
    description: 'כרטיס תודה בסוף הסרטון',
    preview: { bg: PALETTE.cream, title: PALETTE.ink, sub: PALETTE.clay },
    apply(project) {
      const card = createCard(PALETTE.cream, 4, 'סיום');
      if (project.clips.length) card.transition = { type: 'fade', duration: DISSOLVE };
      return insertCard(project, project.clips.length, card, (s, e) =>
        titleTexts(s, e, { title: 'תודה שצפיתם', subtitle: 'נתראה בפעם הבאה', titleColor: PALETTE.ink, subtitleColor: PALETTE.clay }));
    },
  },
  {
    id: 'warm-grade',
    name: 'צבע חם',
    description: 'גוון חמים ורך לכל הסרטונים והתמונות',
    preview: { bg: 'linear-gradient(135deg, #d9a27a, #8c6a54)', title: PALETTE.ivory, sub: PALETTE.ivory },
    apply(project) {
      const clips = project.clips.map((c) => (c.kind === 'card' ? c : { ...c, filter: 'claude' }));
      return { project: { ...project, clips }, select: null, seek: null };
    },
  },
];

export function applyTemplate(project, id, playhead = 0) {
  const tpl = TEMPLATES.find((t) => t.id === id);
  if (!tpl) throw new Error(`Unknown template: ${id}`);
  return tpl.apply(structuredClone(project), playhead);
}
