import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRIFT, FRAMING_DEFAULTS, framingArea, framingCanvas, framingOf, framingProgress, isDefaultFraming, placePicture,
  PRESENTER, PUSH_IN,
} from '../../src/shared/framing.js';
import { buildExport } from '../../src/shared/ffmpeg.js';
import { createClip, createProject, splitClipAt } from '../../src/shared/timeline.js';

const photo = (extra = {}) => ({
  ...createClip({ kind: 'image', path: '/p.jpg', url: 'file:///p.jpg', name: 'p', width: 300, height: 400 }),
  ...extra,
});
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('new clips get default framing; old clips without the fields read as defaults', () => {
  const c = photo();
  for (const [k, v] of Object.entries(FRAMING_DEFAULTS)) assert.equal(c[k], v);
  assert.ok(isDefaultFraming(c));
  const old = { fit: 'cover' };
  assert.deepEqual(framingOf(old), { ...FRAMING_DEFAULTS });
  assert.ok(isDefaultFraming(old));
  assert.ok(!isDefaultFraming({ zoom: 1.2 }));
  assert.ok(!isDefaultFraming({ pushIn: true }));
  // Out-of-range values are clamped; drift only counts with the push-in.
  assert.deepEqual(framingOf({ focusX: 2, focusY: -1, zoom: 9, areaTop: 0.9, drift: true }),
    { focusX: 1, focusY: 0, zoom: 1.5, areaTop: 0.6, pushIn: false, drift: false });
});

test('default framing places the picture like plain fit and fill', () => {
  const contain = placePicture(photo(), 300, 400, 1920, 1080);
  close(contain.h, 1080);
  close(contain.w, 810);
  close(contain.x, (1920 - 810) / 2);
  close(contain.y, 0);
  const cover = placePicture(photo({ fit: 'cover' }), 300, 400, 1920, 1080);
  close(cover.w, 1920);
  close(cover.h, 2560);
  close(cover.y, (1080 - 2560) / 2);
});

test('the focus point aligns edges at 0/100% and stays put while zooming', () => {
  const W = 1080;
  const H = 1080;
  const top = placePicture(photo({ fit: 'cover', focusY: 0 }), 300, 400, W, H);
  close(top.y, 0);
  const bottom = placePicture(photo({ fit: 'cover', focusY: 1 }), 300, 400, W, H);
  close(bottom.y + bottom.h, H);
  for (const zoom of [1, 1.2, 1.5]) {
    const c = photo({ fit: 'cover', focusX: 0.3, focusY: 0.25, zoom });
    const pl = placePicture(c, 300, 400, W, H);
    close(pl.w, 1080 * zoom);
    // The picture point at (30%, 25%) is drawn at (30%, 25%) of the area.
    close(pl.x + 0.3 * pl.w, 0.3 * W);
    close(pl.y + 0.25 * pl.h, 0.25 * H);
  }
});

test('push-in grows the picture by 7% over the clip, centred on the focus point', () => {
  const c = photo({ fit: 'cover', focusY: 0.3, pushIn: true });
  const a = placePicture(c, 300, 400, 1080, 1114, 0);
  const b = placePicture(c, 300, 400, 1080, 1114, 1);
  close(b.w / a.w, 1 + PUSH_IN);
  close(PUSH_IN, 0.07);
  close(a.y + 0.3 * a.h, b.y + 0.3 * b.h);
  // Drift pans the focus point across the slack, both ends clamped to 0..1.
  const d = photo({ fit: 'cover', focusX: 0.95, focusY: 0.3, pushIn: true, drift: true });
  const s = placePicture(d, 300, 400, 1080, 1114, 0);
  const e = placePicture(d, 300, 400, 1080, 1114, 1);
  close((s.y - (1114 - s.h) * (0.3 + DRIFT)), 0);
  close((e.x - (1080 - e.w) * 1), 0);
});

test('progress through a clip segment is clamped to 0..1', () => {
  const seg = { start: 2, end: 6 };
  assert.equal(framingProgress(seg, 1), 0);
  assert.equal(framingProgress(seg, 4), 0.5);
  assert.equal(framingProgress(seg, 7), 1);
});

test('the picture area runs from areaTop to the bottom, with an even height', () => {
  assert.deepEqual(framingArea(photo(), 1080, 1920), { x: 0, y: 0, w: 1080, h: 1920 });
  const a = framingArea(photo(PRESENTER), 1080, 1920);
  assert.equal(a.h % 2, 0);
  assert.equal(a.y + a.h, 1920);
  assert.ok(Math.abs(a.y - 0.42 * 1920) <= 1);
});

