// Animated data graphics in a black-and-gold style (big numbers, bar charts,
// a year timeline), made for the top half of a split screen. This module is
// the pure part: graphic types, defaults and the number/bar parsing. The
// canvas drawing lives in src/renderer/graphics.js.

import { frameSize } from './timeline.js';

export const GOLD = {
  bg: '#0a0908',
  gold: '#e2b54c',
  light: '#f7dc93',
  dark: '#a5761f',
  text: '#f4f1ea',
  muted: '#8c877c',
  red: '#ef4444',
};

export const GRAPHIC_FPS = 30;
export const GRAPHIC_DURATION = 4; // seconds on the timeline
export const GRAPHIC_ANIMATION = 1.8; // seconds of motion; the rest holds the last frame

export const GRAPHIC_TYPES = {
  number: {
    name: 'מספר גדול',
    description: 'מספר זהב שנספר כלפי מעלה, עם כותרת קטנה',
    defaults: { label: 'שווי החברה', value: '$2T', note: '', years: true, from: 2021, to: 2026, active: 2025 },
  },
  bars: {
    name: 'גרף עמודות',
    description: 'עמודות זהב שגדלות אחת אחרי השנייה',
    defaults: { label: 'הכנסות בשנה', values: '2023: 1\n2024: 4\n2025: 9\n2026: 20', prefix: '$', suffix: 'B', years: false, from: 2021, to: 2026, active: 2025 },
  },
  year: {
    name: 'ציר שנים',
    description: 'שנה גדולה וציר זמן עם נקודה זהובה',
    defaults: { label: 'הכול התחיל ב-', from: 2021, to: 2026, active: 2021, years: true },
  },
};

export function createGraphic(type) {
  const def = GRAPHIC_TYPES[type];
  if (!def) throw new Error(`Unknown graphic: ${type}`);
  return { type, ...def.defaults };
}

// Pixel size of a graphic: the top half of the project's frame at 1080p.
export function graphicSize(aspect) {
  const { width, height } = frameSize(aspect, 1080);
  return { width, height: Math.round(height / 4) * 2 };
}

// "$416B" -> { prefix: '$', number: 416, decimals: 0, suffix: 'B', grouped: false }
export function parseCountUp(value) {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/su.exec(String(value ?? '').trim());
  if (!m) return null;
  const digits = m[2].replace(/,/g, '');
  return {
    prefix: m[1],
    number: Number(digits),
    decimals: digits.includes('.') ? digits.split('.')[1].length : 0,
    suffix: m[3],
    grouped: m[2].includes(','),
  };
}

// The value shown at progress p (0..1) of the count-up.
export function formatCountUp(parsed, p) {
  const n = parsed.number * Math.min(1, Math.max(0, p));
  const fixed = n.toFixed(parsed.decimals);
  const [int, frac] = fixed.split('.');
  const intText = parsed.grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int;
  return `${parsed.prefix}${intText}${frac ? `.${frac}` : ''}${parsed.suffix}`;
}

// "2023: 1\n2024: 4" (or comma-separated) -> [{ label: '2023', value: 1 }, ...], at most 8.
export function parseBars(text) {
  return String(text ?? '')
    .split(/[\n,;]+/)
    .map((part) => /^\s*(.*?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(part))
    .filter(Boolean)
    .map((m) => ({ label: m[1], value: Math.max(0, Number(m[2])) }))
    .slice(0, 8);
}

// Years shown on the timeline strip (at most 8, oldest first).
export function yearRange(g) {
  const from = Math.round(Number(g.from) || 2021);
  const to = Math.max(from, Math.min(from + 7, Math.round(Number(g.to) || from)));
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export const easeOutCubic = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
