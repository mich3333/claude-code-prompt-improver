// Live preview: composites the timeline onto a canvas the same way the
// export does (fit, color effects, transitions, text) and plays the audio.

import { clipOps, toCssFilter } from '../shared/effects.js';
import {
  frameSize, layoutClips, locate, overlayAlpha, overlayDuration, overlayRect, sourceTime, totalDuration,
} from '../shared/timeline.js';
import { drawText, measureText, textAlpha } from './text-render.js';
import { textRiseOffset } from '../shared/ffmpeg.js';

const DRIFT_LIMIT = 0.3; // seconds before a playing video is re-synced

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Player {
  constructor(store) {
    this.canvas = null;
    this.ctx = null;
    this.store = store;
    this.version = 0; // bumps on every time/playing change (for React)
    this.time = 0;
    this.playing = false;
    this.media = new Map(); // clip id -> { el, url }
    this.music = { el: new Audio(), url: null };
    this.listeners = new Set();
    this.raf = 0;
    this.drawQueued = false;
    this.pendingRetries = 0;
  }

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.sync();
  }

  get project() {
    return this.store.project;
  }

  get duration() {
    return totalDuration(this.project);
  }

  onTime(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emitTime() {
    this.version += 1;
    for (const fn of this.listeners) fn(this.time, this.playing);
  }

  resize() {
    if (!this.canvas) return;
    const { width, height } = frameSize(this.project.aspect, 540);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvasResized = true; // the canvas was cleared; draw something now
    }
  }

  // Overlays visible at time t, shaped like clip segments ({ clip, start, end }).
  overlaySegs(t) {
    return (this.project.overlays ?? [])
      .map((o) => ({ clip: o, start: o.start, end: o.start + overlayDuration(o) }))
      .filter((s) => t >= s.start && t < s.end);
  }

  // Create/remove media elements so they match the project's clips and overlays.
  sync() {
    this.resize();
    const ids = new Set();
    // Cards are solid colour, nothing to load.
    const items = [...this.project.clips.filter((c) => c.kind !== 'card'), ...(this.project.overlays ?? [])];
    for (const clip of items) {
      ids.add(clip.id);
      let entry = this.media.get(clip.id);
      if (entry && entry.url !== clip.url) {
        this.releaseEntry(entry);
        entry = null;
      }
      if (!entry) {
        const el = clip.kind === 'image' ? new Image() : document.createElement('video');
        if (clip.kind !== 'image') {
          el.preload = 'auto';
          el.playsInline = true;
          el.addEventListener('seeked', () => this.requestDraw());
          el.addEventListener('loadeddata', () => this.requestDraw());
          el.addEventListener('canplay', () => this.requestDraw());
        } else {
          el.addEventListener('load', () => this.requestDraw());
        }
        el.addEventListener('error', () => this.requestDraw());
        el.src = clip.url;
        this.media.set(clip.id, { el, url: clip.url });
      }
    }
    for (const [id, entry] of this.media) {
      if (!ids.has(id)) {
        this.releaseEntry(entry);
        this.media.delete(id);
      }
    }
    const m = this.project.music;
    if ((m?.url ?? null) !== this.music.url) {
      this.music.el.pause();
      this.music.url = m?.url ?? null;
      if (m) this.music.el.src = m.url;
      else this.music.el.removeAttribute('src');
    }
    if (this.time > this.duration) this.time = this.duration;
    if (!this.playing) this.seek(this.time);
  }

  releaseEntry(entry) {
    if (entry.el.pause) entry.el.pause();
    entry.el.removeAttribute('src');
    if (entry.el.load) entry.el.load();
  }

  seek(t) {
    this.time = Math.min(Math.max(0, t), this.duration);
    const loc = locate(this.project, this.time);
    if (loc) {
      for (const seg of [loc.current, loc.next, ...this.overlaySegs(this.time)]) {
        if (!seg || seg.clip.kind !== 'video') continue;
        const el = this.media.get(seg.clip.id)?.el;
        if (!el) continue;
        const target = sourceTime(seg, this.time);
        if (this.playing) continue;
        if (Math.abs(el.currentTime - target) > 0.01) el.currentTime = target;
      }
    }
    if (this.playing) this.syncPlayback(true);
    this.requestDraw();
    this.emitTime();
  }

  play() {
    if (this.playing || !this.project.clips.length) return;
    if (this.time >= this.duration - 0.05) this.time = 0;
    this.playing = true;
    this.last = performance.now();
    this.syncPlayback(true);
    this.raf = requestAnimationFrame((n) => this.tick(n));
    this.emitTime();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const { el } of this.media.values()) if (el.pause) el.pause();
    this.music.el.pause();
    this.seek(this.time);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  tick(now) {
    if (!this.playing) return;
    this.time += (now - this.last) / 1000;
    this.last = now;
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.pause();
      return;
    }
    this.syncPlayback(false);
    this.draw();
    this.emitTime();
    this.raf = requestAnimationFrame((n) => this.tick(n));
  }

  // Start/stop/re-sync media elements for the current playback time.
  syncPlayback(force) {
    const loc = locate(this.project, this.time);
    const active = new Map();
    if (loc) {
      active.set(loc.current.clip.id, { seg: loc.current, gain: loc.next ? 1 - loc.progress : 1 });
      if (loc.next) active.set(loc.next.clip.id, { seg: loc.next, gain: loc.progress });
    }
    for (const seg of this.overlaySegs(this.time)) active.set(seg.clip.id, { seg, gain: 1 });
    for (const [id, { el }] of this.media) {
      if (!el.play) continue;
      const a = active.get(id);
      if (!a) {
        if (!el.paused) el.pause();
        continue;
      }
      const { clip } = a.seg;
      const target = sourceTime(a.seg, this.time);
      el.playbackRate = clip.speed;
      el.volume = clip.muted ? 0 : Math.min(1, clip.volume * a.gain);
      if (force || el.paused || Math.abs(el.currentTime - target) > DRIFT_LIMIT) el.currentTime = target;
      if (el.paused) el.play().catch(() => {});
    }
    this.syncMusic(force);
  }

  syncMusic(force) {
    const m = this.project.music;
    const el = this.music.el;
    if (!m || !this.music.url) return;
    const total = this.duration;
    const elapsed = this.time - m.start;
    const songLen = m.sourceDuration;
    const firstLen = songLen - (m.offset || 0);
    let songTime = null;
    if (elapsed >= 0 && this.time < total) {
      if (elapsed < firstLen) songTime = (m.offset || 0) + elapsed;
      else if (m.loop && songLen > 0) songTime = (elapsed - firstLen) % songLen;
    }
    if (songTime === null) {
      if (!el.paused) el.pause();
      return;
    }
    const len = total - m.start;
    let gain = m.volume;
    if (m.fadeIn > 0) gain *= Math.min(1, elapsed / Math.min(m.fadeIn, len));
    if (m.fadeOut > 0) gain *= Math.min(1, (total - this.time) / Math.min(m.fadeOut, len));
    el.volume = Math.max(0, Math.min(1, gain));
    if (force || el.paused || Math.abs(el.currentTime - songTime) > DRIFT_LIMIT) el.currentTime = songTime;
    if (el.paused) el.play().catch(() => {});
  }

  requestDraw() {
    if (this.drawQueued || this.playing) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.draw();
    });
  }

  drawClip(seg, { x = 0, alpha = 1 } = {}) {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const { clip } = seg;
    const el = this.media.get(clip.id)?.el;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = clip.kind === 'card' ? clip.color : '#000';
    ctx.fillRect(x, 0, W, H);
    if (clip.kind === 'card') {
      ctx.restore();
      return;
    }
    const sw = el?.videoWidth || el?.naturalWidth;
    const sh = el?.videoHeight || el?.naturalHeight;
    const ready = el && (clip.kind === 'image' ? el.complete && sw : el.readyState >= 2);
    if (ready && sw && sh) {
      const scale = clip.fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.beginPath();
      ctx.rect(x, 0, W, H);
      ctx.clip();
      ctx.filter = toCssFilter(clipOps(clip));
      ctx.drawImage(el, x + (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else if (el?.error) {
      ctx.fillStyle = '#e5484d';
      ctx.font = `${Math.round(H * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(`הקובץ לא נמצא: ${clip.name}`, x + W / 2, H / 2);
    }
    ctx.restore();
  }

  // Split-screen overlay: fill its region (cover/contain), fade the inner edge
  // to transparent with a gradient mask, then composite onto the frame.
  drawOverlay(o, alpha) {
    if (alpha <= 0) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const el = this.media.get(o.id)?.el;
    const sw = el?.videoWidth || el?.naturalWidth;
    const sh = el?.videoHeight || el?.naturalHeight;
    const ready = el && (o.kind === 'image' ? el.complete && sw : el.readyState >= 2);
    if (!ready || !sw || !sh) return;
    if (!this.off) this.off = document.createElement('canvas');
    const off = this.off;
    if (off.width !== W || off.height !== H) {
      off.width = W;
      off.height = H;
    }
    const octx = off.getContext('2d');
    const r = overlayRect(o, W, H);
    const custom = o.region === 'custom';
    // Free layers draw into their inner box (inside a card's white margin).
    const a = custom ? { x: r.x + r.inner.x, y: r.y + r.inner.y, w: r.inner.w, h: r.inner.h } : r;
    octx.clearRect(0, 0, W, H);
    octx.save();
    octx.beginPath();
    if (custom && r.radius > 0 && (r.card || o.fit !== 'contain')) octx.roundRect(r.x, r.y, r.w, r.h, r.radius);
    else octx.rect(r.x, r.y, r.w, r.h);
    octx.clip();
    if (custom && r.card) {
      octx.fillStyle = '#fff';
      octx.fillRect(r.x, r.y, r.w, r.h);
    } else if (!custom && o.fit === 'contain') {
      octx.fillStyle = '#000';
      octx.fillRect(r.x, r.y, r.w, r.h);
    }
    octx.beginPath();
    octx.rect(a.x, a.y, a.w, a.h);
    octx.clip();
    const scale = o.fit === 'contain' ? Math.min(a.w / sw, a.h / sh) : Math.max(a.w / sw, a.h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    octx.drawImage(el, a.x + (a.w - dw) / 2, a.y + (a.h - dh) / 2, dw, dh);
    octx.restore();
    if (r.edge && r.feather > 0) {
      const g = r.edge === 'bottom'
        ? octx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h - r.feather)
        : octx.createLinearGradient(0, r.y, 0, r.y + r.feather);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      octx.save();
      octx.globalCompositeOperation = 'destination-in';
      octx.fillStyle = g;
      octx.fillRect(r.x, r.y, r.w, r.h);
      octx.restore();
    }
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  // A visible video that is still seeking would draw as black; wait for it.
  pending(loc) {
    return [loc.current, loc.next, ...this.overlaySegs(this.time)].some((seg) => {
      if (!seg || seg.clip.kind !== 'video') return false;
      const el = this.media.get(seg.clip.id)?.el;
      return el && !el.error && (el.seeking || el.readyState < 2);
    });
  }

  draw() {
    if (!this.canvas) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const loc = locate(this.project, this.time);
    if (loc && this.pending(loc) && !this.canvasResized) {
      // 'seeked' usually triggers the redraw, but it can fire before the frame
      // is decodable, so poll briefly too (then draw whatever is there).
      if (!this.playing && this.pendingRetries < 40) {
        this.pendingRetries += 1;
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.requestDraw(), 50);
        return;
      }
      if (this.playing) return;
    }
    this.pendingRetries = 0;
    this.canvasResized = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!loc) return;
    const { current: a, next: b, progress: p, type } = loc;
    if (!b) {
      this.drawClip(a);
    } else if (type === 'fade') {
      this.drawClip(a);
      this.drawClip(b, { alpha: p });
    } else if (type === 'fadeblack' || type === 'fadewhite') {
      ctx.fillStyle = type === 'fadeblack' ? '#000' : '#fff';
      ctx.fillRect(0, 0, W, H);
      const outA = 1 - smoothstep(0, 0.2, p);
      const inB = smoothstep(0.2, 1, p);
      if (outA > 0) this.drawClip(a, { alpha: outA });
      if (inB > 0) this.drawClip(b, { alpha: inB });
    } else if (type === 'slideleft') {
      this.drawClip(a, { x: -p * W });
      this.drawClip(b, { x: (1 - p) * W });
    } else if (type === 'slideright') {
      this.drawClip(a, { x: p * W });
      this.drawClip(b, { x: -(1 - p) * W });
    } else {
      this.drawClip(a);
      ctx.save();
      ctx.beginPath();
      if (type === 'wipeleft') ctx.rect(W * (1 - p), 0, W * p, H);
      else if (type === 'wiperight') ctx.rect(0, 0, W * p, H);
      else ctx.arc(W / 2, H / 2, (p * Math.hypot(W, H)) / 2, 0, Math.PI * 2);
      ctx.clip();
      this.drawClip(b);
      ctx.restore();
    }
    const sel = this.store.selection;
    for (const seg of this.overlaySegs(this.time)) {
      // While paused, the selected layer is shown fully (as at its first frame it is still faded out).
      const full = !this.playing && sel?.id === seg.clip.id;
      this.drawOverlay(seg.clip, full ? 1 : overlayAlpha(seg.clip, this.time));
    }
    for (const text of this.project.texts) {
      let alpha = textAlpha(text, this.time);
      let dy = textRiseOffset(text, this.time);
      // While paused, show the selected text fully and at rest so it can be edited.
      if (!this.playing && sel?.id === text.id && this.time >= text.start && this.time < text.end) {
        alpha = 1;
        dy = 0;
      }
      drawText(ctx, text, W, H, alpha, dy);
    }
    if (sel?.type === 'text' && !this.playing) {
      const text = this.project.texts.find((t) => t.id === sel.id);
      if (text && this.time >= text.start && this.time < text.end) {
        const box = measureText(ctx, text, W, H);
        ctx.save();
        ctx.strokeStyle = '#4f8cff';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.restore();
      }
    }
  }

  // Topmost visible text under a canvas point (for drag-to-move).
  textAt(px, py) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const texts = this.project.texts;
    if (!this.canvas) return null;
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (this.time < t.start || this.time >= t.end) continue;
      const b = measureText(this.ctx, t, W, H);
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return t;
    }
    return null;
  }

  clipAt(t) {
    return layoutClips(this.project.clips).find((s) => t >= s.start && t < s.end) ?? null;
  }
}
