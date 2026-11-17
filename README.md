# PrintCure

One app, two targets: the same codebase will run in the browser **and** as a
Windows desktop app.

This repository currently contains the project setup only. No application code
has been written yet.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
```

## Scripts

```bash
npm run dev:web       # start the web dev server (Vite)
npm run dev:desktop   # start Vite + Electron together
npm run build:web     # build the static web app into dist/
npm run preview:web   # preview the web build
npm run start:desktop # run Electron against the built dist/
npm run dist:desktop  # build the Windows installer into release/
```

## Structure

```text
src/                  # shared app code (web + desktop)
  components/         # reusable UI
  pages/              # screens
  routes/             # routing
  layouts/            # page shells
  hooks/              # shared hooks
  services/api/       # backend calls
  services/system/    # single bridge for web/desktop differences
  store/              # state
  styles/             # stylesheets
  types/              # types
  utils/              # helpers
public/               # static assets
electron/             # Windows desktop shell (desktop build only)
  main/               # main process
    ipc/              # renderer <-> main channels
    windows/          # window management
    system/           # Windows system functions
  preload/            # context bridge
  shared/             # constants shared across processes
resources/            # app icons, tray icons
build/                # installer / packaging assets
tests/                # unit and e2e tests
scripts/              # helper scripts
```

## Windows system functions

Planned homes for native integrations:

- `notifications/` — Windows toast notifications
- `tray/` — tray icon and menu
- `auto-launch/` — start with Windows
- `power/` — sleep, shutdown and lock events
- `file-dialogs/` — native open/save dialogs
- `registry/` — registry and protocol handlers
- `shortcuts/` — global hotkeys and shortcuts
- `updater/` — auto-update hooks
