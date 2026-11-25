// Building blocks for fancy-shape generators (GemCad style): outlines with support function,
// point and outward normal by radial azimuth; girdle polygon vertices; planes through points or
// tangent to the girdle; symmetry-class tiers.
//
// Conventions: half-width 1 (width 2), length along y, table at z = +H, girdle top at z = 0,
// girdle bottom at z = -g, culet below. Radial azimuth: degrees counter-clockwise from +x, so
// the top point of a marquise or pear is at 90. A facet's azimuth is the direction of its
// outward normal; for a facet touching the girdle that is the outline normal at the contact.
import { newTier, tierFromPlane, expandIndex, azimuthDeg } from './design.js?v=74';
import { girdleFromSupport, plane3, intersect3 } from './generators.js?v=74';

export { plane3, intersect3, girdleFromSupport };
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const norm360 = (a) => ((a % 360) + 360) % 360;
export const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// ---------------------------------------------------------------- outlines
/** Support function of a marquise outline (two circular arcs), half-width w, half-length l. */
export function marquiseSupport(w, l) {
  const R = (l * l + w * w) / (2 * w), c = R - w, sinMax = l / R;
  return (t) => {
    const ct = Math.abs(Math.cos(t)), st = Math.abs(Math.sin(t));
    return st <= sinMax ? R - c * ct : l * st;
  };
}

/** Two-arc marquise outline, half-width 1, half-length l: support, point and outward normal by radial azimuth. */
export function marquiseOutline(l) {
  const R = (l * l + 1) / 2, c = R - 1;
  const point = (az) => {
    const t = rad(az), ct = Math.cos(t), st = Math.sin(t), s = ct >= 0 ? 1 : -1;
    const r = -s * c * ct + Math.sqrt(R * R - c * c * st * st);
    return [r * ct, r * st];
  };
  const normalAz = (az) => {
    const t = rad(az);
    if (Math.abs(Math.cos(t)) < 1e-9) return Math.sin(t) > 0 ? 90 : 270;
    const [x, y] = point(az), s = Math.cos(t) >= 0 ? 1 : -1;
    return norm360(deg(Math.atan2(y, x + s * c)));
  };
  return { l, R, c, support: marquiseSupport(1, l), point, normalAz };
}

/** Ellipse outline, semi-axes 1 (x) and l (y). */
export function ellipseOutline(l) {
  const support = (t) => Math.sqrt(Math.cos(t) ** 2 + l * l * Math.sin(t) ** 2);
  const point = (az) => { const t = rad(az), r = l / Math.sqrt(l * l * Math.cos(t) ** 2 + Math.sin(t) ** 2); return [r * Math.cos(t), r * Math.sin(t)]; };
  const normalAz = (az) => { const [x, y] = point(az); return norm360(deg(Math.atan2(y / (l * l), x))); };
  return { l, support, point, normalAz };
}

/**
 * Convex outline given only by its support function h(phi) (distance from the axis to the
 * tangent line with outward normal at angle phi, radians). Point and normal by radial azimuth are
 * found numerically. Use for outlines made of arcs and tangent lines (pear, heart halves).
 */
