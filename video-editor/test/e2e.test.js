// UI test: launches the real Electron app, edits a video through the UI and
// exports it. Needs a display (on Linux: `xvfb-run -a npm run test:e2e`).
// Set E2E_SCREENSHOTS=<dir> to save screenshots.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';
import { ffmpegPath, ffprobePath } from '../src/main/media.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = (await import('electron')).default;
const shots = process.env.E2E_SCREENSHOTS;
const noDisplay = process.platform === 'linux' && !process.env.DISPLAY;

const ff = (args) => execFileSync(ffmpegPath(), ['-v', 'error', '-y', ...args]);

test('edit and export a video through the UI', { skip: noDisplay && 'no display (use xvfb-run)', timeout: 240000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-e2e-'));
  const p = (n) => path.join(dir, n);
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=30:d=6', '-f', 'lavfi', '-i', 'sine=f=330:d=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('a.mp4')]);
  ff(['-f', 'lavfi', '-i', 'testsrc=s=720x1280:r=30:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p('b.mp4')]);
  ff(['-f', 'lavfi', '-i', 'color=c=teal:s=800x600', '-frames:v', '1', p('c.png')]);
  ff(['-f', 'lavfi', '-i', 'sine=f=262:d=20', '-c:a', 'libmp3lame', p('song.mp3')]);
  if (shots) mkdirSync(shots, { recursive: true });

  const app = await electron.launch({
    executablePath: electronBin,
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), root],
  });
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.waitForSelector('#btn-import');
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.equal((await page.textContent('#btn-import')).trim(), 'ייבוא מדיה');
    const mockOpen = (files) => app.evaluate(({ dialog }, f) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: f });
    }, files);
    const project = () => page.evaluate(() => JSON.parse(JSON.stringify(window.clipcraft.store.project)));
    const shot = async (name) => shots && page.screenshot({ path: path.join(shots, `${name}.png`) });
    await shot('01-empty');

    // Import three clips and music.
    await mockOpen([p('a.mp4'), p('b.mp4'), p('c.png')]);
    await page.click('#btn-import');
    await page.waitForFunction(() => window.clipcraft.store.project.clips.length === 3);
    await mockOpen([p('song.mp3')]);
    await page.click('#btn-music');
    await page.waitForFunction(() => Boolean(window.clipcraft.store.project.music));
    let proj = await project();
    assert.equal(proj.media.length, 4);
    assert.equal(proj.clips[0].hasAudio, true);
    assert.equal(proj.clips[2].kind, 'image');

    // Split the first clip at 2s, then undo and redo the split.
    await page.evaluate(() => window.clipcraft.player.seek(2));
    await page.click('.tl-track-video .tl-clip >> nth=0');
    await page.keyboard.press('s');
    assert.equal((await project()).clips.length, 4);
    await page.click('#btn-undo');
    assert.equal((await project()).clips.length, 3);
    await page.click('#btn-redo');
    assert.equal((await project()).clips.length, 4);

    // Drag the first clip to the end of the timeline, then undo the move.
    const before = (await project()).clips.map((c) => c.id);
    const first = await page.locator('.tl-track-video .tl-clip').nth(0).boundingBox();
    const last = await page.locator('.tl-track-video .tl-clip').nth(3).boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + first.width / 2 + 30, first.y + first.height / 2, { steps: 4 });
    await page.mouse.move(last.x + last.width + 20, first.y + first.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual((await project()).clips.map((c) => c.id), [...before.slice(1), before[0]]);
    await page.waitForTimeout(350); // let the reorder glide finish
    await page.click('#btn-undo');
    assert.deepEqual((await project()).clips.map((c) => c.id), before);

    // Second clip: speed 2x, Vintage filter, crossfade from the previous clip.
    await page.click('.tl-track-video .tl-clip >> nth=1');
    await page.click('.insp button[data-value="2"]');
    await page.click('.insp button[data-value="vintage"]');
    await page.selectOption('.insp-section select', 'fade');
    proj = await project();
    assert.equal(proj.clips[1].speed, 2);
    assert.equal(proj.clips[1].filter, 'vintage');
    assert.equal(proj.clips[1].transition.type, 'fade');

    // Add a Hebrew title.
    await page.evaluate(() => window.clipcraft.player.seek(1));
    await page.click('#btn-text');
    await page.fill('#text-content', 'שלום! My summer');
    await page.locator('#text-content').blur();
    proj = await project();
    assert.equal(proj.texts.length, 1);
    assert.equal(proj.texts[0].text, 'שלום! My summer');
    await shot('02-editing');

    // Claude-style templates: an intro card and a lower third.
    const clipsBefore = (await project()).clips.length;
    await page.click('.bin .segmented button[data-value="templates"]');
    await page.click('.tpl-card[data-template="intro"]');
    await page.click('.tpl-card[data-template="lower-third"]');
    proj = await project();
    assert.equal(proj.clips.length, clipsBefore + 1);
    assert.equal(proj.clips[0].kind, 'card');
    assert.equal(proj.texts.filter((t) => t.animation === 'rise').length, 3);
    await page.waitForTimeout(400);
    await shot('02b-templates');

    // Split screen: the teal photo as a top layer at 4s, moved, then set to the bottom half and back.
    await page.click('.bin .segmented button[data-value="media"]');
    await page.evaluate(() => window.clipcraft.player.seek(4));
    await page.click('.bin-item >> nth=2 >> .bin-overlay');
    proj = await project();
    assert.equal(proj.overlays.length, 1);
    assert.equal(proj.overlays[0].kind, 'image');
    assert.equal(proj.overlays[0].start, 4);
    assert.equal(proj.overlays[0].region, 'top');
    await page.click('.insp button[data-value="bottom"]');
    assert.equal((await project()).overlays[0].region, 'bottom');
    await page.click('.insp button[data-value="top"]');
    const block = await page.locator('.tl-overlay').boundingBox();
    const pps = block.width / 4; // a photo layer lasts 4s
    await page.mouse.move(block.x + block.width / 2, block.y + block.height / 2);
    await page.mouse.down();
    await page.mouse.move(block.x + block.width / 2 + pps, block.y + block.height / 2, { steps: 6 });
    await page.mouse.up();
    const overlayStart = (await project()).overlays[0].start;
    assert.ok(Math.abs(overlayStart - 5) < 0.15, `overlay moved to ${overlayStart}`);
    await page.click('#btn-undo');
    assert.equal((await project()).overlays[0].start, 4);
    await page.evaluate(() => window.clipcraft.player.seek(5.5));
    await page.waitForTimeout(1200);
    await shot('02c-split-screen');

    // Presenter framing: the photo clip fills the lower part of a 9:16 frame with a push-in.
    const photoAt = await page.evaluate(() => {
      const { player } = window.clipcraft;
      for (let t = 0; t < player.duration; t += 0.05) {
        const seg = player.clipAt(t);
        if (seg?.clip.kind === 'image') return { start: seg.start, end: seg.end, index: seg.index };
      }
      return null;
    });
    assert.ok(photoAt, 'the photo is on the main track');
    await page.click(`.tl-track-video .tl-clip >> nth=${photoAt.index}`);
    await page.click('#framing-presenter');
    proj = await project();
    const framedClip = proj.clips[photoAt.index];
    assert.equal(proj.aspect, '9:16');
    assert.equal(framedClip.fit, 'cover');
    assert.equal(framedClip.pushIn, true);
    assert.ok(framedClip.areaTop > 0.3 && framedClip.focusY < 0.5, `presenter framing: ${JSON.stringify(framedClip)}`);
    await page.click('#btn-undo');
    assert.equal((await project()).clips[photoAt.index].pushIn, false, 'the preset is one undo step');
    await page.click('#btn-redo');
    await page.evaluate(() => {
      const input = document.getElementById('framing-zoom');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '120');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('pointerup', { bubbles: true }));
    });
    assert.equal((await project()).clips[photoAt.index].zoom, 1.2);
    // The preview leaves the top of the frame black and draws the photo below.
    const photoTime = (photoAt.start + photoAt.end) / 2;
    const layerUp = photoTime >= 4 && photoTime < 8; // the split-screen layer covers the top then
    await page.evaluate((t) => window.clipcraft.player.seek(t), photoTime);
    await page.waitForTimeout(400);
    // (The canvas shows media:// files, so read it from a screenshot rather than getImageData.)
    await page.locator('#preview').screenshot({ path: p('preview.png') });
    const shotPx = (fy) => [...execFileSync(ffmpegPath(), ['-v', 'error', '-i', p('preview.png'),
      '-vf', `crop=2:2:iw/2:ih*${fy},format=rgb24`, '-f', 'rawvideo', '-'])].slice(0, 3);
    const previewPx = { top: shotPx(0.2), bottom: shotPx(0.8) };
    const isTeal = ([r, g, b]) => r < 40 && Math.abs(g - 128) < 30 && Math.abs(b - 128) < 30;
    if (!layerUp) assert.ok(previewPx.top.every((v) => v < 10), `preview top is empty: ${previewPx.top}`);
    assert.ok(isTeal(previewPx.bottom), `preview bottom shows the photo: ${previewPx.bottom}`);
    await shot('02d-presenter');

    // Switch to vertical and play for a moment.
    await page.selectOption('#aspect', '9:16');
    await page.keyboard.press('Escape');
    await page.click('#btn-play');
    await page.waitForTimeout(1200);
    const playing = await page.evaluate(() => ({ t: window.clipcraft.player.time, p: window.clipcraft.player.playing }));
    assert.ok(playing.p && playing.t > 1.5, `playback advanced: ${JSON.stringify(playing)}`);
    await page.click('#btn-play');
    await page.waitForTimeout(400);
    await shot('03-vertical');

    // Export at 720p.
    const output = p('export.mp4');
    await app.evaluate(({ dialog }, out) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: out });
    }, output);
    await page.click('#btn-export');
    await page.selectOption('.modal-field:has-text("רזולוציה") select', '720');
    await shot('04-export-dialog');
    await page.click('#export-go');
    await page.waitForSelector('.modal h2:has-text("הייצוא הסתיים")', { timeout: 180000 });
    await shot('05-export-done');

    const expected = await page.evaluate(() => window.clipcraft.player.duration);
    const info = JSON.parse(execFileSync(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', output]).toString());
    const v = info.streams.find((s) => s.codec_type === 'video');
    assert.equal(v.width, 720);
    assert.equal(v.height, 1280);
    assert.ok(info.streams.some((s) => s.codec_type === 'audio'));
    assert.ok(Math.abs(Number(info.format.duration) - expected) < 0.2, `duration ${info.format.duration} vs ${expected}`);
    if (shots) ff(['-ss', '2.2', '-i', output, '-frames:v', '1', path.join(shots, '06-exported-frame.png')]);
    // The split-screen layer is in the top half of the exported frame at 5.5s.
    const px = (y) => [...execFileSync(ffmpegPath(), ['-v', 'error', '-ss', '5.5', '-i', output, '-frames:v', '1',
      '-vf', `crop=2:2:360:${y},format=rgb24`, '-f', 'rawvideo', '-'])].slice(0, 3);
    const top = px(200);
    assert.ok(top[0] < 40 && Math.abs(top[1] - 128) < 30 && Math.abs(top[2] - 128) < 30, `top half is teal: ${top}`);
    assert.notDeepEqual(px(1100), top);
    // The presenter-framed photo: the bottom of the frame is the photo, the top above its area is black.
    const framedPx = (y) => [...execFileSync(ffmpegPath(), ['-v', 'error', '-ss', String(photoTime), '-i', output, '-frames:v', '1',
      '-vf', `crop=2:2:360:${y},format=rgb24`, '-f', 'rawvideo', '-'])].slice(0, 3);
    assert.ok(isTeal(framedPx(1100)), `exported photo in the lower part: ${framedPx(1100)}`);
    if (!layerUp) assert.ok(framedPx(200).every((v) => v < 16), `exported top is empty: ${framedPx(200)}`);
    if (shots) ff(['-ss', '5.5', '-i', output, '-frames:v', '1', path.join(shots, '07-exported-split.png')]);
    assert.deepEqual(errors, []);
  } finally {
    await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});