test('the presenter preset frames a selfie in the lower part with a push-in', () => {
  assert.equal(PRESENTER.fit, 'cover');
  assert.ok(PRESENTER.pushIn);
  assert.ok(PRESENTER.areaTop > 0.3 && PRESENTER.areaTop < 0.5, 'starts under the soft edge of a 50% top layer');
  // A face at 35% down a 3:4 selfie lands in the lower half of the 9:16 frame.
  const c = photo(PRESENTER);
  const area = framingArea(c, 1080, 1920);
  const pl = placePicture(c, 3024, 4032, area.w, area.h, 0);
  const faceY = area.y + pl.y + 0.35 * pl.h;
  assert.ok(faceY > 1920 / 2 && faceY < 1920 * 0.85, `face at ${faceY}`);
});

test('the export canvas holds every window the motion visits', () => {
  const cases = [
    photo({ fit: 'cover', focusX: 0, focusY: 1, zoom: 1.5, pushIn: true, drift: true }),
    photo({ fit: 'contain', focusX: 0.1, focusY: 0.9, zoom: 1.3, pushIn: true }),
    photo(PRESENTER),
  ];
  for (const c of cases) {
    const w = 1080;
    const h = 1114;
    const k = framingCanvas(c, 300, 400, w, h);
    close(k.cw / k.ch, w / h, 2e-3);
    assert.ok(k.padX >= 0 && k.padY >= 0 && k.padX + k.pw <= k.padW && k.padY + k.ph <= k.padH, 'picture fits the pad');
    assert.ok(k.cropX >= 0 && k.cropY >= 0 && k.cropX + k.cw <= k.padW && k.cropY + k.ch <= k.padH, 'canvas fits the pad');
    for (let i = 0; i <= 10; i++) {
      const pl = placePicture(c, 300, 400, w, h, i / 10);
      const r = pl.w / k.pw;
      const left = -pl.x / r - k.cx;
      const topY = -pl.y / r - k.cy;
      assert.ok(left >= 0 && left + w / r <= k.cw + 1e-6, `window x inside canvas (${left})`);
      assert.ok(topY >= 0 && topY + h / r <= k.ch + 1e-6, `window y inside canvas (${topY})`);
    }
  }
});

test('framed clips export through perspective; plain clips keep the simple chain', () => {
  const project = createProject();
  project.aspect = '9:16';
  project.clips = [photo({ fit: 'cover' }), photo(PRESENTER)];
  const { filter } = buildExport(project, { output: '/o.mp4', width: 1080, height: 1920, fps: 30 });
  const [first, second] = filter.split(';\n').filter((l) => /^\[\d:v\]/.test(l));
  assert.match(first, /crop=1080:1920/);
  assert.doesNotMatch(first, /perspective/);
  assert.match(second, /perspective=x0='st\(0,clip\(in\/\(120\),0,1\)\);/);
  assert.match(second, /eval=frame/);
  const y = 1920 - framingArea(project.clips[1], 1080, 1920).h;
  assert.match(second, new RegExp(`scale=1080:${1920 - y}:flags=area,setsar=1,pad=1080:1920:0:${y}:color=black`));
  // A framed clip without known dimensions falls back to plain fit.
  project.clips[1] = { ...project.clips[1], width: null, height: null };
  assert.doesNotMatch(buildExport(project, { output: '/o.mp4', width: 1080, height: 1920 }).filter, /perspective/);
});

test('splitting a framed clip keeps its framing on both halves', () => {
  const v = { ...createClip({ kind: 'video', path: '/v.mp4', url: 'file:///v.mp4', name: 'v', duration: 6, hasAudio: false }), ...PRESENTER };
  const [a, b] = splitClipAt([v], 3);
  for (const c of [a, b]) assert.deepEqual(framingOf(c), framingOf(v));
});

test('a still framing exports with a plain crop, and a framed photo is read once', () => {
  const project = createProject();
  project.clips = [photo({ fit: 'cover', focusY: 0.2, zoom: 1.2 })];
  const { filter, inputs } = buildExport(project, { output: '/o.mp4', width: 1920, height: 1080, fps: 30 });
  assert.doesNotMatch(filter, /perspective/);
  assert.match(filter, /loop=loop=-1:size=1,setpts=N\/30\/TB,crop=1920:1080:\d+:\d+,scale=1920:1080/);
  assert.deepEqual(inputs, ['-i', '/p.jpg']);
});
