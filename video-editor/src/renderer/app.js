// Editor bootstrap: wires the store, preview, timeline, inspector, media
// bin, toolbar, keyboard shortcuts and menu commands together.

import {
  createClip, createMusic, createProject, createText, formatTime, frameSize, layoutClips, newId,
  splitClipAt, totalDuration,
} from '../shared/timeline.js';
import { el, icon, isTyping, toast } from './dom.js';
import { ExportDialog } from './export-dialog.js';
import { Inspector } from './inspector.js';
import { Player } from './player.js';
import { Store } from './store.js';
import { TimelineView } from './timeline-view.js';

const $ = (sel) => document.querySelector(sel);

const store = new Store();
const player = new Player($('#preview'), store);
const exportDialog = new ExportDialog(store, player);

// ---------------------------------------------------------------- actions

const actions = {
  async importMedia() {
    const res = await window.api.importMedia('clips');
    addMediaItems(res);
  },

  async addMusic() {
    const res = await window.api.importMedia('music');
    reportErrors(res.errors);
    const item = res.items[0];
    if (!item) return;
    store.update((p) => {
      p.media.push({ ...item, id: newId('media') });
      p.music = createMusic(item);
    });
    store.select({ type: 'music' });
  },

  addText() {
    const total = totalDuration(store.project);
    const start = player.time < total - 0.2 ? player.time : 0;
    const text = createText(start, start + 3);
    store.update((p) => p.texts.push(text));
    store.select({ type: 'text', id: text.id });
    player.seek(Math.max(player.time, start));
    requestAnimationFrame(() => {
      const area = $('#text-content');
      area?.focus();
      area?.select();
    });
  },

  split() {
    const clips = splitClipAt(store.project.clips, player.time);
    if (!clips) {
      toast('Put the playhead inside a clip (not at its edge) to split it.', 'warn');
      return;
    }
    store.update((p) => { p.clips = clips; });
    const seg = layoutClips(clips).find((s) => player.time >= s.start && player.time < s.end);
    if (seg) store.select({ type: 'clip', id: seg.clip.id });
  },

  duplicate() {
    const sel = store.selection;
    if (sel?.type === 'clip') {
      const id = newId('clip');
      store.update((p) => {
        const i = p.clips.findIndex((c) => c.id === sel.id);
        if (i >= 0) p.clips.splice(i + 1, 0, { ...structuredClone(p.clips[i]), id });
      });
      store.select({ type: 'clip', id });
    } else if (sel?.type === 'text') {
      const id = newId('text');
      store.update((p) => {
        const t = p.texts.find((x) => x.id === sel.id);
        if (t) p.texts.push({ ...structuredClone(t), id, start: t.end, end: t.end + (t.end - t.start) });
      });
      store.select({ type: 'text', id });
    }
  },

  remove() {
    const sel = store.selection;
    if (!sel) return;
    store.update((p) => {
      if (sel.type === 'clip') p.clips = p.clips.filter((c) => c.id !== sel.id);
      if (sel.type === 'text') p.texts = p.texts.filter((t) => t.id !== sel.id);
      if (sel.type === 'music') p.music = null;
    });
    store.select(null);
  },

  undo() {
    if (isTyping()) document.execCommand('undo');
    else store.undo();
  },

  redo() {
    if (isTyping()) document.execCommand('redo');
    else store.redo();
  },

  confirmDiscard() {
    return !store.dirty || window.confirm('Discard unsaved changes?');
  },

  newProject() {
    if (!actions.confirmDiscard()) return;
    player.pause();
    store.load(createProject(), null);
    player.seek(0);
  },

  async open() {
    if (!actions.confirmDiscard()) return;
    const res = await window.api.openProject();
    if (!res) return;
    player.pause();
    store.load(res.project, res.filePath);
    player.seek(0);
    timeline.zoomToFit();
    if (res.missing.length) {
      toast(`Missing media (moved or deleted): ${res.missing.map((p) => p.split(/[\\/]/).pop()).join(', ')}`, 'error', 9000);
    }
  },

  async save(saveAs = false) {
    store.commit();
    const filePath = await window.api.saveProject({
      json: JSON.stringify(store.project, null, 2),
      filePath: store.filePath,
      saveAs,
    });
    if (filePath) {
      store.markSaved(filePath);
      toast('Project saved.', 'success', 2500);
    }
  },

  export() {
    if (!store.project.clips.length) {
      toast('Add at least one video or photo before exporting.', 'warn');
      return;
    }
    exportDialog.open();
  },

  shortcuts() {
    store.select(null);
  },
};

