// Editor commands shared by the toolbar, menus, keyboard and panels.

import {
  createClip, createMusic, createOverlay, createProject, createText, layoutClips, newId, overlayDuration, splitClipAt,
  totalDuration,
} from '../shared/timeline.js';
import { applyTemplate, TEMPLATES } from '../shared/templates.js';
import { CAPTION_LOOKS } from '../shared/captions.js';
import { createGraphic, GRAPHIC_TYPES } from '../shared/graphics.js';
import { renderGraphicVideo } from './graphics.js';
import { isTyping, player, store, timelineApi, ui } from './state.js';
import { toast } from './toast.js';

function reportErrors(errors) {
  if (errors?.length) toast(`לא ניתן לייבא: ${errors.join('; ')}`, 'error', 9000);
}

// Imported files go to the media bin; videos/photos are also added to the
// timeline and audio becomes the music track.
export function addMediaItems({ items, errors }, insertAt = null) {
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
    requestAnimationFrame(() => timelineApi.zoomToFit());
  }
}

export function addMediaToTimeline(media, index = store.project.clips.length) {
  if (media.kind === 'audio') {
    store.update((p) => { p.music = createMusic(media); });
    store.select({ type: 'music' });
    return;
  }
  const clip = createClip(media);
  store.update((p) => p.clips.splice(index, 0, clip));
  store.select({ type: 'clip', id: clip.id });
}

// Adds a video/photo as a layer above the main video (split screen). It starts
// at the playhead, or at 0 when the playhead is at the very end.
export function addOverlay(media, start = null) {
  if (media.kind === 'audio') return;
  const total = totalDuration(store.project);
  const at = start ?? (player.time < total - 0.2 ? player.time : 0);
  const overlay = createOverlay(media, at);
  store.update((p) => {
    p.overlays ??= [];
    p.overlays.push(overlay);
  });
  store.select({ type: 'overlay', id: overlay.id });
  player.seek(Math.max(at, Math.min(player.time, at + overlayDuration(overlay) - 0.05)));
}

// Black-and-gold data graphic as a split-screen layer at the playhead.
export async function addGraphic(type) {
  if (ui.graphicBusy.get()) return;
  const g = createGraphic(type);
  const total = totalDuration(store.project);
  const at = player.time < total - 0.2 ? player.time : 0;
  player.pause();
  ui.graphicBusy.set(true);
  try {
    const item = await renderGraphicVideo(g, store.project.aspect);
    const overlay = {
      ...createOverlay(item, at), name: GRAPHIC_TYPES[type].name, feather: 0.1, graphic: g,
      ...(GRAPHIC_TYPES[type].full ? { region: 'full' } : {}),
    };
    store.update((p) => {
      p.media.push({ ...item, id: newId('media'), name: GRAPHIC_TYPES[type].name });
      p.overlays ??= [];
      p.overlays.push(overlay);
    });
    store.select({ type: 'overlay', id: overlay.id });
    player.seek(Math.min(at + 2, at + overlayDuration(overlay) - 0.05));
    toast(`${GRAPHIC_TYPES[type].name} נוסף. את התוכן עורכים בפאנל ההגדרות.`, 'success', 3500);
  } catch (e) {
    toast(`לא הצלחנו ליצור את הגרפיקה: ${e.message}`, 'error', 8000);
  } finally {
    ui.graphicBusy.set(false);
  }
}

// Re-renders a graphic layer with new content, keeping its timing and placement.
export async function updateGraphic(overlayId, g) {
  if (ui.graphicBusy.get()) return;
  const aspect = store.project.aspect;
  ui.graphicBusy.set(true);
  try {
    const item = await renderGraphicVideo(g, aspect);
    store.update((p) => {
      const o = p.overlays.find((x) => x.id === overlayId);
      if (!o) return;
      const media = p.media.find((m) => m.path === o.path);
      if (media) Object.assign(media, { path: item.path, url: item.url, thumbnail: item.thumbnail, duration: item.duration });
      Object.assign(o, {
        path: item.path, url: item.url, thumbnail: item.thumbnail, sourceDuration: item.duration,
        width: item.width, height: item.height, in: 0, out: item.duration, graphic: { ...g },
      });
    });
    player.seek(player.time);
  } catch (e) {
    toast(`לא הצלחנו לעדכן את הגרפיקה: ${e.message}`, 'error', 8000);
  } finally {
    ui.graphicBusy.set(false);
  }
}