export function outlineFromSupport(h) {
  const dh = (phi, e = 1e-5) => (h(phi + e) - h(phi - e)) / (2 * e);
  const contact = (phi) => { const v = h(phi), d = dh(phi); return [v * Math.cos(phi) - d * Math.sin(phi), v * Math.sin(phi) + d * Math.cos(phi)]; };
  const radialOf = (phi) => { const [x, y] = contact(phi); return Math.atan2(y, x); };
  const point = (az) => {
    // bisection on the normal angle phi so that the contact point's radial azimuth equals az
    const target = rad(az);
    let lo = target - Math.PI / 2 + 1e-6, hi = target + Math.PI / 2 - 1e-6;
    const f = (phi) => { let d = radialOf(phi) - target; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
    const phi = (lo + hi) / 2;
    // at a corner (support not differentiable) the contact jumps; return the point on the ray at the support distance
    const p = contact(phi), r = Math.hypot(...p);
    const dir = [Math.cos(target), Math.sin(target)];
    const pr = p[0] * dir[0] + p[1] * dir[1];
    return Math.abs(f(phi)) < 1e-6 ? p : [dir[0] * pr, dir[1] * pr, r];
  };
  const normalAz = (az) => {
    const target = rad(az);
    let lo = target - Math.PI / 2 + 1e-6, hi = target + Math.PI / 2 - 1e-6;
    const f = (phi) => { let d = radialOf(phi) - target; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
    return norm360(deg((lo + hi) / 2));
  };
  return { support: h, point, normalAz };
}

/** Support function of a convex polygon (vertices counter-clockwise). */
export function polygonSupport(verts) {
  return (t) => Math.max(...verts.map(([x, y]) => x * Math.cos(t) + y * Math.sin(t)));
}

/** Girdle tier with one facet per edge of a convex polygon (vertices counter-clockwise). */
export function girdleFromPolygon(verts, gear) {
  const tier = newTier({ name: 'G', angle: 90, distance: 1, indices: [], distances: [] });
  const h = polygonSupport(verts);
  for (let i = 0; i < verts.length; i++) {
    const [x0, y0] = verts[i], [x1, y1] = verts[(i + 1) % verts.length];
    const az = deg(Math.atan2(-(x1 - x0), y1 - y0));   // outward normal of a counter-clockwise edge
    tier.indices.push(indexOf(az, gear)); tier.distances.push(h(rad(az)));
  }
  return tier;
}

/**
 * Girdle tier with `count` facets of equal length along the outline. The outline (an object with
 * a support function, or the support function itself) is first polygonised finely by normal
 * angle, which is exact on flats and arcs alike; the facets' tangent points are then spaced by
 * equal arc length along that polygon, starting half a step from the point at radial azimuth
 * `originAz` (so a polygon vertex falls on that azimuth, and by symmetry on the other axes when
 * count is a multiple of 4). The polygon's vertices are spaced equally along the outline and each
 * facet is the chord between consecutive vertices, so all facets have the same length and the
 * vertices lie on the outline; collinear chords on a flat edge give one facet.
 */
export function girdleEqualLength(outline, count, gear, originAz = 0, cornersAz = []) {
  const h = typeof outline === 'function' ? outline : outline.support;
  const fine = 2880;
  const f = [];
  for (let k = 0; k < fine; k++) { const az = (360 * k) / fine; f.push({ az, h: h(rad(az)) }); }
  // polygon vertices: V_k = facet k ∩ facet k+1; the edge on facet k runs from V_(k-1) to V_k
  const V = [];
  for (let k = 0; k < fine; k++) {
    const a = f[k], b = f[(k + 1) % fine], det = Math.sin(rad(b.az - a.az));
    V.push([(a.h * Math.sin(rad(b.az)) - b.h * Math.sin(rad(a.az))) / det, (b.h * Math.cos(rad(a.az)) - a.h * Math.cos(rad(b.az))) / det]);
  }
  const edges = [];   // { p0, p1, az, len } with cumulative length
  let total = 0;
  for (let k = 0; k < fine; k++) {
    const p0 = V[(k - 1 + fine) % fine], p1 = V[k], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (len < 1e-9) continue;
    edges.push({ p0, p1, az: f[k].az, len, s0: total }); total += len;
  }
  // arc-length position of the outline point at a radial azimuth (the edge the ray crosses)
  const sAt = (azimuth) => {
    const dir = [Math.cos(rad(azimuth)), Math.sin(rad(azimuth))], eps = 1e-9;
    for (const e of edges) {
      const c0 = dir[0] * e.p0[1] - dir[1] * e.p0[0], c1 = dir[0] * e.p1[1] - dir[1] * e.p1[0];   // cross products: sign change = crossing (with a tolerance for a vertex exactly on the ray)
      if (Math.abs(c0) < eps && Math.abs(c1) < eps) continue;
      if ((c0 <= eps && c1 >= -eps) || (c0 >= -eps && c1 <= eps)) { if (dir[0] * e.p0[0] + dir[1] * e.p0[1] > 0) return e.s0 + e.len * (Math.abs(c0) / (Math.abs(c0) + Math.abs(c1))); }
    }
    return 0;
  };
  const s0 = sAt(originAz);
  // polygon vertices equally spaced by arc length (one on originAz); each facet is the chord
  // between consecutive vertices, so the facet lengths are equal and the vertices lie on the outline
  const at = (s) => {
    s = ((s % total) + total) % total;
    let ei = 0; while (ei < edges.length - 1 && edges[ei].s0 + edges[ei].len < s) ei++;
    const e = edges[ei], t = (s - e.s0) / e.len;
    return [e.p0[0] + t * (e.p1[0] - e.p0[0]), e.p0[1] + t * (e.p1[1] - e.p0[1])];
  };
  // vertex positions: equally spaced, or, with corners that must be vertices, equally spaced
  // within each stretch between consecutive corners (the origin is a corner when given)
  let positions;
  if (cornersAz.length) {
    const cs = [...new Set(cornersAz.map((a) => ((sAt(a) - s0) % total + total) % total))].sort((a, b) => a - b);
    if (cs[0] > 1e-9) cs.unshift(0);
    positions = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = i + 1 < cs.length ? cs[i + 1] : total, n = Math.max(1, Math.round((count * (b - a)) / total));
      for (let k = 0; k < n; k++) positions.push(s0 + a + ((b - a) * k) / n);
    }
  } else positions = [...Array(count)].map((_, k) => s0 + (k * total) / count);
  const tier = newTier({ name: 'G', angle: 90, distance: 1, indices: [], distances: [] });
  let prev = null;
  for (let k = 0; k < positions.length; k++) {
    const p = at(positions[k]), q = at(positions[(k + 1) % positions.length]);
    const nx = q[1] - p[1], ny = -(q[0] - p[0]), nl = Math.hypot(nx, ny);   // outward normal of a counter-clockwise chord
    const az = norm360(deg(Math.atan2(ny, nx))), dist = (nx * p[0] + ny * p[1]) / nl;
    if (prev && Math.abs(angDiff(az, prev)) < 1e-6) continue;   // collinear chords on a flat: one facet
    prev = az;
    tier.indices.push(indexOf(az, gear)); tier.distances.push(dist);
  }
  const order = tier.indices.map((v, i) => i).sort((a, b) => tier.indices[a] - tier.indices[b]);
  tier.indices = order.map((i) => tier.indices[i]); tier.distances = order.map((i) => tier.distances[i]);
  tier.distance = tier.distances[0];
  return tier;
}

export const indexOf = (az, gear) => Math.round(((((90 - az) % 360) + 360) % 360) * gear / 360 * 1e6) / 1e6;

// ---------------------------------------------------------------- girdle polygon
/** Vertices of a girdle preform tier (consecutive tangent lines intersected), with radial azimuths. */
export function girdleVertices(tier, gear) {
  const f = tier.indices.map((k, i) => ({ az: rad(azimuthDeg(k, gear)), h: tier.distances[i] })).sort((p, q) => p.az - q.az);
  const verts = [];
  for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length];
    const det = Math.sin(b.az - a.az);
    if (Math.abs(det) < 1e-12) continue;
    const x = (a.h * Math.sin(b.az) - b.h * Math.sin(a.az)) / det;
    const y = (b.h * Math.cos(a.az) - a.h * Math.cos(b.az)) / det;
    verts.push({ p: [x, y, 0], az: norm360(deg(Math.atan2(y, x))) });
  }
  return verts;
}
/** The girdle vertex nearest a radial azimuth. */
export const vertexNear = (verts, az) => verts.reduce((best, v) => (angDiff(v.az, az) < angDiff(best.az, az) ? v : best));
/** The girdle vertex on side (+1 right, -1 left) nearest height y. */
export const vertexNearY = (verts, y, side) => verts.filter((v) => Math.sign(v.p[0]) === side || v.p[0] === 0).reduce((b, v) => (Math.abs(v.p[1] - y) < Math.abs(b.p[1] - y) ? v : b));
/** The girdle vertex nearest a point in plan. */
export const vertexNearPoint = (verts, p) => verts.reduce((b, v) => (Math.hypot(v.p[0] - p[0], v.p[1] - p[1]) < Math.hypot(b.p[0] - p[0], b.p[1] - p[1]) ? v : b));
/** Copy of a vertex at height z. */
export const lift = (v, z) => [v.p[0], v.p[1], z];

