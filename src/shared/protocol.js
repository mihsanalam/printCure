// Shared P2P protocol constants used by both the web app and the desktop app.

export const CHUNK_SIZE = 64 * 1024;
export const BUFFER_HIGH_WATER = 8 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_WAIT_MS = 120 * 1000;

export const MESSAGE = {
  FILE_START: 'file:start',
  FILE_CHUNK: 'file:chunk',
  FILE_END: 'file:end',
  FILE_RESULT: 'file:result',
};

export const PAGE_SIZES = ['A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid'];

// Paper dimensions in millimetres, used for the live page preview.
export const PAPER_DIMENSIONS = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Tabloid: { width: 279.4, height: 431.8 },
};

export const PAGES_PER_SHEET = [1, 2, 4, 6, 9, 16];

export const DEFAULT_PRINT_SETTINGS = {
  copies: 1,
  collate: true,
  pageRanges: { mode: 'all', value: '' },
  orientation: 'portrait',
  pageSize: 'A4',
  pagesPerSheet: 1,
  color: 'color',
  margins: { type: 'default', top: 10, bottom: 10, left: 10, right: 10 },
  scale: 100,
  duplex: 'simplex',
  printBackground: false,
  headersFooters: true,
};

// Chrome-style page range input: "1-3, 5, 8-10". Returns null when invalid.
export function parsePageRanges(value) {
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
