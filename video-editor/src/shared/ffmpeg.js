// Builds the FFmpeg command that renders a project to a video file.
// Pure: no filesystem or process access, so it is unit-testable.

import { clipOps, toFfmpegFilters } from './effects.js';
import {
  clipDuration, effectiveTransition, layoutClips, OVERLAY_FADE, overlayDuration, overlayRect, totalDuration,
} from './timeline.js';

const AUDIO_FMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
const TEXT_FADE = 0.4;
// "rise" text: moves up into place over RISE_DURATION with an ease-out cubic,
// starting RISE_DISTANCE (fraction of frame height) below its final spot.
export const RISE_DURATION = 0.6;
export const RISE_DISTANCE = 0.035;

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
  return text.animation === 'fade' || text.animation === 'rise' ? Math.min(TEXT_FADE, (text.end - text.start) / 2) : 0;
}

// How far below its resting place a text is drawn at time t (fraction of H).
export function textRiseOffset(text, t) {
  if (text.animation !== 'rise') return 0;
  const p = Math.min(1, Math.max(0, (t - text.start) / RISE_DURATION));
  return RISE_DISTANCE * (1 - p) ** 3;
}

const hexColor = (c) => `0x${String(c || '#000000').replace('#', '').slice(0, 6)}`;

/**
 * @param project  the editor project (clips, texts, music, aspect)
 * @param opts     { output, width, height, fps, crf, preset, textInputs }
 *                 textInputs: [{ path, start, end, fade }] full-frame RGBA PNGs
 *                 rendered by the editor, one per text item.
 * @returns { inputs, filter, outputArgs, duration }
 */
