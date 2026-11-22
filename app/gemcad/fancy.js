// Fancy-shape starting designs. They reproduce the facet pattern of the lab plotting template
// (vertex positions measured on the IGI plots) with angles from the published proportion ranges,
// built the GemCad way: every facet is a plane that touches the girdle outline at a chosen point
// (so its azimuth is the outline's normal there, not the radial direction) or passes through
// three meet points. Each symmetry class is one tier expanded by the design's 2-fold mirror symmetry.
import { newTier, tierFromPlane, expandIndex, azimuthDeg } from './design.js';
import { girdleFromSupport, plane3, intersect3 } from './generators.js';

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

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
const vertexNear = (verts, az) => verts.reduce((best, v) => (angDiff(v.az, az) < angDiff(best.az, az) ? v : best));
const vertexNearY = (verts, y, side) => verts.filter((v) => Math.sign(v.p[0]) === side || v.p[0] === 0).reduce((b, v) => (Math.abs(v.p[1] - y) < Math.abs(b.p[1] - y) ? v : b));

/** Plane at `angle` (GemCad sign convention) and azimuth az passing through point p. */
function planeThrough(angle, az, p) {
  const a = rad(Math.abs(angle)), sign = angle >= 0 ? 1 : -1;
  const n = [Math.sin(a) * Math.cos(rad(az)), Math.sin(a) * Math.sin(rad(az)), sign * Math.cos(a)];
  return { n, d: n[0] * p[0] + n[1] * p[1] + n[2] * p[2] };
}
const mirrorX = (pl) => ({ n: [-pl.n[0], pl.n[1], pl.n[2]], d: pl.d });   // reflection x -> -x
const mirrorY = (pl) => ({ n: [pl.n[0], -pl.n[1], pl.n[2]], d: pl.d });   // reflection y -> -y
const zPlane = (z) => ({ n: [0, 0, 1], d: z });
const yPlane = (y) => ({ n: [0, 1, 0], d: y });
const xPlane = (x) => ({ n: [1, 0, 0], d: x });
/** Vertical plane containing the axis line at azimuth az. */
const azPlane = (az) => ({ n: [-Math.sin(rad(az)), Math.cos(rad(az)), 0], d: 0 });
/** Vertical plane perpendicular to azimuth az at distance r from the axis. */
const perpPlane = (az, r) => ({ n: [Math.cos(rad(az)), Math.sin(rad(az)), 0], d: r });

/**
 * Marquise brilliant starting point, pattern of the IGI plotting template:
 * crown: table, 8 bezels (2 points, 4 wings, 2 sides), 8 stars, 16 upper girdle facets;
 * pavilion: 8 mains meeting at the culet, 16 lower girdle facets.
 * French tips (default) replace each point bezel by the GIA arrangement: a hub vertex on the axis
 * where eight facets meet (two tip facets at the point, two small upper girdle facets, the two
 * wing bezels and two half-bezels reaching the table corner).
 */
