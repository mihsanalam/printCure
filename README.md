# PrintCure

One app, two targets: it runs in the browser **and** as a Windows desktop app.

- `src/` — the shared app (React + Vite). Used by both targets.
- `electron/` — thin Windows shell. Only the desktop build uses it.
- `src/services/system/` — the single platform bridge. Browser falls back to Web APIs; the desktop build talks to `electron/main/system/`.

## Requirements

- Node.js 20 or newer
- npm

## Install

```bash
npm install
```

## Run

```bash
npm run dev:web       # browser at http://localhost:5173
npm run dev:desktop   # Windows desktop window (Vite + Electron)
```

## Build

```bash
npm run build:web     # static site in dist/
npm run dist:desktop  # Windows installer in release/
```

## Windows system functions

Native integrations live in `electron/main/system/` and are exposed to the UI
through preload + IPC. The basic app already includes:

- `notifications/` — Windows toast notifications
- `tray/` — tray icon (placeholder folder)
- `auto-launch/` — start with Windows (placeholder folder)
- `power/` — sleep, shutdown and lock events (placeholder folder)
- `file-dialogs/` — native open/save dialogs (placeholder folder)
- `registry/`, `shortcuts/`, `updater/` — placeholders for later
