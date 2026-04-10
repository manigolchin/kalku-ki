/**
 * KALKU-KI Server — Static file server + log endpoint
 * Replaces nginx so we get full logging in docker logs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.join(__dirname, 'dist');
const PORT = 80;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // ─── CORS for API calls ────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ─── LOG ENDPOINT ──────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const logs = JSON.parse(body);
        const entries = Array.isArray(logs) ? logs : [logs];
        for (const log of entries) {
          const lvl = (log.level || 'INFO').padEnd(5);
          const src = (log.source || '-').padEnd(18);
          const ts = log.ts ? log.ts.slice(11, 19) : '';
          console.log(`[${ts}] ${lvl} ${src} ${log.message}`);
          if (log.data && Object.keys(log.data).length > 0) {
            console.log(`                          ${JSON.stringify(log.data)}`);
          }
        }
      } catch {
        console.log(`[LOG] RAW: ${body.slice(0, 500)}`);
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }

  // ─── OPTIONS preflight ─────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ─── STATIC FILE SERVING ───────────────────────────────────
  const urlPath = req.url.split('?')[0]; // strip query
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback — serve index.html for all unknown routes
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);

    const headers = { 'Content-Type': contentType };

    // Cache immutable assets forever (hashed filenames)
    if (urlPath.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else if (ext === '.html') {
      // NEVER cache HTML — must always get latest to pick up new asset hashes
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }

    // Gzip if client accepts
    const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
    if (acceptGzip && content.length > 1024 && (ext === '.js' || ext === '.mjs' || ext === '.css' || ext === '.json' || ext === '.html' || ext === '.svg')) {
      headers['Content-Encoding'] = 'gzip';
      const gzipped = zlib.gzipSync(content);
      res.writeHead(200, headers);
      res.end(gzipped);
    } else {
      res.writeHead(200, headers);
      res.end(content);
    }
  } catch (err) {
    console.error(`[SERVER] File error: ${filePath} — ${err.message}`);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] KALKU-KI running on port ${PORT}`);
  console.log(`[SERVER] Serving from ${DIST}`);
  console.log(`[SERVER] Log endpoint: POST /api/log`);
});