test('automatic captions from a (fake) ElevenLabs Scribe server', { skip: noDisplay && 'no display (use xvfb-run)', timeout: 180000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clipcraft-e2e-'));
  const p = (n) => path.join(dir, n);
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=720x1280:r=30:d=4', '-f', 'lavfi', '-i', 'sine=f=330:d=4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', p('talk.mp4')]);
  ff(['-f', 'lavfi', '-i', 'testsrc=s=720x1280:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p('silent.mp4')]);
  if (shots) mkdirSync(shots, { recursive: true });

  // Stand-in for api.elevenlabs.io: records requests, answers with word timings.
  const requests = [];
  let reply = 'ok';
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      requests.push({ headers: req.headers, body: Buffer.concat(chunks) });
      if (reply === 'unauthorized') {
        res.writeHead(401, { 'content-type': 'application/json' }).end('{"detail":{"message":"Invalid API key"}}');
        return;
      }
      const words = [['היום', 0.2, 0.5], ['אני', 0.55, 0.7], ['מראה', 0.75, 1.0], ['לכם', 1.05, 1.3], ['משהו!', 1.35, 1.8]]
        .flatMap(([text, start, end]) => [{ text, start, end, type: 'word' }, { text: ' ', start: end, end, type: 'spacing' }]);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ language_code: 'heb', text: '', words }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/v1/speech-to-text`;

  const app = await electron.launch({
    executablePath: electronBin,
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), root],
    env: { ...process.env, CLIPCRAFT_SCRIBE_URL: url },
  });
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.waitForSelector('#btn-import');
    const project = () => page.evaluate(() => JSON.parse(JSON.stringify(window.clipcraft.store.project)));
    const shot = async (name) => shots && page.screenshot({ path: path.join(shots, `${name}.png`) });
    await page.evaluate(() => window.api.forgetCaptionsKey());
    await app.evaluate(({ dialog }, f) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: f });
    }, [p('silent.mp4'), p('talk.mp4')]);
    await page.click('#btn-import');
    await page.waitForFunction(() => window.clipcraft.store.project.clips.length === 2);
    await page.selectOption('#aspect', '9:16');

    // Enter a key (not remembered), pick Hebrew, generate.
    await page.click('#btn-captions');
    await page.fill('#captions-key', 'sk_test_123');
    if (await page.locator('#captions-remember').count()) await page.uncheck('#captions-remember');
    await page.click('#captions-key-save');
    await page.waitForSelector('#captions-go:not([disabled])');
    await page.selectOption('#captions-language', 'heb');
    assert.match(await page.textContent('.modal'), /1 קליפ עם סאונד/);
    await shot('10-captions-dialog');
    await page.click('#captions-go');
    await page.waitForFunction(() => window.clipcraft.store.project.texts.some((t) => t.caption));

    assert.equal(requests.length, 1, 'only the clip with sound is sent');
    const req = requests[0];
    assert.equal(req.headers['xi-api-key'], 'sk_test_123');
    const body = req.body.toString('latin1');
    assert.match(body, /name="model_id"\r\n\r\nscribe_v2/);
    assert.match(body, /name="language_code"\r\n\r\nheb/);
    assert.match(body, /name="timestamps_granularity"\r\n\r\nword/);
    assert.ok(req.body.length > 5000, `audio was uploaded (${req.body.length} bytes)`);

    // The talking clip starts after the 2s silent clip, so captions start at 2.2s.
    let proj = await project();
    const caps = proj.texts.filter((t) => t.caption);
    assert.deepEqual(caps.map((t) => t.text), ['היום אני מראה', 'לכם משהו!']);
    assert.ok(Math.abs(caps[0].start - 2.2) < 0.01, `first caption at ${caps[0].start}`);
    assert.equal(caps[0].end, caps[1].start);

    // One undo step removes all captions; redo brings them back.
    await page.click('#btn-undo');
    assert.equal((await project()).texts.length, 0);
    await page.click('#btn-redo');
    assert.equal((await project()).texts.filter((t) => t.caption).length, 2);

    // Restyle one caption and apply the look to all of them.
    await page.click('.tl-text.caption >> nth=0');
    await page.click('.insp button[data-value="box"]');
    await page.click('#captions-apply-all');
    proj = await project();
    assert.ok(proj.texts.every((t) => t.style === 'box'));
    await page.evaluate(() => window.clipcraft.player.seek(2.5));
    await page.waitForTimeout(800);
    await shot('11-captions-added');

    // A rejected key is explained, and nothing changes.
    reply = 'unauthorized';
    await page.keyboard.press('Escape');
    await page.click('#btn-captions');
    await page.click('#captions-go');
    await page.waitForSelector('.modal h2:has-text("לא הצלחנו ליצור כתוביות")');
    assert.match(await page.textContent('.modal-error'), /מפתח ה-API/);
    assert.equal((await project()).texts.length, 2);
    await page.click('.modal button:has-text("סגירה")');

    // Black-and-gold templates: a big-number graphic on top, edited, and red captions on the seam.
    await page.click('.bin .segmented button[data-value="templates"]');
    await page.evaluate(() => window.clipcraft.player.seek(2));
    await page.click('.tpl-card[data-template="gold-number"]');
    await page.waitForFunction(() => (window.clipcraft.store.project.overlays ?? []).length === 1, null, { timeout: 60000 });
    let graphic = (await project()).overlays[0];
    assert.equal(graphic.graphic.type, 'number');
    assert.equal(graphic.region, 'top');
    assert.equal(graphic.start, 2);
    assert.ok(existsSync(graphic.path), 'the graphic video was written');
    assert.ok(Math.abs(graphic.out - 4) < 0.1, `a graphic lasts 4s: ${graphic.out}`);
    await page.fill('#graphic-value', '×7');
    await page.click('#graphic-update');
    await page.waitForFunction((old) => window.clipcraft.store.project.overlays[0].path !== old, graphic.path, { timeout: 60000 });
    graphic = (await project()).overlays[0];
    assert.equal(graphic.graphic.value, '×7');
    assert.equal(graphic.start, 2, 'updating keeps the timing');
    await page.click('.tpl-card[data-template="gold-captions"]');
    proj = await project();
    assert.ok(proj.texts.every((t) => t.caption && t.color === '#ef4444' && t.y === 0.5), 'captions turned red on the seam');
    await page.evaluate(() => window.clipcraft.player.seek(3.4));
    await page.waitForTimeout(1000);
    await shot('13-gold-template');

    // Export: captions go through the shared text lanes.
    const output = p('captions.mp4');
    await app.evaluate(({ dialog }, out) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: out });
    }, output);
    await page.click('#btn-export');
    await page.selectOption('.modal-field:has-text("רזולוציה") select', '720');
    await page.click('#export-go');
    await page.waitForSelector('.modal h2:has-text("הייצוא הסתיים")', { timeout: 120000 });
    if (shots) ff(['-ss', '3.4', '-i', output, '-frames:v', '1', path.join(shots, '12-captions-exported.png')]);
    // While the graphic is up, the top half is its dark background; the bottom is still the video.
    const px = (y) => [...execFileSync(ffmpegPath(), ['-v', 'error', '-ss', '4', '-i', output, '-frames:v', '1',
      '-vf', `crop=2:2:20:${y},format=rgb24`, '-f', 'rawvideo', '-'])].slice(0, 3);
    assert.ok(px(150).every((c) => c < 50), `graphic background on top: ${px(150)}`);
    assert.ok(Math.max(...px(1100)) > 100, `video at the bottom: ${px(1100)}`);
    assert.deepEqual(errors, []);
  } finally {
    await forgetCaptionsKey(app);
    await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

async function forgetCaptionsKey(app) {
  const page = await app.firstWindow().catch(() => null);
  await page?.evaluate(() => window.api.forgetCaptionsKey()).catch(() => {});
}
