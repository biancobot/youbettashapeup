// Render every template (front, back, iso) into one labelled gallery PNG: node tools/gallery.mjs [out.png]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  for (const base of ['/opt/node-tools/', '/usr/lib/node_modules/', '/usr/local/lib/node_modules/']) { try { return createRequire(base).call(null, 'playwright'); } catch {} }
  throw new Error('playwright not found');
}
const { chromium } = await loadPlaywright();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.argv[2] || 'tools/out/gallery.png');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const S = 420;
const page = await browser.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/?ui=0&lw=1.2&meet=0`);
await page.waitForFunction(() => window.__viewer && window.__frames > 2);
const keys = (await page.evaluate(() => Object.keys(window.__templates.templates))).filter((k) => k !== 'blank');
const views = ['front', 'back', 'iso'];
const tiles = {};
for (const k of keys) {
  tiles[k] = [];
  for (const v of views) {
    const name = await page.evaluate(({ k, v }) => { const vw = window.__viewer; vw.clearViews(); vw.loadShape(k); vw.snapTo(v, true); vw.resize(); vw.render(); return window.__templates.templates[k].name; }, { k, v });
    await page.waitForTimeout(60);
    tiles[k].push({ name, buf: await page.locator('#c').screenshot() });
  }
}
await browser.close(); server.close();
// compose with PIL (sharp is not installed): write tiles then call python
const dir = path.join(root, 'tools', 'out', 'gallery-tiles'); fs.mkdirSync(dir, { recursive: true });
const manifest = [];
for (const k of keys) tiles[k].forEach((t, i) => { const f = path.join(dir, `${k}-${views[i]}.png`); fs.writeFileSync(f, t.buf); if (i === 0) manifest.push({ key: k, name: t.name }); });
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ keys: manifest, views, size: S }));
console.log('tiles written', keys.length, 'templates ->', dir, '; compose with tools/gallery.py', out);
