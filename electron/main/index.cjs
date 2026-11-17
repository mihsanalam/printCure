const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { IPC } = require('../shared/constants.cjs');
const { getLanIp } = require('./lan-ip.cjs');
const { startStaticServer } = require('./static-server.cjs');
const { createDesktopWindow } = require('./windows/desktop-window.cjs');
const { printFile } = require('./system/printing.cjs');

let staticServer = null;

async function resolveSession() {
  const lanIp = getLanIp();

  if (process.env.VITE_DEV_SERVER_URL) {
    const port = new URL(process.env.VITE_DEV_SERVER_URL).port || '5173';
    return {
      origin: process.env.VITE_DEV_SERVER_URL,
      webUrl: `http://${lanIp}:${port}/web.html`,
    };
  }

  const root = path.join(__dirname, '../../dist');
  const started = await startStaticServer({ root });
  staticServer = started.server;

  return {
    origin: `http://127.0.0.1:${started.port}`,
    webUrl: `http://${lanIp}:${started.port}/web.html`,
  };
}

app.whenReady().then(async () => {
  const session = await resolveSession();

  ipcMain.handle(IPC.SESSION_INFO, () => ({ webUrl: session.webUrl }));
  ipcMain.handle(IPC.PRINT_FILE, (_event, payload) => printFile(payload));

  createDesktopWindow(session.origin);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDesktopWindow(session.origin);
    }
  });
});

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
