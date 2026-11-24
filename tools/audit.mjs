// Meet-point audit for every template: node tools/audit.mjs [templateKey ...]
// For each design it checks, after building the stone:
//   girdle: every crown or pavilion facet that reaches the girdle meets it at vertices shared with
//     a neighbouring facet (bezel tips and junctions are meet points; a single-vertex tangency is
//     allowed), no facet cuts more than half way through it, every girdle facet survives, the
//     valleys stay at least 1.5% of the width (GIA "thin") and a third of the hills, and the
//     girdle does not bulge past 160% outside zones the design declares (the heart's cleft);
//   slivers: no facet thinner than 1% of the half-width (area / longest edge);
//   symmetry classes: every tier produced faces.
// Exit code 1 if any template fails.
import { templates } from '../app/gemcad/templates.js';
import { designMesh } from '../app/gemcad/mesh.js';

// a key may carry parameters: node tools/audit.mjs 'cushionModified:{"ratio":1.05}'
const keys = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(templates).filter((k) => k !== 'blank');
let failed = 0;
for (const spec of keys) {
  const [key, json] = spec.split(/:(.+)/);
  const d = templates[key].make(json ? JSON.parse(json) : undefined);
  const m = designMesh(d);
  const tier = (f) => d.tiers.find((t) => t.id === f.tag);
  const isG = (f) => { const t = tier(f); return t && Math.abs(t.angle) === 90; };
  // nominal girdle: the girdle facets outside any zone the design declares as intentionally thick
  // (`girdleThickAt: [{ az, span }]`, e.g. the heart's cleft)
  const allowed = d.girdleThickAt || [];
  const inAllowed = (f) => { const c = f.idx.map((i) => m.verts[i]); const az = Math.atan2(c.reduce((s, v) => s + v[1], 0), c.reduce((s, v) => s + v[0], 0)) * 180 / Math.PI; return allowed.some((a) => Math.abs(((az - a.az + 540) % 360) - 180) <= a.span); };
  const gFaces = m.faces.filter((f) => isG(f) && !inAllowed(f));
  const gTop = 0, gBot = Math.min(...gFaces.flatMap((f) => f.idx.map((i) => m.verts[i][2])));
  const girdleT = gTop - gBot;
  const problems = [];
  // vertex -> faces
  const vf = new Map(); m.faces.forEach((f, fi) => f.idx.forEach((i) => { if (!vf.has(i)) vf.set(i, []); vf.get(i).push(fi); }));
  // 1. girdle meet points and valley depth
  let minTop = Infinity, maxBot = -Infinity;
  for (const f of m.faces) {
    if (isG(f)) {
      if (inAllowed(f)) continue;
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
    if (onG.length === 1) continue;   // a single girdle vertex at full height: the facet touches the girdle at a point (a tangency), which needs no second facet
    for (const i of onG) {
      const others = vf.get(i).filter((fi) => m.faces[fi] !== f && !isG(m.faces[fi]));
      if (!others.length) problems.push(`${t.name}: girdle vertex (${m.verts[i].map((v) => v.toFixed(3)).join(', ')}) shared with no other crown/pavilion facet`);
    }
  }
  // junctions: where two crown (or two pavilion) facets meet each other on the girdle, they must do
  // so at the girdle's full height or depth; a junction above or below it means one facet touches
  // the girdle at a point and the other meets it on its edge, with girdle between them
  for (const [i, fis] of vf) {
    if (!fis.some((fi) => isG(m.faces[fi])) || fis.some((fi) => isG(m.faces[fi]) && inAllowed(m.faces[fi]))) continue;
    for (const side of [1, -1]) {
      const fs = fis.filter((fi) => { const t = tier(m.faces[fi]); return t && Math.abs(t.angle) !== 90 && Math.sign(t.angle) === side; });
      if (fs.length < 2) continue;
      const level = side > 0 ? gTop : gBot, off = (m.verts[i][2] - level) * side;
      // a design whose facets are flat planes on a round girdle (the single cut) declares `girdleScallop`: its junctions sit on the hills by nature
      if (Math.abs(off) > (d.girdleScallop ? 0.6 : 0.02) * girdleT) problems.push(`${fs.map((fi) => tier(m.faces[fi]).name).join(' / ')}: junction on the girdle ${(100 * Math.abs(off) / girdleT).toFixed(0)}% ${off > 0 ? 'beyond' : 'short of'} the girdle ${side > 0 ? 'top' : 'bottom'} at (${m.verts[i].slice(0, 2).map((v) => v.toFixed(3)).join(', ')}): the facets should meet each other on the girdle, not ${off > 0 ? 'with girdle between them' : 'inside it'}`);
    }
  }
  // every girdle facet must exist and keep at least half the nominal thickness between the crown and pavilion facets
  const gTier = d.tiers.find((t) => Math.abs(t.angle) === 90);
  const gCount = m.faces.filter(isG).length;
  if (gTier && gCount < gTier.indices.length) problems.push(`${gTier.indices.length - gCount} of the ${gTier.indices.length} girdle facets are cut away entirely`);
  let thinnestRemaining = Infinity, thinnestAz = 0;
  for (const f of m.faces) if (isG(f) && !inAllowed(f)) { const zs = f.idx.map((i) => m.verts[i][2]); const t = Math.max(...zs) - Math.min(...zs); if (t < thinnestRemaining) { thinnestRemaining = t; const c = f.idx.map((i) => m.verts[i]); thinnestAz = Math.atan2(c.reduce((s, v) => s + v[1], 0), c.reduce((s, v) => s + v[0], 0)) * 180 / Math.PI; } }
  // the valleys (where an upper and a lower girdle facet both cut in) must stay at least "thin" on
  // GIA's girdle scale (1.5% of the width) and no thinner than a third of the hills
  const width = m.bbox[1][0] - m.bbox[0][0];
  if (thinnestRemaining < 0.015 * width || thinnestRemaining < girdleT / 3) problems.push(`girdle valley only ${(100 * thinnestRemaining / width).toFixed(2)}% of the width (${(100 * thinnestRemaining / girdleT).toFixed(0)}% of the hills) at azimuth ${thinnestAz.toFixed(0)}: GIA "thin" starts at 1.5%, and the valleys should keep a third of the hill thickness`);
  if (minTop < gTop - 0.5 * girdleT) problems.push(`girdle cut to ${(100 * (minTop - gBot) / girdleT).toFixed(0)}% of its thickness by a crown facet`);
  if (maxBot > gBot + 0.5 * girdleT) problems.push(`girdle cut to ${(100 * (gTop - maxBot) / girdleT).toFixed(0)}% of its thickness by a pavilion facet`);
  // hills: a girdle facet reaching far above the girdle top or below its bottom means the crown or
  // pavilion facets beside it touch the girdle only at points and leave a wedge of girdle between them
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
  // 3. the table has the declared number of sides (a design that declares `tableSides`: a corner clipped by a facet that should stop short of it shows up as an extra side)
  if (d.tableSides) { const tf = m.faces.find((f) => tier(f)?.name === 'T'); if (tf && tf.idx.length !== d.tableSides) problems.push(`table has ${tf.idx.length} sides instead of ${d.tableSides}: a facet clips a table corner`); }
  // 4. every tier has faces
  for (const t of d.tiers) if (!t.hidden && !m.faces.some((f) => f.tag === t.id)) problems.push(`${t.name}: no faces`);
  const uniq = [...new Set(problems)];
  console.log(`${uniq.length ? 'FAIL' : 'ok  '} ${key} (${m.faceCount} facets, girdle ${(100 * girdleT / 2).toFixed(1)}%, thinnest ${(100 * thinnestRemaining / girdleT).toFixed(0)}%, thickest ${(100 * thickest).toFixed(0)}%)`);
  for (const p of uniq.slice(0, 12)) console.log('      ' + p);
  if (uniq.length > 12) console.log(`      ... ${uniq.length - 12} more`);
  if (uniq.length) failed++;
}
process.exit(failed ? 1 : 0);
