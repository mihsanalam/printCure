import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import QRCode from 'qrcode';
import Alert from '@hi-ui/alert';
import Button from '@hi-ui/button';
import Card from '@hi-ui/card';
import Progress from '@hi-ui/progress';
import Tag from '@hi-ui/tag';
import { MESSAGE } from '../shared/protocol.js';
import BrandLogo from '../shared/BrandLogo.jsx';
import DesktopShell from './DesktopShell.jsx';

const bridge = typeof window !== 'undefined' ? window.printCure : undefined;

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

  const [openingId, setOpeningId] = useState('');

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

      connection.on('open', async () => {
        isOpen = true;
        clearTimeout(linkTimer);
        setStatus('connected');

        if (bridge?.getPricing) {
          try {
            const pricing = await bridge.getPricing();
            connection.send({ type: MESSAGE.PRICE_INFO, pricing });
          } catch {
            // The phone simply hides prices if this message cannot be sent.
          }
        }
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

  return (
    <DesktopShell showOwnerButton>
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
