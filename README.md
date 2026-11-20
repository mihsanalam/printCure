# PrintCure

Send a file from your phone to your Windows PC and print it, with no file
server in between. Files travel peer to peer over PeerJS (WebRTC). The Electron
app starts its own local static server and QR code automatically — there is no
separate server to install or configure.

There are three screens: the operator desktop screen (QR code and received files
only), the owner panel (prices, printer, PIN), and the phone page (upload,
print settings and price estimate).

The interface uses Xiaomi's [HiUI](https://github.com/XiaoMi/hiui) design system
(Card, Button, Select, NumberInput, Checkbox, Progress, Alert, Tag) with a small
layout stylesheet in `src/styles/base.css`.

## How it works

1. The desktop app (Electron) starts a PeerJS peer and shows a QR code.
2. The QR code contains the web app URL on your local network plus the desktop
   peer ID, for example `http://192.168.1.20:53124/web.html?peer=printcure-ab12cd34ef`.
3. The phone scans the QR code, opens the web app, and connects to the desktop
   peer through the PeerJS signalling server.
4. When the phone connects, the desktop sends the current pricing rules over the
   same peer connection. If pricing is enabled, the phone shows an estimated
   amount next to the send button.
5. The user picks a file, customizes the print job with the same controls as
   Chrome's print dialog (pages, copies, layout, colour, paper size, pages per
   sheet, margins, scale, two-sided, background graphics, headers/footers), and
   sees a live paper preview before pressing **Send to desktop and print**.
6. The file is chunked and sent over the data channel. The desktop app
   reassembles it, writes it to a temp folder, and automatically sends it to the
   printer selected in the owner panel.
7. The desktop app confirms the result back to the phone and adds the file to
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

## Panels and roles

- **Operator screen** (`desktop.html`): shows only the QR code, connection
  status and received files. No settings are exposed here.
- **Owner panel** (`admin.html`): opened with the gear button in the title bar.
  It is PIN protected (SHA-256 hash saved in `config.json`; with no PIN set it
  opens directly). It contains the pricing rules, printer selection, test print
  and the option to change or remove the PIN.
- **Phone page** (`web.html`): upload, preview, print settings and the price
  estimate. It cannot change prices or the printer.

## Pricing

Pricing is optional and display-only for now — no payment is taken. In the owner
panel you can enable prices, set a currency symbol, a black-and-white price per
page and a colour price per page. Prices are saved to `config.json` and sent to
the phone when it connects. The phone shows a total when a page range is known,
otherwise it shows the per-page rate. Printing still starts immediately; the
owner collects payment separately.

## Payment account (UI only)

The owner panel has a **Payment account** card where the owner saves the country
(India or Bangladesh), a UPI ID or bKash/Nagad number, an optional payment link,
and an optional QR image. These details are stored in `config.json` and are only
shown in the owner panel. The phone shows the bill amount and "Pay at the
counter after printing"; it does not show the QR or link.

No payment gateway is integrated and no money is collected by the app. A future
contributor can connect Razorpay (India) or SSLCommerz/bKash (Bangladesh) to the
saved account details. Until then the owner confirms payments manually.

## Requirements

- Node.js 20 or newer
- Internet access for the PeerJS signalling server (the default PeerJS cloud)
- Phone and PC on the same Wi-Fi network
- A printer configured in Windows (select it in the owner panel)

## Setup

```bash
npm install
```

## Run

```bash
npm run dev:desktop   # Electron app with the QR code (recommended)
npm run dev:web       # web app only, for UI work
```

The gear button in the window title bar opens the owner panel (`admin.html`).

`dev:desktop` starts Vite and Electron together. The QR link uses your LAN IP
so the phone can open the web app.

## Test print

Open the owner panel from the title-bar gear, pick a printer in the **Printer**
card, then press **Test print**. The app generates a sample image and sends it
through the real print path — no phone or QR code needed. The result appears as
an alert and in **Received files**.

To check without physical paper, select **Microsoft Print to PDF** as the
printer; it writes the test page to a PDF file. For a full end-to-end check, run
`npm run dev:desktop`, scan the QR code with your phone, choose an image and
press **Send to desktop and print**.

## Build

```bash
npm run build:web     # builds desktop.html, web.html and admin.html into dist/
npm run start:desktop # runs Electron against the build
npm run dist:desktop  # Windows installer in release/
```

In the built app, Electron serves `dist/` on a random local port automatically
and shows a QR code that points to the web app on the LAN. There is no separate
server to run or configure. That static server only delivers the pages; files
never touch it.

## Project layout

```text
desktop.html              # operator screen entry (QR + received files)
web.html                  # phone page entry
admin.html                # owner panel entry
src/
  desktop/                # operator UI, custom title bar and shell
  web/                    # phone UI (upload, preview, customize, price)
  admin/                  # owner UI (PIN gate, pricing, printer)
  shared/protocol.js      # P2P message types, print and price defaults
electron/
  main/index.cjs          # app lifecycle, session, IPC
  main/config.cjs         # printer, pricing and PIN hash (userData/config.json)
  main/static-server.cjs  # serves the built pages on the LAN
  main/lan-ip.cjs         # finds the local IPv4 address
  main/system/printing.cjs# temp file, printer choice, print options
  main/system/open-file.cjs # opens a received file safely
  main/windows/           # desktop and owner windows
  preload/index.cjs       # context bridge
  shared/constants.cjs    # IPC channel names
```

## Notes

- PeerJS's default cloud broker is used for signalling. File data is P2P.
- Prices are estimates only; there is no payment integration yet.
- The owner PIN is stored as a SHA-256 hash, not as plain text.
- If Windows Firewall asks, allow Node/Electron on private networks.
- `PRINTCURE_DRY_RUN=1` saves the received file without printing, useful for
  testing the transfer flow.
- Received files are saved to `%TEMP%\printcure` and can be opened from the
  **Received files** list in the desktop app.
