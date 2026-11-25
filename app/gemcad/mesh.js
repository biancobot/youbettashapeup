// Polytope -> render buffers for the viewer. Girdle facets (angle 90 tiers) share "smooth" edges
// that are drawn only on the silhouette unless the user asks for every girdle line.
import { build, topology, unionHalves } from './polytope.js?v=80';
import { designPlanes, hasHalves } from './design.js?v=80';
import { triangulate } from '../geometry/core.js?v=80';

export function designMesh(design) {
  const planes = designPlanes(design);
  // A design with half-only tiers (the heart's cleft) is the union of two convex halves split
  // along x = 0; see designPlanes. Faces crossing the seam are merged back, so no line is drawn
  // down the middle of the table, and the seam edges that remain are real creases (the cleft).
  const faces = hasHalves(design) ? unionHalves(build(designPlanes(design, 'right'), 6), build(designPlanes(design, 'left'), 6)) : build(planes, 6);
  const topo = topology(faces);
  const tierById = new Map(design.tiers.map((t) => [t.id, t]));
  const isGirdle = (f) => { const t = tierById.get(f.tag); return t && Math.abs(t.angle) === 90; };
  const positions = [], hard = [], sp = [], na = [], nb = [];
  const normals = topo.faces.map((f) => f.plane ? f.plane.n : [0, 0, 1]);
  for (const f of topo.faces) {
    const pts = f.idx.map((i) => topo.verts[i]);
    const tris = triangulate(pts, f.plane ? f.plane.n : [0, 0, 1]);
    for (const t of tris) for (const k of t) positions.push(...pts[k]);
  }
  const coplanar = (a, b) => a.plane && b.plane && a.plane.n[0] * b.plane.n[0] + a.plane.n[1] * b.plane.n[1] + a.plane.n[2] * b.plane.n[2] > 1 - 1e-9 && Math.abs(a.plane.d - b.plane.d) < 1e-7;
  for (const e of topo.edges) {
    const [fa, fb] = e.faces;
    if (e.faces.length === 2 && coplanar(topo.faces[fa], topo.faces[fb])) continue;   // no crease between coplanar faces (a facet left in two parts across the seam)
    const smooth = e.faces.length === 2 && isGirdle(topo.faces[fa]) && isGirdle(topo.faces[fb]);
    const A = topo.verts[e.a], B = topo.verts[e.b];
    if (smooth) { sp.push(...A, ...B); na.push(...normals[fa]); nb.push(...normals[fb]); }
    else hard.push(...A, ...B);
  }
  let maxR = 0; const bbox = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const v of topo.verts) {
    maxR = Math.max(maxR, Math.hypot(...v));
    for (let k = 0; k < 3; k++) { bbox[0][k] = Math.min(bbox[0][k], v[k]); bbox[1][k] = Math.max(bbox[1][k], v[k]); }
  }
  const vertices = new Float32Array(topo.verts.flat());
  return {
    positions: new Float32Array(positions), hardEdges: new Float32Array(hard),
    smooth: { positions: new Float32Array(sp), normalsA: new Float32Array(na), normalsB: new Float32Array(nb) },
    vertices, verts: topo.verts, faces: topo.faces, faceCount: topo.faces.length, vertexCount: topo.verts.length,
    radius: maxR, bbox, planes,
  };
}

/** Proportions read from the built stone: width, length, depth, table, crown height etc. */
export function stoneStats(mesh, design) {
  const [lo, hi] = mesh.bbox;
  const W = hi[0] - lo[0], L = hi[1] - lo[1], D = hi[2] - lo[2];
  const tierById = new Map(design.tiers.map((t) => [t.id, t]));
  const girdleZ = mesh.faces.filter((f) => { const t = tierById.get(f.tag); return t && Math.abs(t.angle) === 90; })
    .flatMap((f) => f.idx.map((i) => mesh.verts[i][2]));
  const gTop = girdleZ.length ? Math.max(...girdleZ) : 0, gBot = girdleZ.length ? Math.min(...girdleZ) : 0;
  const table = mesh.faces.find((f) => { const t = tierById.get(f.tag); return t && t.angle === 0; });
  let tableW = null;
  if (table) {
    // table size as graded: the largest corner-to-corner distance of the table facet
    const P = table.idx.map((i) => mesh.verts[i]); tableW = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) tableW = Math.max(tableW, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
  }
  return { W, L, D, ratio: L / W, depth: D / W, crown: (hi[2] - gTop) / W, girdle: (gTop - gBot) / W, pavilion: (gBot - lo[2]) / W, table: tableW === null ? null : tableW / W, facets: mesh.faceCount };
}
