// Render a template over a plot underlay (or without one) to a PNG, headless.
//   node tools/overlay.mjs <templateKey> <view front|back|iso> <out.png> [plotId|-] [ratio] [girdleFacets] [stretch]
// Serves this checkout over HTTP (so it works in any worktree), loads the template with the
// given L:W and girdle facet count, loads designs/plots/<plotId>.png as the underlay for that
// view, and writes the canvas. Prints the stone info line and any console errors.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  for (const base of ['/opt/node-tools/', '/usr/lib/node_modules/', '/usr/local/lib/node_modules/']) { try { return createRequire(base).call(null, 'playwright'); } catch {} }
  throw new Error('playwright not found');
}
const { chromium } = await loadPlaywright();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [tpl, view = 'front', out = 'tools/out/overlay.png', plot = '-', ratio = '', gf = '', stretch = ''] = process.argv.slice(2);
if (!tpl) { console.error('usage: node tools/overlay.mjs <templateKey> <view> <out.png> [plotId|-] [ratio] [girdleFacets]'); process.exit(1); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.asc': 'text/plain', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/?lw=1.5&meet=0&fresh=1`);
await page.waitForFunction(() => window.__viewer && window.__frames > 3);
await page.addStyleTag({ content: '#stagemenu { display: none !important; }' });   // the export icon overlaps the canvas
await page.selectOption('#template', tpl);
if (ratio && await page.locator('#tpl-params input[data-param="ratio"]').count()) await page.fill('#tpl-params input[data-param="ratio"]', ratio);
if (gf) await page.fill('#tpl-gf', gf);
await page.click('#loadtemplate'); await page.waitForTimeout(300);
if (plot && plot !== '-') {
  await page.selectOption('#u-builtin', plot); await page.selectOption('#u-view', view === 'back' ? 'back' : 'front'); if (stretch) await page.check('#u-stretch'); await page.click('#u-load');
  await page.waitForTimeout(800);
}
await page.evaluate((v) => { window.__viewer.snapTo(v, true); window.__viewer.render(); }, view);
await page.waitForTimeout(150);
fs.mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
await page.locator('#c').screenshot({ path: path.resolve(root, out) });
console.log(await page.evaluate(() => document.getElementById('info').textContent));
console.log(await page.evaluate(() => document.getElementById('u-status').textContent));
if (errs.length) console.log('errors:', errs.filter((e) => !e.includes('GL Driver')));
await browser.close(); server.close();