function reportErrors(errors) {
  if (errors?.length) toast(`Could not import: ${errors.join('; ')}`, 'error', 9000);
}

// Imported files go to the media bin; videos/photos are also appended to
// the timeline and audio becomes the music track.
function addMediaItems({ items, errors }, insertAt = null) {
  reportErrors(errors);
  if (!items.length) return;
  const wasEmpty = !store.project.clips.length;
  let lastClip = null;
  store.update((p) => {
    let at = insertAt ?? p.clips.length;
    for (const item of items) {
      p.media.push({ ...item, id: newId('media') });
      if (item.kind === 'audio') {
        p.music = createMusic(item);
      } else {
        lastClip = createClip(item);
        p.clips.splice(at, 0, lastClip);
        at += 1;
      }
    }
  });
  if (lastClip) store.select({ type: 'clip', id: lastClip.id });
  if (wasEmpty) {
    player.seek(0);
    requestAnimationFrame(() => timeline.zoomToFit());
  }
}

// --------------------------------------------------------------- media bin

function renderBin() {
  const list = $('#bin-list');
  const media = store.project.media ?? [];
  if (!media.length) {
    list.replaceChildren(el('div', { class: 'bin-empty' }, 'Imported videos, photos and music appear here.'));
    return;
  }
  list.replaceChildren(...media.map((m) => {
    const add = el('button', { class: 'icon-btn', type: 'button', title: m.kind === 'audio' ? 'Use as music' : 'Add to end of timeline' }, icon(m.kind === 'audio' ? 'music' : 'plus'));
    add.addEventListener('click', () => {
      if (m.kind === 'audio') {
        store.update((p) => { p.music = createMusic(m); });
        store.select({ type: 'music' });
      } else {
        const clip = createClip(m);
        store.update((p) => p.clips.push(clip));
        store.select({ type: 'clip', id: clip.id });
      }
    });
    const item = el('div', { class: `bin-item ${m.kind}`, draggable: m.kind !== 'audio' ? 'true' : null, title: m.path },
      el('div', { class: 'bin-thumb', style: m.thumbnail ? `background-image:url("${m.thumbnail}")` : '' }, m.kind === 'audio' ? icon('music') : null),
      el('div', { class: 'bin-meta' },
        el('div', { class: 'bin-name', dir: 'auto' }, m.name),
        el('div', { class: 'bin-sub' }, m.kind === 'image' ? 'Photo' : `${m.kind === 'audio' ? 'Audio' : 'Video'} · ${formatTime(m.duration)}`)),
      add);
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-clipcraft-media', m.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    return item;
  }));
}

// ---------------------------------------------------------------- timeline

const timeline = new TimelineView($('#timeline'), store, player, {
  onDropMedia(mediaId, index) {
    const m = store.project.media.find((x) => x.id === mediaId);
    if (!m || m.kind === 'audio') return;
    const clip = createClip(m);
    store.update((p) => p.clips.splice(index, 0, clip));
    store.select({ type: 'clip', id: clip.id });
  },
});

const inspector = new Inspector($('#inspector'), store, player, actions);

// ----------------------------------------------------------------- toolbar

function bindButton(id, fn) {
  $(id).addEventListener('click', fn);
}

bindButton('#btn-import', () => actions.importMedia());
bindButton('#btn-text', () => actions.addText());
bindButton('#btn-music', () => actions.addMusic());
bindButton('#btn-undo', () => store.undo());
bindButton('#btn-redo', () => store.redo());
bindButton('#btn-export', () => actions.export());
bindButton('#btn-split', () => actions.split());
bindButton('#btn-delete', () => actions.remove());
bindButton('#btn-fit', () => timeline.zoomToFit());
bindButton('#btn-play', () => player.toggle());
bindButton('#btn-start', () => { player.pause(); player.seek(0); });
bindButton('#btn-end', () => { player.pause(); player.seek(player.duration); });
bindButton('#btn-back', () => { player.pause(); player.seek(player.time - 1); });
bindButton('#btn-fwd', () => { player.pause(); player.seek(player.time + 1); });
bindButton('#btn-bin-import', () => actions.importMedia());

const aspectSelect = $('#aspect');
aspectSelect.addEventListener('change', () => store.update((p) => { p.aspect = aspectSelect.value; }));

