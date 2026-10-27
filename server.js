// Local dev server: serves the site and stores responses in ./data (one JSON file per session).
// Run:  node server.js        (then open http://localhost:5173)
// GitHub Pages is static, so this file is only for local use; see README for hosting the "back end".
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
const PUBLIC_DIRS = new Set(['', 'css', 'js', 'illustrations']);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/responses' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const r = JSON.parse(body);
        const id = String(r.sessionId || '').replace(/[^a-zA-Z0-9-]/g, '');
        if (!id) throw new Error('missing sessionId');
        fs.mkdirSync(DATA, { recursive: true });
        fs.writeFileSync(path.join(DATA, id + '.json'), JSON.stringify(r, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const top = rel.includes('/') ? rel.split('/')[0] : '';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !PUBLIC_DIRS.has(top) || (top === '' && !/^(index\.html|favicon\.ico)$/.test(rel))) {
    res.writeHead(404).end('Not found');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(buf);
  });
}).listen(PORT, () => console.log(`Questionnaire running at http://localhost:${PORT}  (responses saved to ./data)`));
