// Builds and exports a reel in the real ClipCraft app from a JSON spec
// (see references/clipcraft.md). Usage: node build_reel.mjs spec.json
//
// When spec.words is given, the editor's own captions pipeline is fed those
// ElevenLabs Scribe words through a local stand-in server (CLIPCRAFT_SCRIBE_URL),
// so captions work even where the container cannot reach api.elevenlabs.io.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const editorDir = path.resolve(spec.editorDir);
const require = createRequire(path.join(editorDir, 'package.json'));
const pw = await import(pathToFileURL(require.resolve('playwright-core')).href);
const electron = pw._electron ?? pw.default?._electron; // CommonJS entry: exports land on default
const electronBin = require('electron');
const out = path.resolve(spec.output);

// Optional stand-in for the Scribe API, answering with the given words.
let server = null;
let scribeUrl = null;
if (spec.words) {
  const offset = Number(spec.wordsOffset ?? 0);
  const words = JSON.parse(readFileSync(spec.words, 'utf8'))
    .map((w) => ({ ...w, start: w.start + offset, end: w.end + offset }));
  server = createServer((req, res) => {
    req.resume();
    req.on('end', () => res.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ language_code: spec.captions?.language ?? 'heb', words })));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  scribeUrl = `http://127.0.0.1:${server.address().port}/v1/speech-to-text`;
}

const app = await electron.launch({
  executablePath: electronBin,
  args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), editorDir],
  env: { ...process.env, ...(scribeUrl ? { CLIPCRAFT_SCRIBE_URL: scribeUrl } : {}) },
});
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const project = () => page.evaluate(() => window.clipcraft.store.project);

try {
  await page.waitForSelector('#btn-import');
  const screenshots = spec.scenes.filter((s) => s.type === 'screenshot').map((s) => path.resolve(s.image));
  const files = [path.resolve(spec.presenter), ...new Set(screenshots)];
  await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: f }); }, files);
  await page.click('#btn-import');
  await page.waitForFunction((n) => window.clipcraft.store.project.clips.length === n, files.length, { timeout: 60000 });
  // Screenshots stay in the media library only; they go on as overlay layers below.
  await page.evaluate((presenter) => {
    const { store } = window.clipcraft;
    store.update((p) => { p.clips = p.clips.filter((c) => c.path === presenter); p.aspect = '9:16'; });
    store.resetHistory();
    store.select(null);
  }, path.resolve(spec.presenter));
  await page.click('.bin .segmented button[data-value="templates"]');

  const count = async () => ((await project()).overlays ?? []).length;
  const waitCount = (n) => page.waitForFunction((k) => (window.clipcraft.store.project.overlays ?? []).length === k, n, { timeout: 60000 });
  const update = async () => {
    const before = (await project()).overlays.map((o) => o.path).join();
    await page.click('#graphic-update');
    await page.waitForFunction((b) => window.clipcraft.store.project.overlays.map((o) => o.path).join() !== b, before, { timeout: 60000 });
  };
  const field = (label) => page.locator(`.insp .insp-row:has-text("${label}") input`).first();

  for (const s of spec.scenes) {
    const n = await count();
    await page.evaluate((t) => window.clipcraft.player.seek(t), s.start);
    if (s.type === 'screenshot') {
      await page.click('.bin .segmented button[data-value="media"]');
      await page.locator('.bin-item', { hasText: path.basename(s.image) }).locator('.bin-overlay').click();
      await waitCount(n + 1);
      await page.click('.insp button[data-value="full"]');
      await page.click('.bin .segmented button[data-value="templates"]');
      continue;
    }
    await page.click(`.tpl-card[data-template="gold-${s.type}"]`);
    await waitCount(n + 1);
    if (s.label != null) await page.fill('#graphic-label', String(s.label));
    if (s.type === 'number' && s.value != null) await page.fill('#graphic-value', String(s.value));
    if (s.type === 'bars') {
      if (s.values != null) await page.fill('#graphic-values', String(s.values));
      if (s.prefix != null) await field('לפני הערך').fill(String(s.prefix));
      if (s.suffix != null) await field('אחרי הערך').fill(String(s.suffix));
    }
    const yearsBox = page.locator('.insp label.insp-check:has-text("ציר שנים למעלה") input');
    if (s.years != null && (await yearsBox.count()) && (await yearsBox.isChecked()) !== Boolean(s.years)) await yearsBox.click();
    if (s.from != null && (await field('משנה').count())) await field('משנה').fill(String(s.from));
    if (s.to != null && (await field('עד שנה').count())) await field('עד שנה').fill(String(s.to));
    if (s.active != null && (await page.locator('#graphic-active').count())) await page.fill('#graphic-active', String(s.active));
    if (await page.locator('#graphic-update:not([disabled])').count()) await update();
  }

  // Hard cuts between scenes, each layer trimmed to its scene.
  await page.evaluate((scenes) => window.clipcraft.store.update((p) => {
    p.overlays.forEach((o, i) => {
      const s = scenes[i];
      if (!s) return;
      o.fade = false;
      const len = Math.max(0.2, s.end - s.start);
      o.out = o.in + (o.sourceDuration ? Math.min(o.sourceDuration - o.in, len) : len);
    });
  }), spec.scenes);

  if (spec.captions && scribeUrl) {
    const c = spec.captions;
    await page.evaluate(() => window.api.forgetCaptionsKey());
    await page.click('#btn-captions');
    await page.fill('#captions-key', 'stand-in-key');
    if (await page.locator('#captions-remember').count()) await page.uncheck('#captions-remember');
    await page.click('#captions-key-save');
    await page.waitForSelector('#captions-go:not([disabled])');
    await page.selectOption('#captions-language', c.language ?? 'heb');
    await page.click(`.modal button[data-value="${c.words ?? 3}"]`);
    await page.click(`.modal button[data-value="${c.look ?? 'red'}"]`);
    await page.click(`.modal button[data-value="${c.position ?? 'middle'}"]`);
    await page.click('#captions-go');
    await page.waitForFunction(() => window.clipcraft.store.project.texts.some((t) => t.caption), null, { timeout: 60000 });
    await page.evaluate(() => window.api.forgetCaptionsKey());
    const caps = (await project()).texts.filter((t) => t.caption).map((t) => `${t.start.toFixed(2)}–${t.end.toFixed(2)} ${t.text}`);
    console.log(`captions (${caps.length}):\n  ${caps.join('\n  ')}`);
  }

  await page.evaluate(() => { window.clipcraft.store.select(null); window.clipcraft.timeline.zoomToFit(); });
  await page.evaluate((t) => window.clipcraft.player.seek(t), spec.scenes[0] ? (spec.scenes[0].start + spec.scenes[0].end) / 2 : 1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out.replace(/\.mp4$/i, '') + '-editor.png' });

  await app.evaluate(({ dialog }, o) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: o }); }, out);
  await page.click('#btn-export');
  await page.selectOption('.modal-field:has-text("רזולוציה") select', String(spec.resolution ?? 1080));
  await page.selectOption('.modal-field:has-text("איכות") select', '18');
  await page.click('#export-go');
  await page.waitForSelector('.modal h2:has-text("הייצוא הסתיים")', { timeout: 600000 });
  console.log(`exported ${out}`);
  if (errors.length) console.log('page errors:', JSON.stringify(errors));
} finally {
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
  server?.close();
}
