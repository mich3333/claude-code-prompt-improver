import type { Caption } from '@remotion/captions';
import { estimateWords, type Word } from './captions';
import type { ReelProps } from './MyReel';

/** Word timings (seconds) to Remotion's Caption format; each word keeps its leading space. */
export const toCaptions = (words: Word[]): Caption[] =>
  words.map((w) => ({
    text: ` ${w.text}`,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: null,
  }));

// A stand-in reel: the photo in public/avatar.jpg plays the recording, and the
// captions are spread over a sample script. A real reel comes from reel.json.
const words = estimateWords(
  [
    'בניתי לעצמי עורך וידאו משלי.',
    'אני מקליט, והוא עושה את השאר: כתוביות, חיתוכים ועיצוב.',
    'כשאני מדבר על משהו, הוא מופיע על המסך.',
    'ובסוף הוא מעלה את זה לבד לאינסטגרם ולטיקטוק.',
    'בלי תוכנה של מישהו אחר.',
  ],
  { start: 0.6, pause: 0.45 },
);

export const SAMPLE_REEL: ReelProps = {
  face: 'avatar.jpg',
  captions: toCaptions(words),
  hook: 'בניתי עורך וידאו משלי',
  hookMs: 2600,
  broll: [
    { src: 'demos/ai-news.mp4', startMs: 4200, endMs: 8200, layout: 'split' },
    { src: 'demos/openai-vs-anthropic.mp4', startMs: 9000, endMs: 12200, layout: 'full' },
  ],
  handle: '@your_handle',
  cta: 'עקבו לעוד',
  durationSec: Math.ceil(words[words.length - 1].end + 3),
};
