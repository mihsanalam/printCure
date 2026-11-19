const path = require('node:path');
const { BrowserWindow } = require('electron');

function createDesktopWindow(origin) {
  const window = new BrowserWindow({
    width: 900,
    height: 780,
    minWidth: 640,
    minHeight: 560,
    backgroundColor: '#ffffff',
    title: 'PrintCure',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.loadURL(`${origin}/desktop.html`);

  if (process.env.VITE_DEV_SERVER_URL) {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  return window;
}

module.exports = { createDesktopWindow };
