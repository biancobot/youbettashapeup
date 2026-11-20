// node pipeline/svg2png.mjs in.svg out.png [size]
import { createRequire } from 'node:module'; import fs from 'node:fs';
let pw; try { pw = await import('playwright'); } catch { pw = createRequire('/opt/node-tools/')('playwright'); }
const [svgPath, pngPath, sizeArg] = process.argv.slice(2); const size = parseInt(sizeArg || '1000', 10);
const browser = await pw.chromium.launch(); const page = await browser.newPage({ viewport: { width: size, height: size } });
const svg = fs.readFileSync(svgPath, 'utf8').replace(/<svg /, `<svg style="max-width:${size}px;max-height:${size}px" `);
await page.setContent(`<body style="margin:0;background:#fff"><div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">${svg}</div></body>`);
await page.screenshot({ path: pngPath }); await browser.close();
