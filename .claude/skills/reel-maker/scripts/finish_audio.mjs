#!/usr/bin/env node
// Final audio pass for a reel: optional background music ducked under the voice,
// then two-pass loudness normalization to -14 LUFS integrated / -1.5 dBTP (the
// common target for Reels, TikTok and Shorts). The video stream is copied.
//
//   node finish_audio.mjs <in.mp4> <out.mp4> [--music bed.mp3] [--music-db -16]
//        [--lufs -14] [--tp -1.5]
//
// Prints the measured loudness before and after. Needs ffmpeg (or FFMPEG=...).

import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : d;
};
const music = opt('music', null);
const musicDb = Number(opt('music-db', -16));
const I = Number(opt('lufs', -14));
const TP = Number(opt('tp', -1.5));
const [input, output] = args;
if (!output) {
  console.error('usage: finish_audio.mjs <in.mp4> <out.mp4> [--music bed.mp3] [--music-db -16] [--lufs -14] [--tp -1.5]');
  process.exit(1);
}
const ff = process.env.FFMPEG || 'ffmpeg';

// The voice, with the music under it: the music loops to the video's length,
// sits musicDb below, and dips a further ~10 dB whenever the voice is speaking.
const mix = music
  ? `[1:a]volume=${musicDb}dB,aformat=sample_rates=48000:channel_layouts=stereo[m];` +
    '[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit[v][sc];' +
    '[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[d];' +
    '[v][d]amix=inputs=2:duration=first:normalize=0'
  : '[0:a]aformat=sample_rates=48000:channel_layouts=stereo';
const inputs = ['-i', input, ...(music ? ['-stream_loop', '-1', '-i', music] : [])];

function measure(extraFilter, files) {
  const r = spawnSync(ff, ['-hide_banner', '-nostats', ...files, '-filter_complex', `${extraFilter},loudnorm=I=${I}:TP=${TP}:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = r.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!m) throw new Error(`loudness measurement failed:\n${r.stderr.slice(-800)}`);
  return JSON.parse(m[0]);
}

const first = measure(mix, inputs);
console.log(`before: ${first.input_i} LUFS, true peak ${first.input_tp} dBTP`);
const norm = `loudnorm=I=${I}:TP=${TP}:LRA=11:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true`;
execFileSync(ff, [
  '-hide_banner', '-v', 'error', '-y', ...inputs,
  '-filter_complex', `${mix},${norm},aresample=48000[a]`,
  '-map', '0:v?', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', output,
], { stdio: 'inherit' });
const after = measure('[0:a]anull', ['-i', output]);
console.log(`after:  ${after.input_i} LUFS, true peak ${after.input_tp} dBTP -> ${output}`);
