const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

const MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'application/pdf': '.pdf',
};

const PAGE_SIZES = new Set(['A4', 'A5', 'A3', 'Letter', 'Legal', 'Tabloid']);

function sanitizeName(name) {
  const cleaned = String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  return cleaned || 'file';
}

function normalizeSettings(settings = {}) {
  const copies = Math.min(Math.max(Number.parseInt(settings.copies, 10) || 1, 1), 99);
  const pageSize = PAGE_SIZES.has(settings.pageSize) ? settings.pageSize : 'A4';
  return { copies, pageSize, landscape: Boolean(settings.landscape) };
}

async function printFile({ name, mime, settings, data } = {}) {
  if (!data) {
    return { ok: false, reason: 'No file data was received.' };
  }

  const buffer = Buffer.from(data);
  const printSettings = normalizeSettings(settings);
  const safeName = sanitizeName(path.basename(name || 'file', path.extname(name || '')));
  const extension = path.extname(name || '') || MIME_EXTENSIONS[mime] || '.bin';

  const directory = path.join(app.getPath('temp'), 'printcure');
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${Date.now()}-${safeName}${extension}`);
  await fs.writeFile(filePath, buffer);

  const isImage = IMAGE_MIME_TYPES.has(mime);
  const isPdf = mime === 'application/pdf';

  if (!isImage && !isPdf) {
    return {
      ok: false,
      reason: 'Only images and PDF files can be printed.',
      filePath,
    };
  }

  if (process.env.PRINTCURE_DRY_RUN === '1') {
    return { ok: true, dryRun: true, filePath };
  }

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });

  try {
    if (isPdf) {
      await printWindow.loadURL(pathToFileURL(filePath).href);
    } else {
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>PrintCure</title></head>
  <body>
    <img src="${dataUrl}" alt="" width="100%" />
  </body>
</html>`;
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await printWindow.webContents
        .executeJavaScript('document.images[0] ? document.images[0].decode() : true')
        .catch(() => true);
    }

    await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          ...printSettings,
        },
        (success, failureReason) => {
          if (success) {
            resolve();
          } else {
            reject(new Error(failureReason || 'The printer rejected the job.'));
          }
        }
      );
    });

    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, reason: error.message, filePath };
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}

module.exports = { printFile };
