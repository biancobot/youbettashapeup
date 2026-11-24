// Meet-point audit for every template: node tools/audit.mjs [templateKey ...]
// For each design it checks, after building the stone:
//   girdle: every crown or pavilion facet that reaches the girdle meets it at vertices shared with
//     a neighbouring facet (bezel tips and junctions are meet points), and the scalloped girdle
//     keeps at least half its thickness everywhere (no facet cuts through it);
//   slivers: no facet thinner than 1% of the half-width (area / longest edge);
//   symmetry classes: every tier produced faces.
// Exit code 1 if any template fails.
import { templates } from '../app/gemcad/templates.js';
import { designMesh } from '../app/gemcad/mesh.js';

const keys = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(templates).filter((k) => k !== 'blank');
let failed = 0;
for (const key of keys) {
  const d = templates[key].make();
  const m = designMesh(d);
  const tier = (f) => d.tiers.find((t) => t.id === f.tag);
  const isG = (f) => { const t = tier(f); return t && Math.abs(t.angle) === 90; };
  const gTop = 0, gBot = Math.min(...m.faces.filter(isG).flatMap((f) => f.idx.map((i) => m.verts[i][2])));
  const girdleT = gTop - gBot;
  const problems = [];
  // vertex -> faces
  const vf = new Map(); m.faces.forEach((f, fi) => f.idx.forEach((i) => { if (!vf.has(i)) vf.set(i, []); vf.get(i).push(fi); }));
  // 1. girdle meet points and valley depth
  let minTop = Infinity, maxBot = -Infinity;
  for (const f of m.faces) {
    if (isG(f)) {
      const zs = f.idx.map((i) => m.verts[i][2]);
      minTop = Math.min(minTop, Math.max(...zs)); maxBot = Math.max(maxBot, Math.min(...zs));
      continue;
    }
    const t = tier(f); if (!t) continue;
    // the facet's meet points on the girdle: its girdle vertices at the girdle's full height
    // (crown) or depth (pavilion); the vertices in between, where its edge crosses girdle facet
    // boundaries inside the scallop, are shared with the girdle only
    const level = t.angle >= 0 ? gTop : gBot;
    const onG = f.idx.filter((i) => Math.abs(m.verts[i][2] - level) < 1e-4 && vf.get(i).some((fi) => isG(m.faces[fi])));
    if (!onG.length) continue;
    for (const i of onG) {
      const others = vf.get(i).filter((fi) => m.faces[fi] !== f && !isG(m.faces[fi]));
      if (!others.length) problems.push(`${t.name}: girdle vertex (${m.verts[i].map((v) => v.toFixed(3)).join(', ')}) shared with no other crown/pavilion facet`);
    }
  }
  if (minTop < gTop - 0.5 * girdleT) problems.push(`girdle cut to ${(100 * (minTop - gBot) / girdleT).toFixed(0)}% of its thickness by a crown facet`);
  if (maxBot > gBot + 0.5 * girdleT) problems.push(`girdle cut to ${(100 * (gTop - maxBot) / girdleT).toFixed(0)}% of its thickness by a pavilion facet`);
  // hills: a girdle facet reaching far above the girdle top or below its bottom means the crown or
  // pavilion facets beside it touch the girdle only at points and leave a wedge of girdle between them
  // (a design may declare zones where a thick girdle is intended, e.g. the heart's cleft: `girdleThickAt: [{ az, span }]`)
  const allowed = d.girdleThickAt || [];
  const inAllowed = (f) => { const c = f.idx.map((i) => m.verts[i]); const az = Math.atan2(c.reduce((s, v) => s + v[1], 0), c.reduce((s, v) => s + v[0], 0)) * 180 / Math.PI; return allowed.some((a) => Math.abs(((az - a.az + 540) % 360) - 180) <= a.span); };
  let maxTop = -Infinity, minBot = Infinity;
  for (const f of m.faces) if (isG(f) && !inAllowed(f)) { const zs = f.idx.map((i) => m.verts[i][2]); maxTop = Math.max(maxTop, Math.max(...zs)); minBot = Math.min(minBot, Math.min(...zs)); }
  const thickest = (maxTop - minBot) / girdleT;
  if (thickest > 1.6) problems.push(`girdle bulges to ${(100 * thickest).toFixed(0)}% of its thickness (${maxTop > gTop + 0.3 * girdleT ? 'above, between crown facets' : 'below, between pavilion facets'}): facets touching it at single points with a wedge of girdle between them`);
  // 2. slivers
  for (const f of m.faces) {
    if (isG(f)) continue;
    const P = f.idx.map((i) => m.verts[i]); let n = [0, 0, 0], longest = 0;
    for (let k = 1; k < P.length - 1; k++) { const u = P[k].map((v, j) => v - P[0][j]), w = P[k + 1].map((v, j) => v - P[0][j]); n[0] += u[1] * w[2] - u[2] * w[1]; n[1] += u[2] * w[0] - u[0] * w[2]; n[2] += u[0] * w[1] - u[1] * w[0]; }
    for (let k = 0; k < P.length; k++) { const q = P[(k + 1) % P.length]; longest = Math.max(longest, Math.hypot(q[0] - P[k][0], q[1] - P[k][1], q[2] - P[k][2])); }
    const area = Math.hypot(...n) / 2;
    if (area / longest < 0.01) problems.push(`${tier(f)?.name || f.tag}: sliver (width ${(area / longest).toFixed(4)})`);
  }
  // 3. every tier has faces
  for (const t of d.tiers) if (!t.hidden && !m.faces.some((f) => f.tag === t.id)) problems.push(`${t.name}: no faces`);
  const uniq = [...new Set(problems)];
  console.log(`${uniq.length ? 'FAIL' : 'ok  '} ${key} (${m.faceCount} facets, girdle ${(100 * girdleT / 2).toFixed(1)}%, thinnest ${(100 * (minTop - gBot) / girdleT).toFixed(0)}%, thickest ${(100 * thickest).toFixed(0)}%)`);
  for (const p of uniq.slice(0, 12)) console.log('      ' + p);
  if (uniq.length > 12) console.log(`      ... ${uniq.length - 12} more`);
  if (uniq.length) failed++;
}
process.exit(failed ? 1 : 0);
