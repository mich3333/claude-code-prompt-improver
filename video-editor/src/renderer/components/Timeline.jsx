// Timeline: ruler, video/text/music tracks, playhead and drag interactions.
// Dragging, trimming and scrubbing follow the pointer 1:1 with no easing;
// the only animation is the short glide of neighbours after a reorder drop,
// which shows where things went.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'motion/react';
import { PRESETS } from '../../shared/effects.js';
import { formatTime, layoutClips, MIN_CLIP_DURATION, totalDuration, TRANSITIONS } from '../../shared/timeline.js';
import { addMediaToTimeline, actions } from '../actions.js';
import { move as moveTransition } from '../motion.js';
import { player, store, timelineApi, usePlayer, useStore } from '../state.js';
import { Button, IconButton } from './controls.jsx';

const MIN_PPS = 8;
const MAX_PPS = 400;
const SNAP_PX = 8;
const TEXT_ROW_H = 30;
const sliderToPps = (v) => MIN_PPS * (MAX_PPS / MIN_PPS) ** (v / 100);
const ppsToSlider = (p) => (100 * Math.log(p / MIN_PPS)) / Math.log(MAX_PPS / MIN_PPS);

// Drag helper: move(dtSeconds, event), end(moved, event).
function startDrag(e, pps, { move, end, threshold = 0 }) {
  const startX = e.clientX;
  let active = threshold === 0;
  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    if (!active && Math.abs(dx) < threshold) return;
    active = true;
    move(dx / pps, ev);
  };
  const onUp = (ev) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    end?.(active, ev);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function Playhead({ pps, scrollRef }) {
  usePlayer();
  const x = player.time * pps;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!player.playing || !el) return;
    if (x > el.scrollLeft + el.clientWidth - 40 || x < el.scrollLeft) el.scrollLeft = x - 60;
  });
  return (
    <div className="tl-playhead" style={{ transform: `translateX(${x}px)` }}>
      <div className="tl-playhead-knob" />
    </div>
  );
}

function textRows(texts) {
  const ends = [];
  const rowOf = new Map();
  for (const t of [...texts].sort((a, b) => a.start - b.start)) {
    let r = ends.findIndex((end) => end <= t.start + 1e-6);
    if (r === -1) {
      r = ends.length;
      ends.push(0);
    }
    ends[r] = t.end;
    rowOf.set(t.id, r);
  }
  return { rowOf, count: Math.max(1, ends.length) };
}

