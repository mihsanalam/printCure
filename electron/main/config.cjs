const fs = require('node:fs/promises');
const path = require('node:path');
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

module.exports = { configPath, getPrinterName, setPrinterName };