// Red captions on the seam: restyles existing captions and makes red the default look.
export function redCaptions() {
  try {
    const s = JSON.parse(localStorage.getItem('clipcraft.captions') || '{}');
    localStorage.setItem('clipcraft.captions', JSON.stringify({ ...s, look: 'red' }));
  } catch {
    // remembered settings are a convenience only
  }
  const captions = store.project.texts.filter((t) => t.caption);
  if (!captions.length) {
    toast('אין עדיין כתוביות. לחצו על ״כתוביות״ בסרגל העליון, והן ייצאו בסגנון הזה.', 'info', 5000);
    return;
  }
  store.update((p) => p.texts.forEach((t) => {
    if (t.caption) Object.assign(t, CAPTION_LOOKS.red.look, { y: 0.5 });
  }));
  toast(`${captions.length} כתוביות עברו לסגנון האדום.`, 'success', 3000);
}

export const actions = {
  applyTemplate(id) {
    player.pause();
    const wasEmpty = !store.project.clips.length;
    const { project, select, seek } = applyTemplate(store.project, id, player.time);
    store.update((p) => {
      p.clips = project.clips;
      p.texts = project.texts;
      p.overlays = project.overlays ?? [];
      p.music = project.music;
    });
    if (select) store.select(select);
    if (seek != null) player.seek(seek);
    if (wasEmpty) requestAnimationFrame(() => timelineApi.zoomToFit());
    const name = TEMPLATES.find((t) => t.id === id)?.name;
    toast(select ? `${name} נוסף. אפשר לערוך את הטקסט בפאנל ההגדרות.` : `${name} הוחל.`, 'success', 3000);
  },

  async importMedia() {
    addMediaItems(await window.api.importMedia('clips'));
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
      const area = document.getElementById('text-content');
      area?.focus();
      area?.select();
    });
  },

  split() {
    const clips = splitClipAt(store.project.clips, player.time);
    if (!clips) {
      toast('כדי לפצל, הציבו את סמן הניגון בתוך קליפ (לא בקצה שלו).', 'warn');
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
    } else if (sel?.type === 'overlay') {
      const id = newId('ovl');
      store.update((p) => {
        const o = p.overlays.find((x) => x.id === sel.id);
        if (o) p.overlays.push({ ...structuredClone(o), id, start: o.start + overlayDuration(o) });
      });
      store.select({ type: 'overlay', id });
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
      if (sel.type === 'overlay') p.overlays = p.overlays.filter((o) => o.id !== sel.id);
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
    return !store.dirty || window.confirm('יש שינויים שלא נשמרו. להמשיך בלי לשמור?');
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
    timelineApi.zoomToFit();
    if (res.missing.length) {
      toast(`קבצים חסרים (הועברו או נמחקו): ${res.missing.map((p) => p.split(/[\\/]/).pop()).join(', ')}`, 'error', 9000);
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
      toast('הפרויקט נשמר', 'success', 2500);
    }
  },

  captions() {
    if (!store.project.clips.length) {
      toast('הוסיפו קודם סרטון שמדברים בו.', 'warn');
      return;
    }
    player.pause();
    ui.captionsOpen.set(true);
  },

  export() {
    if (!store.project.clips.length) {
      toast('הוסיפו לפחות סרטון או תמונה אחת לפני הייצוא.', 'warn');
      return;
    }
    player.pause();
    ui.exportOpen.set(true);
  },

  shortcuts() {
    store.select(null);
  },
};
