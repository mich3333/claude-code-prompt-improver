// Builds the FFmpeg command that renders a project to a video file.
// Pure: no filesystem or process access, so it is unit-testable.

import { clipOps, toFfmpegFilters } from './effects.js';
import { clipDuration, effectiveTransition, layoutClips, totalDuration } from './timeline.js';

const AUDIO_FMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
const TEXT_FADE = 0.4;

const num = (x) => Number(x.toFixed(4)).toString();

// FFmpeg's atempo accepts 0.5..2.0 per instance; chain for other speeds.
export function atempoChain(speed) {
  if (Math.abs(speed - 1) < 1e-6) return [];
  const parts = [];
  let s = speed;
  while (s > 2) {
    parts.push('atempo=2');
    s /= 2;
  }
  while (s < 0.5) {
    parts.push('atempo=0.5');
    s /= 0.5;
  }
  if (Math.abs(s - 1) > 1e-6) parts.push(`atempo=${num(s)}`);
  return parts;
}

export function textFadeDuration(text) {
  return text.animation === 'fade' ? Math.min(TEXT_FADE, (text.end - text.start) / 2) : 0;
}

/**
 * @param project  the editor project (clips, texts, music, aspect)
 * @param opts     { output, width, height, fps, crf, preset, textInputs }
 *                 textInputs: [{ path, start, end, fade }] full-frame RGBA PNGs
 *                 rendered by the editor, one per text item.
 * @returns { inputs, filter, outputArgs, duration }
 */
export function buildExport(project, opts) {
  const { width: W, height: H, fps = 30, crf = 20, preset = 'veryfast' } = opts;
  const clips = project.clips;
  if (!clips.length) throw new Error('ציר הזמן ריק.');

  const inputs = [];
  const chains = [];
  const total = totalDuration(project);

  clips.forEach((clip, i) => {
    const D = clipDuration(clip);
    if (clip.kind === 'image') {
      inputs.push('-loop', '1', '-framerate', String(fps), '-t', num(D + 0.5), '-i', clip.path);
    } else {
      inputs.push('-ss', num(clip.in), '-t', num(clip.out - clip.in), '-i', clip.path);
    }

    // Effects run before padding so letterbox bars stay black, as in the preview.
    const fit =
      clip.fit === 'cover'
        ? [`scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`, 'setsar=1', ...toFfmpegFilters(clipOps(clip))]
        : [
            `scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
            'setsar=1',
            ...toFfmpegFilters(clipOps(clip)),
            `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
          ];
    const speed = clip.kind === 'image' ? 1 : clip.speed;
    const v = [
      `setpts=(PTS-STARTPTS)/${num(speed)}`,
      `fps=${fps}`,
      ...fit,
      'format=yuv420p',
      `tpad=stop_mode=clone:stop_duration=${num(D)}`,
      `trim=duration=${num(D)}`,
      'setpts=PTS-STARTPTS',
      `fps=${fps}`, // setpts leaves the frame rate unset; xfade needs it
    ];
    chains.push(`[${i}:v]${v.join(',')}[v${i}]`);

    const volume = clip.muted ? 0 : clip.volume;
    if (clip.kind !== 'image' && clip.hasAudio && volume > 0) {
      const a = [
        'asetpts=PTS-STARTPTS',
        ...atempoChain(speed),
        `volume=${num(volume)}`,
        AUDIO_FMT,
        'apad',
        `atrim=duration=${num(D)}`,
        'asetpts=PTS-STARTPTS',
      ];
      chains.push(`[${i}:a]${a.join(',')}[a${i}]`);
    } else {
      chains.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${num(D)},${AUDIO_FMT}[a${i}]`);
    }
  });

  // Join clips one by one: xfade/acrossfade for transitions, concat for cuts.
  const layout = layoutClips(clips);
  let v = 'v0';
  let a = 'a0';
  for (let i = 1; i < clips.length; i++) {
    const t = effectiveTransition(clips, i);
    if (t.duration > 0) {
      const offset = layout[i].start; // when the incoming clip starts
      chains.push(`[${v}][v${i}]xfade=transition=${t.type}:duration=${num(t.duration)}:offset=${num(offset)}[xv${i}]`);
      chains.push(`[${a}][a${i}]acrossfade=d=${num(t.duration)}[xa${i}]`);
    } else {
      chains.push(`[${v}][${a}][v${i}][a${i}]concat=n=2:v=1:a=1[xv${i}][xa${i}]`);
    }
    v = `xv${i}`;
    a = `xa${i}`;
  }

  // Text overlays: pre-rendered transparent frames, shown between start/end.
  let nextInput = clips.length;
  (opts.textInputs ?? []).forEach((text, j) => {
    if (!(text.end > text.start) || text.start >= total) return;
    const end = Math.min(text.end, total);
    const idx = nextInput++;
    inputs.push('-loop', '1', '-framerate', String(fps), '-t', num(end + 0.1), '-i', text.path);
    const f = ['format=rgba'];
    const fade = Math.min(text.fade ?? 0, (end - text.start) / 2);
    if (fade > 0) {
      f.push(`fade=t=in:st=${num(text.start)}:d=${num(fade)}:alpha=1`);
      f.push(`fade=t=out:st=${num(end - fade)}:d=${num(fade)}:alpha=1`);
    }
    chains.push(`[${idx}:v]${f.join(',')}[t${j}]`);
    chains.push(`[${v}][t${j}]overlay=0:0:enable='between(t,${num(text.start)},${num(end)})':eof_action=pass[ov${j}]`);
    v = `ov${j}`;
  });

  // Background music, mixed under the clip audio.
  const m = project.music;
  if (m && m.start < total - 0.05) {
    const idx = nextInput++;
    if (m.loop) inputs.push('-stream_loop', '-1');
    inputs.push('-i', m.path);
    const len = total - m.start;
    const ma = [
      `atrim=start=${num(m.offset || 0)}`,
      'asetpts=PTS-STARTPTS',
      AUDIO_FMT,
      `volume=${num(m.volume)}`,
      `atrim=duration=${num(len)}`,
    ];
    if (m.fadeIn > 0) ma.push(`afade=t=in:st=0:d=${num(Math.min(m.fadeIn, len))}`);
    if (m.fadeOut > 0) {
      const d = Math.min(m.fadeOut, len);
      ma.push(`afade=t=out:st=${num(len - d)}:d=${num(d)}`);
    }
    if (m.start > 0) ma.push(`adelay=delays=${Math.round(m.start * 1000)}:all=1`);
    chains.push(`[${idx}:a]${ma.join(',')}[music]`);
    chains.push(`[${a}][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[amix]`);
    a = 'amix';
  }

  const outputArgs = [
    '-map', `[${v}]`,
    '-map', `[${a}]`,
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-movflags', '+faststart',
    '-t', num(total),
  ];

  return { inputs, filter: chains.join(';\n'), outputArgs, duration: total };
}
