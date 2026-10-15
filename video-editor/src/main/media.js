// FFmpeg/FFprobe process helpers for the main process (and tests).

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_EXTENSIONS, mediaUrl } from '../shared/timeline.js';
import { buildExport } from '../shared/ffmpeg.js';

const require = createRequire(import.meta.url);

// Inside a packaged app the binaries live in app.asar.unpacked.
function unpacked(p) {
  return p ? p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`) : p;
}

function resolveBinary(envVar, load, fallback) {
  if (process.env[envVar]) return process.env[envVar];
  try {
    const p = unpacked(load());
    if (p && existsSync(p)) return p;
  } catch {
    // fall through to PATH
  }
  return fallback;
}

export const ffmpegPath = () => resolveBinary('FFMPEG_PATH', () => require('ffmpeg-static'), 'ffmpeg');
export const ffprobePath = () => resolveBinary('FFPROBE_PATH', () => require('ffprobe-static').path, 'ffprobe');

function run(bin, args, { onStdout, signal } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    const out = [];
    let err = '';
    proc.stdout.on('data', (d) => (onStdout ? onStdout(d.toString()) : out.push(d)));
    proc.stderr.on('data', (d) => {
      err = (err + d.toString()).slice(-20000);
    });
    const abort = () => proc.kill('SIGKILL');
    signal?.addEventListener('abort', abort, { once: true });
    proc.on('error', (e) => reject(new Error(`Could not start ${path.basename(bin)}: ${e.message}`)));
    proc.on('close', (code) => {
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) return reject(Object.assign(new Error('Export cancelled'), { cancelled: true }));
      if (code === 0) return resolve(Buffer.concat(out));
      const lines = err.trim().split('\n').slice(-8).join('\n');
      reject(new Error(`${path.basename(bin)} failed (code ${code}):\n${lines}`));
    });
  });
}

export function mediaKind(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'av';
}

async function thumbnail(file, seek) {
  try {
    const buf = await run(ffmpegPath(), [
      '-v', 'error', '-ss', String(seek), '-i', file, '-frames:v', '1',
      '-vf', 'scale=192:-2', '-f', 'image2pipe', '-c:v', 'mjpeg', '-q:v', '5', 'pipe:1',
    ]);
    return buf.length ? `data:image/jpeg;base64,${buf.toString('base64')}` : null;
  } catch {
    return null;
  }
}

// Metadata the editor needs for an imported file.
export async function probe(file) {
  const raw = await run(ffprobePath(), [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]);
  const info = JSON.parse(raw.toString());
  const streams = info.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const duration = Number(info.format?.duration) || 0;
  const isImage = mediaKind(file) === 'image';
  let kind = 'video';
  if (isImage) kind = 'image';
  else if (!video || video.disposition?.attached_pic) kind = 'audio';
  if (kind !== 'audio' && !video) throw new Error('No video or image stream found.');
  if (kind !== 'image' && !(duration > 0)) throw new Error('Could not read the media duration.');
  const rotated = Math.abs(Number(video?.side_data_list?.find((d) => d.rotation != null)?.rotation ?? video?.tags?.rotate ?? 0)) % 180 === 90;
  return {
    path: file,
    url: mediaUrl(file),
    name: path.basename(file),
    kind,
    duration,
    hasAudio: Boolean(audio),
    width: video ? (rotated ? video.height : video.width) : null,
    height: video ? (rotated ? video.width : video.height) : null,
    thumbnail: kind === 'audio' ? null : await thumbnail(file, kind === 'image' ? 0 : Math.min(1, duration / 3)),
  };
}

/**
 * Render a project. `texts` are { png: Buffer, start, end, fade } items.
 * Calls onProgress(0..1). Rejects with { cancelled: true } on abort.
 */
export async function exportProject(project, opts, { tmpDir, texts = [], onProgress, signal }) {
  const textInputs = [];
  for (let i = 0; i < texts.length; i++) {
    const p = path.join(tmpDir, `text_${i}.png`);
    await writeFile(p, texts[i].png);
    textInputs.push({ path: p, start: texts[i].start, end: texts[i].end, fade: texts[i].fade });
  }
  const { inputs, filter, outputArgs, duration } = buildExport(project, { ...opts, textInputs });
  const filterFile = path.join(tmpDir, 'filter.txt');
  await writeFile(filterFile, filter);
  const args = [
    '-hide_banner', '-v', 'error', '-y',
    ...inputs,
    '-filter_complex_script', filterFile,
    ...outputArgs,
    '-progress', 'pipe:1', '-nostats',
    opts.output,
  ];
  let buffer = '';
  await run(ffmpegPath(), args, {
    signal,
    onStdout: (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
        if (m && duration > 0) onProgress?.(Math.min(1, Number(m[1]) / 1e6 / duration));
      }
    },
  });
  onProgress?.(1);
  return { output: opts.output, duration };
}
