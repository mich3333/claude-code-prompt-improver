// The week's script, scene by scene. Source: reports/סיכום AI שבועי אוקטובר 2026.md
// (the "תסריט" section). Every item there is marked verified or reported; the
// `check` field carries what still has to be confirmed before publishing.

export type Pose = 'talk' | 'point' | 'laptop' | 'hold';

export type Brand = 'claude' | 'anthropic' | 'gemini' | 'meta' | 'mistral' | 'openai' | 'xai';

type Base = {
  /** Seconds on the timeline. */
  start: number;
  end: number;
  narration: string;
  pose: Pose;
  badge: string;
  headline: string;
  check?: string;
};

export type Scene = Base &
  (
    | { kind: 'logos'; brands: Brand[] }
    | {
        kind: 'post';
        /** A real screenshot of the post in public/posts/. Without one, an attributed quote is shown instead. */
        screenshot?: string;
        author: string;
        handle: string;
        date: string;
        quote: string;
        translation: string;
        counter?: { prefix?: string; value: number; suffix?: string; note?: string }[];
        brand?: Brand;
      }
    | { kind: 'counter'; brand: Brand; value: number; label: string; detail: string }
    | { kind: 'timeline'; items: { date: string; label: string; brand?: Brand }[] }
    | { kind: 'bars'; unit: string; footnote: string; bars: { label: string; value: number; brand?: Brand }[] }
    | { kind: 'outro'; disclaimer: string }
  );

export const FPS = 30;

