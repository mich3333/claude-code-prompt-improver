// Narrow bridge between the sandboxed renderer and the main process.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  importMedia: (kind) => ipcRenderer.invoke('media:import', kind),
  probePaths: (paths) => ipcRenderer.invoke('media:probe', paths),
  pathForFile: (file) => webUtils.getPathForFile(file),
  saveProject: (args) => ipcRenderer.invoke('project:save', args),
  openProject: () => ipcRenderer.invoke('project:open'),
  setDirty: (value) => ipcRenderer.invoke('project:dirty', value),
  chooseExportPath: (name) => ipcRenderer.invoke('export:choose', name),
  startExport: (args) => ipcRenderer.invoke('export:start', args),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  showInFolder: (p) => ipcRenderer.invoke('shell:show', p),
  onExportProgress: (cb) => {
    const listener = (_e, p) => cb(p);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },
  onMenuCommand: (cb) => {
    const listener = (_e, name) => cb(name);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },
});
