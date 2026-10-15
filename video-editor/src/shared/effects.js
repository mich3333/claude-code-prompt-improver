// Color effects shared by the live preview (CSS canvas filters) and the
// export (FFmpeg filters). Every op mirrors a CSS filter function exactly:
// matrix ops use the Filter Effects spec matrices, so the exported video
// looks the same as the preview.

export const PRESETS = {
  none: { label: 'None', ops: [] },
  bw: { label: 'Black & White', ops: [['grayscale', 1]] },
  sepia: { label: 'Sepia', ops: [['sepia', 1]] },
  vintage: { label: 'Vintage', ops: [['sepia', 0.45], ['contrast', 1.1], ['saturate', 0.85], ['brightness', 1.05]] },
  vivid: { label: 'Vivid', ops: [['saturate', 1.6], ['contrast', 1.12]] },
  dramatic: { label: 'Dramatic', ops: [['contrast', 1.4], ['saturate', 0.7], ['brightness', 0.95]] },
  faded: { label: 'Faded', ops: [['contrast', 0.85], ['brightness', 1.1], ['saturate', 0.8]] },
  cool: { label: 'Cool', ops: [['hue-rotate', 12], ['saturate', 1.1]] },
};

// Ops for a clip: its preset, then the manual adjustments
// (brightness/contrast/saturation are percentages where 100 = unchanged).
export function clipOps(clip) {
  const ops = [...(PRESETS[clip.filter]?.ops ?? [])];
  const adj = [
    ['brightness', (clip.brightness ?? 100) / 100],
    ['contrast', (clip.contrast ?? 100) / 100],
    ['saturate', (clip.saturation ?? 100) / 100],
  ];
  for (const [op, v] of adj) if (Math.abs(v - 1) > 1e-6) ops.push([op, v]);
  return ops;
}

export function toCssFilter(ops) {
  if (!ops.length) return 'none';
  return ops.map(([op, v]) => (op === 'hue-rotate' ? `hue-rotate(${v}deg)` : `${op}(${v})`)).join(' ');
}

function matrixFor(op, v) {
  if (op === 'grayscale') {
    const g = 1 - Math.min(1, v);
    return [
      [0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g],
      [0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g],
      [0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g],
    ];
  }
  if (op === 'sepia') {
    const g = 1 - Math.min(1, v);
    return [
      [0.393 + 0.607 * g, 0.769 - 0.769 * g, 0.189 - 0.189 * g],
      [0.349 - 0.349 * g, 0.686 + 0.314 * g, 0.168 - 0.168 * g],
      [0.272 - 0.272 * g, 0.534 - 0.534 * g, 0.131 + 0.869 * g],
    ];
  }
  if (op === 'saturate') {
    return [
      [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v],
      [0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v],
      [0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v],
    ];
  }
  if (op === 'hue-rotate') {
    const a = (v * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ];
  }
  return null;
}

const n = (x) => Number(x.toFixed(5));

// One FFmpeg filter per op, applied in order (FFmpeg clamps between steps,
// like CSS does between filter functions).
export function toFfmpegFilters(ops) {
  return ops.map(([op, v]) => {
    const m = matrixFor(op, v);
    if (m) {
      const names = ['r', 'g', 'b'];
      const parts = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) parts.push(`${names[row]}${names[col]}=${n(m[row][col])}`);
      }
      return `colorchannelmixer=${parts.join(':')}`;
    }
    if (op === 'brightness') {
      const e = `val*${n(v)}+0.5`; // +0.5: lutrgb truncates
      return `lutrgb=r=${e}:g=${e}:b=${e}`;
    }
    if (op === 'contrast') {
      const e = `val*${n(v)}+${n(127.5 * (1 - v) + 0.5)}`; // +0.5: lutrgb truncates
      return `lutrgb=r=${e}:g=${e}:b=${e}`;
    }
    throw new Error(`Unknown effect op: ${op}`);
  });
}
