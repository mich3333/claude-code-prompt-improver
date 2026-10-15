// Fills the static toolbar buttons with their icons.
import { icon } from './dom.js';

const map = {
  '#btn-undo': 'undo',
  '#btn-redo': 'redo',
  '#btn-start': 'start',
  '#btn-back': 'back',
  '#btn-play': 'play',
  '#btn-fwd': 'fwd',
  '#btn-end': 'end',
  '#btn-fit': 'fit',
  '#btn-bin-import': 'plus',
};
for (const [sel, name] of Object.entries(map)) document.querySelector(sel)?.prepend(icon(name));

const withIcon = { '#btn-import': 'film', '#btn-text': 'text', '#btn-music': 'music', '#btn-export': 'export', '#btn-split': 'split', '#btn-delete': 'trash' };
for (const [sel, name] of Object.entries(withIcon)) document.querySelector(sel)?.prepend(icon(name));