// Greedy packing of non-overlapping texts into lanes (sorted by start).
export function textLanes(texts, total = Infinity) {
  const lanes = [];
  for (const t of [...texts].sort((a, b) => a.start - b.start)) {
    const item = { ...t, end: Math.min(t.end, total) };
    const lane = lanes.find((l) => l.at(-1).end <= item.start + 1e-6);
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

const joinPath = (dir, name) => `${dir.replace(/[\\/]+$/, '')}/${name}`;
const quoteConcat = (p) => `'${String(p).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;

// ffconcat list: transparent gaps between texts, each text for its duration.
export function laneList(lane, blankPath, fps = 30) {
  const lines = ['ffconcat version 1.0'];
  const entry = (file, d) => lines.push(`file ${quoteConcat(file)}`, `duration ${num(d)}`);
  let cursor = 0;
  for (const t of lane) {
    if (t.start > cursor + 1e-4) entry(blankPath, t.start - cursor);
    entry(t.path, t.end - Math.max(cursor, t.start));
    cursor = Math.max(cursor, t.end);
  }
  entry(blankPath, 1 / fps);
  // The concat demuxer ignores the last entry's duration unless the file is listed again.
  lines.push(`file ${quoteConcat(blankPath)}`);
  return `${lines.join('\n')}\n`;
}

export function buildExport(project, opts) {
  const { width: W, height: H, fps = 30, crf = 20, preset = 'veryfast' } = opts;
  const clips = project.clips;
  if (!clips.length) throw new Error('ציר הזמן ריק.');

  const inputs = [];
  const chains = [];
  const total = totalDuration(project);

  clips.forEach((clip, i) => {
    const D = clipDuration(clip);
    if (clip.kind === 'card') {
      inputs.push('-f', 'lavfi', '-t', num(D + 0.5), '-i', `color=c=${hexColor(clip.color)}:s=${W}x${H}:r=${fps}`);
    } else if (clip.kind === 'image') {
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
    const speed = clip.kind === 'video' ? clip.speed : 1;
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
    if (clip.kind === 'video' && clip.hasAudio && volume > 0) {
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

  let nextInput = clips.length;
  const extraAudio = []; // labels mixed under the main audio at the end

  // Overlay layer (split screen): above the clips, below the texts.
  (project.overlays ?? []).forEach((o, j) => {
    if (o.start >= total - 0.05) return;
    const D = Math.min(overlayDuration(o), total - o.start);
    const idx = nextInput++;
    if (o.kind === 'image') {
      inputs.push('-loop', '1', '-framerate', String(fps), '-t', num(D + 0.5), '-i', o.path);
    } else {
      inputs.push(...(o.alphaDecoder ? ['-c:v', o.alphaDecoder] : []), '-ss', num(o.in), '-t', num(D), '-i', o.path);
    }
    const r = overlayRect(o, W, H);
    const fit =
      o.fit === 'contain'
        ? [`scale=${r.w}:${r.h}:force_original_aspect_ratio=decrease:force_divisible_by=2`, `pad=${r.w}:${r.h}:(ow-iw)/2:(oh-ih)/2:color=black`]
        : [`scale=${r.w}:${r.h}:force_original_aspect_ratio=increase`, `crop=${r.w}:${r.h}`];
    const f = [
      'setpts=PTS-STARTPTS',
      `fps=${fps}`,
      ...fit,
      'setsar=1',
      'format=rgba',
      `tpad=stop_mode=clone:stop_duration=${num(D)}`,
      `trim=duration=${num(D)}`,
      'setpts=PTS-STARTPTS',
    ];
    chains.push(`[${idx}:v]${f.join(',')}[ol${j}]`);
    let src = `ol${j}`;
    // A layer with its own alpha keeps it (the soft edge mask would replace it).
    if (r.edge && r.feather > 0 && !o.alphaDecoder) {
      // Gradient alpha mask, computed once and looped: opaque inside the
      // region, fading to transparent across the edge facing the other half.
      const ramp = r.edge === 'bottom' ? `(${r.h - 1}-Y)/${r.feather}` : `Y/${r.feather}`;
      chains.push(
        `color=c=white:s=${r.w}x${r.h}:r=${fps},format=gray,geq=lum='255*clip(${ramp}\\,0\\,1)',trim=end_frame=1,loop=loop=-1:size=1[olm${j}]`,
      );
      chains.push(`[${src}][olm${j}]alphamerge[olf${j}]`);
      src = `olf${j}`;
    }
    const post = [];
    if (o.fade) {
      const fd = Math.min(OVERLAY_FADE, D / 2);
      post.push(`fade=t=in:st=0:d=${num(fd)}:alpha=1`, `fade=t=out:st=${num(D - fd)}:d=${num(fd)}:alpha=1`);
    }
    post.push(`setpts=PTS+${num(o.start)}/TB`);
    chains.push(`[${src}]${post.join(',')}[olt${j}]`);
    chains.push(`[${v}][olt${j}]overlay=x=${r.x}:y=${r.y}:enable='between(t,${num(o.start)},${num(o.start + D)})':eof_action=pass[olv${j}]`);
    v = `olv${j}`;

    if (o.kind === 'video' && o.hasAudio && !o.muted && o.volume > 0) {
      chains.push(`[${idx}:a]asetpts=PTS-STARTPTS,volume=${num(o.volume)},${AUDIO_FMT},apad,atrim=duration=${num(D)},adelay=delays=${Math.round(o.start * 1000)}:all=1[ola${j}]`);
      extraAudio.push(`ola${j}`);
    }
  });

  // Text overlays: pre-rendered transparent frames, shown between start/end.
  // Still texts (no fade or rise, e.g. captions) are packed into "lanes" of
  // non-overlapping texts, each played as one concat input; animated texts
  // get an input each.
  const files = [];
  const visible = (opts.textInputs ?? []).filter((t) => t.end > t.start && t.start < total);
  const still = opts.blankPath ? visible.filter((t) => !(t.fade > 0) && !t.rise) : [];
  textLanes(still, total).forEach((lane, k) => {
    const listPath = joinPath(opts.workDir ?? '.', `text_lane_${k}.ffconcat`);
    files.push({ path: listPath, content: laneList(lane, opts.blankPath, fps) });
    const idx = nextInput++;
    inputs.push('-f', 'concat', '-safe', '0', '-i', listPath);
    chains.push(`[${idx}:v]fps=${fps},format=rgba[tl${k}]`);
    chains.push(`[${v}][tl${k}]overlay=x=0:y=0:eof_action=pass[ovl${k}]`);
    v = `ovl${k}`;
  });
  visible.filter((t) => !still.includes(t)).forEach((text, j) => {
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
    // Same ease-out curve as textRiseOffset(), evaluated per frame.
    const y = text.rise
      ? `y='${num(RISE_DISTANCE * H)}*pow(1-min(max((t-${num(text.start)})/${RISE_DURATION},0),1),3)':eval=frame`
      : 'y=0';
    chains.push(`[${v}][t${j}]overlay=x=0:${y}:enable='between(t,${num(text.start)},${num(end)})':eof_action=pass[ov${j}]`);
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
    extraAudio.push('music');
  }

  if (extraAudio.length) {
    const ins = [a, ...extraAudio].map((l) => `[${l}]`).join('');
    chains.push(`${ins}amix=inputs=${extraAudio.length + 1}:duration=first:dropout_transition=0:normalize=0[amix]`);
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

  return { inputs, filter: chains.join(';\n'), outputArgs, duration: total, files };
}
