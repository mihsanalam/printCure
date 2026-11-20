import { useEffect, useState } from 'react';
import Alert from '@hi-ui/alert';
import Button from '@hi-ui/button';
import Card from '@hi-ui/card';
import Checkbox from '@hi-ui/checkbox';
import Input from '@hi-ui/input';
import NumberInput from '@hi-ui/number-input';
import Select from '@hi-ui/select';
import Tag from '@hi-ui/tag';
import { DEFAULT_PRINT_SETTINGS, DEFAULT_PRICING } from '../shared/protocol.js';
import BrandLogo from '../shared/BrandLogo.jsx';
import DesktopShell from '../desktop/DesktopShell.jsx';

const bridge = typeof window !== 'undefined' ? window.printCure : undefined;
const DEFAULT_PRINTER_ID = '__system_default__';

export default function AdminApp() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingNotice, setPricingNotice] = useState('');
  const [pricingError, setPricingError] = useState('');

  const [printers, setPrinters] = useState([]);
  const [printerName, setPrinterName] = useState(null);
  const [printerLoading, setPrinterLoading] = useState(false);
  const [printerSaving, setPrinterSaving] = useState(false);
  const [printerError, setPrinterError] = useState('');
  const [testPrinting, setTestPrinting] = useState(false);
  const [testNotice, setTestNotice] = useState('');

  const [newPin, setNewPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinNotice, setPinNotice] = useState('');
  const [pinSaveError, setPinSaveError] = useState('');

  useEffect(() => {
    let active = true;

    async function start() {
      if (!bridge) {
        setUnlocked(true);
        return;
      }
      try {
        const hasPin = await bridge.hasOwnerPin();
        if (active) {
          setUnlocked(!hasPin);
        }
      } catch (error) {
        if (active) {
          setPinError(error.message);
        }
      }
    }

    start();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!unlocked || !bridge) {
      return;
    }

    let active = true;

    async function load() {
      setPrinterLoading(true);
      setPrinterError('');
      try {
        const [savedPricing, printerList, printerConfig] = await Promise.all([
          bridge.getPricing(),
          bridge.getPrinters(),
          bridge.getPrinterConfig(),
        ]);
        if (!active) return;
        setPricing(savedPricing ?? DEFAULT_PRICING);
        setPrinterName(printerConfig?.printerName ?? null);
        if (printerList.ok) {
          setPrinters(printerList.printers ?? []);
        } else {
          setPrinters([]);
          setPrinterError(printerList.reason || 'Could not read the printer list.');
        }
      } catch (error) {
        if (active) {
          setPrinterError(error.message);
        }
      } finally {
        if (active) {
          setPrinterLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [unlocked]);

  async function handleUnlock() {
    if (!bridge) return;
    setPinError('');
    try {
      const ok = await bridge.unlockOwner(pin);
      if (ok) {
        setUnlocked(true);
        setPin('');
      } else {
        setPinError('Incorrect PIN. Try again.');
      }
    } catch (error) {
      setPinError(error.message);
    }
  }

  async function handleSavePricing() {
    if (!bridge) return;
    setPricingSaving(true);
    setPricingNotice('');
    setPricingError('');
    try {
      const saved = await bridge.setPricing(pricing);
      setPricing(saved ?? pricing);
      setPricingNotice('Prices saved. New connections will see the updated prices.');
    } catch (error) {
      setPricingError(error.message);
    } finally {
      setPricingSaving(false);
    }
  }

  async function handlePrinterChange(value) {
    if (!bridge) return;
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
    } catch (error) {
      setPrinterError(error.message);
    } finally {
      setPrinterSaving(false);
    }
  }

  async function handleTestPrint() {
    if (!bridge) return;
    setTestPrinting(true);
    setTestNotice('');
    setPrinterError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2f5fe0';
      ctx.fillRect(0, 0, canvas.width, 160);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('PrintCure test print', 60, 105);
      ctx.fillStyle = '#222222';
      ctx.font = '32px sans-serif';
      ctx.fillText(new Date().toLocaleString(), 60, 260);
      ctx.fillText('If you can read this, printing works.', 60, 320);

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
        setPrinterError(`Test print failed: ${result.reason}`);
      }
    } catch (error) {
      setPrinterError(`Test print failed: ${error.message}`);
    } finally {
      setTestPrinting(false);
    }
  }

  async function handleSetPin() {
    if (!bridge) return;
    setPinSaving(true);
    setPinNotice('');
    setPinSaveError('');
    try {
      const active = await bridge.setOwnerPin(newPin);
      setNewPin('');
      setPinNotice(active ? 'Owner PIN updated.' : 'Owner PIN removed.');
    } catch (error) {
      setPinSaveError(error.message);
    } finally {
      setPinSaving(false);
    }
  }

  const printerOptions = [
    { id: DEFAULT_PRINTER_ID, title: 'System default printer' },
    ...printers.map((printer) => ({
      id: printer.name,
      title: printer.displayName || printer.name,
    })),
  ];

  if (printerName && !printerOptions.some((item) => item.id === printerName)) {
    printerOptions.push({ id: printerName, title: `${printerName} (not found)` });
  }

  if (!unlocked) {
    return (
      <DesktopShell title="Owner panel">
        <Card title="Owner panel">
          <p className="muted">Enter the owner PIN to change prices and printer settings.</p>
          <div className="field">
            <span className="field-label">PIN</span>
            <Input
              type="password"
              value={pin}
              placeholder="Owner PIN"
              onChange={(_event, value) => setPin(value)}
            />
          </div>
          <div className="actions">
            <Button type="primary" onClick={handleUnlock} disabled={!pin}>
              Unlock
            </Button>
          </div>
          {pinError && <Alert type="danger" title={pinError} />}
        </Card>
      </DesktopShell>
    );
  }

  return (
    <DesktopShell title="Owner panel">
      <header className="page-header">
        <div className="brand-block">
          <BrandLogo />
          <p className="muted">Prices and device settings for this PC.</p>
        </div>
        <Tag type="success" appearance="filled">Owner</Tag>
      </header>

      <div className="card-stack">
        <Card title="Pricing">
          <p className="muted">
            Set the rate per printed page. The phone shows an estimate when pricing is on.
          </p>

          <div className="field">
            <Checkbox
              checked={pricing.enabled}
              onChange={(event) =>
                setPricing((current) => ({ ...current, enabled: event.target.checked }))
              }
            >
              Show prices on the phone
            </Checkbox>
          </div>

          <div className="field-row">
            <div className="field">
              <span className="field-label">Currency symbol</span>
              <Input
                value={pricing.currency}
                onChange={(_event, value) =>
                  setPricing((current) => ({ ...current, currency: value }))
                }
              />
            </div>
            <div className="field">
              <span className="field-label">Black &amp; white / page</span>
              <NumberInput
                value={pricing.bwPrice}
                min={0}
                onChange={(value) =>
                  setPricing((current) => ({
                    ...current,
                    bwPrice: typeof value === 'number' && Number.isFinite(value) ? value : 0,
                  }))
                }
              />
            </div>
            <div className="field">
              <span className="field-label">Color / page</span>
              <NumberInput
                value={pricing.colorPrice}
                min={0}
                onChange={(value) =>
                  setPricing((current) => ({
                    ...current,
                    colorPrice: typeof value === 'number' && Number.isFinite(value) ? value : 0,
                  }))
                }
              />
            </div>
          </div>

          <p className="muted price-preview">
            Example: 10 color A4 pages = {pricing.currency || '₹'}
            {(pricing.colorPrice * 10).toFixed(2)}
          </p>

          <div className="actions">
            <Button type="primary" onClick={handleSavePricing} loading={pricingSaving}>
              Save prices
            </Button>
          </div>

          {pricingNotice && <Alert type="success" title={pricingNotice} />}
          {pricingError && <Alert type="danger" title={pricingError} />}
        </Card>

        <Card
          title="Printer"
          extra={
            <Button
              size="sm"
              appearance="text"
              onClick={() => {
                if (bridge) {
                  setPrinterLoading(true);
                  Promise.all([bridge.getPrinters(), bridge.getPrinterConfig()])
                    .then(([list, config]) => {
                      setPrinterName(config?.printerName ?? null);
                      if (list.ok) setPrinters(list.printers ?? []);
                      else setPrinterError(list.reason || 'Could not read the printer list.');
                    })
                    .catch((error) => setPrinterError(error.message))
                    .finally(() => setPrinterLoading(false));
                }
              }}
              disabled={printerLoading}
            >
              Refresh
            </Button>
          }
        >
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
              disabled={testPrinting}
              loading={testPrinting}
            >
              {testPrinting ? 'Printing test...' : 'Test print'}
            </Button>
          </div>

          {testNotice && <Alert type="success" title={testNotice} />}
          {printerSaving && <p className="muted">Saving printer...</p>}
          {printerName && !printers.some((item) => item.name === printerName) && !printerLoading && (
            <Alert
              type="warning"
              title={`"${printerName}" is not connected right now. The system default printer will be used.`}
            />
          )}
          {!printerLoading && printers.length === 0 && (
            <Alert
              type="warning"
              title="No printer was found. Connect a printer, then press Refresh."
            />
          )}
          {printerError && <Alert type="danger" title={printerError} />}
        </Card>

        <Card title="Owner PIN">
          <p className="muted">
            Leave empty to remove the PIN. The operator screen stays open for QR codes and files.
          </p>
          <div className="field">
            <span className="field-label">New PIN</span>
            <Input
              type="password"
              value={newPin}
              placeholder="New PIN"
              onChange={(_event, value) => setNewPin(value)}
            />
          </div>
          <div className="actions">
            <Button appearance="line" onClick={handleSetPin} loading={pinSaving}>
              Save PIN
            </Button>
          </div>
          {pinNotice && <Alert type="success" title={pinNotice} />}
          {pinSaveError && <Alert type="danger" title={pinSaveError} />}
        </Card>
      </div>
    </DesktopShell>
  );
}
