// AI headlines from January to October 2026, for the "news storm" motion piece.
// Sources: reports/מרוץ הבינה המלאכותית 2015 2026.md and
// reports/סיכום AI שבועי אוקטובר 2026.md. Headlines are our own wording; each
// card names the outlet and date it comes from. `reported` marks items that rest
// on a single report rather than an official announcement.

import type { IconKind } from './icons';
import type { Brand } from './scenes';

export type Headline = {
  month: number; // 1-12
  date: string;
  outlet: string;
  text: string;
  brand?: Brand;
  reported?: boolean;
  /** Animated icon shown in the spotlight while this card is on screen. */
  icon: IconKind;
  /** Optional key number counted up next to the icon. */
  stat?: string;
};

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר'];

export const HEADLINES: Headline[] = [
  { month: 1, date: '27.1', outlet: 'Fortune', text: 'אמודיי: "מדינה של גאונים במרכז נתונים" בעוד שנה-שנתיים', brand: 'anthropic', reported: true, icon: 'document' },
  { month: 2, date: '3.2', outlet: 'CNBC', text: 'מאסק ממזג את xAI לתוך SpaceX', brand: 'xai', reported: true, icon: 'merge' },
  { month: 3, date: '10.3', outlet: 'Tech.eu', text: 'AMI Labs של יאן לקון מגייסת יותר ממיליארד דולר', icon: 'money', stat: '$1B+' },
  { month: 3, date: '31.3', outlet: 'Bloomberg', text: 'OpenAI מוערכת ב-852 מיליארד דולר אחרי סבב של 122 מיליארד', brand: 'openai', icon: 'money', stat: '$852B' },
  { month: 4, date: '4.2026', outlet: 'VentureBeat', text: 'Anthropic: קצב הכנסות של 30 מיליארד דולר בשנה', brand: 'anthropic', icon: 'chart', stat: '$30B' },
  { month: 5, date: '28.5', outlet: 'CNBC', text: 'Anthropic מגייסת 65 מיליארד בשווי 965 מיליארד ועוקפת את OpenAI', brand: 'anthropic', icon: 'money', stat: '$965B' },
  { month: 6, date: '1.6', outlet: 'NPR', text: 'Anthropic מגישה בחשאי טיוטת תשקיף להנפקה', brand: 'anthropic', icon: 'document' },
  { month: 7, date: '22.7', outlet: 'CNBC', text: 'לאפליקציית Gemini יש 950 מיליון משתמשים בחודש', brand: 'gemini', icon: 'users', stat: '950M' },
  { month: 8, date: '8.2026', outlet: 'NVIDIA', text: 'Nvidia: 89 מיליארד דולר ממרכזי נתונים ברבעון אחד', icon: 'chip', stat: '$89B' },
  { month: 9, date: '8.9', outlet: 'TechCrunch', text: 'Mistral מגייסת 3 מיליארד אירו', brand: 'mistral', reported: true, icon: 'money', stat: '€3B' },
  { month: 9, date: '12.9', outlet: 'Bloomberg', text: 'אלטמן: ההנפקה של OpenAI לא תהיה ב-2026', brand: 'openai', icon: 'calendar' },
  { month: 9, date: '22.9', outlet: 'Anthropic', text: 'Claude Opus 5.5 יוצא לדרך', brand: 'claude', icon: 'rocket' },
  { month: 9, date: '23.9', outlet: 'Anthropic', text: 'תגלית בעזרת Claude מתפרסמת ב-Science', brand: 'claude', icon: 'flask' },
  { month: 9, date: '29.9', outlet: 'Engadget', text: 'DevDay: ל-ChatGPT יש 1.2 מיליארד משתמשים בשבוע', brand: 'openai', icon: 'users', stat: '1.2B' },
  { month: 9, date: '30.9', outlet: 'Reuters', text: 'גוגל מציגה את Gemini 4 Argon אחרי חודשים של עיכובים', brand: 'gemini', icon: 'rocket' },
  { month: 10, date: '6.10', outlet: 'Bloomberg', text: 'Nvidia מתקרבת לשווי של 6 טריליון דולר', icon: 'chip' },
  { month: 10, date: '7.10', outlet: 'Anthropic', text: 'Claude Haiku 5.5: המודל הקטן המהיר ביותר עד היום', brand: 'claude', icon: 'rocket' },
  { month: 10, date: '7.10', outlet: '@OpenAI', text: 'GPT-6 מגיע ל-ChatGPT לכולם', brand: 'openai', icon: 'rocket' },
  { month: 10, date: '12.10', outlet: '@finkd', text: 'מטא משיקה את Muse Wonder', brand: 'meta', icon: 'rocket' },
  { month: 10, date: '13.10', outlet: 'Reuters', text: 'Gemini 4 Argon נפתח לכל המפתחים והעסקים', brand: 'gemini', icon: 'globe' },
  { month: 10, date: '14.10', outlet: 'CNBC', text: 'שמונה מדינות בארה"ב תובעות את OpenAI', brand: 'openai', reported: true, icon: 'gavel', stat: '8' },
  { month: 10, date: '14.10', outlet: 'SiliconANGLE', text: 'Anthropic: הכנסות של 16.8 מיליארד דולר ברבעון השלישי', brand: 'anthropic', reported: true, icon: 'chart', stat: '$16.8B' },
];
