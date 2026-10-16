#!/usr/bin/env node
// Screenshot of a source (article, post, page) for a "proof" scene, framed as a
// 1080x1920 card: the capture on a dark backdrop, rounded, with the source
// domain under it. Hebrew pages render right to left as in a browser.
//
//   node screenshot.mjs <url|file.html> <out.png> [--selector "article h1"]
//        [--height 1400] [--raw] [--label "ynet · 12.10.2026"] [--editor ../../../../video-editor]
//
// --selector  capture from the top of this element (default: the top of the page)
// --height    CSS pixels of page to capture (at 2x scale), default 1100
// --raw       save the plain capture, without the card
// Cookie/consent banners from the common vendors are blocked or hidden.
// Uses playwright-core from ClipCraft (video-editor/node_modules) and a local
// Chromium: PLAYWRIGHT_BROWSERS_PATH, or Google Chrome on a Mac/PC.
// Many news sites block bots or paywall; when a capture shows a wall, take the
// screenshot by hand on the phone/computer and use that image instead.

import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : d;
};
const raw = args.includes('--raw') ? Boolean(args.splice(args.indexOf('--raw'), 1)) : false;
const selector = opt('selector', null);
const height = Number(opt('height', 1100));
const editorDir = path.resolve(opt('editor', process.env.CLIPCRAFT_DIR || path.join(here, '../../../../video-editor')));
const [src, out] = args;
if (!out) {
  console.error('usage: screenshot.mjs <url|file.html> <out.png> [--selector css] [--height 1100] [--raw] [--label text]');
  process.exit(1);
}
const url = /^https?:/.test(src) ? src : pathToFileURL(path.resolve(src)).href;
const label = opt('label', /^https?:/.test(src) ? new URL(src).hostname.replace(/^www\./, '') : '');

const require = createRequire(path.join(editorDir, 'package.json'));
const { chromium } = await import(pathToFileURL(require.resolve('playwright-core')).href).then((m) => m.default ?? m);

function launchOptions() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(root)) {
    for (const d of readdirSync(root).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
        const p = path.join(root, d, rel);
        if (existsSync(p)) return { executablePath: p };
      }
    }
  }
  return { channel: 'chrome' }; // the installed Google Chrome (Mac/Windows)
}

const CONSENT = /onetrust|cookielaw|cookiebot|didomi|quantcast|consensu|trustarc|usercentrics|sourcepoint|cmp\./i;
const HIDE = `[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="gdpr" i],
  [id*="onetrust" i],[class*="paywall" i],[class*="newsletter-popup" i],[aria-modal="true"] { display: none !important; }
  html, body { overflow: visible !important; }`;

const browser = await chromium.launch({ ...launchOptions(), args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ locale: 'he-IL', viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', (r) => (CONSENT.test(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.error(`could not open ${url}: ${e.message.split('\n')[0]}\n` +
      'The site may block automated browsers, or this machine cannot reach it. Take the screenshot by hand and use the image.');
    process.exitCode = 2;
    throw e;
  }
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.addStyleTag({ content: HIDE });
  let top = 0;
  if (selector) {
    const el = page.locator(selector).first();
    await el.scrollIntoViewIfNeeded({ timeout: 10000 });
    top = Math.max(0, (await el.evaluate((n) => n.getBoundingClientRect().top + window.scrollY)) - 16);
  }
  const pageH = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().bottom + window.scrollY + 16));
  const clip = { x: 0, y: top, width: 540, height: Math.max(200, Math.min(height, pageH - top)) };
  const shot = await page.screenshot({ clip, fullPage: true, type: 'png' });
  if (raw) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, shot);
  } else {
    const card = await ctx.newPage();
    await card.setViewportSize({ width: 540, height: 960 });
    await card.setContent(`<!doctype html><html dir="rtl"><body style="margin:0;width:540px;height:960px;overflow:hidden;
      background:radial-gradient(ellipse at 50% 40%,#2a2620,#0a0908 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Rubik,Heebo,Arial,sans-serif">
      <img src="data:image/png;base64,${shot.toString('base64')}" style="width:480px;max-height:780px;object-fit:cover;object-position:top;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.6)">
      ${label ? `<div style="color:#e2b54c;font-size:20px;font-weight:600;direction:ltr;unicode-bidi:plaintext">${label.replace(/</g, '&lt;')}</div>` : ''}
      </body></html>`);
    await card.screenshot({ path: out, type: 'png' });
  }
  console.log(`${out} (${raw ? `1080x${clip.height * 2}` : '1080x1920'}) from ${url}`);
} finally {
  await browser.close();
}
