import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatTime, frameSize } from '../../shared/timeline.js';
import { enter, exit } from '../motion.js';
import { player, store, usePlayer, useStore } from '../state.js';
import { Icon } from './Icon.jsx';
import { IconButton } from './controls.jsx';

// Drag a text item on the canvas; click elsewhere to play/pause.
function onCanvasPointerDown(e) {
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const hit = player.textAt(
    (e.clientX - rect.left) * (canvas.width / rect.width),
    (e.clientY - rect.top) * (canvas.height / rect.height),
  );
  if (!hit) {
    player.toggle();
    return;
  }
  player.pause();
  store.select({ type: 'text', id: hit.id });
  const { x: x0, y: y0 } = hit;
  const sx = e.clientX;
  const sy = e.clientY;
  const move = (ev) => store.mutate((p) => {
    const t = p.texts.find((x) => x.id === hit.id);
    if (!t) return;
    t.x = Math.min(1, Math.max(0, x0 + (ev.clientX - sx) / rect.width));
    t.y = Math.min(1, Math.max(0, y0 + (ev.clientY - sy) / rect.height));
  });
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    store.commit();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function PlayButton() {
  usePlayer();
  const { playing } = player;
  return (
    <button id="btn-play" type="button" className="icon-btn play" onClick={() => player.toggle()}
      title={playing ? 'Pause (Space)' : 'Play (Space)'} aria-label={playing ? 'Pause' : 'Play'}>
      {/* Icon swap: quick scale + blur cross-fade so the change reads as one motion. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={playing ? 'pause' : 'play'}
          className="icon-swap"
          initial={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function TimeDisplay() {
  usePlayer();
  return (
    <span id="time" className="time">
      {formatTime(player.time, true)} / {formatTime(player.duration, true)}
    </span>
  );
}

export function Preview() {
  useStore();
  const canvasRef = useRef(null);
  useEffect(() => {
    player.attach(canvasRef.current);
  }, []);
  const { width, height } = frameSize(store.project.aspect);
  const empty = !store.project.clips.length;
  const jump = (t) => {
    player.pause();
    player.seek(t);
  };

  return (
    <section className="stage">
      <div className="preview-wrap" style={{ '--ar': `${width} / ${height}` }}>
        <canvas id="preview" ref={canvasRef} onPointerDown={onCanvasPointerDown} />
        <AnimatePresence>
          {empty && (
            <motion.div className="empty-preview" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter }}
              exit={{ opacity: 0, transition: exit }}>
              <strong>Start your video</strong>
              <span>Click “Import media” or drop videos and photos anywhere in this window.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="transport">
        <IconButton id="btn-start" icon="start" label="Go to start (Home)" onClick={() => jump(0)} />
        <IconButton id="btn-back" icon="back" label="Back 1 second" onClick={() => jump(player.time - 1)} />
        <PlayButton />
        <IconButton id="btn-fwd" icon="fwd" label="Forward 1 second" onClick={() => jump(player.time + 1)} />
        <IconButton id="btn-end" icon="end" label="Go to end (End)" onClick={() => jump(player.duration)} />
        <TimeDisplay />
      </div>
    </section>
  );
}
