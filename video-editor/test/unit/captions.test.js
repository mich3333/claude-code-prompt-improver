import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  captionSources, captionTexts, defaultCaptionPosition, groupWords, toTimelineWords,
} from '../../src/shared/captions.js';
import { buildExport } from '../../src/shared/ffmpeg.js';
import { createClip, createOverlay, createProject } from '../../src/shared/timeline.js';
import { transcribe } from '../../src/main/scribe.js';

const media = (extra = {}) => ({ kind: 'video', path: '/in/a.mp4', url: 'media://file/a', name: 'a', duration: 10, hasAudio: true, ...extra });
const w = (text, start, end) => ({ text, start, end, type: 'word' });

test('only audible video clips are transcribed, with their timeline position', () => {
  const p = createProject();
  const a = { ...createClip(media()), in: 2, out: 6 };
  const silent = createClip(media({ path: '/in/b.mp4', hasAudio: false }));
  const muted = { ...createClip(media({ path: '/in/c.mp4' })), muted: true };
  const fast = { ...createClip(media({ path: '/in/d.mp4' })), out: 4, speed: 2 };
  p.clips = [a, silent, muted, fast];
  const sources = captionSources(p);
  assert.deepEqual(sources.map((s) => s.path), ['/in/a.mp4', '/in/d.mp4']);
  assert.deepEqual(sources[0], { id: a.id, path: '/in/a.mp4', in: 2, out: 6, speed: 1, start: 0, end: 4 });
  assert.equal(sources[1].start, 4 + 10 + 10);
});

test('word times map onto the timeline through clip position and speed', () => {
  const source = { start: 10, end: 12, speed: 2 };
  const words = toTimelineWords(source, [
    w('שלום', 0.2, 0.6), { text: ' ', start: 0.6, end: 0.7, type: 'spacing' }, { text: '(צחוק)', start: 1, end: 1.5, type: 'audio_event' },
    w('לכולם', 1, 1.4), w('[excited]', 1.5, 1.55), w('(צוחק)', 1.6, 1.7), w('אחרי-הסוף', 3.95, 4.5),
  ]);
  assert.deepEqual(words, [
    { text: 'שלום', start: 10.1, end: 10.3 },
    { text: 'לכולם', start: 10.5, end: 10.7 },
  ]);
});

test('words group into short captions that break at punctuation and pauses', () => {
  const words = [
    w('היום', 0, 0.3), w('אני', 0.35, 0.5), w('אראה', 0.55, 0.8), w('לכם', 0.85, 1.0),
    w('משהו,', 1.05, 1.4), w('מדהים!', 1.45, 1.9), w('אחרי', 3, 3.2), w('הפסקה', 3.25, 3.6),
  ];
  const chunks = groupWords(words, { maxWords: 3 });
  assert.deepEqual(chunks.map((c) => c.text), ['היום אני אראה', 'לכם משהו', 'מדהים!', 'אחרי הפסקה']);
  // Short gaps are bridged (no flicker), long pauses are not; captions never overlap.
  assert.equal(chunks[0].end, chunks[1].start);
  assert.equal(chunks[2].end, 1.9);
  for (let i = 1; i < chunks.length; i++) assert.ok(chunks[i - 1].end <= chunks[i].start);
  assert.equal(groupWords(words, { maxWords: 1 }).length, words.length);
});

test('a caption stays up long enough to read and long words are not split', () => {
  const [c] = groupWords([w('אנטידיסאסטבלישמנטריאניזם', 1, 1.05)], { maxChars: 10 });
  assert.equal(c.text, 'אנטידיסאסטבלישמנטריאניזם');
  assert.ok(c.end - c.start >= 0.35);
});

test('caption texts are marked, still, and placed by position', () => {
  const [t] = captionTexts([{ start: 1, end: 2, text: 'שלום' }], { position: 'middle' });
  assert.equal(t.caption, true);
  assert.equal(t.animation, 'none');
  assert.equal(t.y, 0.5);
  const p = createProject();
  assert.equal(defaultCaptionPosition(p), 'bottom');
  p.overlays = [createOverlay(media(), 0)];
  assert.equal(defaultCaptionPosition(p), 'middle', 'split screens put captions on the seam');
});

test('still texts share concat lanes in the export; animated ones keep their own input', () => {
  const p = createProject();
  p.clips = [createClip(media())];
  const textInputs = [
    { path: '/t/1.png', start: 0, end: 1, fade: 0 },
    { path: '/t/2.png', start: 1, end: 2, fade: 0 },
    { path: '/t/3.png', start: 1.5, end: 2.5, fade: 0 },
    { path: '/t/title.png', start: 0, end: 3, fade: 0.4 },
  ];
  const { inputs, filter, files } = buildExport(p, { width: 1080, height: 1920, fps: 30, output: '/o.mp4', textInputs, workDir: '/tmp/w', blankPath: '/tmp/w/blank.png' });
  assert.equal(files.length, 2, 'two lanes: 1+2 back to back, 3 overlaps 2');
  assert.match(files[0].content, /file '\/t\/1\.png'\nduration 1\nfile '\/t\/2\.png'\nduration 1/);
  assert.match(files[1].content, /file '\/tmp\/w\/blank\.png'\nduration 1\.5\nfile '\/t\/3\.png'/);
  assert.equal(inputs.filter((x) => x === 'concat').length, 2);
  assert.ok(inputs.includes('/t/title.png'));
  assert.match(filter, /fade=t=in:st=0:d=0\.4:alpha=1/);
  // Without a blank frame (older callers) every text keeps its own input.
  const legacy = buildExport(p, { width: 1080, height: 1920, fps: 30, output: '/o.mp4', textInputs });
  assert.equal(legacy.files.length, 0);
});

function withAudio(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-scribe-'));
  const file = path.join(dir, 'a.mp3');
  writeFileSync(file, Buffer.from('fake mp3'));
  return fn(file).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test('transcribe sends the audio, key and options to Scribe and returns words', () => withAudio(async (file) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, form: Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : v.name])) });
    return new Response(JSON.stringify({ language_code: 'heb', words: [w('שלום', 0.1, 0.4)] }), { status: 200 });
  };
  const res = await transcribe(file, { apiKey: 'sk_test', language: 'heb', fetchImpl, url: 'https://scribe.test/v1/speech-to-text' });
  assert.deepEqual(res, { words: [w('שלום', 0.1, 0.4)], language: 'heb' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['xi-api-key'], 'sk_test');
  assert.deepEqual(calls[0].form, {
    model_id: 'scribe_v2', file: 'a.mp3', timestamps_granularity: 'word', tag_audio_events: 'false', language_code: 'heb',
  });
}));

test('transcribe falls back to an older model and explains bad keys', () => withAudio(async (file) => {
  const models = [];
  const fallback = async (_url, init) => {
    const model = init.body.get('model_id');
    models.push(model);
    if (model === 'scribe_v2') return new Response(JSON.stringify({ detail: { message: 'Invalid model_id' } }), { status: 422 });
    return new Response(JSON.stringify({ words: [] }), { status: 200 });
  };
  await transcribe(file, { apiKey: 'k', language: 'auto', fetchImpl: fallback });
  assert.deepEqual(models, ['scribe_v2', 'scribe_v1']);

  const unauthorized = async () => new Response('{"detail":"bad key"}', { status: 401 });
  await assert.rejects(transcribe(file, { apiKey: 'k', fetchImpl: unauthorized }), /מפתח ה-API/);
  const offline = async () => { throw new Error('ENOTFOUND'); };
  await assert.rejects(transcribe(file, { apiKey: 'k', fetchImpl: offline }), /אין חיבור/);
}));
