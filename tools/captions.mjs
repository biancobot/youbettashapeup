// Write designs/captions.md: the publishable title and description of every template.
import { writeFileSync } from 'fs';
import { captions } from '../app/gemcad/captions.js';
import { templates } from '../app/gemcad/templates.js';
let md = '# Captions\n\nA publishable title per design and one description per shape (its variants share it), written as copy on what makes the shape special: shapes are named by their geometry, never by registered trade names, and nothing quotes a laboratory. The Text group fills the sheet\'s title and description from these.\n\n';
const done = new Set();
for (const key of Object.keys(templates)) { const c = captions[key]; if (!c) continue; const titles = Object.keys(templates).filter((k) => captions[k] && captions[k][1] === c[1]); if (done.has(c[1])) continue; done.add(c[1]); md += `## ${titles.map((k) => captions[k][0]).join(' / ')}\n\n${c[1]}\n\n`; }
writeFileSync('designs/captions.md', md);
console.log('designs/captions.md written');
