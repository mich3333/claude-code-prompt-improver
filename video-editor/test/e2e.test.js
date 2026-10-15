// UI test: launches the real Electron app, edits a video through the UI and
// exports it. Needs a display (on Linux: `xvfb-run -a npm run test:e2e`).
// Set E2E_SCREENSHOTS=<dir> to save screenshots.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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
    await page.selectOption('.modal-field:has-text("Resolution") select', '720');
    await shot('04-export-dialog');
    await page.click('#export-go');
    await page.waitForSelector('.modal h2:has-text("Export complete")', { timeout: 180000 });
    await shot('05-export-done');

    const expected = await page.evaluate(() => window.clipcraft.player.duration);
    const info = JSON.parse(execFileSync(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', output]).toString());
    const v = info.streams.find((s) => s.codec_type === 'video');
    assert.equal(v.width, 720);
    assert.equal(v.height, 1280);
    assert.ok(info.streams.some((s) => s.codec_type === 'audio'));
    assert.ok(Math.abs(Number(info.format.duration) - expected) < 0.2, `duration ${info.format.duration} vs ${expected}`);
    if (shots) ff(['-ss', '2.2', '-i', output, '-frames:v', '1', path.join(shots, '06-exported-frame.png')]);
    assert.deepEqual(errors, []);
  } finally {
    await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});
