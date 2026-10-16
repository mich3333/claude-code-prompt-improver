import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExport } from '../../src/shared/ffmpeg.js';
import {
  overlayOffset, overlayPosition, SLIDE_IN, SLIDE_OUT, slideAmount, slideAmountExpr, slideVector,
} from '../../src/shared/overlay-motion.js';
import { createClip, createOverlay, createProject, overlayAnimation } from '../../src/shared/timeline.js';

const media = (extra = {}) => ({ kind: 'video', path: '/in/a.mp4', url: 'media://file/a', name: 'a', duration: 10, hasAudio: true, ...extra });
const slide = (animation, extra = {}) => ({ ...createOverlay(media(), 2), out: 4, animation, ...extra });
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} != ${b}`);

// Evaluates an FFmpeg expression of t (only the functions slideAmountExpr uses).
function evalExpr(expr, t) {
  const js = expr.replace(/\bpow\(/g, 'Math.pow(').replace(/\bclip\(/g, 'clipFn(');
  return new Function('t', 'clipFn', `return ${js};`)(t, (x, a, b) => Math.min(b, Math.max(a, x)));
}

test('new overlays fade by default; old projects keep their fade setting', () => {
  assert.equal(createOverlay(media()).animation, 'fade');
  assert.equal(overlayAnimation({ fade: true }), 'fade');
  assert.equal(overlayAnimation({ fade: false }), 'none');
  assert.equal(overlayAnimation({ fade: false, animation: 'slideleft' }), 'slideleft');
});

test('the slide curve starts off-frame, lands with a strong ease-out, and leaves quicker', () => {
  const o = slide('slideright');
  const D = 4;
  close(slideAmount(o, 2, D), 1, 'off-frame at the start');
  close(slideAmount(o, 2 + SLIDE_IN, D), 0, 'at rest after the entrance');
  close(slideAmount(o, 4, D), 0, 'at rest in the middle');
  close(slideAmount(o, 6 - SLIDE_OUT, D), 0, 'exit starts at rest');
  close(slideAmount(o, 6, D), 1, 'off-frame at the end');
  // Strong ease-out: most of the travel is done in the first third.
  assert.ok(slideAmount(o, 2 + SLIDE_IN / 3, D) < 0.15);
  assert.ok(SLIDE_OUT < SLIDE_IN, 'exits are quicker than entrances');
  // Short layers split their time between the entrance and the exit.
  close(slideAmount(o, 2.2, 0.4), 0, 'a 0.4s layer lands halfway');
});

test('the FFmpeg expression is the same curve as the preview', () => {
  for (const D of [4, 0.4, 1.7]) {
    const o = slide('slidebottom');
    const expr = slideAmountExpr(o, D);
    for (let t = 1.9; t < 2 + D + 0.1; t += 0.013) {
      close(evalExpr(expr, t), slideAmount(o, t, D), `D=${D} t=${t.toFixed(3)}`);
    }
  }
});

test('slide directions move the layer from just off-frame', () => {
  const W = 1080;
  const H = 1920;
  assert.deepEqual(slideVector(slide('slideright'), W, H), { x: 1080, y: 0 });
  assert.deepEqual(slideVector(slide('slideleft'), W, H), { x: -1080, y: 0 });
  assert.deepEqual(slideVector(slide('slidebottom', { region: 'full' }), W, H), { x: 0, y: 1920 });
  assert.deepEqual(slideVector(slide('slidebottom', { region: 'bottom', split: 0.5 }), W, H), { x: 0, y: 960 });
  assert.equal(slideVector(slide('fade'), W, H), null);
  assert.deepEqual(overlayOffset(slide('slideleft'), 2, W, H, 4), { dx: -1080, dy: 0 });
  assert.deepEqual(overlayOffset(slide('fade'), 2, W, H, 4), { dx: 0, dy: 0 });
});

test('overlay position strings', () => {
  assert.equal(overlayPosition(slide('none'), 1080, 1920, 4), 'x=0:y=0');
  const right = overlayPosition(slide('slideright'), 1080, 1920, 4);
  assert.equal(right, `x='0+1080*(${slideAmountExpr(slide('slideright'), 4)})':y=0:eval=frame`);
  assert.match(overlayPosition(slide('slideleft'), 1080, 1920, 4), /^x='0-1080\*\(pow\(1-clip\(\(t-2\)\/0\.3,0,1\),5\)/);
  assert.match(overlayPosition(slide('slidebottom', { region: 'bottom', split: 0.5 }), 1080, 1920, 4), /^x=0:y='960\+960\*\(/);
});

test('export animates sliding overlays per frame and does not fade them', () => {
  const p = createProject();
  p.aspect = '9:16';
  p.clips = [createClip(media())];
  p.overlays = [{ ...createOverlay(media({ path: '/in/news.png', kind: 'image' }), 2), region: 'full', animation: 'slideright' }];
  const { filter } = buildExport(p, { output: '/o.mp4', width: 1080, height: 1920, fps: 30 });
  assert.match(filter, /overlay=x='0\+1080\*\(pow\(1-clip\(\(t-2\)\/0\.3,0,1\),5\)\+1-pow\(1-clip\(\(t-5\.76\)\/0\.24,0,1\),5\)\)':y=0:eval=frame:enable='between\(t,2,6\)'/);
  assert.doesNotMatch(filter, /fade=t=in:st=0/);
  // The layer is cut at the end of the video, and slides out there.
  p.overlays[0].start = 8;
  const cut = buildExport(p, { output: '/o.mp4', width: 1080, height: 1920, fps: 30 }).filter;
  assert.match(cut, /\(t-9\.76\)\/0\.24/);
});
