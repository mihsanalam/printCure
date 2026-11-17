import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import QRCode from 'qrcode';
import { MESSAGE } from '../shared/protocol.js';

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

  let statusText = 'Starting PeerJS...';
  if (status === 'waiting') {
    statusText = 'Waiting for the phone to connect...';
  } else if (status === 'connected') {
    statusText = 'Phone connected. Ready to receive files.';
  } else if (status === 'error') {
    statusText = 'Something went wrong.';
  }

  return (
    <main>
      <h1>PrintCure Desktop</h1>
      <p>Scan the QR code with your phone to open the web app.</p>

      <p>Status: {statusText}</p>
      {error && <p role="alert">{error}</p>}

      {qr && (
        <figure>
          <img src={qr} alt="QR code to open the PrintCure web app" width="280" height="280" />
          <figcaption>Point your phone camera at this code.</figcaption>
        </figure>
      )}

      {link && (
        <p>
          Or open this link on your phone: <a href={link}>{link}</a>
        </p>
      )}

      {peerId && (
        <p>
          Peer ID: <code>{peerId}</code>
        </p>
      )}

      {transfer && (
        <p role="status">
          Receiving {transfer.name}: {percent}%
        </p>
      )}

      {printing && <p role="status">Printing {printing}...</p>}

      <h2>Received files</h2>
      {history.length === 0 ? (
        <p>No files received yet.</p>
      ) : (
        <ol>
          {history.map((item) => (
            <li key={item.id}>
              {item.name} - {item.time} -{' '}
              {item.ok ? 'sent to printer' : `failed: ${item.reason}`}
            </li>
          ))}
        </ol>
      )}

      <p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Generate a new QR code
        </button>
      </p>
    </main>
  );
}
