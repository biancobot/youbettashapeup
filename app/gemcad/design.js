// GemCad-style design model.
//
// A design is a list of tiers. Each tier has an angle to the girdle plane (0 = table, 90 =
// girdle facet; positive = crown, negative = pavilion as in GemCad), a centre-to-facet distance
// and a list of index-wheel positions. Each (tier, index) pair is one facet: a plane whose normal
// points outward at azimuth(index) and whose perpendicular distance from the axis origin is the
// tier's distance. Optional per-index distances allow non-round girdle preforms.
//
// Index convention (GemCad): index 0 (= gear) at 12 o'clock, increasing clockwise seen from the
// crown. Azimuth in model space (counter-clockwise from +x) = 90 - 360 * index / gear.

export function azimuthDeg(index, gear) {
  return 90 - (360 * index) / gear;
}

export function indexOfAzimuth(azDeg, gear) {
  let k = ((90 - azDeg) * gear) / 360;
  k = ((k % gear) + gear) % gear;
  return k;
}

/** Plane for one facet of a tier. Returns { n, d, tag, tier, index }. */
export function facetPlane(tier, index, gear, dist = tier.distance) {
  const a = (Math.abs(tier.angle) * Math.PI) / 180;
  const az = (azimuthDeg(index, gear) * Math.PI) / 180;
  const sign = tier.angle >= 0 ? 1 : -1;
  const n = [Math.sin(a) * Math.cos(az), Math.sin(a) * Math.sin(az), sign * Math.cos(a)];
  return { n, d: dist, tag: tier.id, tier: tier.id, index };
}

/**
 * All facet planes of a design, in tier order.
 *
 * Non-convex stones (the heart's cleft): a tier may carry `half: 'right' | 'left'`, meaning its
 * facets cut only that half of the stone (x >= 0 or x <= 0). Such a stone is built as the union
 * of two convex halves, each the intersection of the common half-spaces, its own half's
 * half-spaces and the splitting plane x = 0. With `half` given, this returns the planes for that
 * half: common tiers, the tiers of that half, and the splitting plane tagged 'seam'. Without it,
 * every tier is returned as before (convex designs are unaffected).
 */
export function designPlanes(design, half) {
  const planes = [];
  for (const tier of design.tiers) {
    if (tier.hidden) continue;
    if (half && tier.half && tier.half !== half) continue;
    const idx = tier.indices.length ? tier.indices : [0];
    idx.forEach((k, i) => {
      const dist = tier.distances && tier.distances[i] !== undefined && tier.distances[i] !== null ? tier.distances[i] : tier.distance;
      planes.push(facetPlane(tier, k, design.gear, dist));
    });
  }
  if (half) planes.push({ n: [half === 'right' ? -1 : 1, 0, 0], d: 0, tag: 'seam', tier: 'seam', index: 0 });
  return planes;
}

/** True when the design has half-only tiers and must be built as the union of two halves. */
export function hasHalves(design) {
  return design.tiers.some((t) => !t.hidden && (t.half === 'right' || t.half === 'left'));
}

/** Expand one index into its symmetric set: n-fold rotation and optional mirror. */
export function expandIndex(index, gear, fold, mirror) {
  const set = new Set();
  const step = gear / fold;
  for (let j = 0; j < fold; j++) {
    const k = ((index + j * step) % gear + gear) % gear;
    set.add(round6(k));
    if (mirror) set.add(round6(((gear - k) % gear + gear) % gear));
  }
  return [...set].sort((a, b) => a - b);
}
const round6 = (v) => Math.round(v * 1e6) / 1e6;

/** Tier (angle, index, distance) that reproduces a given plane { n, d }. */
export function tierFromPlane(n, d, gear) {
  const h = Math.hypot(n[0], n[1]);
  const angle = (Math.atan2(h, Math.abs(n[2])) * 180) / Math.PI * (n[2] >= 0 ? 1 : -1);
  const az = (Math.atan2(n[1], n[0]) * 180) / Math.PI;
  return { angle: h < 1e-9 ? 0 : angle, index: h < 1e-9 ? 0 : indexOfAzimuth(az, gear), distance: d };
}

/** Distance that makes the facet (angle, index) pass through point p: "cut to meet point". */
export function distanceThrough(tier, index, gear, p) {
  const { n } = facetPlane(tier, index, gear, 0);
  return n[0] * p[0] + n[1] * p[1] + n[2] * p[2];
}

let nextId = 1;
export function newTier(props) {
  return { id: `t${nextId++}`, name: '', angle: 0, distance: 1, indices: [], distances: null, hidden: false, ...props };
}
export function resetIds(design) {
  nextId = 1;
  for (const t of design.tiers) t.id = `t${nextId++}`;
  return design;
}