function updateChrome() {
  const name = store.filePath ? store.filePath.split(/[\\/]/).pop().replace(/\.clipcraft$/i, '') : 'Untitled';
  document.title = `${name}${store.dirty ? ' •' : ''} — ClipCraft`;
  $('#project-name').textContent = `${name}${store.dirty ? ' •' : ''}`;
  $('#btn-undo').disabled = !store.past.length && store.committed === JSON.stringify(store.project);
  $('#btn-redo').disabled = !store.future.length;
  aspectSelect.value = store.project.aspect;
  const { width, height } = frameSize(store.project.aspect);
  $('#preview-wrap').style.setProperty('--ar', `${width} / ${height}`);
  $('#btn-split').disabled = !store.project.clips.length;
  $('#btn-delete').disabled = !store.selection;
  $('#btn-export').disabled = !store.project.clips.length;
  $('#empty-preview').hidden = store.project.clips.length > 0;
}

function updateTime(time, playing) {
  $('#time').textContent = `${formatTime(time, true)} / ${formatTime(player.duration, true)}`;
  const btn = $('#btn-play');
  btn.replaceChildren(icon(playing ? 'pause' : 'play'));
  btn.title = playing ? 'Pause (Space)' : 'Play (Space)';
  timeline.updatePlayhead();
}

player.onTime(updateTime);

store.subscribe((reason) => {
  if (reason === 'project') {
    player.sync();
    timeline.render();
    inspector.refresh();
    renderBin();
  } else if (reason === 'selection') {
    timeline.render();
    inspector.render();
    player.requestDraw();
  }
  updateChrome();
  updateTime(player.time, player.playing);
});

// ------------------------------------------------- preview: drag text items

const canvas = $('#preview');
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const hit = player.textAt((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  if (!hit) {
    player.toggle();
    return;
  }
  player.pause();
  store.select({ type: 'text', id: hit.id });
  const x0 = hit.x;
  const y0 = hit.y;
  const startX = e.clientX;
  const startY = e.clientY;
  const move = (ev) => store.mutate((p) => {
    const t = p.texts.find((x) => x.id === hit.id);
    if (!t) return;
    t.x = Math.min(1, Math.max(0, x0 + (ev.clientX - startX) / rect.width));
    t.y = Math.min(1, Math.max(0, y0 + (ev.clientY - startY) / rect.height));
  });
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    store.commit();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

// ---------------------------------------------------- drop files from the OS

window.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    document.body.classList.add('drop-target');
  }
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('drop-target');
});
window.addEventListener('drop', async (e) => {
  document.body.classList.remove('drop-target');
  if (!e.dataTransfer.files.length) return;
  e.preventDefault();
  const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean);
  if (!paths.length) return;
  addMediaItems(await window.api.probePaths(paths));
});

// ------------------------------------------------------------------ keyboard

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (exportDialog.overlay && !exportDialog.running) exportDialog.close();
    else if (isTyping()) document.activeElement.blur();
    else store.select(null);
    return;
  }
  if (isTyping() || exportDialog.overlay || e.ctrlKey || e.metaKey || e.altKey) return;
  const step = e.shiftKey ? 1 : 1 / 30;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      player.toggle();
      break;
    case 's':
    case 'S':
      actions.split();
      break;
    case 't':
    case 'T':
      e.preventDefault();
      actions.addText();
      break;
    case 'Delete':
    case 'Backspace':
      actions.remove();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      player.pause();
      player.seek(player.time - step);
      break;
    case 'ArrowRight':
      e.preventDefault();
      player.pause();
      player.seek(player.time + step);
      break;
    case 'Home':
      player.pause();
      player.seek(0);
      break;
    case 'End':
      player.pause();
      player.seek(player.duration);
      break;
    case '+':
    case '=':
      timeline.setZoom(timeline.pps * 1.25);
      break;
    case '-':
      timeline.setZoom(timeline.pps / 1.25);
      break;
    default:
  }
});

window.api.onMenuCommand((name) => {
  const map = {
    new: actions.newProject,
    open: actions.open,
    save: () => actions.save(false),
    saveAs: () => actions.save(true),
    import: actions.importMedia,
    music: actions.addMusic,
    export: actions.export,
    undo: actions.undo,
    redo: actions.redo,
    shortcuts: actions.shortcuts,
  };
  map[name]?.();
});

// Expose for automated UI tests.
window.clipcraft = { store, player, timeline, actions };

store.emit('project');
store.emit('selection');
