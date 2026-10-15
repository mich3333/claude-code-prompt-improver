// Properties panel for the selected clip, text or music (or the project).

import { PRESETS } from '../shared/effects.js';
import {
  ASPECTS, clipDuration, effectiveTransition, formatTime, layoutClips, MIN_CLIP_DURATION,
  sourceTime, SPEEDS, totalDuration, TRANSITIONS,
} from '../shared/timeline.js';
import { el, icon, toast } from './dom.js';
import { FONTS, TEXT_STYLES } from './text-render.js';

const round = (x, d = 2) => Number(Number(x).toFixed(d));

export class Inspector {
  constructor(root, store, player, actions) {
    this.root = root;
    this.store = store;
    this.player = player;
    this.actions = actions;
    this.updaters = [];
    this.key = null;
  }

  // The live selected object (undo/redo replaces objects, so look it up).
  target() {
    return this.store.selected();
  }

  set(fn) {
    this.store.mutate(() => {
      const t = this.target();
      if (t) fn(t);
    });
  }

  commit() {
    this.store.commit();
  }

  render() {
    const sel = this.store.selection;
    const t = this.target();
    this.key = sel && t ? `${sel.type}:${sel.id ?? ''}` : 'project';
    this.updaters = [];
    let body;
    if (sel?.type === 'clip' && t) body = this.clipPanel(t);
    else if (sel?.type === 'text' && t) body = this.textPanel();
    else if (sel?.type === 'music' && t) body = this.musicPanel();
    else body = this.projectPanel();
    this.root.replaceChildren(body);
    this.refresh();
  }

  refresh() {
    const sel = this.store.selection;
    const key = sel && this.target() ? `${sel.type}:${sel.id ?? ''}` : 'project';
    if (key !== this.key) return this.render();
    for (const u of this.updaters) u();
    return undefined;
  }

  // ---- field builders -------------------------------------------------

  section(title, ...children) {
    return el('section', { class: 'insp-section' }, el('h3', {}, title), ...children);
  }

  row(label, control, extra) {
    return el('label', { class: 'insp-row' }, el('span', { class: 'insp-label' }, label), control, extra);
  }

