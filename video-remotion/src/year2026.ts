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
  /** The article or post this card is about. */
  url: string;
  /** Screenshot of that page in public/articles/, shown in the spotlight. */
  shot?: string;
};

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר'];

export const HEADLINES: Headline[] = [
  { month: 1, date: '27.1', outlet: 'Fortune', text: 'אמודיי: "מדינה של גאונים במרכז נתונים" בעוד שנה-שנתיים', brand: 'anthropic', reported: true, icon: 'document', url: 'https://fortune.com/2026/01/27/anthropic-ceo-dario-amodei-essay-warning-ai-adolescence-test-humanity-risks-remedies', shot: 'articles/01-fortune.jpg' },
  { month: 2, date: '3.2', outlet: 'CNBC', text: 'מאסק ממזג את xAI לתוך SpaceX', brand: 'xai', reported: true, icon: 'merge', url: 'https://www.cnbc.com/2026/02/03/musk-xai-spacex-biggest-merger-ever.html', shot: 'articles/02-cnbc.jpg' },
  { month: 3, date: '10.3', outlet: 'Tech.eu', text: 'AMI Labs של יאן לקון מגייסת יותר ממיליארד דולר', icon: 'money', stat: '$1B+', url: 'https://tech.eu/2026/03/10/yann-lecun-s-paris-based-ai-world-model-startup-raises-more-than-1bn/', shot: 'articles/03-techeu.jpg' },
  { month: 3, date: '31.3', outlet: 'Bloomberg', text: 'OpenAI מוערכת ב-852 מיליארד דולר אחרי סבב של 122 מיליארד', brand: 'openai', icon: 'money', stat: '$852B', url: 'https://www.bloomberg.com/news/articles/2026-03-31/openai-valued-at-852-billion-after-completing-122-billion-round', shot: 'articles/04-bloomberg.jpg' },
  { month: 5, date: '8.5', outlet: 'VentureBeat', text: 'Anthropic: קצב הכנסות של 30 מיליארד דולר בשנה', brand: 'anthropic', icon: 'chart', stat: '$30B', url: 'https://venturebeat.com/technology/anthropic-says-it-hit-a-30-billion-revenue-run-rate-after-crazy-80x-growth', shot: 'articles/05-venturebeat.jpg' },
  { month: 5, date: '28.5', outlet: 'CNBC', text: 'Anthropic מגייסת 65 מיליארד בשווי 965 מיליארד ועוקפת את OpenAI', brand: 'anthropic', icon: 'money', stat: '$965B', url: 'https://www.cnbc.com/2026/05/28/anthropic-open-ai-startup-value.html', shot: 'articles/06-cnbc.jpg' },
  { month: 6, date: '1.6', outlet: 'NPR', text: 'Anthropic מגישה בחשאי טיוטת תשקיף להנפקה', brand: 'anthropic', icon: 'document', url: 'https://www.npr.org/2026/06/01/nx-s1-5843199/anthropic-ipo-filing-ai-large', shot: 'articles/07-npr.jpg' },
  { month: 7, date: '22.7', outlet: 'CNBC', text: 'לאפליקציית Gemini יש 950 מיליון משתמשים בחודש', brand: 'gemini', icon: 'users', stat: '950M', url: 'https://www.cnbc.com/2026/07/22/google-earnings-q2-goog-live-updates.html', shot: 'articles/08-cnbc.jpg' },
  { month: 8, date: '8.2026', outlet: 'NVIDIA', text: 'Nvidia: 89 מיליארד דולר ממרכזי נתונים ברבעון אחד', icon: 'chip', stat: '$89B', url: 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027', shot: 'articles/09-nvidia.jpg' },
  { month: 9, date: '8.9', outlet: 'TechCrunch', text: 'Mistral מגייסת 3 מיליארד אירו', brand: 'mistral', reported: true, icon: 'money', stat: '€3B', url: 'https://techcrunch.com/2026/09/08/mistral-raises-e3b-as-sovereign-ai-becomes-big-business/', shot: 'articles/10-mistral.jpg' },
  { month: 9, date: '12.9', outlet: 'Bloomberg', text: 'אלטמן: ההנפקה של OpenAI לא תהיה ב-2026', brand: 'openai', icon: 'calendar', url: 'https://www.bloomberg.com/news/articles/2026-09-12/openai-ipo-won-t-happen-until-2027-sam-altman-tells-fortune', shot: 'articles/11-bloomberg.jpg' },
  { month: 9, date: '22.9', outlet: 'Anthropic', text: 'Claude Opus 5.5 יוצא לדרך', brand: 'claude', icon: 'rocket', url: 'https://www.anthropic.com/claude-opus-5-5' },
  { month: 9, date: '23.9', outlet: 'Anthropic', text: 'תגלית בעזרת Claude מתפרסמת ב-Science', brand: 'claude', icon: 'flask', url: 'https://www.anthropic.com/news' },
  { month: 9, date: '29.9', outlet: 'Engadget', text: 'DevDay: ל-ChatGPT יש 1.2 מיליארד משתמשים בשבוע', brand: 'openai', icon: 'users', stat: '1.2B', url: 'https://www.engadget.com/2271985/openai-dev-day-live-blog-chatgpt-news/', shot: 'articles/14-engadget.jpg' },
  { month: 9, date: '30.9', outlet: 'Reuters', text: 'גוגל מציגה את Gemini 4 Argon אחרי חודשים של עיכובים', brand: 'gemini', icon: 'rocket', url: 'https://live.euronext.com/en/financial-news/google-announces-gemini-4-flagship-ai-model-after-months-delays', shot: 'articles/15-reuters.jpg' },
  { month: 10, date: '6.10', outlet: 'Bloomberg', text: 'Nvidia מתקרבת לשווי של 6 טריליון דולר', icon: 'chip', url: 'https://www.bloomberg.com/news/articles/2026-10-06/nvidia-heads-for-6-trillion-value-with-chipmaker-back-at-record', shot: 'articles/16-bloomberg.jpg' },
  { month: 10, date: '7.10', outlet: 'Anthropic', text: 'Claude Haiku 5.5: המודל הקטן המהיר ביותר עד היום', brand: 'claude', icon: 'rocket', url: 'https://www.anthropic.com/claude-haiku-5-5' },
  { month: 10, date: '7.10', outlet: '@OpenAI', text: 'GPT-6 מגיע ל-ChatGPT לכולם', brand: 'openai', icon: 'rocket', url: 'https://x.com/OpenAI/status/2107894997538525580' },
  { month: 10, date: '12.10', outlet: '@finkd', text: 'מטא משיקה את Muse Wonder', brand: 'meta', icon: 'rocket', url: 'https://x.com/finkd/status/2109689311088287773' },
  { month: 10, date: '13.10', outlet: 'Reuters', text: 'Gemini 4 Argon נפתח לכל המפתחים והעסקים', brand: 'gemini', icon: 'globe', url: 'https://www.galvnews.com/news_reuters/business/google-launches-flagship-ai-model-gemini-4-argon-for-developers-businesses/article_884d80ce-3e8d-5be6-855f-8b91c6aeeaa6.html', shot: 'articles/20-reuters.jpg' },
  { month: 10, date: '14.10', outlet: 'CNBC', text: 'שמונה מדינות בארה"ב תובעות את OpenAI', brand: 'openai', reported: true, icon: 'gavel', stat: '8', url: 'https://www.cnbc.com/2026/10/14/openai-sued-by-8-states-over-chatgpt-safety-concerns-.html', shot: 'articles/21-cnbc.jpg' },
  { month: 10, date: '14.10', outlet: 'SiliconANGLE', text: 'Anthropic: הכנסות של 16.8 מיליארד דולר ברבעון השלישי', brand: 'anthropic', reported: true, icon: 'chart', stat: '$16.8B', url: 'https://siliconangle.com/2026/10/14/ahead-of-ipo-anthropic-reveals-its-revenue-grow-45-sequentially-to-16-8b-in-q3', shot: 'articles/22-siliconangle.jpg' },
];