// ---------------------------------------------------------------- planes
/** Plane at `angle` (GemCad sign convention: 0 table, 90 girdle, negative pavilion) and azimuth az passing through point p. */
export function planeThrough(angle, az, p) {
  const a = rad(Math.abs(angle)), sign = angle >= 0 ? 1 : -1;
  const n = [Math.sin(a) * Math.cos(rad(az)), Math.sin(a) * Math.sin(rad(az)), sign * Math.cos(a)];
  return { n, d: n[0] * p[0] + n[1] * p[1] + n[2] * p[2] };
}
/** Pavilion main at azimuth az through the girdle point p (at z = -g) and the culet [0, 0, zc]. */
export function mainThrough(az, p, zc) {
  const u = [Math.cos(rad(az)), Math.sin(rad(az))];
  const h = u[0] * p[0] + u[1] * p[1];
  const ang = deg(Math.atan2(p[2] - zc, h));
  return planeThrough(-ang, az, p);
}
export const mirrorX = (pl) => ({ n: [-pl.n[0], pl.n[1], pl.n[2]], d: pl.d });   // reflection x -> -x
export const mirrorY = (pl) => ({ n: [pl.n[0], -pl.n[1], pl.n[2]], d: pl.d });   // reflection y -> -y
export const zPlane = (z) => ({ n: [0, 0, 1], d: z });
export const yPlane = (y) => ({ n: [0, 1, 0], d: y });
export const xPlane = (x) => ({ n: [1, 0, 0], d: x });
/** Vertical plane containing the axis line at azimuth az. */
export const azPlane = (az) => ({ n: [-Math.sin(rad(az)), Math.cos(rad(az)), 0], d: 0 });
/** Vertical plane perpendicular to azimuth az at distance r from the axis. */
export const perpPlane = (az, r) => ({ n: [Math.cos(rad(az)), Math.sin(rad(az)), 0], d: r });

