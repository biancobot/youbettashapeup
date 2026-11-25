// Write designs/captions.md: the publishable title and description of every template.
import { writeFileSync } from 'fs';
import { captions } from '../app/gemcad/captions.js';
import { templates } from '../app/gemcad/templates.js';
let md = '# Captions\n\nA publishable title and description for every design, in descriptive language: shapes are named by their geometry, never by registered trade names, and nothing quotes a laboratory. Fill the sheet\'s title and description from these with the "Use the shape\'s caption" button in the Text group, or copy them from here.\n\n';
for (const key of Object.keys(templates)) { const c = captions[key]; if (!c) continue; md += `## ${c[0]}\n\n*Template: ${templates[key].name}*\n\n${c[1]}\n\n`; }
writeFileSync('designs/captions.md', md);
console.log('designs/captions.md written');
