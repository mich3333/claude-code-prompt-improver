// Builds and exports a reel in the real ClipCraft app from a JSON spec
// (see references/clipcraft.md). Usage: node build_reel.mjs spec.json
//
// Scene types: face (no layer), number / bars / year / quote (black-and-gold
// templates), screenshot / media (any image or video file as a layer: a
// screenshot card, a Remotion clip, a transparent captions WebM, a cut-out).
// Each scene may set region (top | bottom | full), split (0.3-0.7) and
// animation (fade | none | slideright | slideleft | slidebottom; the slides
// need an editor with layer animations, otherwise they fall back to fade).
//
// When spec.words is given, the editor's own captions pipeline is fed those
// words through a local stand-in for the Scribe API (CLIPCRAFT_SCRIBE_URL),
// so captions work even where the container cannot reach api.elevenlabs.io.

import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
const TEMPLATES = new Set(['number', 'bars', 'year', 'quote']);
const FILE_TYPES = new Set(['screenshot', 'media']);
const canSlide = existsSync(path.join(editorDir, 'src/shared/overlay-motion.js'));
const fileOf = (s) => path.resolve(s.file ?? s.image);

// The UI bundle must be built, and newer than its sources (a stale bundle
// silently runs old code: e.g. layers without their alpha decoder).
const built = path.join(editorDir, 'build/renderer/index.html');
const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((m, d) => Math.max(m,
  d.isDirectory() ? newest(path.join(dir, d.name)) : statSync(path.join(dir, d.name)).mtimeMs), 0);
if (!existsSync(built) || Math.max(newest(path.join(editorDir, 'src/renderer')), newest(path.join(editorDir, 'src/shared'))) > statSync(built).mtimeMs) {
  throw new Error(`ClipCraft's UI build is missing or older than its sources: run "npm ci && npx vite build" in ${editorDir}`);
}
for (const s of spec.scenes) {
  if (!TEMPLATES.has(s.type) && !FILE_TYPES.has(s.type) && s.type !== 'face') throw new Error(`unknown scene type: ${s.type}`);
  if (FILE_TYPES.has(s.type) && !existsSync(fileOf(s))) throw new Error(`missing file for scene at ${s.start}s: ${fileOf(s)}`);
  if (!(s.end > s.start)) throw new Error(`scene at ${s.start}s ends before it starts`);
}