// ---------------------------------------------------------------- tiers
/**
 * Tier for one symmetry class: the representative plane's angle, distance and index, expanded by
 * the design's fold and mirror symmetry (fold 2 + mirror for shapes with two mirror lines,
 * fold 1 + mirror for pear and heart, fold 4 + mirror for squares).
 */
export function classTier(name, plane, gear, fold, mirror = true) {
  const t = tierFromPlane(plane.n, plane.d, gear);
  return newTier({ name, angle: t.angle, distance: t.distance, indices: expandIndex(t.index, gear, fold, mirror) });
}

/** Plane with the given azimuth (outward normal direction in plan) through two points p and q; `up` picks the crown (true) or pavilion (false) orientation. */
export function planeAz(p, q, az, up) {
  const h = [-Math.sin(rad(az)), Math.cos(rad(az)), 0];   // horizontal direction along the facet
  return plane3(p, q, [p[0] + h[0], p[1] + h[1], p[2]], up);
}

// ---------------------------------------------------------------- heart (right half)
/**
 * Right half of a heart outline (x >= 0), half-width 1, half-length l, point at -y and cleft at
 * +y: a lobe circle of radius r tangent to x = 1 and y = l, and a lower arc of radius R2 through
 * the point P = (0, -l) internally tangent to the lobe. The cleft is where the lobe circle
 * crosses x = 0 (so r > 1/2). The support function is that of the convex hull of the lobe disk,
 * the lower arc and P; its tangent planes with normals pointing to -x lie outside the half and
 * are harmless once the half is clipped by x = 0. The whole heart is the union of this half and
 * its mirror image, which is not convex: see designPlanes(design, half).
 */
