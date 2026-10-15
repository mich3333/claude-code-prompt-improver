// Export dialog: output settings, progress, result.

import { ASPECTS, frameSize, formatTime, totalDuration } from '../shared/timeline.js';
import { textFadeDuration } from '../shared/ffmpeg.js';
import { el, icon } from './dom.js';
import { renderTextPng } from './text-render.js';

const RESOLUTIONS = { 720: '720p (HD)', 1080: '1080p (Full HD)', 1440: '1440p (2K)', 2160: '2160p (4K)' };
const FPS = { 24: '24 fps (film)', 25: '25 fps', 30: '30 fps', 60: '60 fps (smooth)' };
const QUALITY = { 18: 'High quality', 21: 'Standard', 26: 'Smaller file' };
const SETTINGS_KEY = 'clipcraft.export';

function loadSettings() {
  try {
    return { resolution: '1080', fps: '30', crf: '21', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { resolution: '1080', fps: '30', crf: '21' };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // settings are a convenience only
  }
}

export class ExportDialog {
  constructor(store, player) {
    this.store = store;
    this.player = player;
    this.overlay = null;
  }

  close() {
    this.overlay?.remove();
    this.overlay = null;
  }

  open() {
    if (this.overlay) return;
    this.player.pause();
    this.settings = loadSettings();
    this.overlay = el('div', { class: 'modal-overlay' });
    this.card = el('div', { class: 'modal', role: 'dialog', 'aria-label': 'Export video' });
    this.overlay.append(this.card);
    this.overlay.addEventListener('pointerdown', (e) => {
      if (e.target === this.overlay && !this.running) this.close();
    });
    document.body.append(this.overlay);
    this.showSettings();
  }

  field(label, options, value, onChange) {
    const select = el('select', {}, Object.entries(options).map(([v, t]) => el('option', { value: v }, t)));
    select.value = value;
    select.addEventListener('change', () => onChange(select.value));
    return el('label', { class: 'modal-field' }, el('span', {}, label), select);
  }

  showSettings() {
    const { project } = this.store;
    const size = el('div', { class: 'modal-size' });
    const updateSize = () => {
      const { width, height } = frameSize(this.store.project.aspect, Number(this.settings.resolution));
      size.textContent = `${width} × ${height} · ${formatTime(totalDuration(this.store.project), true)} · MP4 (H.264 + AAC)`;
    };
    const aspectOptions = Object.fromEntries(Object.entries(ASPECTS).map(([k, a]) => [k, a.label]));
    this.card.replaceChildren(
      el('h2', {}, 'Export video'),
      this.field('Frame', aspectOptions, project.aspect, (v) => {
        this.store.update((p) => { p.aspect = v; });
        updateSize();
      }),
      this.field('Resolution', RESOLUTIONS, this.settings.resolution, (v) => {
        this.settings.resolution = v;
        updateSize();
      }),
      this.field('Frame rate', FPS, this.settings.fps, (v) => { this.settings.fps = v; }),
      this.field('Quality', QUALITY, this.settings.crf, (v) => { this.settings.crf = v; }),
      size,
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', type: 'button', onclick: () => this.close() }, 'Cancel'),
        el('button', { class: 'btn primary', type: 'button', id: 'export-go', onclick: () => this.start() }, icon('export'), 'Export…')),
    );
    updateSize();
  }

  async start() {
    saveSettings(this.settings);
    const base = (this.store.filePath?.split(/[\\/]/).pop() ?? 'My video').replace(/\.clipcraft$/i, '');
    const output = await window.api.chooseExportPath(`${base}.mp4`);
    if (!output) return;

    const { width, height } = frameSize(this.store.project.aspect, Number(this.settings.resolution));
    const project = JSON.parse(JSON.stringify(this.store.project));
    delete project.media;
    for (const c of project.clips) delete c.thumbnail;

    const bar = el('div', { class: 'progress-fill' });
    const label = el('div', { class: 'progress-label' }, 'Preparing…');
    const cancel = el('button', { class: 'btn', type: 'button', onclick: () => window.api.cancelExport() }, 'Cancel');
    this.card.replaceChildren(
      el('h2', {}, 'Exporting…'),
      el('div', { class: 'modal-size', dir: 'auto' }, output),
      el('div', { class: 'progress' }, bar),
      label,
      el('div', { class: 'modal-actions' }, cancel),
    );

    this.running = true;
    const started = performance.now();
    const off = window.api.onExportProgress((p) => {
      bar.style.width = `${(p * 100).toFixed(1)}%`;
      const elapsed = (performance.now() - started) / 1000;
      const eta = p > 0.02 ? (elapsed / p) * (1 - p) : null;
      label.textContent = `${Math.floor(p * 100)}%${eta != null ? ` · about ${formatTime(eta)} left` : ''}`;
    });

    let result;
    try {
      const texts = [];
      for (const t of project.texts) {
        if (!t.text?.trim() || !(t.end > t.start)) continue;
        texts.push({ png: await renderTextPng(t, width, height), start: t.start, end: t.end, fade: textFadeDuration(t) });
      }
      label.textContent = 'Rendering…';
      result = await window.api.startExport({
        project,
        opts: { output, width, height, fps: Number(this.settings.fps), crf: Number(this.settings.crf), preset: 'veryfast' },
        texts,
      });
    } catch (e) {
      result = { ok: false, error: e.message };
    } finally {
      off();
      this.running = false;
    }
    this.showResult(result, output, (performance.now() - started) / 1000);
  }

  showResult(result, output, seconds) {
    const done = el('button', { class: 'btn', type: 'button', onclick: () => this.close() }, 'Close');
    if (result.ok) {
      this.card.replaceChildren(
        el('h2', {}, 'Export complete'),
        el('p', { class: 'modal-size', dir: 'auto' }, `Saved to ${output} in ${formatTime(seconds)}.`),
        el('div', { class: 'modal-actions' },
          done,
          el('button', { class: 'btn primary', type: 'button', onclick: () => window.api.showInFolder(output) }, 'Show in folder')),
      );
    } else if (result.cancelled) {
      this.close();
    } else {
      this.card.replaceChildren(
        el('h2', {}, 'Export failed'),
        el('pre', { class: 'modal-error' }, result.error || 'Unknown error'),
        el('div', { class: 'modal-actions' }, done),
      );
    }
  }
}
