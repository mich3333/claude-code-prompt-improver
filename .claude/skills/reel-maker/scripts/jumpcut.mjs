#!/usr/bin/env node
// Jump cuts from word timings: removes pauses longer than --gap and hesitation
// sounds (אממ, אה, ...), re-encodes the kept parts back to back, and writes the
// word timings moved onto the new timeline next to the output.
//
//   node jumpcut.mjs <in.mp4|in.wav> <words.json> <out.mp4> [--gap 0.35] [--pad 0.08]
//        [--no-fillers] [--extra כאילו,בעצם] [--dry-run]
//
// Writes <out>.words.json (the remapped words) and prints what was cut.
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeWords, planCuts, remapWords } from './lib/words.mjs';

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : d;
};
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Boolean(args.splice(i, 1)) : false;
};
const gap = Number(opt('gap', 0.35));
const pad = Number(opt('pad', 0.08));
const extra = String(opt('extra', '')).split(',').filter(Boolean);
const noFillers = flag('no-fillers');
const dry = flag('dry-run');
const [input, wordsPath, output] = args;
if (!output) {
  console.error('usage: jumpcut.mjs <in> <words.json> <out.mp4> [--gap 0.35] [--pad 0.08] [--no-fillers] [--extra a,b] [--dry-run]');
  process.exit(1);
}
const ff = process.env.FFMPEG || 'ffmpeg';
const ffprobe = process.env.FFPROBE || ff.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');

const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input]).toString());
const duration = Number(probe.format.duration);
const hasVideo = probe.streams.some((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
const words = normalizeWords(JSON.parse(readFileSync(wordsPath, 'utf8')));
const segs = planCuts(words, { duration, maxGap: gap, pad, fillers: !noFillers, extraFillers: extra });
const kept = segs.reduce((s, x) => s + x.end - x.start, 0);
console.log(`keeping ${segs.length} parts: ${duration.toFixed(2)}s -> ${kept.toFixed(2)}s (cut ${(duration - kept).toFixed(2)}s)`);
for (const s of segs) console.log(`  ${s.start.toFixed(2)}–${s.end.toFixed(2)}`);

const remapped = remapWords(words, segs);
const dropped = words.length - remapped.length;
if (dropped) console.log(`dropped words: ${words.filter((w) => !segs.some((s) => w.start >= s.start - 1e-6 && w.end <= s.end + 1e-6)).map((w) => w.text).join(', ')}`);
if (dry) process.exit(0);

// trim/atrim each kept part, then concat: frame-accurate (a stream copy would cut on keyframes).
const parts = segs.map((s, i) => [
  ...(hasVideo ? [`[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS[v${i}]`] : []),
  `[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, s.end - s.start - 0.01).toFixed(3)}:d=0.01[a${i}]`,
]).flat();
const ins = segs.map((_, i) => `${hasVideo ? `[v${i}]` : ''}[a${i}]`).join('');
const graph = `${parts.join(';')};${ins}concat=n=${segs.length}:v=${hasVideo ? 1 : 0}:a=1${hasVideo ? '[v]' : ''}[a]`;
execFileSync(ff, [
  '-hide_banner', '-v', 'error', '-y', '-i', input, '-filter_complex', graph,
  ...(hasVideo ? ['-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'] : []),
  '-map', '[a]', '-c:a', /\.(wav)$/i.test(output) ? 'pcm_s16le' : 'aac', ...(/\.(wav)$/i.test(output) ? [] : ['-b:a', '192k']),
  ...(/\.(mp4|mov|m4a)$/i.test(output) ? ['-movflags', '+faststart'] : []), output,
], { stdio: 'inherit' });
const wordsOut = `${output.replace(/\.[^.]+$/, '')}.words.json`;
writeFileSync(wordsOut, `${JSON.stringify(remapped, null, 1)}\n`);
console.log(`-> ${output}\n-> ${wordsOut} (${remapped.length} words)`);
