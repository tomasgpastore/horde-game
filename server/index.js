// Static server (gzip/brotli, immutable cache for hashed assets) + WebSocket on same port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const PORT = process.env.PORT || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.gltf', '.wasm', '.txt']);
const cache = new Map(); // file -> {mtime, raw, br, gz}

function load(file, ext) {
  const st = fs.statSync(file);
  let e = cache.get(file);
  if (e && e.mtime === st.mtimeMs) return e;
  const raw = fs.readFileSync(file);
  e = { mtime: st.mtimeMs, raw };
  if (COMPRESSIBLE.has(ext) && raw.length > 512) {
    e.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    e.gz = zlib.gzipSync(raw, { level: 9 });
  }
  cache.set(file, e);
  return e;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel = decodeURIComponent(url.pathname);
  let file = path.join(DIST, path.normalize(rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
  if (!fs.existsSync(file)) {
    if (path.extname(rel)) { res.writeHead(404); return res.end('not found'); }
    file = path.join(DIST, 'index.html'); // SPA fallback
  }
  const ext = path.extname(file);
  const hashed = file.includes(path.sep + 'assets' + path.sep);
  const e = load(file, ext);
  const ae = req.headers['accept-encoding'] || '';
  const h = { 'content-type': TYPES[ext] || 'application/octet-stream', vary: 'Accept-Encoding',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' };
  let body = e.raw;
  if (e.br && /\bbr\b/.test(ae)) { body = e.br; h['content-encoding'] = 'br'; }
  else if (e.gz && /\bgzip\b/.test(ae)) { body = e.gz; h['content-encoding'] = 'gzip'; }
  h['content-length'] = body.length;
  res.writeHead(200, h);
  res.end(req.method === 'HEAD' ? undefined : body);
});

// WebSocket on /ws (same port). Placeholder: echo/broadcast. Netcode engineer replaces with game rooms.
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: false });
wss.on('connection', (ws) => {
  ws.on('message', (d) => { for (const c of wss.clients) if (c !== ws && c.readyState === 1) c.send(d.toString()); });
});

server.listen(PORT, '0.0.0.0', () => console.log(`listening on ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