export function Timeline() {
  useStore();
  const { project, selection } = store;
  const [pps, setPps] = useState(60);
  const [viewW, setViewW] = useState(800);
  const [dragging, setDragging] = useState(null); // { id, dx }
  const [marker, setMarker] = useState(null); // insert position (seconds)
  const [glideExcept, setGlideExcept] = useState(null); // clip id just dropped; others glide
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const ppsRef = useRef(pps);
  ppsRef.current = pps;

  const layout = layoutClips(project.clips);
  const total = totalDuration(project);
  const width = Math.max(viewW, (total + 10) * pps);

  const timeAt = (clientX) => Math.max(0, (clientX - contentRef.current.getBoundingClientRect().left) / ppsRef.current);

  const setZoom = useCallback((next) => {
    const el = scrollRef.current;
    const center = (el.scrollLeft + el.clientWidth / 2) / ppsRef.current;
    const p = Math.min(MAX_PPS, Math.max(MIN_PPS, next));
    flushSync(() => setPps(p));
    el.scrollLeft = center * p - el.clientWidth / 2;
  }, []);

  useEffect(() => {
    timelineApi.zoomToFit = () => {
      const el = scrollRef.current;
      const t = totalDuration(store.project);
      if (el && t > 0) setPps(Math.min(MAX_PPS, Math.max(MIN_PPS, (el.clientWidth - 40) / t)));
      if (el) el.scrollLeft = 0;
    };
    timelineApi.setZoom = setZoom;
    timelineApi.zoomBy = (f) => setZoom(ppsRef.current * f);
  }, [setZoom]);

  useEffect(() => {
    const el = scrollRef.current;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(ppsRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [setZoom]);

  const snap = (t, exclude = []) => {
    const points = [0, player.time, totalDuration(store.project)];
    for (const s of layoutClips(store.project.clips)) points.push(s.start, s.end);
    for (const tx of store.project.texts) if (!exclude.includes(tx.id)) points.push(tx.start, tx.end);
    let best = t;
    let bestPx = SNAP_PX;
    for (const p of points) {
      const d = Math.abs(p - t) * ppsRef.current;
      if (d < bestPx) {
        bestPx = d;
        best = p;
      }
    }
    return best;
  };

  const insertIndexAt = (t, skipId = null) =>
    layoutClips(store.project.clips).filter((s) => s.clip.id !== skipId && (s.start + s.end) / 2 < t).length;

  const markerTime = (index, skipId = null) => {
    const segs = layoutClips(store.project.clips).filter((s) => s.clip.id !== skipId);
    return index === 0 ? 0 : segs[index - 1]?.end ?? 0;
  };

  // ---- interactions -------------------------------------------------

  const onScrub = (e) => {
    if (e.button !== 0 || e.target.closest('.tl-clip, .tl-text, .tl-music')) return;
    player.pause();
    player.seek(timeAt(e.clientX));
    if (e.target.closest('.tl-track')) store.select(null);
    startDrag(e, ppsRef.current, { move: (_dt, ev) => player.seek(timeAt(ev.clientX)) });
  };

  const onClipDown = (e, clip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    player.pause();
    store.select({ type: 'clip', id: clip.id });
    const handle = e.target.dataset.handle;
    const live = () => store.project.clips.find((c) => c.id === clip.id);

    if (handle) {
      const in0 = clip.in;
      const out0 = clip.out;
      const minSrc = MIN_CLIP_DURATION * clip.speed;
      const maxOut = clip.kind === 'image' ? Infinity : clip.sourceDuration;
      startDrag(e, ppsRef.current, {
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
          if (seg) player.seek(handle === 'right' ? seg.end - 0.001 : seg.start);
        },
        end: () => store.commit(),
      });
      return;
    }

    let index = null;
    startDrag(e, ppsRef.current, {
      threshold: 5,
      move: (dt, ev) => {
        index = insertIndexAt(timeAt(ev.clientX), clip.id);
        setDragging({ id: clip.id, dx: dt * ppsRef.current });
        setMarker(markerTime(index, clip.id));
      },
      end: (moved) => {
        setDragging(null);
        setMarker(null);
        if (!moved) {
          const seg = layoutClips(store.project.clips).find((s) => s.clip.id === clip.id);
          if (seg && (player.time < seg.start || player.time >= seg.end)) player.seek(seg.start);
          return;
        }
        const from = store.project.clips.findIndex((c) => c.id === clip.id);
        if (from === index) return;
        // Enable layout animation for the neighbours before positions change;
        // the dropped clip lands where the pointer let go, without animating.
        flushSync(() => setGlideExcept(clip.id));
        store.update((p) => {
          const [c] = p.clips.splice(from, 1);
          p.clips.splice(index, 0, c);
        });
        setTimeout(() => setGlideExcept(null), 300);
      },
    });
  };

  const onTextDown = (e, text) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    player.pause();
    store.select({ type: 'text', id: text.id });
    const handle = e.target.dataset.handle;
    const s0 = text.start;
    const e0 = text.end;
    const len = e0 - s0;
    startDrag(e, ppsRef.current, {
      threshold: handle ? 0 : 3,
      move: (dt) => {
        store.mutate((p) => {
          const t = p.texts.find((x) => x.id === text.id);
          if (handle === 'left') t.start = Math.min(t.end - 0.2, Math.max(0, snap(s0 + dt, [text.id])));
          else if (handle === 'right') t.end = Math.max(t.start + 0.2, snap(e0 + dt, [text.id]));
          else {
            let start = Math.max(0, snap(s0 + dt, [text.id]));
            const snappedEnd = snap(start + len, [text.id]);
            if (snappedEnd !== start + len && start === s0 + dt) start = snappedEnd - len;
            t.start = Math.max(0, start);
            t.end = t.start + len;
          }
        });
        const t = store.project.texts.find((x) => x.id === text.id);
        if (player.time < t.start || player.time >= t.end) player.seek(t.start);
      },
      end: () => store.commit(),
    });
  };

  const onMusicDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    player.pause();
    store.select({ type: 'music' });
    const s0 = store.project.music.start;
    startDrag(e, ppsRef.current, {
      threshold: 3,
      move: (dt) => store.mutate((p) => { p.music.start = Math.max(0, snap(s0 + dt)); }),
      end: () => store.commit(),
    });
  };

  // Media bin -> video track.
  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes('application/x-clipcraft-media')) return;
    e.preventDefault();
    setMarker(markerTime(insertIndexAt(timeAt(e.clientX))));
  };
  const onDrop = (e) => {
    const id = e.dataTransfer.getData('application/x-clipcraft-media');
    setMarker(null);
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    const m = store.project.media.find((x) => x.id === id);
    if (m && m.kind !== 'audio') addMediaToTimeline(m, insertIndexAt(timeAt(e.clientX)));
  };

  // ---- render ---------------------------------------------------------

  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const step = steps.find((s) => s * pps >= 70) ?? 600;
  const ticks = [];
  for (let t = 0; t * pps < width; t += step) ticks.push(t);

  const { rowOf, count: textRowCount } = textRows(project.texts);
  const textTrackH = textRowCount * TEXT_ROW_H + 8;

  const m = project.music;
  let musicLen = 0;
  if (m) {
    const playable = m.loop ? Infinity : m.sourceDuration - (m.offset || 0);
    musicLen = Math.max(0.2, Math.min(playable, Math.max(total, m.start + 1) - m.start));
  }

  return (
    <section id="timeline" className="timeline">
      <div className="tl-toolbar">
        <Button id="btn-split" icon="split" className="small" onClick={actions.split} disabled={!project.clips.length}
          title="פיצול קליפ בסמן הניגון (S)">פיצול</Button>
        <Button id="btn-delete" icon="trash" className="small" onClick={actions.remove} disabled={!selection}
          title="מחיקת הפריט הנבחר (Delete)">מחיקה</Button>
        <div className="spacer" />
        <span className="zoom-label">זום</span>
        <input id="zoom" type="range" min="0" max="100" step="0.5" value={ppsToSlider(pps)} aria-label="זום בציר הזמן"
          onChange={(e) => setZoom(sliderToPps(Number(e.target.value)))} />
        <IconButton id="btn-fit" icon="fit" label="התאמת ציר הזמן לחלון" onClick={() => timelineApi.zoomToFit()} />
      </div>
      <div className="tl-body" dir="ltr">
        <div className="tl-headers">
          <div className="tl-header-ruler" />
          <div className="tl-header">וידאו</div>
          <div className="tl-header" style={{ height: textTrackH }}>טקסט</div>
          <div className="tl-header tl-header-music">מוזיקה</div>
        </div>
        <div className="tl-scroll" ref={scrollRef}>
          <div className="tl-content" ref={contentRef} style={{ width }} onPointerDown={onScrub}>
            <div className="tl-ruler">
              {ticks.map((t) => (
                <div key={t} className="tl-tick" style={{ left: t * pps }}>{formatTime(t)}</div>
              ))}
              {ticks.map((t) => (
                <div key={`m${t}`} className="tl-tick minor" style={{ left: (t + step / 2) * pps }} />
              ))}
            </div>

            <div className="tl-track tl-track-video" onDragOver={onDragOver} onDragLeave={() => setMarker(null)} onDrop={onDrop}>
              {!project.clips.length && (
                <div className="tl-empty" dir="rtl">גררו לכאן סרטונים או תמונות, או לחצו על ״ייבוא מדיה״.</div>
              )}
              {layout.map((seg) => {
                const { clip } = seg;
                const isDragged = dragging?.id === clip.id;
                const badges = [];
                if (clip.speed !== 1 && clip.kind !== 'image') badges.push(`${clip.speed}×`);
                if (clip.filter !== 'none') badges.push(PRESETS[clip.filter]?.label ?? clip.filter);
                if (clip.kind === 'video' && (clip.muted || !clip.hasAudio)) badges.push('מושתק');
                return (
                  <motion.div
                    key={clip.id}
                    data-id={clip.id}
                    layout={glideExcept && glideExcept !== clip.id ? 'position' : false}
                    transition={moveTransition}
                    className={`tl-clip${selection?.id === clip.id ? ' selected' : ''}${clip.kind === 'image' ? ' image' : ''}${isDragged ? ' dragging' : ''}`}
                    style={{
                      left: seg.start * pps,
                      width: Math.max(4, (seg.end - seg.start) * pps),
                      backgroundImage: clip.thumbnail ? `url("${clip.thumbnail}")` : undefined,
                      x: isDragged ? dragging.dx : 0,
                    }}
                    title={`${clip.name} — ${formatTime(seg.end - seg.start, true)}`}
                    onPointerDown={(e) => onClipDown(e, clip)}
                  >
                    {seg.transition.duration > 0 && (
                      <div className="tl-transition" style={{ width: seg.transition.duration * pps }}
                        title={`${TRANSITIONS[seg.transition.type]} (${seg.transition.duration}s)`} />
                    )}
                    <div className="tl-clip-label">
                      <span className="name">{clip.name}</span>
                      {badges.map((b) => <span key={b} className="badge">{b}</span>)}
                    </div>
                    <div className="tl-handle left" data-handle="left" />
                    <div className="tl-handle right" data-handle="right" />
                  </motion.div>
                );
              })}
              {marker !== null && <div className="tl-insert-marker" style={{ left: marker * pps }} />}
            </div>

            <div className="tl-track tl-track-text" style={{ height: textTrackH }}>
              {project.texts.map((t) => (
                <div key={t.id} dir="auto" title={t.text}
                  className={`tl-text${selection?.id === t.id ? ' selected' : ''}`}
                  style={{ left: t.start * pps, width: Math.max(6, (t.end - t.start) * pps), top: 4 + rowOf.get(t.id) * TEXT_ROW_H }}
                  onPointerDown={(e) => onTextDown(e, t)}>
                  <span className="name">{t.text.split('\n')[0] || '(ריק)'}</span>
                  <div className="tl-handle left" data-handle="left" />
                  <div className="tl-handle right" data-handle="right" />
                </div>
              ))}
            </div>

            <div className="tl-track tl-track-music">
              {m ? (
                <div className={`tl-music${selection?.type === 'music' ? ' selected' : ''}`} title={m.name}
                  style={{ left: m.start * pps, width: musicLen * pps }} onPointerDown={onMusicDown}>
                  <span className="name">♪ {m.name}</span>
                </div>
              ) : (
                <div className="tl-empty small" dir="rtl">אין מוזיקה. לחצו על ״הוספת מוזיקה״.</div>
              )}
            </div>

            <Playhead pps={pps} scrollRef={scrollRef} />
          </div>
        </div>
      </div>
    </section>
  );
}
