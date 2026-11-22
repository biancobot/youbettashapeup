// Convex polytope by successive half-space clipping. A stone is the intersection of the
// half-spaces of its facets, exactly as GemCad computes it. Faces carry the facet that cut them.
//
// plane: { n: [nx, ny, nz] (unit, pointing out of the stone), d: n . x on the facet, tag }

const EPS = 1e-9;

export function cube(half) {
  const h = half;
  const V = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]];
  const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return F.map((idx) => ({ pts: idx.map((i) => V[i].slice()), tag: 'stock' }));
}

function key(p) {
  return `${Math.round(p[0] * 1e7)},${Math.round(p[1] * 1e7)},${Math.round(p[2] * 1e7)}`;
}

/** Clip faces by the half-space n.x <= d and add the new facet polygon tagged `tag`. */
export function clip(faces, plane, tag) {
  const { n, d } = plane;
  const out = [];
  const onPlane = new Map();   // points lying on the cutting plane (candidates for the cap polygon)
  let cutAnything = false;
  for (const f of faces) {
    const P = f.pts, m = P.length;
    const s = P.map((p) => n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d);
    let allIn = true, allOut = true;
    for (const v of s) { if (v > EPS) allIn = false; if (v < -EPS) allOut = false; }
    if (allIn) { out.push(f); for (let i = 0; i < m; i++) if (Math.abs(s[i]) <= EPS) onPlane.set(key(P[i]), P[i]); continue; }
    if (allOut) { cutAnything = true; continue; }
    cutAnything = true;
    const kept = [];
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const a = P[i], b = P[j], sa = s[i], sb = s[j];
      if (sa <= EPS) { kept.push(a); if (Math.abs(sa) <= EPS) onPlane.set(key(a), a); }
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        const t = sa / (sa - sb);
        const x = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        kept.push(x); onPlane.set(key(x), x);
      }
    }
    const clean = [];
    for (const p of kept) if (!clean.length || key(clean[clean.length - 1]) !== key(p)) clean.push(p);
    if (clean.length > 1 && key(clean[0]) === key(clean[clean.length - 1])) clean.pop();
    if (clean.length >= 3) out.push({ ...f, pts: clean });
  }
  if (!cutAnything) return out;
  // Cap polygon: the on-plane points ordered around their centroid. The polytope is convex, so
  // the cap is convex and an angular sort is exact; this is robust to several edges meeting at
  // one point, as at the point of a marquise or pear preform.
  const pts = [...onPlane.values()];
  if (pts.length < 3) return out;
  const c = pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);
  const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = unit(crossv(n, ref)), v = crossv(n, u);
  const cap = pts.map((p) => { const r = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return { p, a: Math.atan2(dotv(r, v), dotv(r, u)) }; })
    .sort((x, y) => x.a - y.a).map((x) => x.p);
  const corners = [];
  for (let i = 0; i < cap.length; i++) {
    const p0 = cap[(i + cap.length - 1) % cap.length], p1 = cap[i], p2 = cap[(i + 1) % cap.length];
    const cr = crossv([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]);
    if (Math.hypot(...cr) > 1e-10) corners.push(p1);
  }
  if (corners.length >= 3) out.push({ pts: corners, tag, plane });
  return out;
}

const crossv = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotv = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };

/** Intersect the stock cube with every plane in order. */
export function build(planes, half = 4) {
  let faces = cube(half);
  for (const pl of planes) faces = clip(faces, pl, pl.tag);
  return faces.filter((f) => f.tag !== 'stock');
}

/** Weld vertices and list unique points, faces as index lists, and edges with their two faces. */
export function topology(faces) {
  const verts = [], map = new Map();
  const vid = (p) => { const k = key(p); if (!map.has(k)) { map.set(k, verts.length); verts.push(p.slice()); } return map.get(k); };
  const F = faces.map((f) => ({ idx: f.pts.map(vid), tag: f.tag, plane: f.plane }));
  const edges = new Map();
  F.forEach((f, fi) => {
    for (let i = 0; i < f.idx.length; i++) {
      const a = f.idx[i], b = f.idx[(i + 1) % f.idx.length];
      if (a === b) continue;
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (!edges.has(k)) edges.set(k, { a, b, faces: [] });
      edges.get(k).faces.push(fi);
    }
  });
  return { verts, faces: F, edges: [...edges.values()] };
}
