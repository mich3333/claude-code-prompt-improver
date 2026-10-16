#!/usr/bin/env node
// Checks what this machine can do before a reel is built, and says how to fix
// what is missing.   node doctor.mjs [path/to/video-editor]

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const editorDir = path.resolve(process.argv[2] ?? process.env.CLIPCRAFT_DIR ?? path.join(here, '../../../../video-editor'));
const rows = [];
const add = (ok, what, detail, fix = '') => rows.push({ ok, what, detail, fix });
const has = (cmd, args = ['--version']) => spawnSync(cmd, args, { encoding: 'utf8' }).status === 0;

const [major] = process.versions.node.split('.').map(Number);
add(major >= 18, 'Node.js', process.versions.node, 'install Node 18+ (nodejs.org or brew install node)');

const req = createRequire(path.join(editorDir, 'package.json'));
const editorOk = existsSync(path.join(editorDir, 'package.json'));
add(editorOk, 'ClipCraft', editorOk ? editorDir : `not found at ${editorDir}`, 'clone mich3333/claude-code-prompt-improver and pass its video-editor path');
const nm = editorOk && existsSync(path.join(editorDir, 'node_modules/electron'));
add(nm, 'ClipCraft dependencies', nm ? 'installed' : 'missing', `cd ${editorDir} && npm ci`);
const ui = editorOk && existsSync(path.join(editorDir, 'build/renderer/index.html'));
add(ui, 'ClipCraft UI build', ui ? 'built' : 'missing', `cd ${editorDir} && npx vite build`);
let ff = null;
try { ff = req('ffmpeg-static'); } catch { ff = has('ffmpeg', ['-version']) ? 'ffmpeg' : null; }
add(Boolean(ff), 'FFmpeg', ff ?? 'missing', 'npm ci in video-editor (bundles it) or brew install ffmpeg');
if (ff) {
  const dec = spawnSync(ff, ['-hide_banner', '-decoders'], { encoding: 'utf8' }).stdout ?? '';
  add(/libvpx-vp9/.test(dec), 'FFmpeg libvpx (transparent layers)', /libvpx-vp9/.test(dec) ? 'yes' : 'no', 'use an FFmpeg build with libvpx');
}
add(process.platform !== 'linux' || Boolean(process.env.DISPLAY) || has('xvfb-run', ['--help']), 'Display for Electron',
  process.platform === 'linux' ? (process.env.DISPLAY ? 'DISPLAY set' : 'use xvfb-run -a') : 'desktop', 'apt-get install xvfb');

const motion = path.join(here, '../motion/node_modules/@remotion/renderer');
add(true, 'Remotion (motion graphics, covers)', existsSync(motion) ? 'installed' : 'not yet: installs itself on the first render (npm, ~250 packages)');
const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const chromium = existsSync(pw) && readdirSync(pw).some((d) => d.startsWith('chromium'));
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].some(existsSync);
add(chromium || chrome || process.platform === 'darwin', 'Browser for screenshots', chromium ? `Playwright Chromium in ${pw}` : chrome ? 'Google Chrome' : 'Remotion downloads its own; screenshots need Chrome',
  'install Google Chrome');

const py = process.env.PYTHON || 'python3';
const pyHas = (mod) => spawnSync(py, ['-c', `import ${mod}`]).status === 0;
add(pyHas('rembg'), 'rembg (cut-outs)  [optional]', pyHas('rembg') ? 'yes' : 'no', 'pip install "rembg[cpu]"');
const cv = spawnSync(py, ['-c', 'import cv2;print(cv2.__version__, hasattr(cv2,"CascadeClassifier"))'], { encoding: 'utf8' }).stdout?.trim();
add(Boolean(cv && cv.endsWith('True')), 'OpenCV (auto-reframe)  [optional]', cv || 'no', 'pip install "opencv-python-headless<5" numpy');
const asr = [pyHas('faster_whisper') && 'faster-whisper', has('mlx_whisper', ['--help']) && 'mlx-whisper', (has('whisper-cli', ['--help']) || has('whisper-cpp', ['--help'])) && 'whisper.cpp'].filter(Boolean);
add(asr.length > 0, 'Offline transcription  [optional]', asr.join(', ') || 'none (Scribe via the connector works without it)', 'pip install faster-whisper   (Mac: also pip install mlx-whisper)');
add(has('espeak-ng'), 'espeak-ng (test narration)  [optional]', has('espeak-ng') ? 'yes' : 'no', 'brew install espeak-ng');

for (const r of rows) console.log(`${r.ok ? '✓' : (r.what.includes('[optional]') ? '·' : '✗')} ${r.what}: ${r.detail}${r.ok ? '' : `\n    fix: ${r.fix}`}`);
const blocking = rows.filter((r) => !r.ok && !r.what.includes('[optional]'));
console.log(blocking.length ? `\n${blocking.length} required item(s) missing.` : '\nReady.');
process.exitCode = blocking.length ? 1 : 0;
