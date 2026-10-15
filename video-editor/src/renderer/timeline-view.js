// Timeline UI: ruler, video/text/music tracks, playhead, drag interactions.

import { formatTime, layoutClips, MIN_CLIP_DURATION, totalDuration, TRANSITIONS } from '../shared/timeline.js';
import { PRESETS } from '../shared/effects.js';
import { el } from './dom.js';

const MIN_PPS = 8;
const MAX_PPS = 400;
const SNAP_PX = 8;
const TEXT_ROW_H = 30;

export class TimelineView {
  constructor(root, store, player, handlers) {
    this.root = root;
    this.store = store;
    this.player = player;
    this.handlers = handlers; // { onDropMedia(mediaId, index) }
    this.pps = 60;
    this.scroll = root.querySelector('.tl-scroll');
    this.content = root.querySelector('.tl-content');
    this.ruler = root.querySelector('.tl-ruler');
    this.videoTrack = root.querySelector('.tl-track-video');
    this.textTrack = root.querySelector('.tl-track-text');
    this.musicTrack = root.querySelector('.tl-track-music');
    this.playhead = root.querySelector('.tl-playhead');
    this.marker = el('div', { class: 'tl-insert-marker' });
    this.zoomInput = root.querySelector('#zoom');
    this.bindScrub();
    this.bindDrop();
    this.zoomInput.addEventListener('input', () => this.setZoom(this.sliderToPps(Number(this.zoomInput.value))));
    this.scroll.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.setZoom(this.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    }, { passive: false });
    new ResizeObserver(() => this.render()).observe(this.scroll);
  }

  // Logarithmic zoom slider (0..100).
  sliderToPps(v) {
    return MIN_PPS * (MAX_PPS / MIN_PPS) ** (v / 100);
  }

  ppsToSlider(p) {
    return (100 * Math.log(p / MIN_PPS)) / Math.log(MAX_PPS / MIN_PPS);
  }

  setZoom(pps) {
    const center = (this.scroll.scrollLeft + this.scroll.clientWidth / 2) / this.pps;
    this.pps = Math.min(MAX_PPS, Math.max(MIN_PPS, pps));
    this.zoomInput.value = String(this.ppsToSlider(this.pps));
    this.render();
    this.scroll.scrollLeft = center * this.pps - this.scroll.clientWidth / 2;
  }

  zoomToFit() {
    const total = totalDuration(this.store.project);
    if (total > 0) this.setZoom((this.scroll.clientWidth - 40) / total);
    this.scroll.scrollLeft = 0;
  }

  timeAtClientX(clientX) {
    const rect = this.content.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / this.pps);
  }

  snap(t, exclude = []) {
    const points = [0, this.player.time, totalDuration(this.store.project)];
    for (const s of layoutClips(this.store.project.clips)) points.push(s.start, s.end);
    for (const tx of this.store.project.texts) if (!exclude.includes(tx.id)) points.push(tx.start, tx.end);
    let best = t;
    let bestPx = SNAP_PX;
    for (const p of points) {
      const d = Math.abs(p - t) * this.pps;
      if (d < bestPx) {
        bestPx = d;
        best = p;
      }
    }
    return best;
  }

  render() {
    const { project } = this.store;
    const total = totalDuration(project);
    const width = Math.max(this.scroll.clientWidth, (total + 10) * this.pps);
    this.content.style.width = `${width}px`;
    this.renderRuler(width);
    this.renderClips();
    this.renderTexts();
    this.renderMusic(total);
    this.updatePlayhead();
  }

  renderRuler(width) {
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * this.pps >= 70) ?? 600;
    const frag = document.createDocumentFragment();
    for (let t = 0; t * this.pps < width; t += step) {
      frag.append(el('div', { class: 'tl-tick', style: `left:${t * this.pps}px` }, formatTime(t)));
      const half = el('div', { class: 'tl-tick minor', style: `left:${(t + step / 2) * this.pps}px` });
      frag.append(half);
    }
    this.ruler.replaceChildren(frag);
  }

  renderClips() {
    const { project, selection } = this.store;
    const frag = document.createDocumentFragment();
    if (!project.clips.length) {
      frag.append(el('div', { class: 'tl-empty' }, 'Drop videos or photos here, or click “Import media”.'));
    }
    for (const seg of layoutClips(project.clips)) {
      const { clip } = seg;
      const left = seg.start * this.pps;
      const w = Math.max(4, (seg.end - seg.start) * this.pps);
      const badges = [];
      if (clip.speed !== 1 && clip.kind !== 'image') badges.push(el('span', { class: 'badge' }, `${clip.speed}×`));
      if (clip.filter !== 'none') badges.push(el('span', { class: 'badge' }, PRESETS[clip.filter]?.label ?? clip.filter));
      if (clip.kind === 'video' && (clip.muted || !clip.hasAudio)) badges.push(el('span', { class: 'badge' }, 'muted'));
      const block = el(
        'div',
        {
          class: `tl-clip${selection?.id === clip.id ? ' selected' : ''}${clip.kind === 'image' ? ' image' : ''}`,
          style: `left:${left}px;width:${w}px;${clip.thumbnail ? `background-image:url("${clip.thumbnail}")` : ''}`,
          'data-id': clip.id,
          title: `${clip.name} — ${formatTime(seg.end - seg.start, true)}`,
        },
        el('div', { class: 'tl-clip-label' }, el('span', { class: 'name' }, clip.name), ...badges),
        el('div', { class: 'tl-handle left', 'data-handle': 'left' }),
        el('div', { class: 'tl-handle right', 'data-handle': 'right' }),
      );
      if (seg.transition.duration > 0) {
        block.append(
          el('div', {
            class: 'tl-transition',
            style: `width:${seg.transition.duration * this.pps}px`,
            title: `${TRANSITIONS[seg.transition.type]} (${seg.transition.duration}s)`,
          }),
        );
      }
      block.addEventListener('pointerdown', (e) => this.onClipPointerDown(e, clip));
      frag.append(block);
    }
    this.videoTrack.replaceChildren(frag);
  }

  renderTexts() {
    const { project, selection } = this.store;
    const rows = [];
    const sorted = [...project.texts].sort((a, b) => a.start - b.start);
    const rowOf = new Map();
    for (const t of sorted) {
      let r = rows.findIndex((end) => end <= t.start + 1e-6);
      if (r === -1) {
        r = rows.length;
        rows.push(0);
      }
      rows[r] = t.end;
      rowOf.set(t.id, r);
    }
    this.textTrack.style.height = `${Math.max(1, rows.length) * TEXT_ROW_H + 8}px`;
    this.root.querySelector('.tl-header-text').style.height = this.textTrack.style.height;
    const frag = document.createDocumentFragment();
    for (const t of project.texts) {
      const block = el(
        'div',
        {
          class: `tl-text${selection?.id === t.id ? ' selected' : ''}`,
          style: `left:${t.start * this.pps}px;width:${Math.max(6, (t.end - t.start) * this.pps)}px;top:${4 + rowOf.get(t.id) * TEXT_ROW_H}px`,
          dir: 'auto',
          title: t.text,
        },
        el('span', { class: 'name' }, t.text.split('\n')[0] || '(empty)'),
        el('div', { class: 'tl-handle left', 'data-handle': 'left' }),
        el('div', { class: 'tl-handle right', 'data-handle': 'right' }),
      );
      block.addEventListener('pointerdown', (e) => this.onTextPointerDown(e, t));
      frag.append(block);
    }
    this.textTrack.replaceChildren(frag);
  }

  renderMusic(total) {
    const { project, selection } = this.store;
    const m = project.music;
    if (!m) {
      this.musicTrack.replaceChildren(el('div', { class: 'tl-empty small' }, 'No music — use “Add music”.'));
      return;
    }
    const playable = m.loop ? Infinity : m.sourceDuration - (m.offset || 0);
    const len = Math.max(0.2, Math.min(playable, Math.max(total, m.start + 1) - m.start));
    const block = el(
      'div',
      {
        class: `tl-music${selection?.type === 'music' ? ' selected' : ''}`,
        style: `left:${m.start * this.pps}px;width:${len * this.pps}px`,
        title: m.name,
      },
      el('span', { class: 'name' }, `♪ ${m.name}`),
    );
    block.addEventListener('pointerdown', (e) => this.onMusicPointerDown(e));
    this.musicTrack.replaceChildren(block);
  }

  updatePlayhead() {
    const x = this.player.time * this.pps;
    this.playhead.style.transform = `translateX(${x}px)`;
    if (this.player.playing) {
      const { scrollLeft, clientWidth } = this.scroll;
      if (x > scrollLeft + clientWidth - 40 || x < scrollLeft) this.scroll.scrollLeft = x - 60;
    }
  }

  // Shared drag helper: calls move(dtSeconds, event) and end().
  drag(e, { move, end, threshold = 0 }) {
    const startX = e.clientX;
    let active = threshold === 0;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      if (!active && Math.abs(dx) < threshold) return;
      active = true;
      move(dx / this.pps, ev);
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      end?.(active, ev);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  bindScrub() {
    const scrub = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.tl-clip, .tl-text, .tl-music')) return;
      this.player.pause();
      this.player.seek(this.timeAtClientX(e.clientX));
      if (e.target.closest('.tl-track')) this.store.select(null);
      this.drag(e, { move: (_dt, ev) => this.player.seek(this.timeAtClientX(ev.clientX)) });
    };
    this.content.addEventListener('pointerdown', scrub);
  }

  bindDrop() {
    this.videoTrack.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('application/x-clipcraft-media')) return;
      e.preventDefault();
      this.showInsertMarker(this.insertIndexAt(this.timeAtClientX(e.clientX)));
    });
    this.videoTrack.addEventListener('dragleave', () => this.marker.remove());
    this.videoTrack.addEventListener('drop', (e) => {
      const id = e.dataTransfer.getData('application/x-clipcraft-media');
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      this.marker.remove();
      this.handlers.onDropMedia(id, this.insertIndexAt(this.timeAtClientX(e.clientX)));
    });
  }

  insertIndexAt(t, skipId = null) {
    const segs = layoutClips(this.store.project.clips).filter((s) => s.clip.id !== skipId);
    return segs.filter((s) => (s.start + s.end) / 2 < t).length;
  }

  showInsertMarker(index, skipId = null) {
    const segs = layoutClips(this.store.project.clips).filter((s) => s.clip.id !== skipId);
    const t = index === 0 ? 0 : segs[index - 1]?.end ?? 0;
    this.marker.style.left = `${t * this.pps}px`;
    if (!this.marker.isConnected) this.videoTrack.append(this.marker);
  }

  onClipPointerDown(e, clip) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.player.pause();
    this.store.select({ type: 'clip', id: clip.id });
    const handle = e.target.dataset.handle;
    const { store } = this;
    const live = () => store.project.clips.find((c) => c.id === clip.id);

    if (handle) {
      const in0 = clip.in;
      const out0 = clip.out;
      const minSrc = MIN_CLIP_DURATION * clip.speed;
      const maxOut = clip.kind === 'image' ? Infinity : clip.sourceDuration;
      this.drag(e, {
        move: (dt) => {
          store.mutate(() => {
            const c = live();
            if (handle === 'right' || clip.kind === 'image') {
              const delta = handle === 'right' ? dt : -dt;
              c.out = Math.min(maxOut, Math.max(c.in + minSrc, out0 + delta * c.speed));
            } else {
              c.in = Math.min(c.out - minSrc, Math.max(0, in0 + dt * c.speed));
            }
          });
          const seg = layoutClips(store.project.clips).find((s) => s.clip.id === clip.id);
          if (seg) this.player.seek(handle === 'right' ? seg.end - 0.001 : seg.start);
        },
        end: () => store.commit(),
      });
      return;
    }

    let index = null;
    this.drag(e, {
      threshold: 5,
      move: (dt, ev) => {
        // Selecting re-rendered the track, so look the block up again.
        const block = this.videoTrack.querySelector(`[data-id="${clip.id}"]`);
        if (!block) return;
        block.classList.add('dragging');
        block.style.transform = `translateX(${dt * this.pps}px)`;
        index = this.insertIndexAt(this.timeAtClientX(ev.clientX), clip.id);
        this.showInsertMarker(index, clip.id);
      },
      end: (moved) => {
        this.marker.remove();
        if (!moved) {
          const seg = layoutClips(store.project.clips).find((s) => s.clip.id === clip.id);
          if (seg && (this.player.time < seg.start || this.player.time >= seg.end)) this.player.seek(seg.start);
          return;
        }
        store.update((p) => {
          const from = p.clips.findIndex((c) => c.id === clip.id);
          const [c] = p.clips.splice(from, 1);
          p.clips.splice(index, 0, c);
        });
      },
    });
  }

  onTextPointerDown(e, text) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.player.pause();
    this.store.select({ type: 'text', id: text.id });
    const handle = e.target.dataset.handle;
    const s0 = text.start;
    const e0 = text.end;
    const len = e0 - s0;
    const { store } = this;
    this.drag(e, {
      threshold: handle ? 0 : 3,
      move: (dt) => {
        store.mutate((p) => {
          const t = p.texts.find((x) => x.id === text.id);
          if (handle === 'left') t.start = Math.min(t.end - 0.2, Math.max(0, this.snap(s0 + dt, [text.id])));
          else if (handle === 'right') t.end = Math.max(t.start + 0.2, this.snap(e0 + dt, [text.id]));
          else {
            let start = Math.max(0, this.snap(s0 + dt, [text.id]));
            const snappedEnd = this.snap(start + len, [text.id]);
            if (snappedEnd !== start + len && start === s0 + dt) start = snappedEnd - len;
            t.start = Math.max(0, start);
            t.end = t.start + len;
          }
        });
        const t = store.project.texts.find((x) => x.id === text.id);
        if (this.player.time < t.start || this.player.time >= t.end) this.player.seek(t.start);
      },
      end: () => store.commit(),
    });
  }

  onMusicPointerDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.player.pause();
    this.store.select({ type: 'music' });
    const s0 = this.store.project.music.start;
    this.drag(e, {
      threshold: 3,
      move: (dt) => this.store.mutate((p) => {
        p.music.start = Math.max(0, this.snap(s0 + dt));
      }),
      end: () => this.store.commit(),
    });
  }
}
