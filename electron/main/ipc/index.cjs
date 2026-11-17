const { app, ipcMain } = require('electron');
const { IPC } = require('../../shared/constants.cjs');
const { showNotification } = require('../system/notifications.cjs');

function registerIpcHandlers() {
  ipcMain.handle(IPC.APP_INFO, () => ({
    mode: 'desktop',
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));

  ipcMain.handle(IPC.NOTIFY, (_event, payload) => showNotification(payload));
}

module.exports = { registerIpcHandlers };
