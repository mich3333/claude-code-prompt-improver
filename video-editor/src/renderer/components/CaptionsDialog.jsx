// Automatic captions: ElevenLabs API key -> options -> transcribing -> captions
// added to the text track (one undo step).

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CAPTION_LANGUAGES, CAPTION_POSITIONS, captionSources, captionTexts, defaultCaptionPosition, groupWords,
  toTimelineWords,
} from '../../shared/captions.js';
import { formatTime } from '../../shared/timeline.js';
import { EASE_OUT, enter, exit } from '../motion.js';
import { player, store, ui, useAtom, useStore } from '../state.js';
import { toast } from '../toast.js';
import { Button, Segmented } from './controls.jsx';

const SETTINGS_KEY = 'clipcraft.captions';
const WORDS = { 1: 'מילה', 2: '2', 3: '3', 4: '4' };

function loadSettings() {
  try {
    return { language: 'auto', words: '3', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { language: 'auto', words: '3' };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: s.language, words: s.words }));
  } catch {
    // remembered settings are a convenience only
  }
}

function KeyField({ status, onSaved }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  if (status.hasKey) {
    return (
      <div className="modal-field">
        <span>מפתח API</span>
        <span className="key-saved">
          ✓ {status.saved ? 'שמור במחשב הזה' : 'בשימוש עד סגירת העורך'}
          <button type="button" className="link-btn" onClick={async () => {
            await window.api.forgetCaptionsKey();
            onSaved();
          }}>החלפה</button>
        </span>
      </div>
    );
  }
  const save = async () => {
    if (!key.trim()) return;
    await window.api.setCaptionsKey({ key, remember: remember && status.canSave });
    setKey('');
    onSaved();
  };
  return (
    <>
      <label className="modal-field">
        <span>מפתח API</span>
        <input id="captions-key" type="password" dir="ltr" autoComplete="off" spellCheck="false" placeholder="sk_…"
          value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
      <div className="key-row">
        {status.canSave && (
          <label className="check">
            <input id="captions-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            לזכור במחשב הזה (מוצפן)
          </label>
        )}
        <Button id="captions-key-save" onClick={save} disabled={!key.trim()}>שמירה</Button>
      </div>
      <p className="modal-size">את המפתח יוצרים באתר ElevenLabs, בהגדרות החשבון, תחת API Keys.</p>
    </>
  );
}