export function marquiseStart({
  ratio = 2.0, crownAngle = 35, wingAngle = crownAngle, pointAngle = 21.5, crownHeight = 0.14, girdle = 0.035, pavilionDepth = 0.435,
  starHeight = 0.65, lowerDepth = 0, gear = 96, girdleFacets = 128,
  frenchTips = true, tipHubHeight = 0.75, tipTable = 0.30, tipGirdle = 0.16,
} = {}) {
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = marquiseOutline(l);
  const girdleTier = girdleFromSupport(outline.support, girdleFacets, gear, 0.5);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => {
    const t = tierFromPlane(plane.n, plane.d, gear);
    tiers.push(newTier({ name, angle: t.angle, distance: t.distance, indices: expandIndex(t.index, gear, 2, true) }));
    return plane;
  };
  const lift = (v, z) => [v.p[0], v.p[1], z];
  // Girdle contacts, top-right quadrant (radial azimuths measured on the IGI plots)
  const Pv = vertexNear(verts, 90), Sv = vertexNear(verts, 0), Uv = vertexNear(verts, 59.3);
  const P = lift(Pv, 0), Sd = lift(Sv, 0), U = lift(Uv, 0);
  const table = zPlane(H);

  // ---- crown bezels: tangent to the girdle at the contact, azimuth = outline normal there
  const side = addClass('A side', planeThrough(crownAngle, 0, Sd));
  const wing = addClass('A wing', planeThrough(wingAngle, outline.normalAz(Uv.az), U));
  const pt = planeThrough(pointAngle, 90, P);
  if (!frenchTips) addClass('A point', pt);
  // table corners: on the bezel's table line at the plot's radial azimuth
  const M = intersect3(side, table, azPlane(0));
  const S = intersect3(wing, table, azPlane(72.2));
  const T = frenchTips ? [0, (1 - tipTable) * l, H] : intersect3(pt, table, azPlane(90));
  // ---- stars: through the two table corners and a tip on the bezel ridge at starHeight of the
  // crown height (0.65 puts the tips where the IGI plot has them: side kites 0.74 of the half-width wide)
  const Wws = intersect3(wing, side, zPlane(starHeight * H));
  addClass('C wing-side', plane3(S, M, Wws, true));
  const Jws = lift(vertexNear(verts, 33.7), 0);
  addClass('B wing', plane3(Wws, U, Jws, true));
  addClass('B side', plane3(Wws, Jws, Sd, true));
  let hub = null;
  if (!frenchTips) {
    const Wpw = intersect3(pt, wing, zPlane(starHeight * H));
    addClass('C point-wing', plane3(T, S, Wpw, true));
    const Jpw = lift(vertexNear(verts, 76.7), 0);
    addClass('B point', plane3(Wpw, P, Jpw, true));
    addClass('B wing-point', plane3(Wpw, Jpw, U, true));
  } else {
    // hub on the ridge of the two wing bezels at tipHubHeight of the crown (kept inside the outline)
    let V = intersect3(wing, mirrorX(wing), zPlane(tipHubHeight * H));
    if (V[1] > 0.97 * l) V = intersect3(wing, mirrorX(wing), yPlane(0.97 * l));
    hub = V;
    const G = lift(vertexNearY(verts, (1 - tipGirdle) * l, 1), 0);
    addClass('C half-bezel', plane3(V, T, S, true));
    addClass('B tip', plane3(V, G, U, true));
    addClass('tip', plane3(P, V, G, true));
  }

  // ---- pavilion: mains tangent to the girdle at the plot contacts, through the culet
  const culet = [0, 0, -g - Pd];
  const Av = vertexNear(verts, 76), Cv = vertexNear(verts, 32.6), Bv = vertexNear(verts, 56.2);
  const A = lift(Av, -g), C = lift(Cv, -g), B = lift(Bv, -g), Pg = lift(Pv, -g), Sg = lift(Sv, -g);
  const mainThrough = (v, p) => {
    const az = outline.normalAz(v.az), u = [Math.cos(rad(az)), Math.sin(rad(az))];
    const h = u[0] * p[0] + u[1] * p[1];
    const ang = deg(Math.atan2(Pd, h));
    return planeThrough(-ang, az, p);
  };
  const mA = addClass('P point', mainThrough(Av, A));
  const mC = addClass('P side', mainThrough(Cv, C));
  // lower girdle facets: junctions on the ridges between mains, at the plot's plan positions
  // (axis: 17% of the half-length from the culet; diagonal: 0.31 of the half-width at 54 degrees;
  // side: 0.305 of the half-width), or at lowerDepth of the pavilion depth when given
  const jz = lowerDepth ? zPlane(-g - lowerDepth * Pd) : null;
  const K = intersect3(mA, mirrorX(mA), jz || yPlane(0.171 * l));
  const J = intersect3(mA, mC, jz || perpPlane(54, 0.311));
  const K2 = intersect3(mC, mirrorY(mC), jz || xPlane(0.305));
  addClass('L point', plane3(K, Pg, A, false));
  addClass('L a', plane3(J, A, B, false));
  addClass('L b', plane3(J, B, C, false));
  addClass('L side', plane3(K2, C, Sg, false));

  const pct = (v) => `${Math.round(v * 100)}%`;
  const hubNote = hub ? `Hub at ${pct(1 - hub[1] / l)} of the half-length from the point, ${pct(hub[2] / H)} of the crown height.` : '';
  return {
    name: 'Marquise brilliant (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Marquise brilliant starting point', `L:W ${ratio}, crown ${crownAngle}${frenchTips ? ', French tips' : ` (point bezels ${pointAngle})`}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: lab plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to marquise diamonds.',
      'IGI Excellent ranges (marquise brilliant): L:W 1.80-2.20, table 57-62%, crown height 11.5-16.5%, crown angle 33-38.5, pavilion depth 41.5-46%, pavilion angle 39.5-42.5, girdle thin to slightly thick.',
      `This design: L:W ${ratio}, crown height ${pct(crownHeight)}, wing and side bezels ${crownAngle}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}. Bezel angles are measured in each facet's own slope direction; they vary around a fancy outline at a constant crown height.`,
      `Points: ${frenchTips ? 'French tips (GIA 4Cs wireframe). No bezel at the point. Eight facets meet at a hub on the axis: two tip facets forming the point, two small upper girdle facets, the two wing bezels and two half-bezels that run to the table corner. ' + hubNote : 'uncorrected, a shallow bezel at each point (' + pointAngle + ') with a star either side.'}`,
      'Plot pattern (IGI template): crown 8 bezels (2 points, 4 wings, 2 sides), 8 stars, 16 upper girdle facets; pavilion 8 mains meeting at the culet (contacts about 21% and 65% of the half-length from the point), 16 lower girdle facets with junctions on the axis, the diagonals and the sides.',
      'Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point.',
    ],
    tiers,
  };
}
