const path = require('node:path');
const { BrowserWindow } = require('electron');

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '../../../dist/index.html'));
  }

  return window;
}

module.exports = { createMainWindow };