// Optional stand-in for the Scribe API, answering with the given words.
let server = null;
let scribeUrl = null;
if (spec.words) {
  const offset = Number(spec.wordsOffset ?? 0);
  const raw = JSON.parse(readFileSync(spec.words, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.words ?? raw.transcripts?.[0]?.words ?? [];
  const words = list.map((w) => ({ type: 'word', ...w, start: w.start + offset, end: w.end + offset }));
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
  const layerFiles = [...new Set(spec.scenes.filter((s) => FILE_TYPES.has(s.type)).map(fileOf))];
  const files = [path.resolve(spec.presenter), ...layerFiles];
  await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: f }); }, files);
  await page.click('#btn-import');
  await page.waitForFunction((n) => window.clipcraft.store.project.clips.length === n, files.length, { timeout: 120000 });
  // Layer files stay in the media library only; they go on as overlay layers below.
  await page.evaluate((presenter) => {
    const { store } = window.clipcraft;
    store.update((p) => { p.clips = p.clips.filter((c) => c.path === presenter); p.aspect = '9:16'; });
    store.resetHistory();
    store.select(null);
  }, path.resolve(spec.presenter));
  await page.click('.bin .segmented button[data-value="templates"]');

  const ids = async () => ((await project()).overlays ?? []).map((o) => o.id);
  const waitCount = (n) => page.waitForFunction((k) => (window.clipcraft.store.project.overlays ?? []).length === k, n, { timeout: 60000 });
  const update = async () => {
    const before = (await project()).overlays.map((o) => o.path).join();
    await page.click('#graphic-update');
    await page.waitForFunction((b) => window.clipcraft.store.project.overlays.map((o) => o.path).join() !== b, before, { timeout: 60000 });
  };
  const field = (label) => page.locator(`.insp .insp-row:has-text("${label}") input`).first();
  const fill = async (sel, v) => { if (v != null && (await page.locator(sel).count())) await page.fill(sel, String(v)); };

  const placed = []; // { scene, id }
  for (const s of spec.scenes) {
    if (s.type === 'face') continue;
    const before = await ids();
    await page.evaluate((t) => window.clipcraft.player.seek(t), s.start);
    if (FILE_TYPES.has(s.type)) {
      await page.click('.bin .segmented button[data-value="media"]');
      await page.locator('.bin-item', { hasText: path.basename(fileOf(s)) }).first().locator('.bin-overlay').click();
      await waitCount(before.length + 1);
      await page.click('.bin .segmented button[data-value="templates"]');
    } else {
      await page.click(`.tpl-card[data-template="gold-${s.type}"]`);
      await waitCount(before.length + 1);
      // The graphic itself lasts as long as its scene (2-60 s), so it is never cut short.
      await fill('#graphic-duration', Math.min(60, Math.max(2, Math.ceil((s.end - s.start) * 2) / 2)));
      await fill('#graphic-label', s.label);
      if (s.type === 'number') await fill('#graphic-value', s.value);
      if (s.type === 'bars') {
        await fill('#graphic-values', s.values);
        // The template's defaults are "$" and "B"; a scene without them means none.
        await field('לפני הערך').fill(String(s.prefix ?? ''));
        await field('אחרי הערך').fill(String(s.suffix ?? ''));
      }
      if (s.type === 'quote') {
        await fill('#graphic-who', s.who);
        await fill('#graphic-where', s.where);
        await fill('#graphic-quote', s.quote);
        await fill('#graphic-he', s.he);
        await fill('#graphic-url', s.url);
        const head = page.locator('.insp label.insp-check:has-text("כותרת של כתבה") input');
        if (s.headline != null && (await head.count()) && (await head.isChecked()) !== Boolean(s.headline)) await head.click();
      }
      const yearsBox = page.locator('.insp label.insp-check:has-text("ציר שנים למעלה") input');
      if (s.years != null && (await yearsBox.count()) && (await yearsBox.isChecked()) !== Boolean(s.years)) await yearsBox.click();
      if (s.from != null && (await field('משנה').count())) await field('משנה').fill(String(s.from));
      if (s.to != null && (await field('עד שנה').count())) await field('עד שנה').fill(String(s.to));
      await fill('#graphic-active', s.active);
      if (await page.locator('#graphic-update:not([disabled])').count()) await update();
    }
    const id = (await ids()).find((x) => !before.includes(x));
    placed.push({ scene: s, id });
  }

  // Timing, placement and entrance of each layer, from its scene.
  const unsupported = await page.evaluate(({ placed: list, canSlide: slide, fallback }) => {
    const skipped = [];
    window.clipcraft.store.update((p) => {
      for (const { scene: s, id } of list) {
        const o = p.overlays.find((x) => x.id === id);
        if (!o) continue;
        o.start = s.start;
        const len = Math.max(0.2, s.end - s.start);
        o.out = o.in + (o.sourceDuration ? Math.min(o.sourceDuration - o.in, len) : len);
        if (s.region) o.region = s.region;
        else if (s.type === 'screenshot') o.region = 'full';
        if (s.split != null) o.split = Number(s.split);
        if (s.fit) o.fit = s.fit;
        const anim = s.animation ?? fallback;
        if (anim.startsWith('slide') && !slide) skipped.push(anim);
        const a = anim.startsWith('slide') && !slide ? 'fade' : anim;
        if (slide) o.animation = a;
        o.fade = a === 'fade';
      }
    });
    return skipped;
  }, { placed, canSlide, fallback: spec.animation ?? 'none' });
  if (unsupported.length) console.log(`note: this editor has no slide animations yet; ${unsupported.length} layer(s) fade instead`);
  console.log(`layers: ${placed.filter((x) => x.id).length} of ${placed.length} placed`);

  const engine = spec.captions?.engine ?? 'clipcraft';
  if (spec.captions && engine === 'clipcraft' && scribeUrl) {
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
    // Over a full-screen layer (a list, a screenshot) the seam is mid-content:
    // those captions move to the bottom of the frame.
    const moved = await page.evaluate((y) => {
      let n = 0;
      window.clipcraft.store.update((p) => {
        const full = p.overlays.filter((o) => o.region === 'full' && !o.alphaDecoder)
          .map((o) => ({ a: o.start, b: o.start + (o.out - o.in) / (o.speed || 1) }));
        for (const t of p.texts) {
          if (t.caption && full.some((f) => t.start < f.b - 0.05 && t.end > f.a + 0.05)) { t.y = y; n++; }
        }
      });
      return n;
    }, c.fullFrameY ?? 0.76);
    if (moved) console.log(`${moved} caption(s) over full-screen layers moved to the bottom`);
    const caps = (await project()).texts.filter((t) => t.caption).map((t) => `${t.start.toFixed(2)}–${t.end.toFixed(2)} ${t.text}`);
    console.log(`captions (${caps.length}):\n  ${caps.join('\n  ')}`);
  } else if (spec.captions && engine === 'clipcraft') {
    console.log('note: no words given, so no captions (the captions dialog would need a real ElevenLabs key)');
  }

  await page.evaluate(() => { window.clipcraft.store.select(null); window.clipcraft.timeline.zoomToFit(); });
  const first = spec.scenes.find((s) => s.type !== 'face');
  await page.evaluate((t) => window.clipcraft.player.seek(t), first ? (first.start + first.end) / 2 : 1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out.replace(/\.mp4$/i, '')}-editor.png` });
  if (spec.project) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path.resolve(spec.project), JSON.stringify(await project(), null, 1));
  }

  await app.evaluate(({ dialog }, o) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: o }); }, out);
  await page.click('#btn-export');
  await page.selectOption('.modal-field:has-text("רזולוציה") select', String(spec.resolution ?? 1080));
  await page.selectOption('.modal-field:has-text("איכות") select', '18');
  await page.click('#export-go');
  await page.waitForSelector('.modal h2:has-text("הייצוא הסתיים")', { timeout: 900000 });
  console.log(`exported ${out}`);
  if (errors.length) console.log('page errors:', JSON.stringify(errors));
} finally {
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
  server?.close();
}
