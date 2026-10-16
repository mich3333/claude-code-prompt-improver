// End-to-end export: generates real media with FFmpeg, renders a project
// that uses every feature, and checks the output with FFprobe.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exportProject, ffmpegPath, ffprobePath, probe } from '../src/main/media.js';
import { createClip, createMusic, createProject, createText, frameSize, totalDuration } from '../src/shared/timeline.js';
import { textFadeDuration } from '../src/shared/ffmpeg.js';

const ff = (args) => execFileSync(ffmpegPath(), ['-v', 'error', '-y', ...args]);

function makeMedia(dir) {
  const p = (n) => path.join(dir, n);
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=5', '-f', 'lavfi', '-i', 'sine=f=440:d=5',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('landscape.mp4')]);
  ff(['-f', 'lavfi', '-i', 'testsrc=s=360x640:r=25:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p('portrait-silent.mp4')]);
  ff(['-f', 'lavfi', '-i', 'gradients=s=400x300:seed=7', '-frames:v', '1', p('photo.jpg')]);
  ff(['-f', 'lavfi', '-i', 'sine=f=220:d=3', '-c:a', 'libmp3lame', p('music.mp3')]);
  return { landscape: p('landscape.mp4'), portrait: p('portrait-silent.mp4'), photo: p('photo.jpg'), music: p('music.mp3') };
}

function textPng(dir, w, h) {
  const file = path.join(dir, 'text-src.png');
  ff(['-f', 'lavfi', '-i', `color=c=white@0.0:s=${w}x${h},format=rgba,drawbox=x=10:y=10:w=200:h=80:color=red@1:t=fill`,
    '-frames:v', '1', file]);
  return execFileSync('cat', [file]);
}

function streams(file) {
  const out = execFileSync(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  return JSON.parse(out.toString());
}

test('exports a project using trims, speed, filters, transitions, text and music', { timeout: 180000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-test-'));
  try {
    const media = makeMedia(dir);
    const [a, b, img, song] = await Promise.all([
      probe(media.landscape), probe(media.portrait), probe(media.photo), probe(media.music),
    ]);
    assert.equal(a.kind, 'video');
    assert.equal(a.hasAudio, true);
    assert.equal(b.hasAudio, false);
    assert.equal(img.kind, 'image');
    assert.equal(song.kind, 'audio');
    assert.ok(a.thumbnail?.startsWith('data:image/jpeg;base64,'));
    assert.ok(img.thumbnail?.startsWith('data:image/jpeg;base64,'), 'photos get a thumbnail too');

    const project = createProject();
    project.aspect = '9:16';
    const c1 = createClip(a);
    c1.in = 0.5; c1.out = 4.5; c1.speed = 2; c1.filter = 'vintage'; c1.fit = 'cover'; c1.volume = 0.8;
    const c2 = createClip(b);
    c2.transition = { type: 'fade', duration: 0.6 }; c2.speed = 0.5; c2.out = 2; c2.brightness = 120;
    const c3 = createClip(img);
    c3.out = 2; c3.transition = { type: 'wipeleft', duration: 1 }; c3.filter = 'bw';
    project.clips = [c1, c2, c3];
    const text = createText(0.5, 3);
    project.texts = [text];
    project.music = { ...createMusic(song), start: 1, offset: 0.5, loop: true };

    const expected = totalDuration(project);
    // 2s + 4s - 0.6 + 2 - 1 = 6.4
    assert.ok(Math.abs(expected - 6.4) < 1e-6, `expected 6.4, got ${expected}`);

    const { width, height } = frameSize('9:16', 360);
    const output = path.join(dir, 'out.mp4');
    const progress = [];
    await exportProject(project, { output, width, height, fps: 30, crf: 30, preset: 'ultrafast' }, {
      tmpDir: dir,
      texts: [{ png: textPng(dir, width, height), start: text.start, end: text.end, fade: textFadeDuration(text) }],
      onProgress: (p) => progress.push(p),
    });

    const info = streams(output);
    const v = info.streams.find((s) => s.codec_type === 'video');
    const au = info.streams.find((s) => s.codec_type === 'audio');
    assert.equal(v.width, width);
    assert.equal(v.height, height);
    assert.ok(au, 'output has audio');
    assert.ok(Math.abs(Number(info.format.duration) - expected) < 0.15, `duration ${info.format.duration}`);
    assert.equal(progress.at(-1), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cancelling an export rejects with cancelled', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-test-'));
  try {
    ff(['-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=30:d=30', '-c:v', 'libx264', '-preset', 'ultrafast', path.join(dir, 'long.mp4')]);
    const project = createProject();
    project.clips = [createClip(await probe(path.join(dir, 'long.mp4')))];
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 300);
    await assert.rejects(
      exportProject(project, { output: path.join(dir, 'x.mp4'), width: 1920, height: 1080, preset: 'slow' }, {
        tmpDir: dir, signal: controller.signal,
      }),
      (e) => e.cancelled === true,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Reference implementation of the CSS filter math (Filter Effects spec),
// clamping after each function like browsers do.
function cssReference(rgb, ops) {
  let [r, g, b] = rgb.map((x) => x / 255);
  const clamp = (x) => Math.min(1, Math.max(0, x));
  for (const [op, v] of ops) {
    if (op === 'brightness') [r, g, b] = [r * v, g * v, b * v];
    else if (op === 'contrast') [r, g, b] = [r, g, b].map((x) => (x - 0.5) * v + 0.5);
    else {
      const m = {
        grayscale: (a) => { const k = 1 - a; return [[0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k], [0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k], [0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k]]; },
        sepia: (a) => { const k = 1 - a; return [[0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k], [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k], [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k]]; },
        saturate: (s) => [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]],
        'hue-rotate': (d) => { const a = (d * Math.PI) / 180; const c = Math.cos(a); const s = Math.sin(a); return [[0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928], [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283], [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]]; },
      }[op](v);
      [r, g, b] = m.map((row) => row[0] * r + row[1] * g + row[2] * b);
    }
    [r, g, b] = [r, g, b].map(clamp);
  }
  return [r, g, b].map((x) => Math.round(x * 255));
}

test('exported colors match the preview (CSS) for every preset', async () => {
  const { PRESETS, toFfmpegFilters } = await import('../src/shared/effects.js');
  const color = [200, 120, 60];
  for (const [name, preset] of Object.entries(PRESETS)) {
    const ops = [...preset.ops, ['brightness', 1.1], ['contrast', 0.9], ['saturate', 1.2]];
    const chain = ['format=rgb24', ...toFfmpegFilters(ops), 'format=rgb24'].join(',');
    const raw = execFileSync(ffmpegPath(), [
      '-v', 'error', '-f', 'lavfi', '-i', `color=c=0xC8783C:s=16x16,format=rgb24,${chain}`,
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
    ]);
    const got = [...raw.subarray(0, 3)];
    const want = cssReference(color, ops);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(got[i] - want[i]) <= 3, `${name}: ffmpeg ${got} vs css ${want}`);
    }
  }
});

test('exports template cards with rising text', { timeout: 120000 }, async () => {
  const { applyTemplate, PALETTE } = await import('../src/shared/templates.js');
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-test-'));
  try {
    const media = makeMedia(dir);
    let project = createProject();
    project.clips = [createClip(await probe(media.landscape))];
    project = applyTemplate(project, 'intro-dark').project;
    project = applyTemplate(project, 'quote', 0.5).project;
    const expected = totalDuration(project);
    const { width, height } = frameSize('16:9', 360);
    const output = path.join(dir, 'tpl.mp4');
    const png = textPng(dir, width, height);
    await exportProject(project, { output, width, height, fps: 30, crf: 28, preset: 'ultrafast' }, {
      tmpDir: dir,
      texts: project.texts.map((t) => ({ png, start: t.start, end: t.end, fade: textFadeDuration(t), rise: t.animation === 'rise' })),
    });
    const info = streams(output);
    assert.ok(Math.abs(Number(info.format.duration) - expected) < 0.15, `duration ${info.format.duration} vs ${expected}`);
    // The intro card's colour fills the frame before any text appears.
    const raw = execFileSync(ffmpegPath(), ['-v', 'error', '-ss', '0.05', '-i', output, '-frames:v', '1',
      '-vf', 'crop=4:4:300:300', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    const want = [1, 3, 5].map((i) => parseInt(PALETTE.charcoal.slice(i, i + 2), 16));
    [...raw.subarray(0, 3)].forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= 6, `card colour ${[...raw.subarray(0, 3)]} vs ${want}`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('exports a split screen: feathered overlay on top, main video below', { timeout: 120000 }, async () => {
  const { createOverlay } = await import('../src/shared/timeline.js');
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-test-'));
  try {
    const p = (n) => path.join(dir, n);
    // Main video: solid blue with a tone; overlay: solid red with its own tone.
    ff(['-f', 'lavfi', '-i', 'color=c=blue:s=360x640:r=30:d=4', '-f', 'lavfi', '-i', 'sine=f=300:d=4',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('main.mp4')]);
    ff(['-f', 'lavfi', '-i', 'color=c=red:s=640x480:r=30:d=4', '-f', 'lavfi', '-i', 'sine=f=900:d=4',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('graphic.mp4')]);
    const project = createProject();
    project.aspect = '9:16';
    project.clips = [createClip(await probe(p('main.mp4')))];
    project.overlays = [{ ...createOverlay(await probe(p('graphic.mp4')), 1), out: 2, fade: false, muted: false, volume: 0.5 }];

    const { width, height } = frameSize('9:16', 360);
    const output = p('split.mp4');
    await exportProject(project, { output, width, height, fps: 30, crf: 20, preset: 'ultrafast' }, { tmpDir: dir });
    const info = streams(output);
    assert.ok(Math.abs(Number(info.format.duration) - 4) < 0.15);

    const pixel = (t, y) => {
      const raw = execFileSync(ffmpegPath(), ['-v', 'error', '-ss', String(t), '-i', output, '-frames:v', '1',
        '-vf', `crop=2:2:180:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
      return [...raw.subarray(0, 3)];
    };
    const isRed = ([r, g, b]) => r > 200 && g < 60 && b < 60;
    const isBlue = ([r, g, b]) => b > 200 && r < 60 && g < 60;
    assert.ok(isBlue(pixel(0.5, 100)), 'before the overlay starts, the top is the main video');
    assert.ok(isRed(pixel(2, 100)), `top half shows the overlay: ${pixel(2, 100)}`);
    assert.ok(isBlue(pixel(2, 560)), `bottom half shows the main video: ${pixel(2, 560)}`);
    const edge = pixel(2, 300); // inside the feathered band
    assert.ok(edge[0] > 60 && edge[2] > 60, `the edge blends both: ${edge}`);
    assert.ok(isBlue(pixel(3.5, 100)), 'after it ends, the main video is back');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
