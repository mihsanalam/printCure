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

// Keep this list in sync with src/shared/protocol.js.
const PAGE_SIZES = new Set(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Legal', 'Letter', 'Tabloid']);
const SHEETS_PER_PAGE = new Set([1, 2, 4, 6, 9, 16]);
const MARGIN_TYPES = {
  default: 'default',
  none: 'none',
  minimum: 'printableArea',
  custom: 'custom',
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeName(name) {
  const cleaned = String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  return cleaned || 'file';
}

// Chrome-style page ranges: "1-3, 5, 8-10". Returns null when invalid.
function parsePageRanges(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const ranges = [];
  for (const part of text.split(',')) {
    const match = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) {
      return null;
    }

    const from = Number.parseInt(match[1], 10);
    const to = Number.parseInt(match[2] ?? match[1], 10);
    if (from < 1 || to < from) {
      return null;
    }
    ranges.push({ from, to });
  }

  return ranges.length > 0 ? ranges : null;
}

function normalizeSettings(settings = {}) {
  const margins = settings.margins && typeof settings.margins === 'object' ? settings.margins : {};
  const marginType = Object.prototype.hasOwnProperty.call(MARGIN_TYPES, margins.type)
    ? margins.type
    : 'default';
  const ranges =
    settings.pageRanges?.mode === 'custom'
      ? parsePageRanges(settings.pageRanges.value)
      : null;

  const pagesPerSheet = toInt(settings.pagesPerSheet, 1);

  return {
    copies: clamp(toInt(settings.copies, 1), 1, 99),
    collate: settings.collate !== false,
    pageRanges: { mode: ranges ? 'custom' : 'all', ranges },
    orientation:
      settings.orientation === 'landscape' ||
      (!settings.orientation && settings.landscape)
        ? 'landscape'
        : 'portrait',
    pageSize: PAGE_SIZES.has(settings.pageSize) ? settings.pageSize : 'A4',
    pagesPerSheet: SHEETS_PER_PAGE.has(pagesPerSheet) ? pagesPerSheet : 1,
    color: settings.color === 'grayscale' ? 'grayscale' : 'color',
    margins: {
      type: marginType,
      top: clamp(toNumber(margins.top, 10), 0, 100),
      bottom: clamp(toNumber(margins.bottom, 10), 0, 100),
      left: clamp(toNumber(margins.left, 10), 0, 100),
      right: clamp(toNumber(margins.right, 10), 0, 100),
    },
    scale: clamp(toNumber(settings.scale, 100), 10, 200),
    duplex: ['simplex', 'longEdge', 'shortEdge'].includes(settings.duplex)
      ? settings.duplex
      : 'simplex',
    printBackground: settings.printBackground !== false,
    headersFooters: Boolean(settings.headersFooters),
  };
}

function buildMargins(margins) {
  const marginType = MARGIN_TYPES[margins.type] ?? 'default';
  if (marginType !== 'custom') {
    return { marginType };
  }

  // Electron expects custom margins in pixels.
  const toPixels = (millimetres) => Math.round((millimetres * 96) / 25.4);
  return {
    marginType,
    top: toPixels(margins.top),
    bottom: toPixels(margins.bottom),
    left: toPixels(margins.left),
    right: toPixels(margins.right),
  };
}

function buildPrintOptions(settings, { deviceName, header, footer } = {}) {
  const options = {
    silent: true,
    printBackground: settings.printBackground,
    color: settings.color === 'color',
    landscape: settings.orientation === 'landscape',
    copies: settings.copies,
    collate: settings.collate,
    pagesPerSheet: settings.pagesPerSheet,
    scaleFactor: settings.scale / 100,
    duplexMode: settings.duplex,
    pageSize: settings.pageSize,
    margins: buildMargins(settings.margins),
  };

  if (deviceName) {
    options.deviceName = deviceName;
  }

  if (settings.pageRanges.ranges) {
    options.pageRanges = settings.pageRanges.ranges;
  }

  if (settings.headersFooters) {
    options.header = header || 'PrintCure';
    // Chromium uses the footer string as the printed document URL.
    options.footer = footer || 'PrintCure';
  }

  return options;
}

async function listPrinters(webContents) {
  const printers = await webContents.getPrintersAsync();
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName || printer.name,
    description: printer.description || '',
  }));
}

