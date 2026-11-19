// Core vector math, plane construction and mesh assembly used by every shape builder.
//
// Conventions (model space):
//   X = width axis (right), Y = length axis (up in the face-up view), Z = table normal.
//   z = 0 is the top edge of the girdle at the anchor points. The crown rises to +H,
//   the girdle runs down to -g, the pavilion continues down to -g - P.
//   All sizes are normalised so that the stone width is 1.

/**
 * Girdle mode. Lab diagrams draw the girdle as a flat band, so by default every girdle point
 * sits at the reference heights (crown edge at 0, pavilion edge at -g) and the facets that
 * meet the girdle along a curved arc are very slightly non-planar (by the arc's sagitta).
 * With flat = false the facets stay exactly planar and the girdle edges scallop instead.
 */
export const GIRDLE = { flat: true };

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.sqrt(dot(a, a));
export const normalize = (a) => {
  const l = length(a);
  return l > 0 ? scale(a, 1 / l) : [0, 0, 0];
};

/** Plane through three points: { n, d } with n . x = d. */
export function planeFrom3(p, q, r) {
  const n = normalize(cross(sub(q, p), sub(r, p)));
  if (length(n) === 0) throw new Error('planeFrom3: degenerate points');
  return { n, d: dot(n, p) };
}

/** z of the plane at (x, y). The plane must not be vertical. */
export function planeZ(pl, x, y) {
  if (Math.abs(pl.n[2]) < 1e-9) throw new Error('planeZ: vertical plane');
  return (pl.d - pl.n[0] * x - pl.n[1] * y) / pl.n[2];
}

/**
 * Plane containing points T and G whose steepest slope runs along T->G
 * (no twist): the horizontal direction perpendicular to (G - T) lies in the plane.
 */
export function planeNoTwist(T, G) {
  const dx = G[0] - T[0], dy = G[1] - T[1];
  const h = normalize([-dy, dx, 0]);
  return planeFrom3(T, G, [T[0] + h[0], T[1] + h[1], T[2]]);
}

/** Line of intersection of two planes: { pt, dir }. */
export function intersectPlanes(p1, p2) {
  const dir = normalize(cross(p1.n, p2.n));
  if (length(dir) < 1e-9) throw new Error('intersectPlanes: parallel planes');
  const c = cross(p2.n, dir);
  const denom = dot(p1.n, c);
  const pt = scale(add(scale(cross(p2.n, dir), p1.d), scale(cross(dir, p1.n), p2.d)), 1 / denom);
  return { pt, dir };
}

/** Point on a 3D line whose XY projection is nearest to a 2D target. */
export function pointOnLineNearestXY(line, target) {
  const dx = line.dir[0], dy = line.dir[1];
  const dd = dx * dx + dy * dy;
  if (dd < 1e-12) return [target[0], target[1], line.pt[2]];
  const t = ((target[0] - line.pt[0]) * dx + (target[1] - line.pt[1]) * dy) / dd;
  return add(line.pt, scale(line.dir, t));
}

/** Point on a 3D line at a given z. */
export function pointOnLineAtZ(line, z) {
  if (Math.abs(line.dir[2]) < 1e-12) throw new Error('pointOnLineAtZ: horizontal line');
  const t = (z - line.pt[2]) / line.dir[2];
  return add(line.pt, scale(line.dir, t));
}

// ---------------------------------------------------------------------------
// Polygon triangulation (ear clipping) for planar, possibly concave polygons.
// ---------------------------------------------------------------------------

function projectTo2D(points, normal) {
  const ax = Math.abs(normal[0]), ay = Math.abs(normal[1]), az = Math.abs(normal[2]);
  if (az >= ax && az >= ay) return points.map((p) => [p[0], p[1]]);
  if (ax >= ay) return points.map((p) => [p[1], p[2]]);
  return points.map((p) => [p[2], p[0]]);
}

function signedArea2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function pointInTri(p, a, b, c) {
  const s = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
  const t = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
  const d = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
  return d === 0 || (d < 0) === (s + t <= 0);
}

