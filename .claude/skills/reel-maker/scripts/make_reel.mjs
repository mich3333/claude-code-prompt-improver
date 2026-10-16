#!/usr/bin/env node
// One command from "my photo or video + the narration" to a finished reel.
//   node make_reel.mjs job.json        (on Linux without a display: xvfb-run -a node make_reel.mjs job.json)
//
// Steps: words (any transcriber's JSON) -> optional exact-script alignment ->
// optional jump cuts -> presenter video -> scenes placed on the spoken words ->
// Remotion motion clips -> ClipCraft assembly + captions -> music + loudness ->
// cover -> checks (frame grid, loudness, report, SRT). See references/pipeline.md
// for the job format. Every intermediate file lands in job.workDir.

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alignToScript, findPhrase, normalizeWords, planCuts, remapWords, toSrt } from './lib/words.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const jobPath = path.resolve(process.argv[2] ?? '');
if (!existsSync(jobPath)) {
  console.error('usage: node make_reel.mjs job.json (see references/pipeline.md)');
  process.exit(1);
}
const job = JSON.parse(readFileSync(jobPath, 'utf8'));
const rel = (p) => (p == null ? p : path.resolve(path.dirname(jobPath), p));
// ClipCraft: the job's editorDir, else $CLIPCRAFT_DIR, else the repo checkout this skill lives in.
const editorDir = job.editorDir ? rel(job.editorDir) : path.resolve(process.env.CLIPCRAFT_DIR ?? path.join(here, '../../../../video-editor'));
if (!existsSync(path.join(editorDir, 'package.json'))) {
  throw new Error(`ClipCraft not found at ${editorDir}: set "editorDir" in the job (or CLIPCRAFT_DIR) to the video-editor folder of mich3333/claude-code-prompt-improver`);
}
const out = rel(job.output ?? 'reel.mp4');
const base = out.replace(/\.mp4$/i, '');
const work = rel(job.workDir ?? `${base}-work`);
mkdirSync(work, { recursive: true });
const W = (name) => path.join(work, name);
const step = (msg) => console.log(`\n▶ ${msg}`);

// FFmpeg: the one bundled with ClipCraft, so nothing else needs installing.
const req = createRequire(path.join(editorDir, 'package.json'));
const pick = (env, load, fallback) => {
  if (process.env[env]) return process.env[env];
  try { const p = load(); if (p && existsSync(p)) return p; } catch { /* not installed */ }
  return fallback;
};
const FF = pick('FFMPEG', () => req('ffmpeg-static'), 'ffmpeg');
const FP = pick('FFPROBE', () => req('ffprobe-static').path, 'ffprobe');
const env = { ...process.env, FFMPEG: FF, FFPROBE: FP };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', env, ...opts });
const node = (script, args) => run(process.execPath, [path.join(here, script), ...args]);
const probe = (file) => JSON.parse(execFileSync(FP, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]).toString());
const duration = (file) => Number(probe(file).format.duration);
const saveJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);

// ---------------------------------------------------------------- inputs
const P = job.presenter ?? {};
const photo = rel(P.photo);
const video = rel(P.video);
if (!photo === !video) throw new Error('presenter needs exactly one of "photo" or "video"');
const voice = rel(P.voice) ?? video;
if (photo && !voice) throw new Error('a photo presenter needs "voice" (the narration audio)');
if (!job.words) {
  throw new Error('job.words is missing: transcribe the narration first (ElevenLabs Scribe through the connector, or scripts/transcribe.sh on the Mac) and point "words" at the JSON');
}

step('words');
let words = normalizeWords(JSON.parse(readFileSync(rel(job.words), 'utf8')));
console.log(`${words.length} words from ${path.basename(rel(job.words))}`);
if (job.script) {
  const text = existsSync(rel(job.script)) ? readFileSync(rel(job.script), 'utf8') : String(job.script);
  const heard = words.length;
  words = alignToScript(words, text);
  console.log(`aligned to the script: ${heard} heard -> ${words.length} script words, exact spelling`);
}

// ---------------------------------------------------------------- jump cuts
let voiceFile = voice;
let presenterVideo = video;
if (job.jumpcut) {
  step('jump cuts');
  const jc = job.jumpcut === true ? {} : job.jumpcut;
  const src = video ?? voice;
  const segs = planCuts(words, { duration: duration(src), maxGap: jc.gap ?? 0.35, pad: jc.pad ?? 0.08, fillers: jc.fillers !== false, extraFillers: jc.extra ?? [] });
  saveJson(W('words.uncut.json'), words);
  const target = video ? W('presenter.cut.mp4') : W('voice.cut.wav');
  node('jumpcut.mjs', [src, W('words.uncut.json'), target, '--gap', String(jc.gap ?? 0.35), '--pad', String(jc.pad ?? 0.08),
    ...(jc.fillers === false ? ['--no-fillers'] : []), ...(jc.extra?.length ? ['--extra', jc.extra.join(',')] : [])]);
  words = remapWords(words, segs);
  if (video) presenterVideo = target;
  else voiceFile = target;
}

