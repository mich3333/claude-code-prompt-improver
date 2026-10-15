import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipDuration, createClip, createProject, effectiveTransition, frameSize, layoutClips, locate,
  sourceTime, splitClipAt, textDirection, totalDuration,
} from '../../src/shared/timeline.js';

const video = (duration, extra = {}) => ({ ...createClip({ kind: 'video', path: '/v.mp4', url: 'file:///v.mp4', name: 'v', duration, hasAudio: true }), ...extra });

test('frameSize keeps aspect and even dimensions', () => {
  assert.deepEqual(frameSize('16:9'), { width: 1920, height: 1080 });
  assert.deepEqual(frameSize('9:16'), { width: 1080, height: 1920 });
  assert.deepEqual(frameSize('1:1', 720), { width: 720, height: 720 });
  assert.deepEqual(frameSize('4:5'), { width: 1080, height: 1350 });
  const { width, height } = frameSize('16:9', 541);
  assert.equal(width % 2, 0);
  assert.equal(height, 541);
});

test('clip duration accounts for trim and speed', () => {
  assert.equal(clipDuration(video(10, { in: 2, out: 8 })), 6);
  assert.equal(clipDuration(video(10, { in: 2, out: 8, speed: 2 })), 3);
  assert.equal(clipDuration(video(10, { in: 0, out: 3, speed: 0.5 })), 6);
});

test('images default to a fixed duration', () => {
  const img = createClip({ kind: 'image', path: '/p.png', url: 'file:///p.png', name: 'p' });
  assert.equal(img.kind, 'image');
  assert.equal(clipDuration(img), 4);
  assert.equal(img.hasAudio, false);
});

test('layout overlaps clips by their transition', () => {
  const clips = [video(4), video(4, { transition: { type: 'fade', duration: 1 } }), video(4)];
  const layout = layoutClips(clips);
  assert.deepEqual(layout.map((s) => [s.start, s.end]), [[0, 4], [3, 7], [7, 11]]);
  assert.equal(totalDuration({ clips }), 11);
});

test('transitions are clamped to half of the shorter neighbour', () => {
  const clips = [video(1), video(4, { transition: { type: 'fade', duration: 3 } })];
  assert.deepEqual(effectiveTransition(clips, 1), { type: 'fade', duration: 0.5 });
  assert.deepEqual(effectiveTransition(clips, 0), { type: 'none', duration: 0 });
});

test('locate reports transition progress', () => {
  const project = { ...createProject(), clips: [video(4), video(4, { transition: { type: 'wipeleft', duration: 2 } })] };
  const mid = locate(project, 3);
  assert.equal(mid.type, 'wipeleft');
  assert.equal(mid.progress, 0.5);
  assert.equal(mid.current.index, 0);
  assert.equal(mid.next.index, 1);
  const after = locate(project, 5);
  assert.equal(after.next, null);
  assert.equal(after.current.index, 1);
  assert.equal(locate({ clips: [] }, 0), null);
});

test('sourceTime maps timeline time through trim and speed', () => {
  const [seg] = layoutClips([video(10, { in: 2, out: 10, speed: 2 })]);
  assert.equal(sourceTime(seg, 0), 2);
  assert.equal(sourceTime(seg, 1.5), 5);
});

test('splitClipAt cuts one clip into two that cover the same media', () => {
  const clips = [video(10, { in: 1, out: 9, speed: 2 }), video(5)];
  const result = splitClipAt(clips, 2); // 2s on timeline = 4s into the source
  assert.equal(result.length, 3);
  assert.equal(result[0].in, 1);
  assert.equal(result[0].out, 5);
  assert.equal(result[1].in, 5);
  assert.equal(result[1].out, 9);
  assert.notEqual(result[0].id, result[1].id);
  assert.equal(totalDuration({ clips: result }), totalDuration({ clips }));
  assert.equal(splitClipAt(clips, 0), null);
  assert.equal(splitClipAt(clips, 4.01), null);
});

test('textDirection detects right-to-left text', () => {
  assert.equal(textDirection('שלום world'), 'rtl');
  assert.equal(textDirection('Hello שלום'), 'ltr');
  assert.equal(textDirection('123 مرحبا'), 'rtl');
  assert.equal(textDirection(''), 'ltr');
});