// --------------------------------------------------------------------------- .asc round trip
// GemCad for Windows .ASC: "g <gear> <offset>", "y <fold> <y|n>", "I <ri>", "H <heading>",
// "a <angle> <distance> <index> [n <name>] <index> ... [G <instructions>]", "F <footnote>".

export function parseAsc(text) {
  const design = { name: 'Imported', gear: 96, fold: 1, mirror: false, ri: 2.42, headings: [], footnotes: [], tiers: [] };
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const parts = line.split(/\s+/);
    const tag = parts[0];
    if (tag === 'g') { design.gear = parseFloat(parts[1]) || 96; continue; }
    if (tag === 'y') { design.fold = parseInt(parts[1], 10) || 1; design.mirror = (parts[2] || 'n').toLowerCase() === 'y'; continue; }
    if (tag === 'I') { design.ri = parseFloat(parts[1]) || 2.42; continue; }
    if (tag === 'H') { design.headings.push(line.slice(2).trim()); if (!design.headings.length || design.name === 'Imported') design.name = design.headings[0]; continue; }
    if (tag === 'F') { design.footnotes.push(line.slice(2).trim()); continue; }
    if (tag === 'G') { if (current) { current.instructions = (current.instructions ? current.instructions + ' ' : '') + line.slice(2).trim(); readHalf(current); } continue; }
    if (tag === 'a') {
      const angle = parseFloat(parts[1].replace('−', '-'));
      const distance = parseFloat(parts[2]);
      const tier = newTier({ angle, distance, indices: [] });
      let i = 3;
      while (i < parts.length) {
        const tok = parts[i];
        if (tok === 'n') { tier.name = parts[i + 1] || ''; i += 2; continue; }
        if (tok === 'G') { tier.instructions = parts.slice(i + 1).join(' '); readHalf(tier); break; }
        if (/^-?\d+(\.\d+)?$/.test(tok)) tier.indices.push(parseFloat(tok));
        i += 1;
      }
      design.tiers.push(tier); current = tier;
      continue;
    }
    // continuation line of indices
    if (current && parts.every((t) => /^-?\d+(\.\d+)?$/.test(t))) current.indices.push(...parts.map(parseFloat));
  }
  return design;
}

/** A half-only tier is written as GemCad cutting instructions "half:right" / "half:left" (see designPlanes); read it back. */
function readHalf(tier) {
  const m = /^half:(right|left)\b\s*/.exec(tier.instructions || '');
  if (!m) return;
  tier.half = m[1];
  tier.instructions = tier.instructions.slice(m[0].length) || undefined;
}

export function toAsc(design) {
  const L = ['GemCad 5.0', `g ${design.gear} 0.0`, `y ${design.fold} ${design.mirror ? 'y' : 'n'}`, `I ${design.ri}`];
  for (const h of (design.headings.length ? design.headings : [design.name])) L.push(`H ${h}`);
  for (const t of design.tiers) {
    if (t.distances && t.distances.some((d) => d !== null && d !== undefined && d !== t.distance)) {
      // GemCad has one distance per tier: per-index distances are written as one tier per index
      t.indices.forEach((k, i) => {
        const d = t.distances[i] ?? t.distance;
        L.push(`a ${fmt(t.angle)} ${fmt(d, 8)} ${fmtIdx(k)}${i === 0 && t.name ? ' n ' + t.name : ''}${t.half ? ' G half:' + t.half : ''}`);
      });
      continue;
    }
    const idx = t.indices.map(fmtIdx);
    const first = idx.length ? idx[0] : '96';
    L.push(`a ${fmt(t.angle)} ${fmt(t.distance, 8)} ${first}${t.name ? ' n ' + t.name : ''}${idx.length > 1 ? ' ' + idx.slice(1).join(' ') : ''}${instr(t) ? ' G ' + instr(t) : ''}`);
  }
  for (const f of design.footnotes) L.push(`F ${f}`);
  if (hasHalves(design)) L.push('F Tiers marked "half:right" / "half:left" cut only that half of the stone (non-convex outline built as the union of two convex halves). GemCad cannot express this: cut as plain tiers it would remove the cleft.');
  return L.join('\n') + '\n';
}
const instr = (t) => (t.half ? `half:${t.half}${t.instructions ? ' ' + t.instructions : ''}` : t.instructions || '');
const fmt = (v, p = 6) => Number(v).toFixed(p);
const fmtIdx = (k) => (Number.isInteger(k) ? String(k) : String(Math.round(k * 1000) / 1000));
