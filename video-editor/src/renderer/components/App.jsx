// Root layout plus app-wide wiring: toolbar, keyboard, menus, file drops.

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ASPECTS } from '../../shared/timeline.js';
import { actions, addMediaItems } from '../actions.js';
import { enter, exit } from '../motion.js';
import { isTyping, player, store, timelineApi, ui, useAtom, useStore } from '../state.js';
import { Button, IconButton } from './controls.jsx';
import { CaptionsDialog } from './CaptionsDialog.jsx';
import { ExportDialog } from './ExportDialog.jsx';
import { Inspector } from './Inspector.jsx';
import { MediaBin } from './MediaBin.jsx';
import { Preview } from './Preview.jsx';
import { Timeline } from './Timeline.jsx';
import { Toaster } from './Toaster.jsx';

function Toolbar() {
  useStore();
  const name = store.filePath ? store.filePath.split(/[\\/]/).pop().replace(/\.clipcraft$/i, '') : 'ללא שם';
  const label = `${name}${store.dirty ? ' •' : ''}`;
  useEffect(() => {
    document.title = `${label} — ClipCraft`;
  }, [label]);
  const canUndo = store.past.length > 0 || store.committed !== JSON.stringify(store.project);
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo">▶</span> ClipCraft <span id="project-name" className="project-name">{label}</span>
      </div>
      <div className="tool-group">
        <Button id="btn-import" icon="film" onClick={actions.importMedia} title="ייבוא סרטונים ותמונות (Ctrl+I)">ייבוא מדיה</Button>
        <Button id="btn-text" icon="text" onClick={actions.addText} title="הוספת טקסט בסמן הניגון (T)">הוספת טקסט</Button>
        <Button id="btn-music" icon="music" onClick={actions.addMusic} title="הוספת מוזיקת רקע (Ctrl+M)">הוספת מוזיקה</Button>
        <Button id="btn-captions" icon="captions" onClick={actions.captions} disabled={!store.project.clips.length}
          title="כתוביות אוטומטיות מהדיבור בסרטון">כתוביות</Button>
      </div>
      <div className="tool-group">
        <IconButton id="btn-undo" icon="undo" label="ביטול (Ctrl+Z)" disabled={!canUndo} onClick={() => store.undo()} />
        <IconButton id="btn-redo" icon="redo" label="שחזור (Ctrl+Y)" disabled={!store.future.length} onClick={() => store.redo()} />
      </div>
      <div className="spacer" />
      <label className="aspect-picker" title="גודל מסגרת">
        <span>מסגרת</span>
        <select id="aspect" value={store.project.aspect} onChange={(e) => store.update((p) => { p.aspect = e.target.value; })}>
          {Object.entries(ASPECTS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
        </select>
      </label>
      <Button id="btn-export" variant="primary" icon="export" disabled={!store.project.clips.length}
        onClick={actions.export} title="ייצוא סרטון (Ctrl+E)">ייצוא</Button>
    </header>
  );
}

function DropOverlay() {
  const active = useAtom(ui.dropActive);
  return (
    <AnimatePresence>
      {active && (
        <motion.div className="drop-overlay" initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1, transition: enter }} exit={{ opacity: 0, transition: exit }}>
          שחררו כדי לייבא
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function useGlobalHandlers() {
  useEffect(() => {
    const onKey = (e) => {
      if (ui.exportOpen.get() || ui.captionsOpen.get()) return;
      if (e.key === 'Escape') {
        if (isTyping()) document.activeElement.blur();
        else store.select(null);
        return;
      }
      if (isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? 1 : 1 / 30;
      const seek = (t) => {
        e.preventDefault();
        player.pause();
        player.seek(t);
      };
      // Match physical keys (e.code), so S/T still work on a Hebrew keyboard layout.
      switch (e.code) {
        case 'Space': e.preventDefault(); player.toggle(); break;
        case 'KeyS': actions.split(); break;
        case 'KeyT': e.preventDefault(); actions.addText(); break;
        case 'Delete': case 'Backspace': actions.remove(); break;
        case 'ArrowLeft': seek(player.time - step); break;
        case 'ArrowRight': seek(player.time + step); break;
        case 'Home': seek(0); break;
        case 'End': seek(player.duration); break;
        case 'Equal': case 'NumpadAdd': timelineApi.zoomBy?.(1.25); break;
        case 'Minus': case 'NumpadSubtract': timelineApi.zoomBy?.(1 / 1.25); break;
        default:
      }
    };

    const onDragOver = (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      if (!ui.dropActive.get()) ui.dropActive.set(true);
    };
    const onDragLeave = (e) => {
      if (!e.relatedTarget) ui.dropActive.set(false);
    };
    const onDrop = async (e) => {
      ui.dropActive.set(false);
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean);
      if (paths.length) addMediaItems(await window.api.probePaths(paths));
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    const commands = {
      new: actions.newProject,
      open: actions.open,
      save: () => actions.save(false),
      saveAs: () => actions.save(true),
      import: actions.importMedia,
      music: actions.addMusic,
      export: actions.export,
      undo: actions.undo,
      redo: actions.redo,
      shortcuts: actions.shortcuts,
    };
    const offMenu = window.api.onMenuCommand((name) => commands[name]?.());
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      offMenu?.();
    };
  }, []);
}

export function App() {
  useGlobalHandlers();
  return (
    <>
      <Toolbar />
      <main className="workspace">
        <MediaBin />
        <Preview />
        <Inspector />
      </main>
      <Timeline />
      <ExportDialog />
      <CaptionsDialog />
      <DropOverlay />
      <Toaster />
    </>
  );
}
