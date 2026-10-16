import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatTime } from '../../shared/timeline.js';
import { TEMPLATES } from '../../shared/templates.js';
import { actions, addGraphic, addMediaToTimeline, addOverlay, redCaptions } from '../actions.js';
import { GOLD, GRAPHIC_TYPES } from '../../shared/graphics.js';
import { enter, exit } from '../motion.js';
import { store, ui, useAtom, useStore } from '../state.js';
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
            <div className="bin-actions">
              {m.kind !== 'audio' && (
                <IconButton icon="layers" size={16} className="bin-overlay" label="הוספה כשכבה עליונה (מסך מפוצל) בסמן הניגון"
                  onClick={() => addOverlay(m)} />
              )}
              <IconButton icon={m.kind === 'audio' ? 'music' : 'plus'} size={16}
                label={m.kind === 'audio' ? 'שימוש כמוזיקת רקע' : 'הוספה לסוף ציר הזמן'}
                onClick={() => addMediaToTimeline(m)} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Mini previews of the black-and-gold graphics.
function GoldPreview({ type }) {
  if (type === 'bars') {
    return (
      <span className="gold-bars">
        {[30, 55, 75, 100].map((h) => <span key={h} style={{ height: `${h}%` }} />)}
      </span>
    );
  }
  if (type === 'year') return <span className="gold-year">2021</span>;
  if (type === 'quote') return <span className="gold-quote"><span /><span /><span /></span>;
  if (type === 'captions') return <span className="gold-caption">ככה זה מתחיל</span>;
  return <span className="gold-number">$2T</span>;
}

function GoldTemplates() {
  const busy = useAtom(ui.graphicBusy);
  const items = [
    ...Object.entries(GRAPHIC_TYPES).map(([id, t]) => ({ id, name: t.name, description: t.description, run: () => addGraphic(id) })),
    { id: 'captions', name: 'כתוביות אדומות', description: 'כתוביות אדומות על קו החיבור של המסך המפוצל', run: redCaptions },
  ];
  return (
    <>
      <p className="tpl-intro tpl-group">שחור וזהב · בסגנון הרפרנס: גרפיקה למעלה, אתם למטה.</p>
      {items.map((t) => (
        <button key={t.id} type="button" className="tpl-card" data-template={`gold-${t.id}`} disabled={busy} onClick={t.run}>
          <span className="tpl-preview gold-preview" style={{ background: GOLD.bg }}>
            <GoldPreview type={t.id} />
          </span>
          <span className="tpl-meta">
            <span className="tpl-name">{t.name}</span>
            <span className="tpl-desc">{busy && t.id !== 'captions' ? 'יוצר גרפיקה…' : t.description}</span>
          </span>
        </button>
      ))}
    </>
  );
}

function TemplateList() {
  return (
    <div className="tpl-list">
      <GoldTemplates />
      <p className="tpl-intro tpl-group">בהיר וחמים · בסגנון Claude: שמנת חמימה, טרקוטה, סריף עריכתי ותנועה רגועה.</p>
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
