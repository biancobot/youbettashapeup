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
  const segs = [];
  for (const f of faces) {
    const P = f.pts, m = P.length;
    const s = P.map((p) => n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d);
    let allIn = true, allOut = true;
    for (const v of s) { if (v > EPS) allIn = false; if (v < -EPS) allOut = false; }
    if (allIn) { out.push(f); continue; }
    if (allOut) continue;
    const kept = [], cross = [];
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const a = P[i], b = P[j], sa = s[i], sb = s[j];
      if (sa <= EPS) kept.push(a);
      if (Math.abs(sa) <= EPS) { if (sb > EPS || s[(i + m - 1) % m] > EPS) cross.push(a); }
      else if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        const t = sa / (sa - sb);
        const x = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        kept.push(x); cross.push(x);
      }
    }
    // de-duplicate consecutive points
    const clean = [];
    for (const p of kept) if (!clean.length || key(clean[clean.length - 1]) !== key(p)) clean.push(p);
    if (clean.length > 1 && key(clean[0]) === key(clean[clean.length - 1])) clean.pop();
    if (clean.length >= 3) out.push({ ...f, pts: clean });
    // the two crossing points of this face form one edge of the cap
    const uniq = []; for (const p of cross) if (!uniq.some((q) => key(q) === key(p))) uniq.push(p);
    if (uniq.length === 2) segs.push(uniq);
  }
  const cap = chain(segs);
  if (cap.length >= 3) {
    // orient the cap counter-clockwise about the outward normal n
    const c = cap.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / cap.length);
    let ax = 0, ay = 0, az = 0;
    for (let i = 0; i < cap.length; i++) {
      const p = cap[i], q = cap[(i + 1) % cap.length];
      const u = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], v = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
      ax += u[1] * v[2] - u[2] * v[1]; ay += u[2] * v[0] - u[0] * v[2]; az += u[0] * v[1] - u[1] * v[0];
    }
    if (ax * n[0] + ay * n[1] + az * n[2] < 0) cap.reverse();
    out.push({ pts: cap, tag, plane });
  }
  return out;
}

function chain(segs) {
  if (!segs.length) return [];
  const used = new Array(segs.length).fill(false);
  const loop = [segs[0][0], segs[0][1]]; used[0] = true;
  let guard = 0;
  while (guard++ < segs.length + 1) {
    const last = key(loop[loop.length - 1]);
    if (loop.length > 2 && last === key(loop[0])) { loop.pop(); break; }
    let found = -1;
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      if (key(segs[i][0]) === last) { loop.push(segs[i][1]); used[i] = true; found = i; break; }
      if (key(segs[i][1]) === last) { loop.push(segs[i][0]); used[i] = true; found = i; break; }
    }
    if (found < 0) break;
  }
  if (loop.length > 2 && key(loop[loop.length - 1]) === key(loop[0])) loop.pop();
  return loop;
}

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
