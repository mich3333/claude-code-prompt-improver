// Electron main process: window, menus, file dialogs, media probing, export.

import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, safeStorage, shell } from 'electron';
import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportProject, extractAudio, probe } from './src/main/media.js';
import { transcribe } from './src/main/scribe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'mts', 'm2ts', '3gp'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'];
const PROJECT_EXT = 'clipcraft';

const MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', '3gp': 'video/3gpp', mts: 'video/mp2t', m2ts: 'video/mp2t',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac', opus: 'audio/ogg',
};

// The editor loads media through media:// so it works from the dev server
// and the packaged app alike. Only files the user imported are served.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
const allowedMedia = new Set();
const allowMedia = (paths) => paths.forEach((p) => p && allowedMedia.add(path.resolve(p)));

async function serveMedia(request) {
  const filePath = path.resolve(decodeURIComponent(new URL(request.url).pathname.slice(1)));
  if (!allowedMedia.has(filePath)) return new Response('Forbidden', { status: 403 });
  let size;
  try {
    ({ size } = await stat(filePath));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const headers = {
    'Content-Type': MIME[path.extname(filePath).slice(1).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
  };
  // Video seeking needs byte-range responses.
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '');
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const body = Readable.toWeb(createReadStream(filePath, { start, end }));
    return new Response(body, {
      status: 206,
      headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` },
    });
  }
  return new Response(Readable.toWeb(createReadStream(filePath)), { headers: { ...headers, 'Content-Length': String(size) } });
}

let win = null;
let dirty = false;
let exportJob = null;

function send(channel, ...args) {
  win?.webContents.send(channel, ...args);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#111317',
    title: 'ClipCraft',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, 'build/renderer/index.html'));

  win.on('close', (e) => {
    if (!dirty) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['יציאה בלי לשמור', 'ביטול'],
      defaultId: 1,
      cancelId: 1,
      message: 'יש שינויים שלא נשמרו.',
      detail: 'אם תצאו עכשיו, העריכות יאבדו.',
    });
    if (choice === 1) e.preventDefault();
  });
  win.on('closed', () => {
    exportJob?.abort();
    win = null;
  });
}

function buildMenu() {
  const cmd = (name) => () => send('menu:command', name);
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'קובץ',
      submenu: [
        { label: 'פרויקט חדש', accelerator: 'CmdOrCtrl+N', click: cmd('new') },
        { label: 'פתיחת פרויקט…', accelerator: 'CmdOrCtrl+O', click: cmd('open') },
        { label: 'שמירת פרויקט', accelerator: 'CmdOrCtrl+S', click: cmd('save') },
        { label: 'שמירה בשם…', accelerator: 'CmdOrCtrl+Shift+S', click: cmd('saveAs') },
        { type: 'separator' },
        { label: 'ייבוא מדיה…', accelerator: 'CmdOrCtrl+I', click: cmd('import') },
        { label: 'הוספת מוזיקה…', accelerator: 'CmdOrCtrl+M', click: cmd('music') },
        { type: 'separator' },
        { label: 'ייצוא סרטון…', accelerator: 'CmdOrCtrl+E', click: cmd('export') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'עריכה',
      submenu: [
        { label: 'ביטול פעולה', accelerator: 'CmdOrCtrl+Z', click: cmd('undo') },
        { label: 'שחזור פעולה', accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: cmd('redo') },
        { type: 'separator' },
        { role: 'cut', label: 'גזירה' },
        { role: 'copy', label: 'העתקה' },
        { role: 'paste', label: 'הדבקה' },
        { role: 'selectAll', label: 'בחירת הכול' },
      ],
    },
    {
      label: 'תצוגה',
      submenu: [
        { role: 'reload', label: 'רענון' },
        { role: 'toggleDevTools', label: 'כלי מפתחים' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'מסך מלא' },
      ],
    },
    { role: 'help', label: 'עזרה', submenu: [{ label: 'קיצורי מקלדת', click: cmd('shortcuts') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function probeAll(paths) {
  const items = [];
  const errors = [];
  for (const p of paths) {
    try {
      items.push(await probe(p));
      allowMedia([p]);
    } catch (e) {
      errors.push(`${path.basename(p)}: ${e.message}`);
    }
  }
  return { items, errors };
}

ipcMain.handle('media:import', async (_e, kind) => {
  const filters =
    kind === 'music'
      ? [{ name: 'קובצי שמע', extensions: AUDIO_EXT }]
      : [
          { name: 'סרטונים ותמונות', extensions: [...VIDEO_EXT, ...IMAGE_EXT] },
          { name: 'כל הקבצים', extensions: ['*'] },
        ];
  const res = await dialog.showOpenDialog(win, {
    title: kind === 'music' ? 'הוספת מוזיקה' : 'ייבוא מדיה',
    properties: kind === 'music' ? ['openFile'] : ['openFile', 'multiSelections'],
    filters,
  });
  if (res.canceled) return { items: [], errors: [] };
  return probeAll(res.filePaths);
});

ipcMain.handle('media:probe', (_e, paths) => probeAll(paths));

ipcMain.handle('project:save', async (_e, { json, filePath, saveAs }) => {
  let target = saveAs ? null : filePath;
  if (!target) {
    const res = await dialog.showSaveDialog(win, {
      title: 'שמירת פרויקט',
      defaultPath: filePath || `הסרטון שלי.${PROJECT_EXT}`,
      filters: [{ name: 'פרויקט ClipCraft', extensions: [PROJECT_EXT] }],
    });
    if (res.canceled || !res.filePath) return null;
    target = res.filePath;
  }
  await writeFile(target, json, 'utf8');
  return target;
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'פתיחת פרויקט',
    properties: ['openFile'],
    filters: [{ name: 'פרויקט ClipCraft', extensions: [PROJECT_EXT] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const filePath = res.filePaths[0];
  const project = JSON.parse(await readFile(filePath, 'utf8'));
  const paths = [
    ...(project.clips ?? []).map((c) => c.path),
    ...(project.overlays ?? []).map((o) => o.path),
    ...(project.media ?? []).map((m) => m.path),
    ...(project.music ? [project.music.path] : []),
  ];
  allowMedia(paths);
  const missing = [...new Set(paths.filter(Boolean))].filter((p) => !existsSync(p));
  return { filePath, project, missing };
});

ipcMain.handle('project:dirty', (_e, value) => {
  dirty = Boolean(value);
});

ipcMain.handle('export:choose', async (_e, defaultName) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'ייצוא סרטון',
    defaultPath: path.join(app.getPath('videos'), defaultName || 'הסרטון שלי.mp4'),
    filters: [{ name: 'סרטון MP4', extensions: ['mp4'] }],
  });
  return res.canceled ? null : res.filePath;
});

ipcMain.handle('export:start', async (_e, { project, opts, texts }) => {
  if (exportJob) throw new Error('ייצוא אחר כבר רץ.');
  const controller = new AbortController();
  exportJob = controller;
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'clipcraft-'));
  let lastSent = 0;
  try {
    const result = await exportProject(project, opts, {
      tmpDir,
      signal: controller.signal,
      texts: texts.map((t) => ({ ...t, png: Buffer.from(t.png) })),
      onProgress: (p) => {
        const now = Date.now();
        if (p >= 1 || now - lastSent > 150) {
          lastSent = now;
          send('export:progress', p);
        }
      },
    });
    return { ok: true, output: result.output };
  } catch (e) {
    await rm(opts.output, { force: true }).catch(() => {});
    return { ok: false, cancelled: Boolean(e.cancelled), error: e.message };
  } finally {
    exportJob = null;
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

ipcMain.handle('export:cancel', () => exportJob?.abort());

// ---- automatic captions (ElevenLabs Scribe) ----
// The API key stays in the main process; on disk it is encrypted with the OS
// keychain (safeStorage) and only when the user asks to remember it.
let scribeKey = null;
let captionJob = null;
const keyFile = () => path.join(app.getPath('userData'), 'elevenlabs-key.bin');
const canSaveKey = () => {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
};

async function currentKey() {
  if (!scribeKey && canSaveKey() && existsSync(keyFile())) {
    try {
      scribeKey = safeStorage.decryptString(await readFile(keyFile()));
    } catch {
      scribeKey = null; // unreadable (e.g. keychain changed): ask again
    }
  }
  return scribeKey;
}

ipcMain.handle('captions:keyStatus', async () => ({
  hasKey: Boolean(await currentKey()),
  saved: existsSync(keyFile()),
  canSave: canSaveKey(),
}));

ipcMain.handle('captions:setKey', async (_e, { key, remember }) => {
  scribeKey = String(key ?? '').trim() || null;
  if (remember && scribeKey && canSaveKey()) await writeFile(keyFile(), safeStorage.encryptString(scribeKey));
  else await rm(keyFile(), { force: true });
  return { hasKey: Boolean(scribeKey) };
});

ipcMain.handle('captions:forgetKey', async () => {
  scribeKey = null;
  await rm(keyFile(), { force: true });
});

ipcMain.handle('captions:run', async (_e, { sources, language }) => {
  if (captionJob) return { ok: false, error: 'תמלול אחר כבר רץ.' };
  const apiKey = await currentKey();
  if (!apiKey) return { ok: false, error: 'חסר מפתח API של ElevenLabs.' };
  // Only files the user imported may be read and sent.
  if (sources.some((s) => !allowedMedia.has(path.resolve(s.path)))) return { ok: false, error: 'קובץ שלא יובא לעורך.' };
  const controller = new AbortController();
  captionJob = controller;
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'clipcraft-captions-'));
  try {
    const results = [];
    for (const [index, source] of sources.entries()) {
      send('captions:progress', { index, total: sources.length, stage: 'audio' });
      const file = await extractAudio(source, path.join(tmpDir, `audio_${index}.mp3`), { signal: controller.signal });
      send('captions:progress', { index, total: sources.length, stage: 'transcribe' });
      const { words, language: detected } = await transcribe(file, { apiKey, language, signal: controller.signal });
      results.push({ id: source.id, words, language: detected });
    }
    return { ok: true, results };
  } catch (e) {
    return { ok: false, cancelled: Boolean(e.cancelled || controller.signal.aborted), error: e.message };
  } finally {
    captionJob = null;
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

ipcMain.handle('captions:cancel', () => captionJob?.abort());

ipcMain.handle('shell:show', (_e, p) => shell.showItemInFolder(p));

app.whenReady().then(() => {
  protocol.handle('media', serveMedia);
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
