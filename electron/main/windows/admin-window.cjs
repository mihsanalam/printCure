const path = require('node:path');
const { BrowserWindow } = require('electron');

function createAdminWindow(origin) {
  const window = new BrowserWindow({
    width: 620,
    height: 700,
    minWidth: 520,
    minHeight: 520,
    backgroundColor: '#ffffff',
    title: 'PrintCure - Owner panel',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.loadURL(`${origin}/admin.html`);

  if (process.env.VITE_DEV_SERVER_URL) {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  return window;
}

module.exports = { createAdminWindow };