// ---------------------------------------------------------------- presenter
step('presenter');
let offset = 0;
if (photo) {
  offset = Number(P.voiceDelay ?? 0.3);
  const secs = (duration(voiceFile) + offset + 0.6).toFixed(2);
  presenterVideo = W('presenter.mp4');
  run('bash', [path.join(here, 'prepare_presenter.sh'), photo, presenterVideo, secs, voiceFile, String(Math.round(offset * 1000))],
    { env: { ...env, ...(P.cropY != null ? { CROP_Y: String(P.cropY) } : {}), ...(P.zoom ? { ZOOM: String(P.zoom) } : {}) } });
} else if (P.reframe) {
  const info = probe(presenterVideo).streams.find((s) => s.codec_type === 'video');
  if (info && info.width > info.height) {
    const py = process.env.PYTHON || 'python3';
    run(py, [path.join(here, 'reframe.py'), presenterVideo, W('presenter.vertical.mp4')]);
    presenterVideo = W('presenter.vertical.mp4');
  }
}
const total = duration(presenterVideo);
words = words.map((w) => ({ ...w, start: +(w.start + offset).toFixed(3), end: +(w.end + offset).toFixed(3) }));
saveJson(W('words.final.json'), words);
writeFileSync(`${base}.srt`, toSrt(words, 4));
console.log(`presenter ${path.basename(presenterVideo)}: ${total.toFixed(2)}s; captions file ${path.basename(base)}.srt`);

// ---------------------------------------------------------------- scenes on the words
step('scenes');
const scenes = [];
let cursor = 0;
for (const [i, s] of (job.scenes ?? []).entries()) {
  let start = s.start;
  if (s.at != null) {
    const hit = findPhrase(words, s.at, cursor - 0.01);
    if (!hit) throw new Error(`scene ${i + 1}: "${s.at}" is not said after ${cursor.toFixed(2)}s. Check the words (node words.mjs show ${W('words.final.json')})`);
    start = Math.max(0, hit.start - (s.lead ?? 0.05));
  }
  if (start == null) throw new Error(`scene ${i + 1} needs "at" (a phrase) or "start" (seconds)`);
  scenes.push({ ...s, start: +start.toFixed(3) });
  cursor = start + 0.01;
}
scenes.forEach((s, i) => {
  if (s.end != null) return;
  if (s.until != null) {
    const hit = findPhrase(words, s.until, s.start + 0.05);
    if (!hit) throw new Error(`scene ${i + 1}: "until" phrase "${s.until}" not found after ${s.start}s`);
    s.end = hit.start;
  } else if (s.duration != null) s.end = s.start + Number(s.duration);
  else s.end = scenes[i + 1]?.start ?? total;
  s.end = +Math.min(total, s.end).toFixed(3);
});
const warnings = [];
for (const s of scenes) {
  const len = s.end - s.start;
  console.log(`  ${s.start.toFixed(2)}–${s.end.toFixed(2)}  ${s.type}${s.composition ? `:${s.composition}` : ''}  ${s.at ? `"${s.at}"` : ''}`);
  const min = s.type === 'number' ? 1.7 : s.type === 'screenshot' || s.type === 'quote' ? 2.5 : 1.5;
  if (s.type !== 'face' && len < min) warnings.push(`${s.type} at ${s.start.toFixed(2)}s lasts ${len.toFixed(2)}s (< ${min}s): merge it with a neighbour or start it on an earlier word`);
}
for (const w of warnings) console.log(`  ! ${w}`);

// ---------------------------------------------------------------- motion clips (Remotion)
const renders = [];
scenes.forEach((s, i) => {
  if (s.type !== 'motion') return;
  const region = s.region ?? 'top';
  const file = W(`motion-${i + 1}-${s.composition}.mp4`);
  renders.push({ composition: s.composition, props: { ...s.props, region, duration: +(s.end - s.start).toFixed(2) }, output: file });
  Object.assign(s, { type: 'media', file, region, fit: 'cover' });
});
const captions = job.captions ?? { engine: 'clipcraft' };
if (captions.engine === 'remotion') {
  const file = W('captions.webm');
  renders.push({ composition: 'WordCaptions', transparent: true, output: file, props: {
    words, duration: total, perPage: captions.words ?? 3, y: captions.y ?? (captions.position === 'bottom' ? 0.7 : captions.position === 'top' ? 0.2 : 0.5),
    size: captions.size ?? 92, color: captions.color ?? '#ffffff', active: captions.active ?? '#ffd23f',
  } });
  scenes.push({ type: 'media', file, start: 0, end: total, region: 'full', animation: 'none' });
}
if (renders.length) {
  step(`motion graphics (${renders.length} clip${renders.length > 1 ? 's' : ''}, Remotion)`);
  saveJson(W('motion-jobs.json'), { renders });
  node('render_motion.mjs', [W('motion-jobs.json')]);
}

