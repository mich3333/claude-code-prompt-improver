// Renders Remotion motion-graphic clips (and the cover still) from ../motion.
// Usage: node render_motion.mjs jobs.json
//
// jobs.json: { "renders": [ { "composition": "KineticTitle", "props": {...},
//   "output": "/abs/title.mp4", "transparent": false } ], "assets": ["/abs/frame.jpg"] }
//
// - Opaque clips are H.264 MP4 (import them like any graphic: a top or full layer).
// - "transparent": true renders VP9 WebM with alpha (yuva420p) for overlays such
//   as word captions; ClipCraft keeps the alpha when it exports.
// - Stills (Cover) are written as PNG/JPEG by extension.
// - Files in "assets" are copied into the bundle's public dir; refer to them by
//   their base name in props (e.g. Cover's "image").
// Installs ../motion's dependencies on first run. Set REMOTION_BROWSER to use a
// specific Chrome/Chromium; otherwise a local Playwright headless shell is used
// when present, else Remotion downloads its own Chrome Headless Shell.

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const motionDir = path.resolve(here, '../motion');
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));

if (!existsSync(path.join(motionDir, 'node_modules/@remotion/renderer'))) {
  console.log('installing Remotion (first run)…');
  execSync('npm install --no-audit --no-fund', { cwd: motionDir, stdio: 'inherit' });
}
const require = createRequire(path.join(motionDir, 'package.json'));
const load = async (m) => import(pathToFileURL(require.resolve(m)).href);
const { bundle } = await load('@remotion/bundler');
const { renderMedia, renderStill, selectComposition } = await load('@remotion/renderer');

function findBrowser() {
  if (process.env.REMOTION_BROWSER) return process.env.REMOTION_BROWSER;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (process.platform !== 'linux' || !existsSync(root)) return null;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium_headless_shell')).sort().reverse()) {
    for (const rel of ['chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
      const p = path.join(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}
const browserExecutable = findBrowser();

const publicDir = mkdtempSync(path.join(os.tmpdir(), 'reel-motion-public-'));
for (const a of jobs.assets ?? []) copyFileSync(a, path.join(publicDir, path.basename(a)));

try {
  const serveUrl = await bundle({ entryPoint: path.join(motionDir, 'src/index.jsx'), publicDir });
  for (const job of jobs.renders) {
    const inputProps = job.props ?? {};
    const output = path.resolve(job.output);
    const composition = await selectComposition({ serveUrl, id: job.composition, inputProps, browserExecutable, logLevel: 'error' });
    const t0 = Date.now();
    if (/\.(png|jpe?g)$/i.test(output)) {
      await renderStill({ serveUrl, composition, inputProps, output, browserExecutable, imageFormat: /png$/i.test(output) ? 'png' : 'jpeg', logLevel: 'error' });
    } else if (job.transparent) {
      await renderMedia({
        serveUrl, composition, inputProps, browserExecutable, outputLocation: output,
        codec: 'vp9', imageFormat: 'png', pixelFormat: 'yuva420p', logLevel: 'error',
      });
    } else {
      await renderMedia({ serveUrl, composition, inputProps, browserExecutable, outputLocation: output, codec: 'h264', crf: 18, pixelFormat: 'yuv420p', logLevel: 'error' });
    }
    console.log(`${job.composition} -> ${output} (${composition.width}x${composition.height}, ${(composition.durationInFrames / composition.fps).toFixed(2)}s, ${((Date.now() - t0) / 1000).toFixed(1)}s to render)`);
  }
} finally {
  rmSync(publicDir, { recursive: true, force: true });
}
