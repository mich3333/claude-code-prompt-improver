import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatTime } from '../../shared/timeline.js';
import { TEMPLATES } from '../../shared/templates.js';
import { actions, addMediaToTimeline } from '../actions.js';
import { enter, exit } from '../motion.js';
import { store, useStore } from '../state.js';
import { Icon } from './Icon.jsx';
import { IconButton, Segmented } from './controls.jsx';

function MediaList() {
  const media = store.project.media ?? [];
  return (
    <div id="bin-list" className="bin-list">
      {!media.length && <div className="bin-empty">סרטונים, תמונות ומוזיקה שתייבאו יופיעו כאן.</div>}
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
                {m.kind === 'image' ? 'תמונה' : `${m.kind === 'audio' ? 'שמע' : 'וידאו'} · ${formatTime(m.duration)}`}
              </div>
            </div>
            <IconButton icon={m.kind === 'audio' ? 'music' : 'plus'} size={16}
              label={m.kind === 'audio' ? 'שימוש כמוזיקת רקע' : 'הוספה לסוף ציר הזמן'}
              onClick={() => addMediaToTimeline(m)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TemplateList() {
  return (
    <div className="tpl-list">
      <p className="tpl-intro">בסגנון Claude: שמנת חמימה, טרקוטה, סריף עריכתי ותנועה רגועה.</p>
      {TEMPLATES.map((t) => (
        <button key={t.id} type="button" className="tpl-card" data-template={t.id} onClick={() => actions.applyTemplate(t.id)}>
          <span className="tpl-preview" style={{ background: t.preview.bg }}>
            {t.preview.box ? (
              <span className="tpl-lower" style={{ background: t.preview.box, color: t.preview.title }}>שם · תפקיד</span>
            ) : (
              <>
                <span className="tpl-title" style={{ color: t.preview.title }}>{t.id === 'warm-grade' ? 'חמים' : 'כותרת'}</span>
                <span className="tpl-sub" style={{ background: t.preview.sub }} />
              </>
            )}
          </span>
          <span className="tpl-meta">
            <span className="tpl-name">{t.name}</span>
            <span className="tpl-desc">{t.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function MediaBin() {
  useStore();
  const [tab, setTab] = useState('media');
  return (
    <aside className="bin panel">
      <div className="panel-head">
        <Segmented value={tab} options={{ media: 'מדיה', templates: 'תבניות' }} onChange={setTab} layout="tabs" />
        {tab === 'media' && <IconButton id="btn-bin-import" icon="plus" label="ייבוא מדיה" onClick={actions.importMedia} />}
      </div>
      {tab === 'media' ? <MediaList /> : <TemplateList />}
    </aside>
  );
}
