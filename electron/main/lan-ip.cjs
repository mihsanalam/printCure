const os = require('node:os');

// Picks the IPv4 address the phone can reach on the same Wi-Fi network.
function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        candidates.push(entry.address);
      }
    }
  }

  const preferred = candidates.find(
    (address) =>
      address.startsWith('192.168.') ||
      address.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );

  return preferred ?? candidates[0] ?? '127.0.0.1';
}

module.exports = { getLanIp };
