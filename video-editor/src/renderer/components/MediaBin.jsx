import { AnimatePresence, motion } from 'motion/react';
import { formatTime } from '../../shared/timeline.js';
import { actions, addMediaToTimeline } from '../actions.js';
import { enter, exit } from '../motion.js';
import { store, useStore } from '../state.js';
import { Icon } from './Icon.jsx';
import { IconButton } from './controls.jsx';

export function MediaBin() {
  useStore();
  const media = store.project.media ?? [];
  return (
    <aside className="bin panel">
      <div className="panel-head">
        <h2>Media</h2>
        <IconButton id="btn-bin-import" icon="plus" label="Import media" onClick={actions.importMedia} />
      </div>
      <div id="bin-list" className="bin-list">
        {!media.length && <div className="bin-empty">Imported videos, photos and music appear here.</div>}
        {/* Imports are occasional, so new items get a short entrance; existing ones never animate. */}
        <AnimatePresence initial={false}>
          {media.map((m) => (
            <motion.div
              key={m.id}
              layout="position"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: enter }}
              exit={{ opacity: 0, scale: 0.98, transition: exit }}
              className={`bin-item ${m.kind}`}
              draggable={m.kind !== 'audio'}
              title={m.path}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-clipcraft-media', m.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <div className="bin-thumb" style={m.thumbnail ? { backgroundImage: `url("${m.thumbnail}")` } : undefined}>
                {m.kind === 'audio' && <Icon name="music" />}
              </div>
              <div className="bin-meta">
                <div className="bin-name" dir="auto">{m.name}</div>
                <div className="bin-sub">
                  {m.kind === 'image' ? 'Photo' : `${m.kind === 'audio' ? 'Audio' : 'Video'} · ${formatTime(m.duration)}`}
                </div>
              </div>
              <IconButton icon={m.kind === 'audio' ? 'music' : 'plus'} size={16}
                label={m.kind === 'audio' ? 'Use as music' : 'Add to end of timeline'}
                onClick={() => addMediaToTimeline(m)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
