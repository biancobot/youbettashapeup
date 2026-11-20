// Build a faceted stone the way a cutter (or a CAD program) does: start from the girdle prism
// and cut it with one plane per facet. Each cut removes everything on the outer side of the
// plane and adds the new facet as a cap face. The girdle is whatever is left of the prism, so
// its thickness varies exactly as the facet planes dictate.
//
// The prism may be non-convex (heart outlines); each cut clips every face polygon against the
// half-space and reassembles the cap from the intersection segments.

import { MeshBuilder, dot, sub, cross, normalize } from './core.js';

const EPS = 1e-9;

/** Prism of the outline between zBottom and zTop: { pts: [[x,y,z]...], tag } faces. */
export function prism(outline, zBottom, zTop) {
  const pts = outline.points;
  const N = pts.length;
  const faces = [];
  faces.push({ pts: pts.map((p) => [p[0], p[1], zTop]), tag: 'cap-top' });
  faces.push({ pts: pts.slice().reverse().map((p) => [p[0], p[1], zBottom]), tag: 'cap-bottom' });
  for (let k = 0; k < N; k++) {
    const a = pts[k], b = pts[(k + 1) % N];
    faces.push({ pts: [[a[0], a[1], zBottom], [b[0], b[1], zBottom], [b[0], b[1], zTop], [a[0], a[1], zTop]], tag: 'girdle', girdleIndex: k });
  }
  return faces;
}

/** Plane through three points, oriented so that `inside` is on the kept side (n.p - d <= 0). */
export function cutPlane(p, q, r, inside) {
  let n = normalize(cross(sub(q, p), sub(r, p)));
  let d = dot(n, p);
  if (dot(n, inside) - d > 0) { n = [-n[0], -n[1], -n[2]]; d = -d; }
  return { n, d };
}

function key(p) {
  return p.map((c) => (Math.abs(c) < 5e-8 ? 0 : Math.round(c * 1e7) / 1e7)).join(',');
}

/** Clip a list of faces by a plane (keep n.p - d <= 0) and add the cap face(s). */
export function clip(faces, plane, tag) {
  const out = [];
  const segments = [];
  for (const f of faces) {
    const pts = f.pts;
    const n = pts.length;
    const s = pts.map((p) => dot(plane.n, p) - plane.d);
    if (s.every((v) => v <= EPS)) { out.push(f); continue; }
    if (s.every((v) => v >= -EPS)) continue;
    const kept = [];
    const crossings = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = pts[i], b = pts[j], sa = s[i], sb = s[j];
      if (sa <= EPS) kept.push(a);
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        const t = sa / (sa - sb);
        const x = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        kept.push(x);
        crossings.push(x);
      } else if (Math.abs(sa) <= EPS && sb > EPS) {
        crossings.push(a);
      } else if (sa > EPS && Math.abs(sb) <= EPS) {
        crossings.push(b);
      }
    }
    if (kept.length >= 3) out.push({ ...f, pts: kept });
    for (let i = 0; i + 1 < crossings.length; i += 2) segments.push([crossings[i], crossings[i + 1]]);
  }
  // Assemble cap loops from the segments.
  const loops = chainLoops(segments);
  for (const loop of loops) {
    if (loop.length >= 3) out.push({ pts: loop, tag });
  }
  return out;
}

function chainLoops(segments) {
  const loops = [];
  const used = new Array(segments.length).fill(false);
  const index = new Map();
  segments.forEach((sg, i) => {
    for (const p of sg) {
      const k = key(p);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(i);
    }
  });
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const loop = [segments[i][0], segments[i][1]];
    let guard = 0;
    while (guard++ < segments.length + 2) {
      const last = loop[loop.length - 1];
      if (key(last) === key(loop[0]) && loop.length > 2) { loop.pop(); break; }
      const cands = (index.get(key(last)) || []).filter((j) => !used[j]);
      if (!cands.length) break;
      const j = cands[0];
      used[j] = true;
      const sg = segments[j];
      loop.push(key(sg[0]) === key(last) ? sg[1] : sg[0]);
    }
    loops.push(loop);
  }
  return loops;
}

/**
 * Cut the prism with every plane and return a MeshBuilder. Girdle faces keep their tag so the
 * renderer can treat their shared edges as girdle facet lines.
 */
export function buildByCutting(outline, planes, { zBottom = -3, zTop = 1 } = {}) {
  let faces = prism(outline, zBottom, zTop);
  for (const pl of planes) faces = clip(faces, pl, pl.tag);
  const mb = new MeshBuilder();
  const girdleFaceIds = new Map();
  for (const f of faces) {
    const id = mb.face(f.pts, f.tag);
    if (id >= 0 && f.tag === 'girdle') girdleFaceIds.set(f.girdleIndex, id);
  }
  // vertical edges shared by neighbouring girdle facets are the girdle facet lines
  const N = outline.points.length;
  for (let k = 0; k < N; k++) {
    const a = girdleFaceIds.get(k), b = girdleFaceIds.get((k + 1) % N);
    if (a === undefined || b === undefined) continue;
    const fa = mb.faces[a], fb = mb.faces[b];
    const shared = fa.idx.filter((i) => fb.idx.includes(i));
    if (shared.length === 2) mb.smoothEdge(shared[0], shared[1], a, b);
  }
  mb.cut = true;
  return mb;
}