/** Returns triangles as index triples into `points` (3D) using ear clipping. */
export function triangulate(points, normal) {
  const n = points.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];
  let pts = projectTo2D(points, normal);
  let idx = points.map((_, i) => i);
  if (signedArea2(pts) < 0) idx.reverse();
  const P = (k) => pts[idx[k]];
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = (i + idx.length - 1) % idx.length, i2 = (i + 1) % idx.length;
      const a = P(i0), b = P(i), c = P(i2);
      const crossz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (crossz <= 1e-14) continue; // reflex or degenerate vertex
      let ok = true;
      for (let j = 0; j < idx.length; j++) {
        if (j === i0 || j === i || j === i2) continue;
        const p = P(j);
        if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1]) || (p[0] === c[0] && p[1] === c[1])) continue;
        if (pointInTri(p, a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([idx[i0], idx[i], idx[i2]]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      // Fall back: drop the most degenerate vertex to keep going.
      let worst = 0, worstVal = Infinity;
      for (let i = 0; i < idx.length; i++) {
        const i0 = (i + idx.length - 1) % idx.length, i2 = (i + 1) % idx.length;
        const a = P(i0), b = P(i), c = P(i2);
        const v = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
        if (v < worstVal) { worstVal = v; worst = i; }
      }
      idx.splice(worst, 1);
    }
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// ---------------------------------------------------------------------------
// Mesh builder: vertices are de-duplicated so shared edges are found exactly.
// ---------------------------------------------------------------------------

export class MeshBuilder {
  constructor() {
    this.verts = [];
    this.map = new Map();
    this.faces = [];        // { idx: [vertex indices], tag }
    this.smoothEdges = [];  // { a, b, faceA, faceB } edges hidden unless on the silhouette
  }

  v(p) {
    const k = p.map((c) => (Math.abs(c) < 5e-7 ? 0 : Math.round(c * 1e6) / 1e6)).join(',');
    if (this.map.has(k)) return this.map.get(k);
    const i = this.verts.length;
    this.verts.push(k.split(',').map(Number));
    this.map.set(k, i);
    return i;
  }

  face(points, tag) {
    const idx = [];
    for (const p of points) {
      const i = this.v(p);
      if (idx.length === 0 || idx[idx.length - 1] !== i) idx.push(i);
    }
    if (idx.length > 1 && idx[0] === idx[idx.length - 1]) idx.pop();
    if (idx.length < 3) return -1;
    this.faces.push({ idx, tag });
    return this.faces.length - 1;
  }

  /** Mark the edge (a, b) shared by faces fa, fb as smooth (drawn only when on the silhouette). */
  smoothEdge(a, b, fa, fb) {
    this.smoothEdges.push({ a, b, fa, fb });
  }

  faceNormal(f) {
    const pts = f.idx.map((i) => this.verts[i]);
    // Newell's method handles concave polygons.
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      n[0] += (p[1] - q[1]) * (p[2] + q[2]);
      n[1] += (p[2] - q[2]) * (p[0] + q[0]);
      n[2] += (p[0] - q[0]) * (p[1] + q[1]);
    }
    return normalize(n);
  }

  /**
   * Produce render buffers:
   *   positions: Float32Array of triangles (occluder)
   *   hardEdges: Float32Array of segment pairs always drawn
   *   smooth:    { positions: Float32Array, normalsA: Float32Array, normalsB: Float32Array }
   */
  build() {
    const smoothKey = new Set(this.smoothEdges.map((e) => (e.a < e.b ? `${e.a},${e.b}` : `${e.b},${e.a}`)));
    const positions = [];
    const edgeSet = new Map();
    for (const f of this.faces) {
      const pts = f.idx.map((i) => this.verts[i]);
      const n = this.faceNormal(f);
      const tris = triangulate(pts, n);
      for (const t of tris) for (const k of t) positions.push(...pts[k]);
      for (let i = 0; i < f.idx.length; i++) {
        const a = f.idx[i], b = f.idx[(i + 1) % f.idx.length];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (!edgeSet.has(key)) edgeSet.set(key, [a, b]);
      }
    }
    const hard = [];
    for (const [key, [a, b]] of edgeSet) {
      if (smoothKey.has(key)) continue;
      hard.push(...this.verts[a], ...this.verts[b]);
    }
    const sp = [], na = [], nb = [];
    for (const e of this.smoothEdges) {
      sp.push(...this.verts[e.a], ...this.verts[e.b]);
      na.push(...this.faceNormal(this.faces[e.fa]));
      nb.push(...this.faceNormal(this.faces[e.fb]));
    }
    let maxR = 0;
    for (const v of this.verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
    const bbox = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    for (const v of this.verts) for (let k = 0; k < 3; k++) {
      bbox[0][k] = Math.min(bbox[0][k], v[k]);
      bbox[1][k] = Math.max(bbox[1][k], v[k]);
    }
    const vertices = new Float32Array(this.verts.length * 3);
    this.verts.forEach((v, i) => { vertices[3 * i] = v[0]; vertices[3 * i + 1] = v[1]; vertices[3 * i + 2] = v[2]; });
    return {
      vertices,
      positions: new Float32Array(positions),
      hardEdges: new Float32Array(hard),
      smooth: { positions: new Float32Array(sp), normalsA: new Float32Array(na), normalsB: new Float32Array(nb) },
      faceCount: this.faces.length,
      vertexCount: this.verts.length,
      radius: maxR,
      bbox,
    };
  }
}