export const SCENES: Scene[] = [
  {
    kind: 'logos',
    start: 0,
    end: 4,
    narration: 'שבוע מטורף ב-AI! מטא, גוגל ו-xAI השיקו מודלים חדשים. הנה הסיכום בדקה.',
    pose: 'laptop',
    brands: ['meta', 'gemini', 'xai', 'openai', 'claude'],
    badge: '@מקור: הודעות רשמיות של החברות',
    headline: 'השבוע ב-AI · \u20669\u2060–\u206016.10\u2069',
  },
  {
    kind: 'post',
    start: 4,
    end: 11,
    narration: "מטא השיקה את Muse Wonder, מודלים לעבודה עם סוכנים. צוקרברג: 'קפיצה גדולה לעבר סופר-אינטליגנציה אישית לכולם'.",
    pose: 'point',
    author: 'Mark Zuckerberg',
    handle: '@finkd',
    date: '12.10.2026',
    quote: 'Muse Wonder is a major leap towards delivering personal superintelligence for everyone.',
    translation: 'קפיצה גדולה לעבר סופר-אינטליגנציה אישית לכולם',
    brand: 'meta',
    badge: '@finkd · X · 12.10.2026',
    headline: 'מטא: Muse Wonder',
  },
  {
    kind: 'post',
    start: 11,
    end: 18,
    narration: 'גוגל פתחה לכל העולם את Gemini 4 Argon, במחיר היכרות של 2 דולר למיליון טוקנים בקלט ו-10 בפלט.',
    pose: 'hold',
    author: 'Google DeepMind',
    handle: '@GoogleDeepMind',
    date: '13.10.2026',
    quote: 'Gemini 4 Argon is now globally available.',
    translation: 'Gemini 4 Argon זמין עכשיו בכל העולם',
    brand: 'gemini',
    counter: [
      { prefix: '$', value: 2, note: 'קלט' },
      { prefix: '$', value: 10, note: 'פלט' },
    ],
    badge: '@GoogleDeepMind · 13.10 · מחיר: @OfficialLoganK',
    headline: 'Gemini 4 Argon פתוח לכולם',
    check: 'לא להזכיר את המחיר שאחרי נובמבר (מדווח בלבד)',
  },
  {
    kind: 'post',
    start: 18,
    end: 24,
    narration: "ו-xAI הציגה את Grok Voice 3.0, מודל קולי שעונה בפחות משנייה. אילון מאסק: 'Try Grok Voice'.",
    pose: 'hold',
    author: 'Elon Musk',
    handle: '@elonmusk',
    date: '14.10.2026',
    quote: 'Try Grok Voice',
    translation: 'נסו את Grok Voice',
    brand: 'xai',
    badge: '@elonmusk · X · 14.10.2026',
    headline: 'Grok Voice 3.0',
    check: 'לבדוק מה הקשר בין @SpaceXSI ל-xAI',
  },
  {
    kind: 'counter',
    start: 24,
    end: 31,
    narration: 'ובצד המשפטי: לפי CNBC, שמונה מדינות בארה"ב תבעו את OpenAI בטענה לפגיעה בקטינים. OpenAI אומרת שיש לה הגנות מותאמות גיל.',
    pose: 'talk',
    brand: 'openai',
    value: 8,
    label: 'מדינות בארה"ב',
    detail: 'תבעו את OpenAI בטענה לפגיעה בקטינים · לפי CNBC ו-Washington Post',
    badge: '@מקור: CNBC · Washington Post · 14.10',
    headline: '8 מדינות תובעות את OpenAI',
    check: 'מדווח בלבד: לציין את המקור בקריינות ובתג',
  },
  {
    kind: 'timeline',
    start: 31,
    end: 39,
    narration: 'ובחודש כולו: Anthropic השלימה את משפחת Claude 5.5, ו-OpenAI השיקה ב-DevDay את GPT-6.1 Sol ואת סוכני Dots.',
    pose: 'laptop',
    items: [
      { date: '22.9', label: 'Claude Opus 5.5', brand: 'claude' },
      { date: '28.9', label: 'Claude Sonnet 5.5', brand: 'claude' },
      { date: '29.9', label: 'GPT-6.1 Sol', brand: 'openai' },
      { date: '30.9', label: 'Gemini 4 Argon', brand: 'gemini' },
      { date: '7.10', label: 'Claude Haiku 5.5', brand: 'claude' },
      { date: '12.10', label: 'Muse Wonder', brand: 'meta' },
      { date: '13.10', label: 'Argon לכולם', brand: 'gemini' },
      { date: '14.10', label: 'Grok Voice 3.0', brand: 'xai' },
    ],
    badge: '@מקור: anthropic.com · @OpenAI · @Google',
    headline: 'חודש של מודלים חדשים',
  },
  {
    kind: 'bars',
    start: 39,
    end: 47,
    narration: 'מי הכי חכם? במדד העצמאי של Artificial Analysis, Claude Opus 5.5 מוביל, ו-GPT-6 Astra ו-Gemini 4 Argon כמעט צמודים.',
    pose: 'point',
    unit: 'Intelligence Index',
    footnote: 'Artificial Analysis Intelligence Index · נכון ל-16.10.2026',
    bars: [
      { label: 'Claude Opus 5.5', value: 58, brand: 'claude' },
      { label: 'Claude Sonnet 5.5', value: 56, brand: 'claude' },
      { label: 'Claude Fable 5.1', value: 53, brand: 'claude' },
      { label: 'GPT-6 Astra', value: 53, brand: 'openai' },
      { label: 'Gemini 4 Argon', value: 53, brand: 'gemini' },
      { label: 'Grok 4.7', value: 46, brand: 'xai' },
    ],
    badge: '@מקור: Artificial Analysis',
    headline: 'מי מוביל במדד העצמאי?',
    check: 'הערכים נלקחו מתקצירי חיפוש: חובה לבדוק ב-artificialanalysis.ai לפני פרסום',
  },
  {
    kind: 'post',
    start: 47,
    end: 54,
    narration: "וסם אלטמן הזהיר: הוא 'מאוד לא בנוח' כשאנשים מייחסים למודלי AI כוח דתי ומוותרים על שיקול דעת אנושי.",
    pose: 'talk',
    author: 'Sam Altman',
    handle: '@sama',
    date: 'אוקטובר 2026',
    quote:
      'I am very uncomfortable about people trying to ascribe religious force or a surrender of human judgment to AI models, and think it is a real safety issue.',
    translation: 'אני מאוד לא בנוח עם ייחוס כוח דתי למודלי AI או ויתור על שיקול דעת אנושי מולם; זו בעיית בטיחות אמיתית',
    badge: '@sama · X · אוקטובר 2026',
    headline: 'אלטמן: "בעיית בטיחות אמיתית"',
    check: 'התאריך (בסביבות 3.10) הוסק: לבדוק בפוסט',
  },
  {
    kind: 'outro',
    start: 54,
    end: 58,
    narration: 'שמרו את הסרטון, ונתראה בסיכום של השבוע הבא!',
    pose: 'laptop',
    disclaimer: 'לא בחסות ולא בשיתוף עם אף חברה המוצגת',
    badge: '@מקור: קישורים בתיאור',
    headline: 'הסיכום הבא: 23.10',
  },
];

export const DURATION = Math.round(SCENES[SCENES.length - 1].end * FPS);
