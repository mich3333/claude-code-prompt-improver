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
const FPS = { 24: '24 fps (film)', 25: '25 fps', 30: '30 fps', 60: '60 fps (smooth)' };
const QUALITY = { 18: 'High quality', 21: 'Standard', 26: 'Smaller file' };
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
    const base = (store.filePath?.split(/[\\/]/).pop() ?? 'My video').replace(/\.clipcraft$/i, '');
    const output = await window.api.chooseExportPath(`${base}.mp4`);
    if (!output) return;
    const project = JSON.parse(JSON.stringify(store.project));
    delete project.media;
    for (const c of project.clips) delete c.thumbnail;

    setBusy(true);
    setProgress(0);
    setPhase({ name: 'running', output, label: 'Preparing…' });
    started.current = performance.now();
    const off = window.api.onExportProgress((p) => {
      setProgress(p);
      const elapsed = (performance.now() - started.current) / 1000;
      const eta = p > 0.02 ? (elapsed / p) * (1 - p) : null;
      setPhase((ph) => ({ ...ph, label: `${Math.floor(p * 100)}%${eta != null ? ` · about ${formatTime(eta)} left` : ''}` }));
    });
    let result;
    try {
      const texts = [];
      for (const t of project.texts) {
        if (!t.text?.trim() || !(t.end > t.start)) continue;
        texts.push({ png: await renderTextPng(t, width, height), start: t.start, end: t.end, fade: textFadeDuration(t) });
      }
      setPhase((ph) => ({ ...ph, label: 'Rendering…' }));
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
        <h2>Exporting…</h2>
        <p className="modal-size" dir="auto">{phase.output}</p>
        <div className="progress">
          {/* scaleX instead of width: transform-only animation stays on the compositor. */}
          <motion.div className="progress-fill" initial={false} animate={{ scaleX: progress }}
            transition={{ duration: 0.2, ease: 'linear' }} />
        </div>
        <div className="progress-label">{phase.label}</div>
        <div className="modal-actions">
          <Button onClick={() => window.api.cancelExport()}>Cancel</Button>
        </div>
      </>
    );
  }
  if (phase.name === 'done') {
    return (
      <>
        <h2>Export complete</h2>
        <p className="modal-size" dir="auto">Saved to {phase.output} in {formatTime(phase.seconds)}.</p>
        <div className="modal-actions">
          <Button onClick={close}>Close</Button>
          <Button variant="primary" onClick={() => window.api.showInFolder(phase.output)}>Show in folder</Button>
        </div>
      </>
    );
  }
  if (phase.name === 'error') {
    return (
      <>
        <h2>Export failed</h2>
        <pre className="modal-error">{phase.error || 'Unknown error'}</pre>
        <div className="modal-actions"><Button onClick={close}>Close</Button></div>
      </>
    );
  }
  return (
    <>
      <h2>Export video</h2>
      <Field label="Frame" value={store.project.aspect}
        options={Object.fromEntries(Object.entries(ASPECTS).map(([k, a]) => [k, a.label]))}
        onChange={(v) => store.update((p) => { p.aspect = v; })} />
      <Field label="Resolution" options={RESOLUTIONS} value={settings.resolution} onChange={set('resolution')} />
      <Field label="Frame rate" options={FPS} value={settings.fps} onChange={set('fps')} />
      <Field label="Quality" options={QUALITY} value={settings.crf} onChange={set('crf')} />
      <div className="modal-size">
        {width} × {height} · {formatTime(totalDuration(store.project), true)} · MP4 (H.264 + AAC)
      </div>
      <div className="modal-actions">
        <Button onClick={close}>Cancel</Button>
        <Button id="export-go" variant="primary" icon="export" onClick={start}>Export…</Button>
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
            aria-label="Export video"
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
