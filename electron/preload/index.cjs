const { contextBridge, ipcRenderer } = require('electron');

// Channel names mirror electron/shared/constants.cjs.
// They are inlined because sandboxed preload scripts cannot require local files.
contextBridge.exposeInMainWorld('printCure', {
  isDesktop: true,
  getSessionInfo: () => ipcRenderer.invoke('session:info'),
  printFile: (payload) => ipcRenderer.invoke('print:file', payload),
});
