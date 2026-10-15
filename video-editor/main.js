// Electron main process: window, menus, file dialogs, media probing, export.

import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, shell } from 'electron';
import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportProject, probe } from './src/main/media.js';

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
      buttons: ['Quit without saving', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'You have unsaved changes.',
      detail: 'Your edits will be lost if you quit now.',
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
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: cmd('new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: cmd('open') },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: cmd('save') },
        { label: 'Save Project As…', accelerator: 'CmdOrCtrl+Shift+S', click: cmd('saveAs') },
        { type: 'separator' },
        { label: 'Import Media…', accelerator: 'CmdOrCtrl+I', click: cmd('import') },
        { label: 'Add Music…', accelerator: 'CmdOrCtrl+M', click: cmd('music') },
        { type: 'separator' },
        { label: 'Export Video…', accelerator: 'CmdOrCtrl+E', click: cmd('export') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: cmd('undo') },
        { label: 'Redo', accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: cmd('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    { role: 'help', submenu: [{ label: 'Keyboard Shortcuts', click: cmd('shortcuts') }] },
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
      ? [{ name: 'Audio', extensions: AUDIO_EXT }]
      : [
          { name: 'Videos and images', extensions: [...VIDEO_EXT, ...IMAGE_EXT] },
          { name: 'All files', extensions: ['*'] },
        ];
  const res = await dialog.showOpenDialog(win, {
    title: kind === 'music' ? 'Add music' : 'Import media',
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
      title: 'Save project',
      defaultPath: filePath || `My video.${PROJECT_EXT}`,
      filters: [{ name: 'ClipCraft project', extensions: [PROJECT_EXT] }],
    });
    if (res.canceled || !res.filePath) return null;
    target = res.filePath;
  }
  await writeFile(target, json, 'utf8');
  return target;
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Open project',
    properties: ['openFile'],
    filters: [{ name: 'ClipCraft project', extensions: [PROJECT_EXT] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const filePath = res.filePaths[0];
  const project = JSON.parse(await readFile(filePath, 'utf8'));
  const paths = [
    ...(project.clips ?? []).map((c) => c.path),
    ...(project.media ?? []).map((m) => m.path),
    ...(project.music ? [project.music.path] : []),
  ];
  allowMedia(paths);
  const missing = [...new Set(paths)].filter((p) => !existsSync(p));
  return { filePath, project, missing };
});

ipcMain.handle('project:dirty', (_e, value) => {
  dirty = Boolean(value);
});

ipcMain.handle('export:choose', async (_e, defaultName) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export video',
    defaultPath: path.join(app.getPath('videos'), defaultName || 'My video.mp4'),
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  });
  return res.canceled ? null : res.filePath;
});

ipcMain.handle('export:start', async (_e, { project, opts, texts }) => {
  if (exportJob) throw new Error('An export is already running.');
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
