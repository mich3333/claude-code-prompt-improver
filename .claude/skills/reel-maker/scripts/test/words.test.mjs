// node --test .claude/skills/reel-maker/scripts/test/*.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { alignToScript, findPhrase, norm, normalizeWords, planCuts, remapWords, toSrt } from '../lib/words.mjs';

const w = (text, start, end) => ({ text, start, end, type: 'word' });

test('normalizes Scribe (API and connector shapes) and drops spacing and delivery tags', () => {
  const words = [w('[excited]', 0, 0.1), { text: ' ', start: 0.1, end: 0.2, type: 'spacing' }, w('שלום', 0.2, 0.5), w('לכולם', 0.55, 0.9)];
  const expected = [w('שלום', 0.2, 0.5), w('לכולם', 0.55, 0.9)];
  assert.deepEqual(normalizeWords({ language_code: 'heb', words }), expected);
  assert.deepEqual(normalizeWords({ transcripts: [{ words }] }), expected);
});

test('normalizes Whisper / mlx-whisper / faster-whisper segments', () => {
  const data = { segments: [{ words: [{ word: ' שלום', start: 0.2, end: 0.5 }, { word: ' לכולם', start: 0.55, end: 0.9 }] }] };
  assert.deepEqual(normalizeWords(data), [w('שלום', 0.2, 0.5), w('לכולם', 0.55, 0.9)]);
});

test('normalizes whisper.cpp one-word entries and full token output', () => {
  const perWord = { transcription: [
    { offsets: { from: 200, to: 500 }, text: ' שלום' },
    { offsets: { from: 550, to: 900 }, text: ' לכולם' },
  ] };
  assert.deepEqual(normalizeWords(perWord), [w('שלום', 0.2, 0.5), w('לכולם', 0.55, 0.9)]);
  const tokens = { transcription: [{ offsets: { from: 0, to: 1000 }, text: ' שלום לכולם', tokens: [
    { text: '[_BEG_]', offsets: { from: 0, to: 0 } },
    { text: ' של', offsets: { from: 200, to: 350 } }, { text: 'ום', offsets: { from: 350, to: 500 } },
    { text: ' לכולם', offsets: { from: 550, to: 900 } },
  ] }] };
  assert.deepEqual(normalizeWords(tokens), [w('שלום', 0.2, 0.5), w('לכולם', 0.55, 0.9)]);
});

test('rejects unknown formats', () => {
  assert.throws(() => normalizeWords({ foo: 1 }), /unknown transcript format/);
});

test('norm folds final letters, niqqud and punctuation', () => {
  assert.equal(norm('שָׁלוֹם,'), 'שלומ');
  assert.equal(norm('"דקות."'), 'דקות');
  assert.equal(norm('Hello!'), 'hello');
});

test('alignment keeps timings but uses the script spelling, and times missing words', () => {
  const heard = [w('בשנת', 0.3, 0.6), w('אלפיים', 0.7, 1.0), w('עריכה', 1.1, 1.5), w('אממ', 2, 2.2), w('רילז', 3, 3.4), w('עובד', 4, 4.3)];
  const out = alignToScript(heard, 'בשנת 2026 עריכת [excited] רילס זה עובד.');
  assert.deepEqual(out.map((x) => x.text), ['בשנת', '2026', 'עריכת', 'רילס', 'זה', 'עובד.']);
  assert.deepEqual([out[0].start, out[2].start, out[3].start, out[5].start], [0.3, 1.1, 3, 4]);
  assert.ok(out[1].start >= 0.6 && out[1].end <= 1.1, '2026 sits between its neighbours');
  assert.ok(out[4].start >= 3.4 && out[4].end <= 4, 'the missed word sits in the gap');
});

test('findPhrase finds whole phrases after a given time', () => {
  const words = [w('הנה', 1, 1.2), w('שלוש', 1.3, 1.6), w('סיבות.', 1.7, 2), w('הנה', 5, 5.2), w('עוד', 5.3, 5.5)];
  assert.equal(findPhrase(words, 'שלוש סיבות').start, 1.3);
  assert.equal(findPhrase(words, 'הנה', 2).start, 5);
  assert.equal(findPhrase(words, 'לא נאמר'), null);
});

test('planCuts drops long pauses and fillers; remapWords follows the cut', () => {
  const words = [w('אחת', 0.5, 1), w('שתיים', 1.1, 1.5), w('אממ', 2.5, 2.8), w('שלוש', 4, 4.5)];
  const segs = planCuts(words, { duration: 5, maxGap: 0.35, pad: 0.05 });
  assert.deepEqual(segs, [{ start: 0.45, end: 1.55 }, { start: 3.95, end: 4.55 }]);
  const moved = remapWords(words, segs);
  assert.deepEqual(moved.map((x) => x.text), ['אחת', 'שתיים', 'שלוש']);
  assert.deepEqual([moved[2].start, moved[2].end], [1.15, 1.65]);
  assert.equal(planCuts(words, { duration: 5, fillers: false }).length, 3, 'keeping fillers keeps their part');
});

test('SRT cues break on count and sentence ends', () => {
  const srt = toSrt([w('אחת', 0, 0.5), w('שתיים.', 0.6, 1), w('שלוש', 1.1, 1.5)], 4);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,000\nאחת שתיים\.\n\n2\n00:00:01,100 --> 00:00:01,500\nשלוש\n$/);
});
