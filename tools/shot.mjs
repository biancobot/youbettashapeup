// Headless screenshot tool: node tools/shot.mjs [design|all] [view,view,...] [lineWidth]
// Designs are the built-in templates (round, blank) or a path to a .asc file.
// Serves the repo over HTTP, renders each shape/view in Chromium and writes PNGs to tools/out/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Resolve Playwright from the local project or from a global install.
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  for (const base of ['/opt/node-tools/', '/usr/lib/node_modules/', '/usr/local/lib/node_modules/']) {
    try { return createRequire(base).call(null, 'playwright'); } catch {}
  }
  throw new Error('playwright not found: npm install playwright');
}
const { chromium } = await loadPlaywright();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = path.join(root, decodeURIComponent(url.pathname));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// Usage: node tools/shot.mjs [shape|all] [views] [lineWidth] [size] [sheet] [standard] [projection]
//   sheet: projections to add, e.g. "base:right,base:above,v1:right" (view ids are v1, v2 ... in order)
//   standard: third | first      projection: orthographic | perspective
const shapeArg = process.argv[2] || 'all';
const views = (process.argv[3] || 'front,back').split(',');
const lw = process.argv[4] || '2';
const size = parseInt(process.argv[5] || '700', 10);
const sheet = process.argv[6] || '';
const standard = process.argv[7] || 'third';
const projection = process.argv[8] || 'orthographic';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`http://127.0.0.1:${port}/index.html?ui=0&lw=${lw}`);
await page.waitForFunction(() => window.__viewer && window.__frames > 2);
const shapes = shapeArg === 'all'
  ? await page.evaluate(() => Object.keys(window.__templates.templates))
  : shapeArg.split(',');

for (const shape of shapes) {
  for (const view of views) {
    const ok = await page.evaluate(async ({ shape, view, sheet, standard, projection }) => {
      try {
        const v = window.__viewer;
        v.clearViews();
        if (shape.endsWith('.asc')) {
          const txt = await (await fetch('/' + shape)).text();
          const m = await import('./app/gemcad/design.js');
          v.editor.design = m.parseAsc(txt);
        } else v.loadShape(shape);
        v.snapTo(view, true);
        v.setStandard(standard);
        v.setProjection(projection);
        if (sheet) for (const item of sheet.split(',')) { const [parent, dir] = item.split(':'); v.addView(parent, dir); }
        v.resize();
        v.render();
        return true;
      } catch (e) { console.error(`${shape}/${view}: ${e.stack || e}`); return false; }
    }, { shape, view, sheet, standard, projection });
    await page.waitForTimeout(60);
    const tag = sheet ? `-sheet-${standard}` : (projection === 'perspective' ? '-persp' : '');
    const file = path.join(outDir, `${path.basename(shape).replace(/\.asc$/, '')}-${view}${tag}.png`);
    await page.locator('#c').screenshot({ path: file });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(root, file)}`);
  }
}
if (errors.length) { console.log('--- console errors/warnings ---'); for (const e of errors) console.log(e); }
await browser.close();
server.close();
