// Building blocks for fancy-shape generators (GemCad style): outlines with support function,
// point and outward normal by radial azimuth; girdle polygon vertices; planes through points or
// tangent to the girdle; symmetry-class tiers.
//
// Conventions: half-width 1 (width 2), length along y, table at z = +H, girdle top at z = 0,
// girdle bottom at z = -g, culet below. Radial azimuth: degrees counter-clockwise from +x, so
// the top point of a marquise or pear is at 90. A facet's azimuth is the direction of its
// outward normal; for a facet touching the girdle that is the outline normal at the contact.
import { newTier, tierFromPlane, expandIndex, azimuthDeg } from './design.js';
import { girdleFromSupport, plane3, intersect3 } from './generators.js';

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
    const az = deg(Math.atan2(x1 - x0, -(y1 - y0)));   // outward normal of the edge
    tier.indices.push(indexOf(az, gear)); tier.distances.push(h(rad(az)));
  }
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
