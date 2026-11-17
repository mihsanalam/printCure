# PrintCure

Send a file from your phone to your Windows PC and print it, with no file
server in between. Files travel peer to peer over PeerJS (WebRTC).

The interface uses Xiaomi's [HiUI](https://github.com/XiaoMi/hiui) design system
(Card, Button, Select, NumberInput, Checkbox, Progress, Alert, Tag) with a small
layout stylesheet in `src/styles/base.css`.

## How it works

1. The desktop app (Electron) starts a PeerJS peer and shows a QR code.
2. The QR code contains the web app URL on your local network plus the desktop
   peer ID, for example `http://192.168.1.20:53124/web.html?peer=printcure-ab12cd34ef`.
3. The phone scans the QR code, opens the web app, and connects to the desktop
   peer through the PeerJS signalling server.
4. The user picks a file, adjusts copies / page size / orientation, sees a
   preview, and presses **Send to desktop and print**.
5. The file is chunked and sent over the data channel. The desktop app
   reassembles it, writes it to a temp folder, and sends it to the default
   printer using Electron's print API.
6. The desktop app confirms the result back to the phone.

Only images (PNG, JPEG, WebP, GIF, BMP) and PDF files can be printed. The
maximum file size is 50 MB.

## Requirements

- Node.js 20 or newer
- Internet access for the PeerJS signalling server (the default PeerJS cloud)
- Phone and PC on the same Wi-Fi network
- A default printer configured in Windows

## Setup

```bash
npm install
```

## Run

```bash
npm run dev:desktop   # Electron app with the QR code (recommended)
npm run dev:web       # web app only, for UI work
```

`dev:desktop` starts Vite and Electron together. The QR link uses your LAN IP
so the phone can open the web app.

## Build

```bash
npm run build:web     # builds desktop.html and web.html into dist/
npm run start:desktop # runs Electron against the build
npm run dist:desktop  # Windows installer in release/
```

In the built app, Electron serves `dist/` on a random local port and shows a QR
code that points to the web app on the LAN. That static server only delivers
the web page; files never touch it.

## Project layout

```text
desktop.html              # desktop renderer entry
web.html                  # web app entry
src/
  desktop/                # desktop UI (QR code, receive status)
  web/                    # web UI (upload, preview, customize, print)
  shared/protocol.js      # P2P message types and print defaults
electron/
  main/index.cjs          # app lifecycle, session, IPC
  main/static-server.cjs  # serves the built web app on the LAN
  main/lan-ip.cjs         # finds the local IPv4 address
  main/system/printing.cjs# temp file + Windows printer
  main/windows/           # browser windows
  preload/index.cjs       # context bridge
  shared/constants.cjs    # IPC channel names
```

## Notes

- PeerJS's default cloud broker is used for signalling. File data is P2P.
- If Windows Firewall asks, allow Node/Electron on private networks.
- `PRINTCURE_DRY_RUN=1` saves the received file without printing, useful for
  testing the transfer flow.
- Received files are saved to `%TEMP%\printcure`.
