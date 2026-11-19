import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import QRCode from 'qrcode';
import Alert from '@hi-ui/alert';
import Button from '@hi-ui/button';
import Card from '@hi-ui/card';
import Progress from '@hi-ui/progress';
import Select from '@hi-ui/select';
import Tag from '@hi-ui/tag';
import { DEFAULT_PRINT_SETTINGS, MESSAGE } from '../shared/protocol.js';
import BrandLogo from '../shared/BrandLogo.jsx';
import DesktopShell from './DesktopShell.jsx';

const bridge = typeof window !== 'undefined' ? window.printCure : undefined;
const DEFAULT_PRINTER_ID = '__system_default__';

function randomPeerId() {
  const random = Math.random().toString(36).slice(2, 8);
  const suffix = Date.now().toString(36).slice(-4);
  return `printcure-${random}${suffix}`;
}

function joinUrl(base, peerId) {
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}peer=${encodeURIComponent(peerId)}`;
}

export default function DesktopApp() {
  const [attempt, setAttempt] = useState(0);
  const [peerId, setPeerId] = useState('');
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(!bridge);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const [transfer, setTransfer] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [history, setHistory] = useState([]);

  const [printers, setPrinters] = useState([]);
  const [printerName, setPrinterName] = useState(null);
  const [printerLoading, setPrinterLoading] = useState(false);
  const [printerSaving, setPrinterSaving] = useState(false);
  const [printerError, setPrinterError] = useState('');
  const [openingId, setOpeningId] = useState('');
  const [testPrinting, setTestPrinting] = useState(false);
  const [testNotice, setTestNotice] = useState('');

  const transfers = useRef(new Map());

  const webUrl = session?.webUrl ?? `${window.location.origin}/web.html`;

  // Web app URL comes from the Electron main process (LAN address + port).
  // In a plain browser preview we fall back to the current origin.
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!bridge) {
        return;
      }
      try {
        const info = await bridge.getSessionInfo();
        if (!cancelled) {
          setSession(info);
        }
      } catch (sessionError) {
        if (!cancelled) {
          setError(`Could not read session info: ${sessionError.message}`);
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshPrinters();
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    const id = randomPeerId();
    setPeerId(id);
    setStatus('starting');
    setError('');
    setQr('');
    setLink('');

    const peer = new Peer(id);

    peer.on('open', () => {
      const webLink = joinUrl(webUrl, id);
      setStatus('waiting');
      setLink(webLink);
      QRCode.toDataURL(webLink, { width: 280, margin: 1 })
        .then((dataUrl) => setQr(dataUrl))
        .catch((qrError) => setError(`Could not create QR code: ${qrError.message}`));
    });

    peer.on('connection', (connection) => {
      setStatus('linking');
      setError('');

      let isOpen = false;
      const linkTimer = setTimeout(() => {
        if (!isOpen) {
          setStatus('waiting');
          setError(
            'A phone was found but the direct link could not be established. ' +
              'Check that both devices are on the same Wi-Fi, allow Electron through the firewall, and try again.'
          );
        }
      }, 15000);

      connection.on('open', () => {
        isOpen = true;
        clearTimeout(linkTimer);
        setStatus('connected');
      });

      connection.on('data', (message) => {
        if (!message || typeof message !== 'object') {
          return;
        }

        if (message.type === MESSAGE.FILE_START) {
          transfers.current.set(message.fileId, {
            meta: message,
            chunks: [],
            received: 0,
          });
          setTransfer({
            name: message.name,
            received: 0,
            size: message.size,
          });
          return;
        }

        if (message.type === MESSAGE.FILE_CHUNK) {
          const item = transfers.current.get(message.fileId);
          if (!item) {
            return;
          }
          const bytes = message.data;
          item.chunks.push(bytes);
          item.received += bytes.byteLength ?? bytes.length ?? 0;
          setTransfer({
            name: item.meta.name,
            received: item.received,
            size: item.meta.size,
          });
          return;
        }

        if (message.type === MESSAGE.FILE_END) {
          finishTransfer(connection, message.fileId);
        }
      });

      connection.on('close', () => {
        isOpen = false;
        clearTimeout(linkTimer);
        setStatus('waiting');
      });

      connection.on('error', (connectionError) => {
        setError(`Connection error: ${connectionError.message}`);
      });
    });

    peer.on('error', (peerError) => {
      if (peerError.type === 'unavailable-id') {
        setAttempt((value) => value + 1);
        return;
      }
      setStatus('error');
      setError(
        peerError.type === 'network'
          ? 'Cannot reach the PeerJS signalling server. Check the internet connection.'
          : `PeerJS error: ${peerError.type} - ${peerError.message}`
      );
    });

    return () => {
      peer.destroy();
    };
    // webUrl is intentionally part of the dependencies: the peer starts once
    // the LAN web URL is known so the QR link is correct.
  }, [attempt, webUrl, sessionReady]);

  async function refreshPrinters() {
    if (!bridge) {
      return;
    }

    setPrinterLoading(true);
    setPrinterError('');

    try {
      const [result, config] = await Promise.all([
        bridge.getPrinters(),
        bridge.getPrinterConfig(),
      ]);

      if (result.ok) {
        setPrinters(result.printers ?? []);
      } else {
        setPrinters([]);
        setPrinterError(result.reason || 'Could not read the printer list.');
      }

      setPrinterName(config.printerName ?? null);
    } catch (printerLoadError) {
      setPrinterError(printerLoadError.message);
    } finally {
      setPrinterLoading(false);
    }
  }

  async function handlePrinterChange(value) {
    if (!bridge) {
      return;
    }

    const next = value === DEFAULT_PRINTER_ID ? null : String(value);
    setPrinterName(next);
    setPrinterSaving(true);
    setPrinterError('');

    try {
      const result = await bridge.setPrinter(next);
      if (!result.ok) {
        setPrinterError(result.reason || 'Could not save the printer.');
      } else {
        setPrinterName(result.printerName ?? null);
      }
    } catch (printerSaveError) {
      setPrinterError(printerSaveError.message);
    } finally {
      setPrinterSaving(false);
    }
  }

  async function handleTestPrint() {
    if (!bridge) {
      return;
    }

    setTestPrinting(true);
    setTestNotice('');
    setError('');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1f6feb';
      ctx.fillRect(0, 0, canvas.width, 160);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('PrintCure test print', 60, 105);
      ctx.fillStyle = '#222222';
      ctx.font = '32px sans-serif';
      ctx.fillText(new Date().toLocaleString(), 60, 260);
      ctx.fillText('If you can read this, printing works.', 60, 320);
      ['#e53935', '#43a047', '#1e88e5', '#fdd835'].forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(60 + index * 270, 420, 240, 160);
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('The test image could not be created.');
      }

      const result = await bridge.printFile({
        name: 'printcure-test.png',
        mime: 'image/png',
        settings: DEFAULT_PRINT_SETTINGS,
        data: await blob.arrayBuffer(),
      });

      if (result.ok) {
        setTestNotice(`Test print sent to ${result.printerName || 'the system default printer'}.`);
      } else {
        setError(`Test print failed: ${result.reason}`);
      }
    } catch (testError) {
      setError(`Test print failed: ${testError.message}`);
    } finally {
      setTestPrinting(false);
    }
  }

  async function openReceived(item) {
    if (!bridge || !item.filePath) {
      return;
    }

    setOpeningId(item.id);
    setError('');

    try {
      const result = await bridge.openFile(item.filePath);
      if (!result.ok) {
        setError(`Could not open ${item.name}: ${result.reason}`);
      }
    } catch (openError) {
      setError(`Could not open ${item.name}: ${openError.message}`);
    } finally {
      setOpeningId('');
    }
  }

  async function finishTransfer(connection, fileId) {
    const item = transfers.current.get(fileId);
    if (!item) {
      return;
    }
    transfers.current.delete(fileId);
    setPrinting(item.meta.name);

    try {
      const blob = new Blob(item.chunks, {
        type: item.meta.mime || 'application/octet-stream',
      });
      const data = await blob.arrayBuffer();

      let result;
      if (bridge) {
        result = await bridge.printFile({
          name: item.meta.name,
          mime: item.meta.mime,
          settings: item.meta.settings,
          data,
        });
      } else {
        result = {
          ok: false,
          reason: 'Printing is only available in the desktop app.',
        };
      }

      setHistory((items) => [
        {
          id: fileId,
          name: item.meta.name,
          ok: Boolean(result.ok),
          reason: result.reason ?? '',
          note: result.note ?? '',
          printerName: result.printerName ?? '',
          filePath: result.filePath ?? '',
          time: new Date().toLocaleTimeString(),
        },
        ...items,
      ]);

      if (!result.ok) {
        setError(`Could not print ${item.meta.name}: ${result.reason}`);
      }

      connection.send({
        type: MESSAGE.FILE_RESULT,
        fileId,
        ok: Boolean(result.ok),
        reason: result.reason ?? '',
        printerName: result.printerName ?? '',
        note: result.note ?? '',
      });
    } catch (transferError) {
      setError(`Could not print the file: ${transferError.message}`);
      connection.send({
        type: MESSAGE.FILE_RESULT,
        fileId,
        ok: false,
        reason: transferError.message,
      });
    } finally {
      setTransfer(null);
      setPrinting(null);
    }
  }

  const percent =
    transfer && transfer.size > 0
      ? Math.min(100, Math.round((transfer.received / transfer.size) * 100))
      : 0;

  let statusText = 'Starting the connection...';
  if (status === 'waiting') {
    statusText = 'Waiting for a phone to connect.';
  } else if (status === 'linking') {
    statusText = 'Phone found. Opening the direct connection...';
  } else if (status === 'connected') {
    statusText = 'Phone connected. Ready to receive files.';
  } else if (status === 'error') {
    statusText = 'Something went wrong.';
  }

  const statusTag =
    status === 'connected'
      ? 'success'
      : status === 'linking'
        ? 'warning'
        : status === 'error'
          ? 'danger'
          : 'primary';

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'linking'
        ? 'Connecting'
        : status === 'error'
          ? 'Error'
          : 'Waiting';

  const printerOptions = [
    { id: DEFAULT_PRINTER_ID, title: 'System default printer' },
    ...printers.map((printer) => ({
      id: printer.name,
      title: printer.displayName || printer.name,
    })),
  ];

  const missingPrinter =
    Boolean(printerName) &&
    !printerLoading &&
    !printers.some((printer) => printer.name === printerName);

  if (missingPrinter) {
    printerOptions.push({
      id: printerName,
      title: `${printerName} (not found)`,
    });
  }

  return (
    <DesktopShell>
      <header className="page-header">
        <div className="brand-block">
          <BrandLogo />
          <p className="muted">{statusText}</p>
        </div>
        <Tag type={statusTag} appearance="filled">
          {statusLabel}
        </Tag>
      </header>

      {error && <Alert type="danger" title={error} />}

      <div className="page-grid">
        <div className="column">
          <Card title="Scan to connect">
            <div className="qr-wrap">
              {qr ? (
                <img
                  src={qr}
                  alt="QR code to open the PrintCure web app"
                  width="240"
                  height="240"
                />
              ) : (
                <p className="muted">Creating your QR code...</p>
              )}
            </div>

            <p className="muted">Open your phone camera and scan this code.</p>

            {link && (
              <p className="link-row">
                <a href={link}>{link}</a>
              </p>
            )}

            {peerId && (
              <p className="muted">
                Peer ID <code>{peerId}</code>
              </p>
            )}

            <div className="actions">
              <Button appearance="line" onClick={() => setAttempt((value) => value + 1)}>
                New QR code
              </Button>
            </div>
          </Card>

          <Card
            title="Printer"
            extra={
              <Button
                size="sm"
                appearance="text"
                onClick={refreshPrinters}
                disabled={printerLoading || !bridge}
              >
                Refresh
              </Button>
            }
          >
            {!bridge ? (
              <p className="muted">Printer selection is available in the desktop app.</p>
            ) : (
              <>
                <div className="field">
                  <span className="field-label">Print received files on</span>
                  <Select
                    data={printerOptions}
                    value={printerName ?? DEFAULT_PRINTER_ID}
                    onChange={handlePrinterChange}
                    disabled={printerLoading || printerSaving}
                    placeholder="Choose a printer"
                  />
                </div>

                <p className="muted printer-note">
                  Saved automatically. Every new file is sent straight to this printer without asking.
                </p>

                <div className="actions">
                  <Button
                    appearance="line"
                    onClick={handleTestPrint}
                    disabled={!bridge || testPrinting || printerLoading}
                    loading={testPrinting}
                  >
                    {testPrinting ? 'Printing test...' : 'Test print'}
                  </Button>
                </div>

                {testNotice && <Alert type="success" title={testNotice} />}

                {printerSaving && <p className="muted">Saving printer...</p>}

                {missingPrinter && (
                  <Alert
                    type="warning"
                    title={`"${printerName}" is not connected right now. The system default printer will be used until it is back.`}
                  />
                )}

                {!printerLoading && printers.length === 0 && (
                  <Alert
                    type="warning"
                    title="No printer was found. Connect a printer, then press Refresh."
                  />
                )}

                {printerError && <Alert type="danger" title={printerError} />}
              </>
            )}
          </Card>
        </div>

        <Card title="Received files">
          {transfer && (
            <div className="progress-block">
              <span>
                Receiving {transfer.name} - {percent}%
              </span>
              <Progress percent={percent} />
            </div>
          )}

          {printing && <p className="muted">Printing {printing}...</p>}

          {history.length === 0 ? (
            <p className="muted">No files yet. Scan the QR code to send your first file.</p>
          ) : (
            <ul className="file-list">
              {history.map((item) => (
                <li key={item.id} className="file-item">
                  <div className="file-item-main">
                    <strong>{item.name}</strong>
                    <time>
                      {item.time}
                      {item.printerName ? ` · ${item.printerName}` : ''}
                    </time>
                    {item.note && <span className="muted file-note">{item.note}</span>}
                  </div>

                  <div className="file-actions">
                    {item.filePath && (
                      <Button
                        size="sm"
                        appearance="line"
                        onClick={() => openReceived(item)}
                        loading={openingId === item.id}
                      >
                        Open
                      </Button>
                    )}

                    <span title={item.reason}>
                      <Tag type={item.ok ? 'success' : 'danger'} appearance="filled">
                        {item.ok ? 'Printed' : 'Failed'}
                      </Tag>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DesktopShell>
  );
}
