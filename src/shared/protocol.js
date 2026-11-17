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

export const PAGE_SIZES = ['A4', 'A5', 'Letter', 'Legal'];

export const DEFAULT_PRINT_SETTINGS = {
  copies: 1,
  pageSize: 'A4',
  landscape: false,
};