export function heartHalfOutline(l, r, R2) {
  const c = [1 - r, l - r], P = [0, -l];
  // lower circle centre: at distance R2 from P and R2 - r from the lobe centre, on the upper-left
  const dx = c[0] - P[0], dy = c[1] - P[1], dist = Math.hypot(dx, dy);
  const a = (R2 * R2 - (R2 - r) ** 2 + dist * dist) / (2 * dist), hh = Math.sqrt(Math.max(0, R2 * R2 - a * a));
  const c2 = [P[0] + (a * dx - hh * dy) / dist, P[1] + (a * dy + hh * dx) / dist];
  const tdir = [c[0] - c2[0], c[1] - c2[1]], tl = Math.hypot(...tdir);
  const T = [c[0] + r * tdir[0] / tl, c[1] + r * tdir[1] / tl];                 // tangency of the two arcs
  const phiT = Math.atan2(T[1] - c[1], T[0] - c[0]), phiP = Math.atan2(P[1] - c2[1], P[0] - c2[0]);
  const cleft = [0, c[1] + Math.sqrt(Math.max(0, r * r - c[0] * c[0]))];
  const support = (t) => {
    const ct = Math.cos(t), st = Math.sin(t);
    let phi = Math.atan2(st, ct);
    if (phi >= phiP && phi <= phiT) return c2[0] * ct + c2[1] * st + R2;
    return Math.max(c[0] * ct + c[1] * st + r, P[0] * ct + P[1] * st);
  };
  const o = outlineFromSupport(support);
  return { l, r, R2, c, c2, T, cleft, support, point: o.point, normalAz: o.normalAz };
}
/** Support function of the mirror image (x -> -x) of an outline given by its support function. */
export const mirrorSupport = (h) => (t) => h(Math.PI - t);
/** Outward normal azimuth (degrees) of the chord between two outline points p and q (the normal pointing away from the axis). */
export function chordAz(p, q) {
  let n = [-(q[1] - p[1]), q[0] - p[0]];
  if (n[0] * p[0] + n[1] * p[1] < 0) n = [-n[0], -n[1]];
  return norm360(deg(Math.atan2(n[1], n[0])));
}
// ---------------------------------------------------------------- cushion outlines, plan points
/** Support function of a cushion outline: Minkowski sum of a rectangle (half-sides a, b) and a circle of radius r. */
export function cushionSupport(a, b, r) {
  return (t) => a * Math.abs(Math.cos(t)) + b * Math.abs(Math.sin(t)) + r;
}
/** Cushion outline, half-width 1, half-length l, corner radius r: straight sides of half-length 1 - r (x) and l - r (y), quarter circles at the corners. */
export function cushionOutline(r, l = 1) {
  return { ...outlineFromSupport(cushionSupport(1 - r, l - r, r)), r, l };
}
/** Point of a plane at plan position (x, y): "cut to the plot position". */
export const pointOn = (pl, x, y) => intersect3(pl, xPlane(x), yPlane(y));
/** Radial azimuth (degrees) of a plan position. */
export const azOf = ([x, y]) => norm360(deg(Math.atan2(y, x)));

/**
 * Planes for a run of girdle facets (uppers or lowers) between the girdle vertices nearest
 * azimuths azA and azB, all through `apex`: one chord facet through the two vertices (lifted to z)
 * when it digs into the girdle by at most `maxDip`, otherwise the run is split at the vertex that
 * deviates most from the chord and both parts are tried again. The dip is the outline's deviation
 * from the chord times the facet's slope. Returns [{ plane, azA, azB }] in order from azA to azB.
 * verts: girdleVertices(); the run goes the short way round from azA to azB.
 */
export function chordRun(verts, azA, azB, apex, z, up, maxDip) {
  const sorted = verts.slice().sort((p, q) => p.az - q.az);
  const idx = (az) => { const v = vertexNear(sorted, az); return sorted.indexOf(v); };
  const iA = idx(azA), iB = idx(azB), n = sorted.length;
  const fwd = ((iB - iA) % n + n) % n, back = ((iA - iB) % n + n) % n;
  const step = fwd <= back ? 1 : -1, count = Math.min(fwd, back);
  const run = (i0, i1) => {   // i0 -> i1 along `step`
    const a = sorted[i0], b = sorted[i1];
    const pl = plane3(apex, [a.p[0], a.p[1], z], [b.p[0], b.p[1], z], up);
    const slope = Math.hypot(pl.n[0], pl.n[1]) / Math.max(1e-9, Math.abs(pl.n[2]));
    // deviation of the intermediate vertices from the chord a-b (outward, along the chord's outward normal)
    const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], L = Math.hypot(dx, dy) || 1;
    let worst = 0, at = -1;
    for (let k = (i0 + step + n) % n; k !== i1; k = (k + step + n) % n) {
      const v = sorted[k], d = Math.abs(((v.p[0] - a.p[0]) * dy - (v.p[1] - a.p[1]) * dx) / L);
      if (d > worst) { worst = d; at = k; }
    }
    if (at < 0 || worst * slope <= maxDip) return [{ plane: pl, azA: a.az, azB: b.az }];
    return [...run(i0, at), ...run(at, i1)];
  };
  if (count === 0) return [];
  return run(iA, iB);
}