function DialogBody({ close, setBusy }) {
  useStore();
  const [settings, setSettings] = useState(loadSettings);
  const [position, setPosition] = useState(() => defaultCaptionPosition(store.project));
  const [replace, setReplace] = useState(true);
  const [status, setStatus] = useState(null);
  const [phase, setPhase] = useState({ name: 'settings' });
  const refreshKey = () => window.api.captionsKeyStatus().then(setStatus);
  useEffect(() => {
    refreshKey();
  }, []);

  const sources = captionSources(store.project);
  const seconds = sources.reduce((sum, s) => sum + (s.out - s.in), 0);
  const existing = store.project.texts.filter((t) => t.caption).length;
  const set = (k) => (v) => setSettings((s) => ({ ...s, [k]: v }));

  const start = async () => {
    saveSettings(settings);
    setBusy(true);
    setPhase({ name: 'running', label: 'מכין את הסאונד…', progress: 0 });
    const off = window.api.onCaptionsProgress(({ index, total, stage }) => {
      const label = stage === 'audio'
        ? 'מכין את הסאונד…'
        : `מתמלל${total > 1 ? ` קליפ ${index + 1} מתוך ${total}` : ''}…`;
      setPhase({ name: 'running', label, progress: (index + (stage === 'audio' ? 0.1 : 0.4)) / total });
    });
    let res;
    try {
      res = await window.api.runCaptions({ sources, language: settings.language });
    } catch (e) {
      res = { ok: false, error: e.message };
    } finally {
      off();
      setBusy(false);
    }
    if (res.cancelled) {
      setPhase({ name: 'settings' });
      return;
    }
    if (!res.ok) {
      setPhase({ name: 'error', error: res.error });
      refreshKey();
      return;
    }
    const words = res.results.flatMap((r) => toTimelineWords(sources.find((s) => s.id === r.id), r.words));
    if (!words.length) {
      setPhase({ name: 'error', error: 'לא זוהה דיבור בסרטון.' });
      return;
    }
    const texts = captionTexts(groupWords(words, { maxWords: Number(settings.words) }), { position });
    store.update((p) => {
      if (replace) p.texts = p.texts.filter((t) => !t.caption);
      p.texts.push(...texts);
    });
    store.select(null);
    player.seek(texts[0].start);
    close();
    toast(`נוספו ${texts.length} כתוביות. אפשר לתקן כל אחת במסלול הטקסט.`, 'success', 4000);
  };

  if (phase.name === 'running') {
    return (
      <>
        <h2>יוצר כתוביות…</h2>
        <div className="progress">
          <motion.div className="progress-fill" initial={false} animate={{ scaleX: phase.progress }}
            transition={{ duration: 0.3, ease: EASE_OUT }} />
        </div>
        <div className="progress-label">{phase.label}</div>
        <div className="modal-actions">
          <Button onClick={() => window.api.cancelCaptions()}>ביטול</Button>
        </div>
      </>
    );
  }
  if (phase.name === 'error') {
    return (
      <>
        <h2>לא הצלחנו ליצור כתוביות</h2>
        <p className="modal-error" dir="auto">{phase.error}</p>
        <div className="modal-actions">
          <Button onClick={close}>סגירה</Button>
          <Button variant="primary" onClick={() => setPhase({ name: 'settings' })}>חזרה</Button>
        </div>
      </>
    );
  }
  return (
    <>
      <h2>כתוביות אוטומטיות</h2>
      <p className="modal-size">
        הדיבור בסרטון מתומלל ב-ElevenLabs Scribe (הסאונד נשלח אליהם), והכתוביות נוספות למסלול הטקסט.
        אפשר לתקן או להזיז כל אחת.
      </p>
      {status && <KeyField status={status} onSaved={refreshKey} />}
      <label className="modal-field">
        <span>שפת הדיבור</span>
        <select id="captions-language" value={settings.language} onChange={(e) => set('language')(e.target.value)}>
          {Object.entries(CAPTION_LANGUAGES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <div className="modal-field">
        <span>מילים בכל כתובית</span>
        <Segmented value={settings.words} options={WORDS} onChange={(v) => set('words')(String(v))} />
      </div>
      <div className="modal-field">
        <span>מיקום</span>
        <Segmented value={position} options={CAPTION_POSITIONS} onChange={setPosition} />
      </div>
      {existing > 0 && (
        <label className="check">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          להחליף את {existing} הכתוביות הקיימות
        </label>
      )}
      <div className="modal-size">
        {sources.length
          ? `${sources.length} ${sources.length === 1 ? 'קליפ' : 'קליפים'} עם סאונד · ${formatTime(seconds)} של דיבור לתמלול`
          : 'אין בציר הזמן קליפים עם סאונד (קליפים מושתקים לא מתומללים).'}
      </div>
      <div className="modal-actions">
        <Button onClick={close}>ביטול</Button>
        <Button id="captions-go" variant="primary" icon="captions" onClick={start}
          disabled={!status?.hasKey || !sources.length}>יצירת כתוביות</Button>
      </div>
    </>
  );
}

export function CaptionsDialog() {
  const open = useAtom(ui.captionsOpen);
  const [busy, setBusy] = useState(false);
  const close = () => ui.captionsOpen.set(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: enter }}
          exit={{ opacity: 0, transition: exit }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget && !busy) close();
          }}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-label="כתוביות אוטומטיות"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: 0.97, transition: exit }}
          >
            <DialogBody close={close} setBusy={setBusy} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
