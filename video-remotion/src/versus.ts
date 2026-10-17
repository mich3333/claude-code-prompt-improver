// Head-to-head episodes: two companies, a few rounds, each round decided by a
// number from a named source. Only numbers already verified for the 2026
// headlines are used, and a round is only scored when both sides can be
// compared on it. The verdict sums the rounds; it is not an opinion.

import type { Brand } from './scenes';

export type Side = 'a' | 'b';

export type Value = {
  value: string;
  caption: string;
  /** Outlet and date, e.g. "Bloomberg · 31.3". Empty when there is no figure. */
  source: string;
  /** Count the number up. Off for years and words. */
  count?: boolean;
};

export type Round = { label: string; a: Value; b: Value; winner: Side | 'tie'; note: string };

export type Match = {
  a: Brand;
  b: Brand;
  rounds: Round[];
  verdict: { title: string; a: string; b: string; ask: string };
};

export const MATCHES: Record<string, Match> = {
  'openai-anthropic': {
    a: 'openai',
    b: 'anthropic',
    rounds: [
      {
        label: 'שווי',
        a: { value: '$852B', caption: 'אחרי סבב של 122 מיליארד', source: 'Bloomberg · 31.3' },
        b: { value: '$965B', caption: 'אחרי סבב של 65 מיליארד', source: 'CNBC · 28.5' },
        winner: 'b',
        note: 'השווי האחרון שדווח לכל אחת. במאי Anthropic עקפה את OpenAI.',
      },
      {
        label: 'הסבב האחרון',
        a: { value: '$122B', caption: 'גויסו בסבב', source: 'Bloomberg · 31.3' },
        b: { value: '$65B', caption: 'גויסו בסבב', source: 'CNBC · 28.5' },
        winner: 'a',
        note: 'OpenAI גייסה כמעט פי שניים בסבב האחרון שלה.',
      },
      {
        label: 'משתמשים',
        a: { value: '1.2B', caption: 'משתמשים בשבוע ב-ChatGPT', source: 'Engadget · 29.9' },
        b: { value: '—', caption: 'לא מפרסמת נתון דומה', source: '', count: false },
        winner: 'a',
        note: 'בשוק הצרכנים ChatGPT עדיין הכי גדול.',
      },
      {
        label: 'הנפקה',
        a: { value: '2027', caption: 'אלטמן: לא ב-2026', source: 'Bloomberg · 12.9', count: false },
        b: { value: 'הוגשה', caption: 'טיוטת תשקיף חסויה', source: 'NPR · 1.6', count: false },
        winner: 'b',
        note: 'Anthropic כבר הגישה טיוטה. OpenAI מכוונת ל-2027.',
      },
    ],
    verdict: {
      title: 'תיקו',
      a: 'יותר משתמשים, ויותר כסף בסבב האחרון',
      b: 'שווי גבוה יותר, וקרובה יותר להנפקה',
      ask: 'ומי לדעתכם מנצחת? כתבו בתגובות',
    },
  },
};
