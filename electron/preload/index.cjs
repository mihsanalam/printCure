const { contextBridge, ipcRenderer } = require('electron');

// Channel names mirror electron/shared/constants.cjs.
// They are inlined because sandboxed preload scripts cannot require local files.
contextBridge.exposeInMainWorld('printCure', {
  isDesktop: true,
  getSessionInfo: () => ipcRenderer.invoke('session:info'),
  printFile: (payload) => ipcRenderer.invoke('print:file', payload),
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  getPrinterConfig: () => ipcRenderer.invoke('printer:get'),
  setPrinter: (printerName) => ipcRenderer.invoke('printer:set', printerName),
  openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
  windowControls: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  },
  getPricing: () => ipcRenderer.invoke('pricing:get'),
  setPricing: (pricing) => ipcRenderer.invoke('pricing:set', pricing),
  hasOwnerPin: () => ipcRenderer.invoke('admin:has-pin'),
  unlockOwner: (pin) => ipcRenderer.invoke('admin:unlock', pin),
  setOwnerPin: (pin) => ipcRenderer.invoke('admin:set-pin', pin),
  openOwnerPanel: () => ipcRenderer.send('admin:open'),
  getPaymentAccount: () => ipcRenderer.invoke('payment:account-get'),
  setPaymentAccount: (account) => ipcRenderer.invoke('payment:account-set', account),
});
