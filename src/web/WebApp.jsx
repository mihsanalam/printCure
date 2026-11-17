import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import {
  DEFAULT_PRINT_SETTINGS,
  MAX_FILE_BYTES,
  MAX_WAIT_MS,
  MESSAGE,
  PAGE_SIZES,
} from '../shared/protocol.js';
import { sendFile } from './send-file.js';

const desktopId = new URLSearchParams(window.location.search).get('peer') ?? '';

export default function WebApp() {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [settings, setSettings] = useState(DEFAULT_PRINT_SETTINGS);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const connectionRef = useRef(null);
  const resultWaiter = useRef(null);
  const previewRef = useRef('');

  useEffect(() => {
    if (!desktopId) {
      setStatus('error');
      setError('No desktop peer ID in the link. Scan the QR code again.');
      return;
    }

    setStatus('connecting');
    setError('');

    const peer = new Peer();

    peer.on('open', () => {
      const connection = peer.connect(desktopId, { reliable: true });
      connectionRef.current = connection;

      connection.on('open', () => setStatus('connected'));

      connection.on('data', (data) => {
        if (data?.type === MESSAGE.FILE_RESULT) {
          resultWaiter.current?.(data);
        }
      });

      connection.on('close', () => {
        connectionRef.current = null;
        setStatus('disconnected');
      });

      connection.on('error', (connectionError) => {
        setError(`Connection error: ${connectionError.message}`);
      });
    });

    peer.on('error', (peerError) => {
      setStatus('error');
      if (peerError.type === 'peer-unavailable') {
        setError('The desktop app is not reachable. Generate a new QR code and scan it again.');
      } else if (peerError.type === 'network') {
        setError('Cannot reach the PeerJS signalling server. Check the internet connection.');
      } else {
        setError(`PeerJS error: ${peerError.type} - ${peerError.message}`);
      }
    });

    return () => {
      peer.destroy();
      connectionRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null;
    setMessage('');
    setError('');
    setFile(selected);

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = '';
    }

    if (selected) {
      const url = URL.createObjectURL(selected);
      previewRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
  }

  function updateSetting(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  async function handleSend() {
    if (!file || !connectionRef.current) {
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError(`This file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Sending the file to the desktop app...');
    setProgress(0);

    const resultPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resultWaiter.current = null;
        reject(new Error('The desktop app did not confirm the print in time.'));
      }, MAX_WAIT_MS);

      resultWaiter.current = (result) => {
        clearTimeout(timer);
        resultWaiter.current = null;
        resolve(result);
      };
    });

    try {
      await sendFile(connectionRef.current, file, settings, setProgress);
      setMessage('File sent. Waiting for the desktop app to finish printing...');
      const result = await resultPromise;
      setMessage(
        result.ok
          ? 'File received by the desktop app and sent to the printer.'
          : `The desktop app could not print the file: ${result.reason}`
      );
    } catch (sendError) {
      setError(sendError.message);
      resultWaiter.current = null;
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const connected = status === 'connected';

  let preview = null;
  if (file && previewUrl) {
    if (file.type.startsWith('image/')) {
      preview = <img src={previewUrl} alt="Preview of the selected file" width="420" />;
    } else if (file.type === 'application/pdf') {
      preview = <iframe src={previewUrl} title="PDF preview" width="600" height="420" />;
    } else {
      preview = <p>Preview is not available for this file type.</p>;
    }
  }

  return (
    <main>
      <h1>PrintCure</h1>
      <p>Upload a file, adjust it, and send it to the desktop printer.</p>

      <p>
        Status:{' '}
        {status === 'connected'
          ? 'Connected to the desktop app.'
          : status === 'connecting'
            ? 'Connecting...'
            : status === 'disconnected'
              ? 'Disconnected from the desktop app.'
              : 'Not connected.'}
      </p>

      {desktopId ? (
        <p>
          Desktop peer: <code>{desktopId}</code>
        </p>
      ) : (
        <p role="alert">Open this page by scanning the QR code in the desktop app.</p>
      )}

      {error && <p role="alert">{error}</p>}

      <section>
        <h2>1. Choose a file</h2>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          disabled={busy}
        />
        {file && (
          <p>
            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </section>

      {preview && (
        <section>
          <h2>Preview</h2>
          {preview}
        </section>
      )}

      <section>
        <h2>2. Customize</h2>
        <p>
          <label>
            Copies{' '}
            <input
              type="number"
              min="1"
              max="99"
              value={settings.copies}
              onChange={(event) =>
                updateSetting(
                  'copies',
                  Math.min(99, Math.max(1, Number(event.target.value) || 1))
                )
              }
            />
          </label>
        </p>
        <p>
          <label>
            Page size{' '}
            <select
              value={settings.pageSize}
              onChange={(event) => updateSetting('pageSize', event.target.value)}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.landscape}
              onChange={(event) => updateSetting('landscape', event.target.checked)}
            />{' '}
            Landscape
          </label>
        </p>
      </section>

      <section>
        <h2>3. Send and print</h2>
        <button
          type="button"
          onClick={handleSend}
          disabled={!file || !connected || busy}
        >
          {busy ? 'Sending...' : 'Send to desktop and print'}
        </button>

        {busy && (
          <p role="status">
            Transfer progress: {Math.round(progress * 100)}%
          </p>
        )}

        {message && <p role="status">{message}</p>}

        {status !== 'connected' && (
          <p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Reconnect
            </button>
          </p>
        )}
      </section>
    </main>
  );
}
