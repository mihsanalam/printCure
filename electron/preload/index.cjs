const { contextBridge, ipcRenderer } = require('electron');

// Channel names mirror electron/shared/constants.cjs.
// They are inlined because sandboxed preload scripts cannot require local files.
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  notify: (title, body) => ipcRenderer.invoke('system:notify', { title, body }),
});