  number(label, get, set, { min = 0, max = Infinity, step = 0.1, suffix = 's' } = {}) {
    const input = el('input', { type: 'number', min, max: Number.isFinite(max) ? max : null, step });
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) {
        this.set((t) => set(t, Math.min(max, Math.max(min, v))));
        this.commit();
      }
    });
    this.updaters.push(() => {
      const t = this.target();
      if (t && document.activeElement !== input) input.value = String(round(get(t)));
    });
    return this.row(label, input, el('span', { class: 'insp-suffix' }, suffix));
  }

  range(label, get, set, { min = 0, max = 100, step = 1, format = (v) => String(v) } = {}) {
    const input = el('input', { type: 'range', min, max, step });
    const out = el('span', { class: 'insp-value' });
    input.addEventListener('input', () => this.set((t) => set(t, Number(input.value))));
    input.addEventListener('change', () => this.commit());
    this.updaters.push(() => {
      const t = this.target();
      if (!t) return;
      const v = get(t);
      if (document.activeElement !== input) input.value = String(v);
      out.textContent = format(v);
    });
    return this.row(label, input, out);
  }

  select(label, options, get, set) {
    const input = el('select', {}, Object.entries(options).map(([v, text]) => el('option', { value: v }, text)));
    input.addEventListener('change', () => {
      this.set((t) => set(t, input.value));
      this.commit();
    });
    this.updaters.push(() => {
      const t = this.target();
      if (t) input.value = String(get(t));
    });
    return this.row(label, input);
  }

  segmented(options, get, set, cls = '') {
    const wrap = el('div', { class: `segmented ${cls}` });
    const buttons = Object.entries(options).map(([v, text]) => {
      const b = el('button', { type: 'button', 'data-value': v }, text);
      b.addEventListener('click', () => {
        this.set((t) => set(t, v));
        this.commit();
      });
      return b;
    });
    wrap.append(...buttons);
    this.updaters.push(() => {
      const t = this.target();
      if (!t) return;
      const cur = String(get(t));
      for (const b of buttons) b.classList.toggle('active', b.dataset.value === cur);
    });
    return wrap;
  }

  checkbox(label, get, set) {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => {
      this.set((t) => set(t, input.checked));
      this.commit();
    });
    this.updaters.push(() => {
      const t = this.target();
      if (t) input.checked = Boolean(get(t));
    });
    return el('label', { class: 'insp-check' }, input, el('span', {}, label));
  }

  color(label, get, set) {
    const input = el('input', { type: 'color' });
    input.addEventListener('input', () => this.set((t) => set(t, input.value)));
    input.addEventListener('change', () => this.commit());
    this.updaters.push(() => {
      const t = this.target();
      if (t && document.activeElement !== input) input.value = get(t);
    });
    return this.row(label, input);
  }

  live(fn, tag = 'div', cls = 'insp-note') {
    const node = el(tag, { class: cls });
    this.updaters.push(() => {
      const t = this.target();
      if (t) node.textContent = fn(t);
    });
    return node;
  }

  button(label, onClick, { iconName, cls = '' } = {}) {
    return el('button', { type: 'button', class: `btn ${cls}`, onclick: onClick }, iconName ? icon(iconName) : null, label);
  }

  // ---- panels -----------------------------------------------------------

  segOf(clip) {
    return layoutClips(this.store.project.clips).find((s) => s.clip.id === clip.id);
  }

  clipPanel(clip) {
    const isImage = clip.kind === 'image';
    const index = this.store.project.clips.findIndex((c) => c.id === clip.id);
    const info = isImage
      ? 'Photo'
      : `Video · ${clip.width}×${clip.height} · ${formatTime(clip.sourceDuration, true)}${clip.hasAudio ? '' : ' · no audio'}`;

    const setAtPlayhead = (which) => {
      const c = this.target();
      const seg = this.segOf(c);
      const t = this.player.time;
      if (!seg || t < seg.start || t > seg.end) {
        toast('Move the playhead over this clip first.', 'warn');
        return;
      }
      const src = sourceTime(seg, t);
      this.set((x) => {
        if (which === 'in') x.in = Math.min(src, x.out - MIN_CLIP_DURATION * x.speed);
        else x.out = Math.max(src, x.in + MIN_CLIP_DURATION * x.speed);
      });
      this.commit();
    };

    const sections = [
      el('div', { class: 'insp-title' }, el('strong', { dir: 'auto' }, clip.name), el('span', {}, info)),
      this.section(
        isImage ? 'Duration' : 'Trim',
        isImage
          ? this.number('Show for', (c) => c.out, (c, v) => { c.out = Math.max(MIN_CLIP_DURATION, v); }, { min: MIN_CLIP_DURATION, max: 600 })
          : [
              this.number('Start at', (c) => c.in, (c, v) => { c.in = Math.min(v, c.out - MIN_CLIP_DURATION); }, { max: clip.sourceDuration }),
              this.number('End at', (c) => c.out, (c, v) => { c.out = Math.max(v, c.in + MIN_CLIP_DURATION); }, { max: clip.sourceDuration }),
              el('div', { class: 'btn-row' },
                this.button('Set start at playhead', () => setAtPlayhead('in')),
                this.button('Set end at playhead', () => setAtPlayhead('out'))),
            ],
        this.live((c) => `On timeline: ${formatTime(clipDuration(c), true)}`),
      ),
    ];
    if (!isImage) {
      sections.push(this.section('Speed',
        this.segmented(Object.fromEntries(SPEEDS.map((s) => [s, `${s}×`])), (c) => c.speed, (c, v) => { c.speed = Number(v); }, 'wrap')));
    }
    sections.push(
      this.section('Framing',
        this.segmented({ contain: 'Fit (bars)', cover: 'Fill (crop)' }, (c) => c.fit, (c, v) => { c.fit = v; })),
      this.section('Color',
        this.segmented(Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, p.label])), (c) => c.filter, (c, v) => { c.filter = v; }, 'grid'),
        this.range('Brightness', (c) => c.brightness, (c, v) => { c.brightness = v; }, { min: 20, max: 200, format: (v) => `${v}%` }),
        this.range('Contrast', (c) => c.contrast, (c, v) => { c.contrast = v; }, { min: 20, max: 200, format: (v) => `${v}%` }),
        this.range('Saturation', (c) => c.saturation, (c, v) => { c.saturation = v; }, { min: 0, max: 250, format: (v) => `${v}%` }),
        el('div', { class: 'btn-row' }, this.button('Reset color', () => {
          this.set((c) => Object.assign(c, { filter: 'none', brightness: 100, contrast: 100, saturation: 100 }));
          this.commit();
        })),
      ),
    );
    if (!isImage) {
      sections.push(this.section('Audio',
        clip.hasAudio
          ? [
              this.range('Volume', (c) => Math.round(c.volume * 100), (c, v) => { c.volume = v / 100; }, { min: 0, max: 100, format: (v) => `${v}%` }),
              this.checkbox('Mute this clip', (c) => c.muted, (c, v) => { c.muted = v; }),
            ]
          : el('div', { class: 'insp-note' }, 'This clip has no audio track.')));
    }
    if (index > 0) {
      sections.push(this.section('Transition from previous clip',
        this.select('Effect', TRANSITIONS, (c) => c.transition.type, (c, v) => { c.transition = { ...c.transition, type: v }; }),
        this.range('Length', (c) => c.transition.duration, (c, v) => { c.transition = { ...c.transition, duration: v }; }, {
          min: 0.2, max: 3, step: 0.1, format: (v) => `${v.toFixed(1)}s`,
        }),
        this.live((c) => {
          const clips = this.store.project.clips;
          const i = clips.findIndex((x) => x.id === c.id);
          const eff = effectiveTransition(clips, i);
          if (c.transition.type === 'none') return 'Hard cut between clips.';
          return eff.duration < c.transition.duration - 1e-3
            ? `Shortened to ${eff.duration.toFixed(2)}s to fit the neighbouring clips.`
            : '';
        }),
      ));
    }
    sections.push(el('div', { class: 'btn-row actions' },
      this.button('Split at playhead', () => this.actions.split(), { iconName: 'split' }),
      this.button('Duplicate', () => this.actions.duplicate(), { iconName: 'copy' }),
      this.button('Delete', () => this.actions.remove(), { iconName: 'trash', cls: 'danger' })));
    return el('div', { class: 'insp' }, sections);
  }

  textPanel() {
    const area = el('textarea', { rows: 3, dir: 'auto', id: 'text-content', placeholder: 'Type your text…' });
    area.addEventListener('input', () => this.set((t) => { t.text = area.value; }));
    area.addEventListener('change', () => this.commit());
    area.addEventListener('blur', () => this.commit());
    this.updaters.push(() => {
      const t = this.target();
      if (t && document.activeElement !== area) area.value = t.text;
    });
    const place = (y) => () => {
      this.set((t) => { t.x = 0.5; t.y = y; });
      this.commit();
    };
    return el('div', { class: 'insp' },
      el('div', { class: 'insp-title' }, el('strong', {}, 'Text'), el('span', {}, 'Drag it on the preview to move it')),
      this.section('Content', area),
      this.section('Timing',
        this.number('Starts', (t) => t.start, (t, v) => { t.start = Math.min(v, t.end - 0.2); }),
        this.number('Ends', (t) => t.end, (t, v) => { t.end = Math.max(v, t.start + 0.2); }, { max: 36000 }),
        el('div', { class: 'btn-row' },
          this.button('Start at playhead', () => {
            const now = this.player.time;
            this.set((t) => { const len = t.end - t.start; t.start = now; t.end = now + len; });
            this.commit();
          }),
          this.button('End at playhead', () => {
            const now = this.player.time;
            this.set((t) => { if (now > t.start + 0.2) t.end = now; });
            this.commit();
          })),
        this.segmented({ none: 'No animation', fade: 'Fade in/out' }, (t) => t.animation, (t, v) => { t.animation = v; })),
      this.section('Look',
        this.select('Font', Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.label])), (t) => t.font, (t, v) => { t.font = v; }),
        this.range('Size', (t) => Math.round(t.size * 1000) / 10, (t, v) => { t.size = v / 100; }, { min: 2, max: 25, step: 0.5, format: (v) => `${v}%` }),
        this.color('Color', (t) => t.color, (t, v) => { t.color = v; }),
        this.checkbox('Bold', (t) => t.bold, (t, v) => { t.bold = v; }),
        this.segmented(TEXT_STYLES, (t) => t.style, (t, v) => { t.style = v; }),
        this.color('Box color', (t) => t.boxColor, (t, v) => { t.boxColor = v; })),
      this.section('Position',
        el('div', { class: 'btn-row' },
          this.button('Top', place(0.12)), this.button('Middle', place(0.5)), this.button('Bottom', place(0.85))),
        this.range('Horizontal', (t) => Math.round(t.x * 100), (t, v) => { t.x = v / 100; }, { format: (v) => `${v}%` }),
        this.range('Vertical', (t) => Math.round(t.y * 100), (t, v) => { t.y = v / 100; }, { format: (v) => `${v}%` })),
      el('div', { class: 'btn-row actions' },
        this.button('Duplicate', () => this.actions.duplicate(), { iconName: 'copy' }),
        this.button('Delete', () => this.actions.remove(), { iconName: 'trash', cls: 'danger' })),
    );
  }

  musicPanel() {
    return el('div', { class: 'insp' },
      el('div', { class: 'insp-title' }, el('strong', { dir: 'auto' }, this.target().name),
        this.live((m) => `Music · ${formatTime(m.sourceDuration)}`, 'span', '')),
      this.section('Mix',
        this.range('Volume', (m) => Math.round(m.volume * 100), (m, v) => { m.volume = v / 100; }, { format: (v) => `${v}%` }),
        this.checkbox('Loop until the video ends', (m) => m.loop, (m, v) => { m.loop = v; })),
      this.section('Timing',
        this.number('Starts on timeline at', (m) => m.start, (m, v) => { m.start = v; }, { max: 36000 }),
        this.number('Skip song intro', (m) => m.offset, (m, v) => { m.offset = Math.min(v, m.sourceDuration - 0.5); }, { max: 36000 }),
        this.range('Fade in', (m) => m.fadeIn, (m, v) => { m.fadeIn = v; }, { min: 0, max: 10, step: 0.5, format: (v) => `${v}s` }),
        this.range('Fade out', (m) => m.fadeOut, (m, v) => { m.fadeOut = v; }, { min: 0, max: 10, step: 0.5, format: (v) => `${v}s` })),
      el('div', { class: 'btn-row actions' },
        this.button('Replace…', () => this.actions.addMusic(), { iconName: 'music' }),
        this.button('Remove music', () => this.actions.remove(), { iconName: 'trash', cls: 'danger' })),
    );
  }

  projectPanel() {
    const { project } = this.store;
    const aspect = el('div', { class: 'segmented grid' }, Object.entries(ASPECTS).map(([k, a]) => {
      const b = el('button', { type: 'button', class: project.aspect === k ? 'active' : '' },
        el('span', { class: 'aspect-swatch', style: `aspect-ratio:${a.w}/${a.h}` }), a.label);
      b.addEventListener('click', () => {
        this.store.update((p) => { p.aspect = k; });
        this.render();
      });
      return b;
    }));
    const stats = el('div', { class: 'insp-note' });
    this.updaters.push(() => {
      const p = this.store.project;
      stats.textContent = `${p.clips.length} clip(s) · ${p.texts.length} text(s) · ${p.music ? 'music' : 'no music'} · ${formatTime(totalDuration(p), true)}`;
    });
    const keys = [
      ['Space', 'Play / pause'], ['S', 'Split clip at playhead'], ['T', 'Add text at playhead'],
      ['Delete', 'Remove selected'], ['← / →', 'Step one frame (Shift: 1 second)'], ['Home / End', 'Jump to start / end'],
      ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl + scroll', 'Zoom timeline'],
    ];
    return el('div', { class: 'insp' },
      el('div', { class: 'insp-title' }, el('strong', {}, 'Project'), stats),
      this.section('Frame size', aspect,
        el('div', { class: 'insp-note' }, 'You can also change this when exporting.')),
      this.section('Keyboard shortcuts',
        el('dl', { class: 'shortcuts' }, keys.map(([k, d]) => [el('dt', {}, el('kbd', {}, k)), el('dd', {}, d)]))),
      el('div', { class: 'insp-note' }, 'Select a clip, text or the music track to edit it.'),
    );
  }
}
