const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { IPC } = require('../shared/constants.cjs');
const { getLanIp } = require('./lan-ip.cjs');
const { startStaticServer } = require('./static-server.cjs');
const { createDesktopWindow } = require('./windows/desktop-window.cjs');
const { printFile, listPrinters } = require('./system/printing.cjs');
const { openReceivedFile } = require('./system/open-file.cjs');
const { getPrinterName, setPrinterName } = require('./config.cjs');

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

  ipcMain.handle(IPC.PRINT_FILE, async (_event, payload) => {
    const printerName = await getPrinterName();
    return printFile({ ...payload, printerName });
  });

  ipcMain.handle(IPC.PRINTERS_LIST, async (event) => {
    try {
      return { ok: true, printers: await listPrinters(event.sender) };
    } catch (error) {
      return { ok: false, reason: error.message, printers: [] };
    }
  });

  ipcMain.handle(IPC.PRINTER_GET, async () => ({
    printerName: await getPrinterName(),
  }));

  ipcMain.handle(IPC.PRINTER_SET, async (_event, printerName) => {
    try {
      return { ok: true, printerName: await setPrinterName(printerName) };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  });

  ipcMain.handle(IPC.FILE_OPEN, async (_event, filePath) => openReceivedFile(filePath));

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
