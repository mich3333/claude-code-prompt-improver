// Export dialog: output settings -> progress -> result.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ASPECTS, formatTime, frameSize, totalDuration } from '../../shared/timeline.js';
import { textFadeDuration } from '../../shared/ffmpeg.js';
import { EASE_OUT, enter, exit } from '../motion.js';
import { store, ui, useAtom, useStore } from '../state.js';
import { renderTextPng } from '../text-render.js';
import { Button } from './controls.jsx';

const RESOLUTIONS = { 720: '720p (HD)', 1080: '1080p (Full HD)', 1440: '1440p (2K)', 2160: '2160p (4K)' };
const FPS = { 24: '24 פריימים (קולנועי)', 25: '25 פריימים', 30: '30 פריימים', 60: '60 פריימים (חלק)' };
const QUALITY = { 18: 'איכות גבוהה', 21: 'רגילה', 26: 'קובץ קטן' };
const SETTINGS_KEY = 'clipcraft.export';
const DEFAULTS = { resolution: '1080', fps: '30', crf: '21' };

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // remembered settings are a convenience only
  }
}

function Field({ label, options, value, onChange }) {
  return (
    <label className="modal-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

function DialogBody({ close, setBusy }) {
  useStore();
  const [settings, setSettings] = useState(loadSettings);
  const [phase, setPhase] = useState({ name: 'settings' });
  const [progress, setProgress] = useState(0);
  const started = useRef(0);
  const set = (k) => (v) => setSettings((s) => ({ ...s, [k]: v }));
  const { width, height } = frameSize(store.project.aspect, Number(settings.resolution));

  const start = async () => {
    saveSettings(settings);
    const base = (store.filePath?.split(/[\\/]/).pop() ?? 'הסרטון שלי').replace(/\.clipcraft$/i, '');
    const output = await window.api.chooseExportPath(`${base}.mp4`);
    if (!output) return;
    const project = JSON.parse(JSON.stringify(store.project));
    delete project.media;
    for (const c of [...project.clips, ...(project.overlays ?? [])]) delete c.thumbnail;

    setBusy(true);
    setProgress(0);
    setPhase({ name: 'running', output, label: 'מתכונן…' });
    started.current = performance.now();
    const off = window.api.onExportProgress((p) => {
      setProgress(p);
      const elapsed = (performance.now() - started.current) / 1000;
      const eta = p > 0.02 ? (elapsed / p) * (1 - p) : null;
      setPhase((ph) => ({ ...ph, label: `${Math.floor(p * 100)}%${eta != null ? ` · נותרו בערך ${formatTime(eta)}` : ''}` }));
    });
    let result;
    try {
      const texts = [];
      for (const t of project.texts) {
        if (!t.text?.trim() || !(t.end > t.start)) continue;
        texts.push({
          png: await renderTextPng(t, width, height), start: t.start, end: t.end,
          fade: textFadeDuration(t), rise: t.animation === 'rise',
        });
      }
      setPhase((ph) => ({ ...ph, label: 'מייצא…' }));
      result = await window.api.startExport({
        project,
        opts: { output, width, height, fps: Number(settings.fps), crf: Number(settings.crf), preset: 'veryfast' },
        texts,
      });
    } catch (e) {
      result = { ok: false, error: e.message };
    } finally {
      off();
      setBusy(false);
    }
    if (result.cancelled) close();
    else setPhase({ name: result.ok ? 'done' : 'error', output, error: result.error, seconds: (performance.now() - started.current) / 1000 });
  };

  if (phase.name === 'running') {
    return (
      <>
        <h2>מייצא…</h2>
        <p className="modal-size" dir="ltr">{phase.output}</p>
        <div className="progress">
          {/* scaleX instead of width: transform-only animation stays on the compositor. */}
          <motion.div className="progress-fill" initial={false} animate={{ scaleX: progress }}
            transition={{ duration: 0.2, ease: 'linear' }} />
        </div>
        <div className="progress-label">{phase.label}</div>
        <div className="modal-actions">
          <Button onClick={() => window.api.cancelExport()}>ביטול</Button>
        </div>
      </>
    );
  }
  if (phase.name === 'done') {
    return (
      <>
        <h2>הייצוא הסתיים</h2>
        <p className="modal-size">נשמר תוך {formatTime(phase.seconds)} ב: <bdi dir="ltr">{phase.output}</bdi></p>
        <div className="modal-actions">
          <Button onClick={close}>סגירה</Button>
          <Button variant="primary" onClick={() => window.api.showInFolder(phase.output)}>הצגה בתיקייה</Button>
        </div>
      </>
    );
  }
  if (phase.name === 'error') {
    return (
      <>
        <h2>הייצוא נכשל</h2>
        <pre className="modal-error" dir="ltr">{phase.error || 'Unknown error'}</pre>
        <div className="modal-actions"><Button onClick={close}>סגירה</Button></div>
      </>
    );
  }
  return (
    <>
      <h2>ייצוא סרטון</h2>
      <Field label="מסגרת" value={store.project.aspect}
        options={Object.fromEntries(Object.entries(ASPECTS).map(([k, a]) => [k, a.label]))}
        onChange={(v) => store.update((p) => { p.aspect = v; })} />
      <Field label="רזולוציה" options={RESOLUTIONS} value={settings.resolution} onChange={set('resolution')} />
      <Field label="קצב פריימים" options={FPS} value={settings.fps} onChange={set('fps')} />
      <Field label="איכות" options={QUALITY} value={settings.crf} onChange={set('crf')} />
      <div className="modal-size">
        {width} × {height} · {formatTime(totalDuration(store.project), true)} · MP4 (H.264 + AAC)
      </div>
      <div className="modal-actions">
        <Button onClick={close}>ביטול</Button>
        <Button id="export-go" variant="primary" icon="export" onClick={start}>ייצוא…</Button>
      </div>
    </>
  );
}

export function ExportDialog() {
  const open = useAtom(ui.exportOpen);
  const [busy, setBusy] = useState(false);
  const close = () => ui.exportOpen.set(false);
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
          {/* Enter from 0.96 (never from 0) with a strong ease-out; exit is quicker. */}
          <motion.div
            className="modal"
            role="dialog"
            aria-label="ייצוא סרטון"
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
