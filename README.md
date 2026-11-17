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
4. The user picks a file, customizes the print job with the same controls as
   Chrome's print dialog (pages, copies, layout, colour, paper size, pages per
   sheet, margins, scale, two-sided, background graphics, headers/footers), and
   sees a live paper preview before pressing **Send to desktop and print**.
5. The file is chunked and sent over the data channel. The desktop app
   reassembles it, writes it to a temp folder, and automatically sends it to the
   printer selected in the desktop app's **Printer** card.
6. The desktop app confirms the result back to the phone and adds the file to
   **Received files**, where it can be reopened with the **Open** button.

Only images (PNG, JPEG, WebP, GIF, BMP) and PDF files can be printed. The
maximum file size is 50 MB.

## Print controls

The phone UI mirrors Chrome's print dialog and maps each control to Electron's
`webContents.print` options:

| Control | Values | Electron option |
| --- | --- | --- |
| Pages | All / custom range (`1-3, 5`) | `pageRanges` |
| Copies | 1-99 | `copies` |
| Layout | Portrait / landscape | `landscape` |
| Colour | Colour / black and white | `color` |
| Paper size | A3, A4, A5, A6, Letter, Legal, Tabloid | `pageSize` |
| Pages per sheet | 1, 2, 4, 6, 9, 16 | `pagesPerSheet` |
| Margins | Default / none / minimum / custom (mm) | `margins` |
| Scale | 10-200% | `scaleFactor` |
| Two-sided | One-sided / long edge / short edge | `duplexMode` |
| Background graphics | On / off | `printBackground` |
| Headers and footers | On / off | `header` + `footer` |
| Collate copies | On / off | `collate` |

The desktop app stores the chosen printer in
`%APPDATA%\printcure\config.json`. When that printer is disconnected it falls
back to the Windows default printer and tells the phone. If no printer is saved,
the Windows default is used.

## Requirements

- Node.js 20 or newer
- Internet access for the PeerJS signalling server (the default PeerJS cloud)
- Phone and PC on the same Wi-Fi network
- A printer configured in Windows (select it in the desktop app)

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
  main/config.cjs         # saved printer choice (userData/config.json)
  main/static-server.cjs  # serves the built web app on the LAN
  main/lan-ip.cjs         # finds the local IPv4 address
  main/system/printing.cjs# temp file, printer choice, print options
  main/system/open-file.cjs # opens a received file safely
  main/windows/           # browser windows
  preload/index.cjs       # context bridge
  shared/constants.cjs    # IPC channel names
```

## Notes

- PeerJS's default cloud broker is used for signalling. File data is P2P.
- If Windows Firewall asks, allow Node/Electron on private networks.
- `PRINTCURE_DRY_RUN=1` saves the received file without printing, useful for
  testing the transfer flow.
- Received files are saved to `%TEMP%\printcure` and can be opened from the
  **Received files** list in the desktop app.
