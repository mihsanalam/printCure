const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { app } = require('electron');

// Small JSON settings file in the OS user-data folder. It survives restarts and
// app updates, so the user only has to pick a printer once.
let cache = null;

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

async function readConfig() {
  if (cache) {
    return cache;
  }

  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }

  return cache;
}

async function writeConfig(next) {
  cache = next;
  const file = configPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(temp, file);
  return cache;
}

async function getPrinterName() {
  const config = await readConfig();
  return typeof config.printerName === 'string' && config.printerName
    ? config.printerName
    : null;
}

async function setPrinterName(printerName) {
  const config = await readConfig();
  const next = {
    ...config,
    printerName:
      typeof printerName === 'string' && printerName.trim()
        ? printerName.trim()
        : null,
  };
  await writeConfig(next);
  return next.printerName;
}

const DEFAULT_PRICING = {
  enabled: false,
  bwPrice: 0,
  colorPrice: 0,
  currency: '₹',
};

async function getPricing() {
  const config = await readConfig();
  const saved = config.pricing && typeof config.pricing === 'object' ? config.pricing : {};
  return {
    enabled: Boolean(saved.enabled),
    bwPrice: Number.isFinite(saved.bwPrice) ? Math.max(0, saved.bwPrice) : 0,
    colorPrice: Number.isFinite(saved.colorPrice) ? Math.max(0, saved.colorPrice) : 0,
    currency: typeof saved.currency === 'string' && saved.currency ? saved.currency : '₹',
  };
}

async function setPricing(value = {}) {
  const config = await readConfig();
  const next = {
    ...config,
    pricing: {
      enabled: Boolean(value.enabled),
      bwPrice: Math.max(0, Number(value.bwPrice) || 0),
      colorPrice: Math.max(0, Number(value.colorPrice) || 0),
      currency: typeof value.currency === 'string' && value.currency.trim()
        ? value.currency.trim().slice(0, 4)
        : DEFAULT_PRICING.currency,
    },
  };
  await writeConfig(next);
  return getPricing();
}

const DEFAULT_PAYMENT_ACCOUNT = {
  country: 'IN',
  upiId: '',
  bkashNumber: '',
  paymentLink: '',
  qrDataUrl: '',
};

async function getPaymentAccount() {
  const config = await readConfig();
  const saved = config.paymentAccount && typeof config.paymentAccount === 'object'
    ? config.paymentAccount
    : {};
  return {
    country: saved.country === 'BD' ? 'BD' : 'IN',
    upiId: typeof saved.upiId === 'string' ? saved.upiId : '',
    bkashNumber: typeof saved.bkashNumber === 'string' ? saved.bkashNumber : '',
    paymentLink: typeof saved.paymentLink === 'string' ? saved.paymentLink : '',
    qrDataUrl: typeof saved.qrDataUrl === 'string' ? saved.qrDataUrl : '',
  };
}

async function setPaymentAccount(value = {}) {
  const config = await readConfig();
  const link = typeof value.paymentLink === 'string' ? value.paymentLink.trim() : '';
  const qr = typeof value.qrDataUrl === 'string' ? value.qrDataUrl : '';
  const next = {
    ...config,
    paymentAccount: {
      country: value.country === 'BD' ? 'BD' : 'IN',
      upiId: typeof value.upiId === 'string' ? value.upiId.trim().slice(0, 120) : '',
      bkashNumber: typeof value.bkashNumber === 'string' ? value.bkashNumber.trim().slice(0, 40) : '',
      paymentLink: /^https?:\/\//i.test(link) ? link.slice(0, 800) : '',
      qrDataUrl: /^data:image\//i.test(qr) && qr.length <= 2_000_000 ? qr : '',
    },
  };
  await writeConfig(next);
  return getPaymentAccount();
}

function pinHash(pin) {
  return crypto.createHash('sha256').update(`printcure:${pin}`).digest('hex');
}

async function hasOwnerPin() {
  const config = await readConfig();
  return Boolean(config.ownerPinHash);
}

async function unlockOwner(pin) {
  const config = await readConfig();
  if (!config.ownerPinHash) {
    return true;
  }
  return config.ownerPinHash === pinHash(String(pin ?? ''));
}

async function setOwnerPin(pin) {
  const config = await readConfig();
  const text = String(pin ?? '').trim();
  const next = { ...config };
  if (text) {
    next.ownerPinHash = pinHash(text);
  } else {
    delete next.ownerPinHash;
  }
  await writeConfig(next);
  return Boolean(text);
}

module.exports = {
  configPath,
  getPrinterName,
  setPrinterName,
  DEFAULT_PRICING,
  getPricing,
  setPricing,
  DEFAULT_PAYMENT_ACCOUNT,
  getPaymentAccount,
  setPaymentAccount,
  hasOwnerPin,
  unlockOwner,
  setOwnerPin,
};
