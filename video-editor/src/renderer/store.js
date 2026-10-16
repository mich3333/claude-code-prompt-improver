// Editor state: the project (saved, undoable) plus UI state (selection,
// playhead, zoom). Listeners are notified after every change.

import { createProject, mediaUrl } from '../shared/timeline.js';

const HISTORY_LIMIT = 150;

export class Store {
  constructor() {
    this.project = createProject();
    this.project.media = [];
    this.selection = null; // { type: 'clip' | 'overlay' | 'text' | 'music', id }
    this.filePath = null;
    this.listeners = new Set();
    this.version = 0; // bumps on every change (for React)
    this.resetHistory();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason = 'project') {
    this.version += 1;
    for (const fn of this.listeners) fn(reason);
  }

  resetHistory() {
    this.past = [];
    this.future = [];
    this.committed = JSON.stringify(this.project);
    this.savedSnapshot = this.committed;
    this.syncDirty();
  }

  get dirty() {
    return this.committed !== this.savedSnapshot;
  }

  syncDirty() {
    const d = this.dirty;
    if (d !== this.lastDirty) {
      this.lastDirty = d;
      window.api?.setDirty(d);
    }
  }

  // Live change without an undo step (e.g. while dragging a slider).
  mutate(fn) {
    fn(this.project);
    this.emit('project');
  }

  // Record the current project as one undo step if it changed.
  commit() {
    const snap = JSON.stringify(this.project);
    if (snap === this.committed) return;
    this.past.push(this.committed);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.committed = snap;
    this.syncDirty();
    this.emit('history');
  }

  update(fn) {
    this.mutate(fn);
    this.commit();
  }

  undo() {
    this.commit();
    if (!this.past.length) return;
    this.future.push(this.committed);
    this.restore(this.past.pop());
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(this.committed);
    this.restore(this.future.pop());
  }

  restore(snap) {
    this.committed = snap;
    this.project = JSON.parse(snap);
    if (this.selection && !this.selected()) this.selection = null;
    this.syncDirty();
    this.emit('project');
    this.emit('history');
  }

  load(project, filePath) {
    this.project = { media: [], texts: [], clips: [], overlays: [], music: null, ...project };
    // URLs are derived from paths (older project files stored file:// URLs).
    for (const item of [...this.project.clips, ...this.project.overlays, ...this.project.media, this.project.music]) {
      if (item?.path) item.url = mediaUrl(item.path);
    }
    this.filePath = filePath;
    this.selection = null;
    this.resetHistory();
    this.emit('project');
    this.emit('selection');
  }

  markSaved(filePath) {
    this.filePath = filePath;
    this.savedSnapshot = this.committed;
    this.syncDirty();
    this.emit('history');
  }

  select(selection) {
    this.selection = selection;
    this.emit('selection');
  }

  selected() {
    const s = this.selection;
    if (!s) return null;
    if (s.type === 'clip') return this.project.clips.find((c) => c.id === s.id) ?? null;
    if (s.type === 'overlay') return this.project.overlays.find((o) => o.id === s.id) ?? null;
    if (s.type === 'text') return this.project.texts.find((t) => t.id === s.id) ?? null;
    if (s.type === 'music') return this.project.music;
    return null;
  }
}