// ---------------------------------------------------------------- assembly in ClipCraft
step('assembly in ClipCraft');
const raw = W('reel.raw.mp4');
const spec = {
  editorDir, presenter: presenterVideo, output: raw, project: `${base}.clipcraft`, animation: job.animation ?? 'none',
  scenes: scenes.map((s) => ({ ...s, ...(s.image ? { image: rel(s.image) } : {}), ...(s.file ? { file: rel(s.file) } : {}) })),
  ...(captions.engine === 'clipcraft' ? { words: W('words.final.json'), wordsOffset: 0, captions: { look: 'red', position: 'middle', words: 3, language: 'heb', ...captions } } : {}),
};
saveJson(W('build-spec.json'), spec);
node('build_reel.mjs', [W('build-spec.json')]);
copyFileSync(`${raw.replace(/\.mp4$/, '')}-editor.png`, `${base}-editor.png`);

// ---------------------------------------------------------------- audio
step('audio: music and loudness');
node('finish_audio.mjs', [raw, out, ...(job.music ? ['--music', rel(job.music), '--music-db', String(job.musicDb ?? -16)] : [])]);

// ---------------------------------------------------------------- cover
if (job.cover !== false) {
  step('cover');
  const c = job.cover ?? {};
  const at = c.at ?? Math.min(total - 0.1, (scenes.find((s) => s.type !== 'face')?.start ?? 1.5) / 2 || 1);
  const frame = W('cover-frame.jpg');
  run(FF, ['-v', 'error', '-y', '-ss', String(at), '-i', presenterVideo, '-frames:v', '1', '-q:v', '2', frame]);
  saveJson(W('cover-jobs.json'), { assets: [frame], renders: [{ composition: 'Cover', output: `${base}-cover.png`,
    props: { image: path.basename(frame), title: c.title ?? job.title ?? '', highlight: c.highlight ?? [], subtitle: c.subtitle ?? '', theme: c.theme ?? 'gold' } }] });
  node('render_motion.mjs', [W('cover-jobs.json')]);
}

// ---------------------------------------------------------------- checks
step('checks');
const info = probe(out);
const v = info.streams.find((s) => s.codec_type === 'video');
const a = info.streams.find((s) => s.codec_type === 'audio');
const final = Number(info.format.duration);
const problems = [];
if (!v || v.width !== 1080 || v.height !== 1920) problems.push(`video is ${v?.width}x${v?.height}, expected 1080x1920`);
if (!a) problems.push('no audio stream');
if (Math.abs(final - total) > 0.5) problems.push(`length ${final.toFixed(2)}s differs from the presenter's ${total.toFixed(2)}s`);
const vol = spawnSync(FF, ['-hide_banner', '-i', out, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const mean = Number(vol.match(/mean_volume: (-?[\d.]+)/)?.[1] ?? -99);
if (mean < -40) problems.push(`audio is nearly silent (mean ${mean} dB)`);
// One frame per scene (late in it, after count-ups land), plus the opening face.
const times = [Math.min(0.8, final / 2), ...scenes.filter((s) => s.region !== 'full' || s.end - s.start < total - 0.5).map((s) => s.start + Math.min(s.end - s.start - 0.1, Math.max(0.3, (s.end - s.start) * 0.7)))]
  .filter((t, i, all) => t < final && all.findIndex((x) => Math.abs(x - t) < 0.4) === i).slice(0, 8);
const tiles = times.map((t, i) => {
  const f = W(`check-${i}.png`);
  run(FF, ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', out, '-frames:v', '1', '-vf', 'scale=270:480', f]);
  return f;
});
run(FF, ['-v', 'error', '-y', ...tiles.flatMap((f) => ['-i', f]), '-filter_complex', tiles.length > 1 ? `hstack=inputs=${tiles.length}` : 'null', `${base}-grid.png`]);
const report = {
  output: out, seconds: +final.toFixed(2), size: `${v?.width}x${v?.height}`, meanVolumeDb: mean, problems, warnings,
  files: { cover: job.cover !== false ? `${base}-cover.png` : null, grid: `${base}-grid.png`, srt: `${base}.srt`, project: `${base}.clipcraft`, editor: `${base}-editor.png` },
  scenes: scenes.map((s) => ({ start: s.start, end: s.end, type: s.type, at: s.at, label: s.label ?? s.props?.title ?? s.composition, source: s.url ?? s.source })),
  gridTimes: times.map((t) => +t.toFixed(2)),
};
saveJson(`${base}-report.json`, report);
console.log(problems.length ? `PROBLEMS:\n  ${problems.join('\n  ')}` : `OK: ${report.size}, ${report.seconds}s, mean ${mean} dB`);
console.log(`-> ${out}\n-> ${base}-grid.png (frames at ${report.gridTimes.join(', ')}s)\n-> ${base}-report.json`);
process.exitCode = problems.length ? 1 : 0;
