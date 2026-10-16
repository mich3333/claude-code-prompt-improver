import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExport } from '../../src/shared/ffmpeg.js';
import {
  createCard, createClip, createOverlay, createProject, insertClip, overlayAlpha, overlayRect,
} from '../../src/shared/timeline.js';

const media = (extra = {}) => ({ kind: 'video', path: '/in/a.mp4', url: 'media://file/a', name: 'a', duration: 10, hasAudio: true, ...extra });
const opts = { output: '/o.mp4', width: 1080, height: 1920, fps: 30 };

function projectWithOverlay(overrides = {}) {
  const p = createProject();
  p.aspect = '9:16';
  p.clips = [createClip(media())];
  p.overlays = [{ ...createOverlay(media({ path: '/in/graphic.mp4', hasAudio: false }), 2), out: 4, ...overrides }];
  return p;
}

test('overlay rectangles cover the chosen part of the frame', () => {
  const o = createOverlay(media(), 0);
  assert.deepEqual(overlayRect(o, 1080, 1920), { x: 0, y: 0, w: 1080, h: 960, edge: 'bottom', feather: 154 });
  assert.deepEqual(overlayRect({ ...o, region: 'bottom', split: 0.4 }, 1080, 1920), { x: 0, y: 1152, w: 1080, h: 768, edge: 'top', feather: 154 });
  assert.deepEqual(overlayRect({ ...o, region: 'full' }, 1080, 1920), { x: 0, y: 0, w: 1080, h: 1920, edge: null, feather: 0 });
  assert.equal(overlayRect({ ...o, split: 0.333 }, 1080, 1921).h % 2, 0, 'heights stay even');
});

test('overlay alpha fades in and out', () => {
  const o = { ...createOverlay(media(), 2), out: 4 };
  assert.equal(overlayAlpha(o, 1.9), 0);
  assert.equal(overlayAlpha(o, 2), 0);
  assert.equal(overlayAlpha(o, 3), 1);
  assert.equal(overlayAlpha(o, 6), 0);
  assert.equal(overlayAlpha({ ...o, fade: false }, 2), 1);
});

test('export places a feathered overlay in the top half at its start time', () => {
  const { filter, inputs } = buildExport(projectWithOverlay(), opts);
  assert.ok(inputs.includes('/in/graphic.mp4'));
  assert.match(filter, /scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960/);
  assert.match(filter, /geq=lum='255\*clip\(\(959-Y\)\/154\\,0\\,1\)'/);
  assert.match(filter, /alphamerge/);
  assert.match(filter, /setpts=PTS\+2\/TB/);
  assert.match(filter, /overlay=x=0:y=0:enable='between\(t,2,6\)'/);
});

test('full-frame overlays need no mask; bottom overlays sit at the bottom', () => {
  const full = buildExport(projectWithOverlay({ region: 'full' }), opts).filter;
  assert.doesNotMatch(full, /alphamerge/);
  const bottom = buildExport(projectWithOverlay({ region: 'bottom', split: 0.5 }), opts).filter;
  assert.match(bottom, /overlay=x=0:y=960:/);
  assert.match(bottom, /geq=lum='255\*clip\(Y\/154/);
});

test('overlay audio is mixed only when not muted', () => {
  const muted = buildExport(projectWithOverlay({ hasAudio: true }), opts).filter;
  assert.doesNotMatch(muted, /amix/);
  const audible = buildExport(projectWithOverlay({ hasAudio: true, muted: false, volume: 0.5 }), opts).filter;
  assert.match(audible, /adelay=delays=2000:all=1\[ola0\]/);
  assert.match(audible, /amix=inputs=2/);
});

test('overlays starting after the end are skipped', () => {
  const { filter } = buildExport(projectWithOverlay({ start: 50 }), opts);
  assert.doesNotMatch(filter, /overlay=x=0:y=0/);
});

test('inserting a card moves later overlays with their clips', () => {
  const p = projectWithOverlay();
  const res = insertClip(p, 0, createCard('#000000', 3));
  assert.equal(res.overlays[0].start, 5);
});

test('transparent WebM layers are decoded with libvpx and keep their own alpha', () => {
  const plain = buildExport(projectWithOverlay(), opts);
  assert.ok(!plain.inputs.includes('libvpx-vp9'));
  const p = createProject();
  p.aspect = '9:16';
  p.clips = [createClip(media())];
  p.overlays = [{ ...createOverlay(media({ path: '/in/captions.webm', hasAudio: false, alphaDecoder: 'libvpx-vp9' }), 0), out: 4 }];
  const { inputs, filter } = buildExport(p, opts);
  const i = inputs.indexOf('/in/captions.webm');
  assert.deepEqual(inputs.slice(i - 7, i - 5), ['-c:v', 'libvpx-vp9'], 'the decoder is chosen before the input');
  assert.doesNotMatch(filter, /alphamerge/, 'no soft-edge mask over the layer\'s own alpha');
});
