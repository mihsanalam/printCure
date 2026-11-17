import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import Alert from '@hi-ui/alert';
import Button from '@hi-ui/button';
import Card from '@hi-ui/card';
import Checkbox from '@hi-ui/checkbox';
import Input from '@hi-ui/input';
import NumberInput from '@hi-ui/number-input';
import Progress from '@hi-ui/progress';
import Select from '@hi-ui/select';
import Tag from '@hi-ui/tag';
import {
  DEFAULT_PRINT_SETTINGS,
  MAX_FILE_BYTES,
  MAX_WAIT_MS,
  MESSAGE,
  PAGES_PER_SHEET,
  PAGE_SIZES,
  PAPER_DIMENSIONS,
  parsePageRanges,
} from '../shared/protocol.js';
import { sendFile } from './send-file.js';

const desktopId = new URLSearchParams(window.location.search).get('peer') ?? '';

const PAGE_SIZE_DATA = PAGE_SIZES.map((size) => ({ id: size, title: size }));
const PAGE_RANGE_DATA = [
  { id: 'all', title: 'All pages' },
  { id: 'custom', title: 'Custom range' },
];
const ORIENTATION_DATA = [
  { id: 'portrait', title: 'Portrait' },
  { id: 'landscape', title: 'Landscape' },
];
const COLOR_DATA = [
  { id: 'color', title: 'Color' },
  { id: 'grayscale', title: 'Black and white' },
];
const SHEET_DATA = PAGES_PER_SHEET.map((count) => ({
  id: String(count),
  title: count === 1 ? '1 page per sheet' : `${count} pages per sheet`,
}));
const MARGIN_DATA = [
  { id: 'default', title: 'Default' },
  { id: 'none', title: 'None' },
  { id: 'minimum', title: 'Minimum' },
  { id: 'custom', title: 'Custom' },
];
const DUPLEX_DATA = [
  { id: 'simplex', title: 'One-sided' },
  { id: 'longEdge', title: 'Two-sided (long edge)' },
  { id: 'shortEdge', title: 'Two-sided (short edge)' },
];

function toNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

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

  function updatePageRanges(patch) {
    setSettings((current) => ({
      ...current,
      pageRanges: { ...current.pageRanges, ...patch },
    }));
  }

  function updateMargin(name, value) {
    setSettings((current) => ({
      ...current,
      margins: { ...current.margins, [name]: value },
    }));
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
        const printer = result.printerName ? ` on ${result.printerName}` : '';
        setMessageType('success');
        setMessage(
          `File received by the desktop app and printed${printer}.${
            result.note ? ` ${result.note}` : ''
          }`
        );
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
  const isLandscape = settings.orientation === 'landscape';
  const customRange = settings.pageRanges.mode === 'custom';
  const pageRanges = customRange ? parsePageRanges(settings.pageRanges.value) : null;
  const pageRangeError = customRange && !pageRanges;

  const dimensions = PAPER_DIMENSIONS[settings.pageSize] ?? PAPER_DIMENSIONS.A4;
  const paperWidth = isLandscape ? dimensions.height : dimensions.width;
  const paperHeight = isLandscape ? dimensions.width : dimensions.height;
  const paperAspect = paperWidth / paperHeight;

  const marginValues =
    settings.margins.type === 'none'
      ? { top: 0, bottom: 0, left: 0, right: 0 }
      : settings.margins.type === 'minimum'
        ? { top: 5, bottom: 5, left: 5, right: 5 }
        : settings.margins.type === 'custom'
          ? settings.margins
          : { top: 10, bottom: 10, left: 10, right: 10 };

  const marginPadding = {
    top: Math.min(20, (marginValues.top / paperWidth) * 100),
    right: Math.min(20, (marginValues.right / paperWidth) * 100),
    bottom: Math.min(20, (marginValues.bottom / paperWidth) * 100),
    left: Math.min(20, (marginValues.left / paperWidth) * 100),
  };

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

  const marginLabel = MARGIN_DATA.find((item) => item.id === settings.margins.type)?.title;
  const duplexLabel = DUPLEX_DATA.find((item) => item.id === settings.duplex)?.title;

  const summary = [
    `${settings.copies} ${settings.copies === 1 ? 'copy' : 'copies'}`,
    settings.pageSize,
    isLandscape ? 'Landscape' : 'Portrait',
    `${settings.scale}%`,
    settings.color === 'grayscale' ? 'Black and white' : 'Color',
    customRange ? `Pages ${settings.pageRanges.value || '?'}` : 'All pages',
    settings.pagesPerSheet > 1 ? `${settings.pagesPerSheet} per sheet` : '',
    duplexLabel,
    marginLabel ? `${marginLabel} margins` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div>
          <h1>PrintCure</h1>
          <p className="muted">Upload, customize and print from your phone.</p>
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
        <Alert type="danger" title="Open this page by scanning the QR code in the desktop app." />
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
                <span className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </span>
            ) : (
              <span className="muted">Images or PDF, up to 50 MB</span>
            )}
          </div>
        </Card>

        <Card title="2. Customize">
          <div className="paper-stage">
            <div
              className="paper"
              style={{
                '--paper-aspect': paperAspect,
                padding: `${marginPadding.top}% ${marginPadding.right}% ${marginPadding.bottom}% ${marginPadding.left}%`,
              }}
            >
              <div
                className="paper-content"
                style={{ transform: `scale(${settings.scale / 100})` }}
              >
                {file && previewUrl ? (
                  file.type.startsWith('image/') ? (
                    <img src={previewUrl} alt="Print preview" />
                  ) : file.type === 'application/pdf' ? (
                    <iframe src={`${previewUrl}#toolbar=0&navpanes=0`} title="PDF preview" />
                  ) : (
                    <span className="paper-empty">No preview for this file type</span>
                  )
                ) : (
                  <span className="paper-empty">Choose a file to preview the page</span>
                )}
              </div>
            </div>
          </div>

          <div className="paper-caption">
            <Tag size="sm" appearance="line">
              {settings.pageSize}
            </Tag>
            <Tag size="sm" appearance="line">
              {isLandscape ? 'Landscape' : 'Portrait'}
            </Tag>
            <Tag size="sm" appearance="line">
              {settings.scale}%
            </Tag>
            <Tag size="sm" appearance="line">
              {marginLabel} margins
            </Tag>
            {settings.color === 'grayscale' && (
              <Tag size="sm" appearance="line">
                Black and white
              </Tag>
            )}
          </div>

          <div className="settings-grid">
            <div className="field">
              <span className="field-label">Pages</span>
              <Select
                data={PAGE_RANGE_DATA}
                value={settings.pageRanges.mode}
                onChange={(value) => updatePageRanges({ mode: String(value) })}
              />
            </div>

            {customRange && (
              <div className="field">
                <span className="field-label">Page range</span>
                <Input
                  value={settings.pageRanges.value}
                  placeholder="e.g. 1-3, 5, 8"
                  onChange={(_event, value) => updatePageRanges({ value })}
                />
              </div>
            )}

            <div className="field">
              <span className="field-label">Copies</span>
              <NumberInput
                value={settings.copies}
                min={1}
                max={99}
                onChange={(value) => updateSetting('copies', toNumber(value, 1))}
              />
            </div>

            <div className="field">
              <span className="field-label">Layout</span>
              <Select
                data={ORIENTATION_DATA}
                value={settings.orientation}
                onChange={(value) => updateSetting('orientation', String(value))}
              />
            </div>

            <div className="field">
              <span className="field-label">Color</span>
              <Select
                data={COLOR_DATA}
                value={settings.color}
                onChange={(value) => updateSetting('color', String(value))}
              />
            </div>

            <div className="field">
              <span className="field-label">Paper size</span>
              <Select
                data={PAGE_SIZE_DATA}
                value={settings.pageSize}
                onChange={(value) => updateSetting('pageSize', String(value))}
              />
            </div>

            <div className="field">
              <span className="field-label">Pages per sheet</span>
              <Select
                data={SHEET_DATA}
                value={String(settings.pagesPerSheet)}
                onChange={(value) => updateSetting('pagesPerSheet', Number(value))}
              />
            </div>

            <div className="field">
              <span className="field-label">Margins</span>
              <Select
                data={MARGIN_DATA}
                value={settings.margins.type}
                onChange={(value) => updateMargin('type', String(value))}
              />
            </div>

            <div className="field">
              <span className="field-label">Scale</span>
              <NumberInput
                value={settings.scale}
                min={10}
                max={200}
                suffix="%"
                onChange={(value) => updateSetting('scale', toNumber(value, 100))}
              />
            </div>

            <div className="field">
              <span className="field-label">Two-sided</span>
              <Select
                data={DUPLEX_DATA}
                value={settings.duplex}
                onChange={(value) => updateSetting('duplex', String(value))}
              />
            </div>
          </div>

          {pageRangeError && (
            <p className="field-error">
              Enter page numbers like 1-3, 5. Separate each range with a comma.
            </p>
          )}

          {settings.margins.type === 'custom' && (
            <div className="margin-grid">
              {['top', 'bottom', 'left', 'right'].map((side) => (
                <div className="field" key={side}>
                  <span className="field-label">{side[0].toUpperCase() + side.slice(1)} (mm)</span>
                  <NumberInput
                    value={settings.margins[side]}
                    min={0}
                    max={100}
                    onChange={(value) => updateMargin(side, toNumber(value, 0))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="options-row">
            <Checkbox
              checked={settings.printBackground}
              onChange={(event) => updateSetting('printBackground', event.target.checked)}
            >
              Background graphics
            </Checkbox>

            <Checkbox
              checked={settings.headersFooters}
              onChange={(event) => updateSetting('headersFooters', event.target.checked)}
            >
              Headers and footers
            </Checkbox>

            <Checkbox
              checked={settings.collate}
              onChange={(event) => updateSetting('collate', event.target.checked)}
            >
              Collate copies
            </Checkbox>
          </div>
        </Card>

        <Card title="3. Send and print">
          <p className="muted summary-line">{summary}</p>

          <div className="actions">
            <Button
              type="primary"
              onClick={handleSend}
              disabled={!file || !connected || busy || pageRangeError}
              loading={busy}
            >
              {busy ? 'Sending...' : 'Send to desktop and print'}
            </Button>

            {!connected && (
              <Button appearance="line" onClick={() => setAttempt((value) => value + 1)}>
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
