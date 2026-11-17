const fs = require('node:fs');
const path = require('node:path');
const { app, shell } = require('electron');

// Received files live in <temp>/printcure. Only allow opening files from that
// folder so a renderer cannot ask the main process to open arbitrary paths.
function receivedDirectory() {
  return path.join(app.getPath('temp'), 'printcure');
}

async function openReceivedFile(filePath) {
  const directory = receivedDirectory();
  const resolved = path.resolve(String(filePath || ''));
  const relative = path.relative(directory, resolved);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, reason: 'That file is outside the received files folder.' };
  }

  if (!fs.existsSync(resolved)) {
    return { ok: false, reason: 'The file is no longer on disk. Send it again.' };
  }

  const error = await shell.openPath(resolved);
  if (error) {
    return { ok: false, reason: error };
  }

  return { ok: true };
}

module.exports = { openReceivedFile, receivedDirectory };
