// Zero-dependency static server: node tools/serve.mjs [port] [host]
// Binds 127.0.0.1 by default (what VS Code and SSH port forwards connect to); pass 0.0.0.0 to expose it.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = parseInt(process.argv[2] || '8000', 10);
const host = process.argv[3] || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => console.log(`${res.statusCode} ${req.method} ${req.url} (${Date.now() - started} ms)`));
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  let p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
});
server.on('error', (e) => { console.error(`Cannot listen on port ${port}: ${e.message}`); process.exit(1); });
server.listen(port, host, () => {
  console.log(`Gem Shape Viewer serving ${root} on ${host}:${port}`);
  console.log(`  http://localhost:${port}/`);
  console.log(`  http://127.0.0.1:${port}/   (use this if localhost hangs)`);
  console.log('Requests are logged below. Ctrl+C to stop.');
});
