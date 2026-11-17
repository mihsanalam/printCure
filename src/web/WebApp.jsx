import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import Alert from '@hi-ui/alert';
import Button from '@hi-ui/button';
import Card from '@hi-ui/card';
import Checkbox from '@hi-ui/checkbox';
import NumberInput from '@hi-ui/number-input';
import Progress from '@hi-ui/progress';
import Select from '@hi-ui/select';
import Tag from '@hi-ui/tag';
import {
  DEFAULT_PRINT_SETTINGS,
  MAX_FILE_BYTES,
  MAX_WAIT_MS,
  MESSAGE,
  PAGE_SIZES,
} from '../shared/protocol.js';
import { sendFile } from './send-file.js';

const desktopId = new URLSearchParams(window.location.search).get('peer') ?? '';

const PAGE_SIZE_DATA = PAGE_SIZES.map((size) => ({ id: size, title: size }));

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
  const [messageType, setMessageType] = useState('primary');

  const connectionRef = useRef(null);
  const resultWaiter = useRef(null);
  const previewRef = useRef('');
  const fileInputRef = useRef(null);

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

      const openTimer = setTimeout(() => {
        if (connectionRef.current === connection && !connection.open) {
          setStatus('error');
          setError(
            'The desktop app was found but the direct connection could not be opened. ' +
              'Keep both devices on the same Wi-Fi, check the firewall, then press Reconnect.'
          );
        }
      }, 15000);

      connection.on('open', () => {
        clearTimeout(openTimer);
        setStatus('connected');
      });

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
    setMessageType('primary');
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

      if (result.ok) {
        setMessageType('success');
        setMessage('File received by the desktop app and sent to the printer.');
      } else {
        setMessage('');
        setError(`The desktop app could not print the file: ${result.reason}`);
      }
    } catch (sendError) {
      setMessage('');
      setError(sendError.message);
      resultWaiter.current = null;
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const connected = status === 'connected';

  const statusTag =
    status === 'connected'
      ? 'success'
      : status === 'disconnected'
        ? 'warning'
        : status === 'error'
          ? 'danger'
          : 'primary';

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'disconnected'
        ? 'Disconnected'
        : status === 'error'
          ? 'Offline'
          : 'Connecting';

  let preview = null;
  if (file && previewUrl) {
    if (file.type.startsWith('image/')) {
      preview = <img src={previewUrl} alt="Preview of the selected file" />;
    } else if (file.type === 'application/pdf') {
      preview = <iframe src={previewUrl} title="PDF preview" />;
    } else {
      preview = <p className="muted">Preview is not available for this file type.</p>;
    }
  }

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>PrintCure</h1>
          <p className="muted">Upload, preview and print from your phone.</p>
        </div>
        <Tag type={statusTag} appearance="filled">
          {statusLabel}
        </Tag>
      </header>

      {desktopId ? (
        <p className="muted peer-line">
          Desktop peer <code>{desktopId}</code>
        </p>
      ) : (
        <Alert
          type="danger"
          title="Open this page by scanning the QR code in the desktop app."
        />
      )}

      {error && <Alert type="danger" title={error} />}
      {message && <Alert type={messageType} title={message} />}

      <div className="card-stack">
        <Card title="1. Choose a file">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            disabled={busy}
          />

          <div className="actions">
            <Button
              appearance="line"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              Choose file
            </Button>

            {file ? (
              <span className="file-meta">
                <strong>{file.name}</strong>
                <span className="muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </span>
            ) : (
              <span className="muted">Images or PDF, up to 50 MB</span>
            )}
          </div>

          {preview && <div className="preview">{preview}</div>}
        </Card>

        <Card title="2. Customize">
          <div className="settings">
            <div className="field">
              <span>Copies</span>
              <NumberInput
                value={settings.copies}
                min={1}
                max={99}
                onChange={(value) => updateSetting('copies', value ?? 1)}
              />
            </div>

            <div className="field">
              <span>Page size</span>
              <Select
                data={PAGE_SIZE_DATA}
                value={settings.pageSize}
                onChange={(selectedId) => updateSetting('pageSize', String(selectedId))}
              />
            </div>

            <div className="field">
              <Checkbox
                checked={settings.landscape}
                onChange={(event) => updateSetting('landscape', event.target.checked)}
              >
                Landscape
              </Checkbox>
            </div>
          </div>
        </Card>

        <Card title="3. Send and print">
          <div className="actions">
            <Button
              type="primary"
              onClick={handleSend}
              disabled={!file || !connected || busy}
              loading={busy}
            >
              {busy ? 'Sending...' : 'Send to desktop and print'}
            </Button>

            {!connected && (
              <Button
                appearance="line"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Reconnect
              </Button>
            )}
          </div>

          {busy && (
            <div className="progress-block">
              <span>Transfer progress {Math.round(progress * 100)}%</span>
              <Progress percent={Math.round(progress * 100)} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
