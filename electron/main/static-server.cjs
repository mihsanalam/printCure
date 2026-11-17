const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

// Serves the built web app on the local network so the phone can open it.
// Only static pages are served here; files are transferred peer to peer.
async function startStaticServer({ root, port = 0 }) {
  const rootDir = path.resolve(root);

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relative = pathname === '/' ? 'desktop.html' : pathname.slice(1);
    const filePath = path.join(rootDir, relative);

    if (!filePath.startsWith(`${rootDir}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(port, '0.0.0.0', resolve));

  return { server, port: server.address().port };
}

module.exports = { startStaticServer };
