// Script and on-screen content for AgentsGuide. Filled from the research notes
// in research_notes/AI agents money 2026/.

export type Screen =
  | { kind: 'title'; kicker: string; title: string; sub?: string }
  | { kind: 'list'; kicker: string; title: string; items: { text: string; note?: string }[] }
  | { kind: 'tools'; kicker: string; title: string; items: { name: string; what: string; price: string }[] }
  | { kind: 'compare'; kicker: string; title: string; a: string; b: string; rows: { label: string; a: string; b: string }[]; source?: string }
  | { kind: 'match'; kicker: string; title: string; items: { when: string; use: string }[] }
  | { kind: 'cta'; title: string; button: string };

// Sources (checked 16.10.2026), full notes with URLs in research_notes/AI agents money 2026/:
// Upwork Future Workforce Index (14.7.2026); chatgpt.com/pricing; claude.com/pricing;
// cursor.com/pricing; lovable.dev/pricing; n8n.io/pricing; zapier.com/pricing; make.com/pricing;
// heygen.com/pricing; opus.pro/pricing; captions.ai/pricing; help.openai.com (Sora shut down,
// 24.9.2026); Instagram's Adam Mosseri (Jan 2025, Apr 2026 originality change); YouTube, TikTok and
// Meta AI-disclosure rules; FTC actions against Automators AI (2024) and Click Profit (2025).
export const AGENTS_SCRIPT: { text: string; screen: Screen }[] = [
  {
    text: 'לא תתעשרו מסוכן AI. אבל אפשר להרוויח ממנו כסף אמיתי, והנה איך.',
    screen: { kind: 'title', kicker: 'בלי הייפ', title: 'סוכני AI שבאמת מכניסים כסף', sub: 'כל מספר במסך מגיע עם מקור' },
  },
  {
    text: 'לפי Upwork, פרילנסרים שעובדים עם AI מרוויחים שלושים וארבעה אחוז יותר לשעה. אבל מי שמוכר רק תוצר פשוט של AI, מרוויח פחות.',
    screen: {
      kind: 'list',
      kicker: 'Upwork · יולי 2026',
      title: 'מה הנתונים אומרים',
      items: [
        { text: '+34% לשעה', note: 'פרילנסרים שעושים עבודות AI' },
        { text: '−13% לחוזה', note: 'עבודות AI יצירתיות פשוטות' },
        { text: 'הכסף: AI + מקצוע', note: 'לא לחיצה על כפתור' },
      ],
    },
  },
  {
    text: 'רוצים לבנות אפליקציות? Claude Code, Codex, Cursor או Lovable. מתחילים בפחות מעשרים וחמישה דולר בחודש.',
    screen: {
      kind: 'tools',
      kicker: 'לבנות אפליקציות',
      title: 'סוכני קוד',
      items: [
        { name: 'Claude Code', what: 'כלול ב-Claude Pro', price: '$20' },
        { name: 'Codex', what: 'כלול ב-ChatGPT Plus (מוגבל ב-Go $8)', price: '$20' },
        { name: 'Cursor', what: 'עורך קוד עם סוכן', price: 'Plus $8' },
        { name: 'Lovable', what: 'אפליקציה מתיאור במילים', price: 'Pro $25' },
      ],
    },
  },
  {
    text: 'יש לכם עסק, או לקוחות עם עסק? אוטומציות עם n8n, Zapier או Make, ואפשר לגבות על זה תשלום חודשי.',
    screen: {
      kind: 'tools',
      kicker: 'לעסקים קטנים',
      title: 'אוטומציות',
      items: [
        { name: 'n8n', what: 'חינם בהתקנה עצמית', price: 'ענן €20' },
        { name: 'Zapier', what: 'כולל סוכנים', price: 'מ-$19.99' },
        { name: 'Make', what: 'תרחישים ויזואליים', price: 'Core $12' },
      ],
    },
  },
  {
    text: 'ותוכן: HeyGen, OpusClip ו-Captions. לתרגם, לחתוך ולהוסיף כתוביות לסרטונים של לקוחות.',
    screen: {
      kind: 'tools',
      kicker: 'שירותי תוכן',
      title: 'וידאו וקול',
      items: [
        { name: 'HeyGen', what: 'אווטאר ותרגום וידאו', price: 'Creator $29' },
        { name: 'OpusClip', what: 'סרטון ארוך לקליפים קצרים', price: 'Starter $15' },
        { name: 'Captions', what: 'כתוביות ועריכה', price: 'Max $24.99' },
      ],
    },
  },
  {
    text: 'ומה עדיף, ChatGPT או Claude? שניהם מתחילים בעשרים דולר. ChatGPT מייצר תמונות, Claude לא. ו-Sora כבר נסגר.',
    screen: {
      kind: 'compare',
      kicker: 'עובדות, לא דעה',
      title: 'ChatGPT מול Claude',
      a: 'ChatGPT',
      b: 'Claude',
      rows: [
        { label: 'בתשלום', a: 'Plus $20 · Go $8', b: 'Pro $20' },
        { label: 'בחינם', a: 'GPT-6 Luna', b: 'Sonnet, Haiku' },
        { label: 'סוכן קוד', a: 'Codex', b: 'Claude Code' },
        { label: 'תמונות', a: 'יש', b: 'אין' },
        { label: 'וידאו', a: 'Sora נסגר', b: 'בטא, רק לצוותים' },
      ],
      source: 'chatgpt.com/pricing · claude.com/pricing · 16.10.2026',
    },
  },
  {
    text: 'אז מה מתאים לכם? רוצים לבנות מוצר, קחו סוכן קוד. יש לכם עסק, אוטומציה. רוצים קהל, כלי תוכן.',
    screen: {
      kind: 'match',
      kicker: 'מה מתאים לך',
      title: 'לפי המטרה',
      items: [
        { when: 'רוצה לבנות מוצר', use: 'סוכן קוד' },
        { when: 'יש לך עסק או לקוחות', use: 'אוטומציה' },
        { when: 'רוצה לבנות קהל', use: 'כלי תוכן' },
      ],
    },
  },
  {
    text: 'ולעוקבים: מה שקובע זה זמן צפייה ושיתופים. תוכן מקורי, הפנים שלכם, ולסמן כשמשהו ריאליסטי נוצר ב-AI.',
    screen: {
      kind: 'list',
      kicker: 'אינסטגרם, טיקטוק, יוטיוב',
      title: 'איך צומחים',
      items: [
        { text: 'זמן צפייה ושיתופים', note: 'אדם מוסרי, Instagram · ינואר 2025' },
        { text: 'תוכן מקורי', note: 'תוכן לא מקורי לא מומלץ לזרים · אפריל 2026' },
        { text: 'לסמן תוכן AI', note: 'חובה בתוכן ריאליסטי ביוטיוב, טיקטוק ומטא' },
      ],
    },
  },
  {
    text: 'ותיזהרו ממי שמוכר לכם הכנסה פסיבית עם AI. ה-FTC כבר תבע חברות כאלה.',
    screen: {
      kind: 'list',
      kicker: 'FTC · 2024–2025',
      title: 'דגלים אדומים',
      items: [
        { text: '"הכנסה פסיבית"', note: 'Click Profit: לקוחות שילמו 45–75 אלף דולר' },
        { text: 'הכנסה מובטחת', note: 'Automators AI: פסק דין של 21.8 מיליון דולר' },
        { text: 'דמי כניסה גבוהים', note: 'וחוזה שאוסר ביקורת שלילית' },
      ],
    },
  },
  {
    text: 'אני בונה את כל זה בשקיפות, כולל האפליקציות שלי. עקבו, ונראה ביחד מה באמת עובד.',
    screen: { kind: 'cta', title: 'בונה בשקיפות, בלי הייפ', button: 'עקבו' },
  },
];
