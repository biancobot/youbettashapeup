// Bump the page's build number and stamp it on every module URL, so a browser can never pair a
// cached old module with a new one after a pull:   node tools/bump.mjs
// Updates index.html (header, main.js?v=N), README.md (currently N) and the relative imports of
// every file under app/ (./x.js?v=N; vendor files are left alone so three.js loads once).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
const html = readFileSync('index.html', 'utf8');
const n = parseInt(html.match(/>build (\d+)<\/span>/)[1], 10) + 1;
writeFileSync('index.html', html.replace(/>build \d+<\/span>/, `>build ${n}</span>`).replace(/\.\/app\/main\.js\?v=\d+/, `./app/main.js?v=${n}`));
writeFileSync('README.md', readFileSync('README.md', 'utf8').replace(/\(currently \d+\)/, `(currently ${n})`));
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
let files = 0;
for (const p of walk('app')) {
  const src = readFileSync(p, 'utf8');
  const out = src.replace(/(from\s+['"]|import\(\s*['"])(\.{1,2}\/[^'"?]+\.js)(\?v=\d+)?(['"])/g, (m, a, path, q, b) => (path.includes('vendor') ? m : `${a}${path}?v=${n}${b}`));
  if (out !== src) { writeFileSync(p, out); files++; }
}
console.log(`build ${n}: ${files} module files stamped`);