// Returns the system printer matching the saved name. When the saved printer is
// gone (unplugged, renamed, different PC) we fall back to the system default.
function matchPrinter(printers, preferredName) {
  if (!preferredName) {
    return { printer: null, missing: null };
  }

  const wanted = preferredName.toLowerCase();
  const printer = printers.find(
    (item) =>
      item.name.toLowerCase() === wanted ||
      String(item.displayName || '').toLowerCase() === wanted
  );

  return { printer: printer ?? null, missing: printer ? null : preferredName };
}

function buildImageDocument({ mime, buffer, title }) {
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      html, body { margin: 0; padding: 0; }
      body { display: flex; justify-content: center; }
      img { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body><img src="${dataUrl}" alt="" /></body>
</html>`;
}

// Chromium rejects very long data: URLs passed to loadURL with ERR_INVALID_URL,
// so the document is written to disk and loaded with loadFile instead. The image
// stays embedded in the HTML, where large data URLs are allowed.
async function writeImageDocument(directory, { mime, buffer, title }) {
  const html = buildImageDocument({ mime, buffer, title });
  const htmlPath = path.join(
    directory,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-print.html`
  );
  await fs.writeFile(htmlPath, html, 'utf8');
  return htmlPath;
}

// A hidden window can report did-finish-load before the image has decoded.
// Printing at that point silently produces a blank page, so wait explicitly.
async function waitForImage(webContents, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await webContents
      .executeJavaScript(
        `(() => {
          const img = document.images[0];
          if (!img) return 'missing';
          if (!img.complete) return 'loading';
          return img.naturalWidth > 0 ? 'ready' : 'error';
        })()`
      )
      .catch(() => 'error');

    if (state === 'ready') return;
    if (state === 'error' || state === 'missing') {
      throw new Error('The image could not be loaded for printing.');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out while loading the image for printing.');
}

async function printFile({ name, mime, settings, data, printerName } = {}) {
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
    console.log('[printcure] dry run', filePath, printSettings);
    return {
      ok: true,
      dryRun: true,
      filePath,
      printerName: printerName || 'System default',
    };
  }

  let htmlPath = null;
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });

  try {
    const printers = await listPrinters(printWindow.webContents);
    console.log(
      '[printcure] printers:',
      printers
        .map((printer) => `${printer.displayName} (${printer.name})`)
        .join(', ') || 'none'
    );

    if (printers.length === 0) {
      return {
        ok: false,
        reason: 'No printer is installed or Windows did not report any printer.',
        filePath,
      };
    }

    const { printer, missing } = matchPrinter(printers, printerName);
    const usedPrinter = printer ?? null;
    const note = missing
      ? `"${missing}" is not available, so the system default printer was used.`
      : '';

    if (usedPrinter) {
      console.log('[printcure] selected printer:', usedPrinter.displayName, usedPrinter.name);
    } else if (missing) {
      console.warn('[printcure] saved printer missing, using system default:', missing);
    }

    if (isPdf) {
      await printWindow.loadURL(pathToFileURL(filePath).href);
    } else {
      htmlPath = await writeImageDocument(directory, {
        mime,
        buffer,
        title: safeName,
      });
      await printWindow.loadFile(htmlPath);
      await waitForImage(printWindow.webContents);
    }

    const printOptions = buildPrintOptions(printSettings, {
      deviceName: usedPrinter?.name,
      header: name || 'PrintCure',
      footer: 'PrintCure',
    });

    console.log('[printcure] printing', filePath, printOptions);

    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('The printer did not respond within 30 seconds.'));
        }
      }, 30000);

      printWindow.webContents.print(printOptions, (success, failureReason) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (success) {
          console.log('[printcure] print job accepted');
          resolve();
        } else {
          reject(new Error(failureReason || 'The printer rejected the job.'));
        }
      });
    });

    return {
      ok: true,
      filePath,
      printerName: usedPrinter?.displayName || usedPrinter?.name || 'System default',
      note,
    };
  } catch (error) {
    console.error('[printcure] print failed:', error.message);
    return { ok: false, reason: error.message, filePath };
  } finally {
    if (htmlPath) {
      await fs.unlink(htmlPath).catch(() => {});
    }
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}

module.exports = { printFile, listPrinters, normalizeSettings, buildPrintOptions };
