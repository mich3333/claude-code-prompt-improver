import test from 'node:test';
import assert from 'node:assert/strict';
import { atempoChain, buildExport, textFadeDuration } from '../../src/shared/ffmpeg.js';
import { clipOps, PRESETS, toCssFilter, toFfmpegFilters } from '../../src/shared/effects.js';
import { createClip, createMusic, createProject, createText } from '../../src/shared/timeline.js';

const media = (extra = {}) => ({ kind: 'video', path: '/in/a.mp4', url: 'file:///in/a.mp4', name: 'a', duration: 10, hasAudio: true, ...extra });
const opts = { output: '/out.mp4', width: 1920, height: 1080, fps: 30 };

test('atempo chain multiplies to the requested speed within 0.5..2 per step', () => {
  for (const speed of [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]) {
    const parts = atempoChain(speed);
    const product = parts.reduce((acc, p) => acc * Number(p.split('=')[1]), 1);
    assert.ok(Math.abs(product - speed) < 1e-3, `${speed}: ${parts}`);
    for (const p of parts) {
      const v = Number(p.split('=')[1]);
      assert.ok(v >= 0.5 && v <= 2);
    }
  }
  assert.deepEqual(atempoChain(1), []);
});

test('cuts use concat, transitions use xfade at the right offset', () => {
  const project = createProject();
  const a = createClip(media());
  a.out = 4;
  const b = createClip(media());
  b.out = 4;
  b.transition = { type: 'fade', duration: 1 };
  const c = createClip(media({ hasAudio: false }));
  c.out = 2;
  project.clips = [a, b, c];
  const { filter, duration, inputs } = buildExport(project, opts);
  assert.equal(duration, 9);
  assert.match(filter, /\[v0\]\[v1\]xfade=transition=fade:duration=1:offset=3\[xv1\]/);
  assert.match(filter, /\[a0\]\[a1\]acrossfade=d=1\[xa1\]/);
  assert.match(filter, /\[xv1\]\[xa1\]\[v2\]\[a2\]concat=n=2:v=1:a=1/);
  assert.match(filter, /anullsrc=.*\[a2\]/); // silent clip gets generated silence
  assert.deepEqual(inputs.slice(0, 6), ['-ss', '0', '-t', '4', '-i', '/in/a.mp4']);
});

test('speed, fit, effects and volume reach the clip chains', () => {
  const project = createProject();
  const clip = createClip(media());
  Object.assign(clip, { in: 1, out: 5, speed: 2, fit: 'cover', filter: 'bw', volume: 0.5 });
  project.clips = [clip];
  const { filter, outputArgs } = buildExport(project, opts);
  assert.match(filter, /setpts=\(PTS-STARTPTS\)\/2/);
  assert.match(filter, /crop=1920:1080/);
  assert.match(filter, /colorchannelmixer=rr=0\.2126/);
  assert.match(filter, /atempo=2/);
  assert.match(filter, /volume=0\.5/);
  assert.ok(outputArgs.includes('-t') && outputArgs[outputArgs.indexOf('-t') + 1] === '2');
});

test('muted clips export silence', () => {
  const project = createProject();
  const clip = createClip(media());
  clip.muted = true;
  project.clips = [clip];
  const { filter } = buildExport(project, opts);
  assert.doesNotMatch(filter, /\[0:a\]/);
  assert.match(filter, /anullsrc/);
});

test('images loop for their duration', () => {
  const project = createProject();
  const img = createClip({ kind: 'image', path: '/in/p.png', url: 'file:///in/p.png', name: 'p' });
  project.clips = [img];
  const { inputs } = buildExport(project, opts);
  assert.deepEqual(inputs, ['-loop', '1', '-framerate', '30', '-t', '4.5', '-i', '/in/p.png']);
});

test('text overlays and music are layered on top', () => {
  const project = createProject();
  const clip = createClip(media());
  clip.out = 6;
  project.clips = [clip];
  project.music = { ...createMusic({ path: '/in/song.mp3', url: 'file:///in/song.mp3', name: 's', duration: 30 }), start: 1 };
  const text = createText(1, 3);
  const { filter, inputs } = buildExport(project, {
    ...opts,
    textInputs: [{ path: '/tmp/t0.png', start: text.start, end: text.end, fade: textFadeDuration(text) }],
  });
  assert.match(filter, /overlay=0:0:enable='between\(t,1,3\)'/);
  assert.match(filter, /fade=t=in:st=1:d=0\.4:alpha=1/);
  assert.match(filter, /amix=inputs=2:duration=first/);
  assert.match(filter, /adelay=delays=1000:all=1/);
  assert.match(filter, /afade=t=out:st=3:d=2/);
  assert.ok(inputs.includes('-stream_loop'));
});

test('empty timeline is rejected', () => {
  assert.throws(() => buildExport(createProject(), opts), /ריק/);
});

test('effects produce matching CSS and FFmpeg filters', () => {
  const clip = { filter: 'none', brightness: 100, contrast: 100, saturation: 100 };
  assert.deepEqual(clipOps(clip), []);
  assert.equal(toCssFilter([]), 'none');
  const ops = clipOps({ ...clip, filter: 'vintage', brightness: 120 });
  assert.equal(ops.length, PRESETS.vintage.ops.length + 1);
  assert.equal(toCssFilter(ops), 'sepia(0.45) contrast(1.1) saturate(0.85) brightness(1.05) brightness(1.2)');
  const ff = toFfmpegFilters(ops);
  assert.equal(ff.length, ops.length);
  assert.match(ff[1], /^lutrgb=r=val\*1\.1\+-12\.25/);
  // saturate(1) is the identity matrix
  assert.match(toFfmpegFilters([['saturate', 1]])[0], /rr=1:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bg=0:bb=1/);
});
