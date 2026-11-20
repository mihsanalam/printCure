const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { IPC } = require('../shared/constants.cjs');
const { getLanIp } = require('./lan-ip.cjs');
const { startStaticServer } = require('./static-server.cjs');
const { createDesktopWindow } = require('./windows/desktop-window.cjs');
const { printFile, listPrinters } = require('./system/printing.cjs');
const { openReceivedFile } = require('./system/open-file.cjs');
const {
  getPrinterName,
  setPrinterName,
  getPricing,
  setPricing,
  hasOwnerPin,
  unlockOwner,
  setOwnerPin,
  getPaymentAccount,
  setPaymentAccount,
} = require('./config.cjs');
const { createAdminWindow } = require('./windows/admin-window.cjs');

let staticServer = null;
let adminWindow = null;

function openAdminWindow(origin) {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.focus();
    return;
  }
  adminWindow = createAdminWindow(origin);
  adminWindow.on('closed', () => {
    adminWindow = null;
  });
}

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

  ipcMain.handle(IPC.PRICING_GET, () => getPricing());
  ipcMain.handle(IPC.PRICING_SET, async (_event, pricing) => setPricing(pricing));
  ipcMain.handle(IPC.ADMIN_HAS_PIN, () => hasOwnerPin());
  ipcMain.handle(IPC.ADMIN_UNLOCK, async (_event, pin) => unlockOwner(pin));
  ipcMain.handle(IPC.ADMIN_SET_PIN, async (_event, pin) => setOwnerPin(pin));
  ipcMain.on(IPC.ADMIN_OPEN, () => openAdminWindow(session.origin));
  ipcMain.handle(IPC.PAYMENT_ACCOUNT_GET, () => getPaymentAccount());
  ipcMain.handle(IPC.PAYMENT_ACCOUNT_SET, async (_event, account) => setPaymentAccount(account));

  ipcMain.on(IPC.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on(IPC.WINDOW_MAXIMIZE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on(IPC.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, (event) =>
    Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized())
  );

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
