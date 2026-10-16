// Shared look for every composition. "gold" matches ClipCraft's black-and-gold
// graphics (src/shared/graphics.js GOLD); "light" is the white-card explainer
// style; "none" leaves the background transparent for an overlay layer.
import '@fontsource/rubik/hebrew-500.css';
import '@fontsource/rubik/hebrew-800.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/heebo/hebrew-900.css';
import '@fontsource/heebo/latin-900.css';

export const FPS = 30;
export const WIDTH = 1080;

export const THEMES = {
  gold: { bg: '#0a0908', text: '#f4f1ea', accent: '#e2b54c', accentLight: '#f7dc93', muted: '#8c877c', card: 'rgba(255,255,255,0.04)' },
  light: { bg: '#f4f1ea', text: '#141414', accent: '#d9472b', accentLight: '#f08a5d', muted: '#6b6b6b', card: '#ffffff' },
  none: { bg: 'transparent', text: '#ffffff', accent: '#ffd23f', accentLight: '#fff1b8', muted: '#e5e5e5', card: 'rgba(0,0,0,0.55)' },
};

export const theme = (name) => THEMES[name] ?? THEMES.gold;

export const FONT = 'Rubik, Heebo, Arial, sans-serif';
export const HEAVY = 'Heebo, Rubik, Arial, sans-serif';

// Height of a composition: the whole 9:16 frame, or the top half for a split screen.
export const heightFor = (region) => (region === 'top' ? 960 : 1920);

// Seconds -> frames, at least one frame.
export const frames = (s) => Math.max(1, Math.round(Number(s) * FPS));

// Latin/digit runs (numbers, years, $, %, brand names) keep their own order
// inside Hebrew text; <bdi> isolates them so "2,024%" never flips.
export function splitBidi(text) {
  return String(text).split(/([A-Za-z0-9$€₪%.,:+×\-/]+(?:\s+[A-Za-z0-9$€₪%.,:+×\-/]+)*)/).filter(Boolean);
}
