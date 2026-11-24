// Bump the page's build number: node tools/bump.mjs  (updates index.html's header and script version and the README)
import { readFileSync, writeFileSync } from 'fs';
const html = readFileSync('index.html', 'utf8');
const n = parseInt(html.match(/>build (\d+)<\/span>/)[1], 10) + 1;
writeFileSync('index.html', html.replace(/>build \d+<\/span>/, `>build ${n}</span>`).replace(/\.\/app\/main\.js\?v=\d+/, `./app/main.js?v=${n}`));
writeFileSync('README.md', readFileSync('README.md', 'utf8').replace(/\(currently \d+\)/, `(currently ${n})`));
console.log('build', n);
