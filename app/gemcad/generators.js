// Design generators: standard designs expressed as tiers from published proportion parameters.
import { newTier, tierFromPlane, expandIndex, azimuthDeg } from './design.js?v=75';

const rad = (d) => (d * Math.PI) / 180;
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Plane through three points with the normal's z sign fixed. */
export function plane3(a, b, c, up) {
  let n = unit(cross(sub(b, a), sub(c, a)));
  if ((n[2] > 0) !== up) n = n.map((v) => -v);
  return { n, d: dot(n, a) };
}

/** Plane with given azimuth through two points lying on that azimuth line. */
function planeAz(p, q, azDeg, up) {
  const u = [Math.cos(rad(azDeg)), Math.sin(rad(azDeg)), 0];
  const h = [-u[1], u[0], 0];
  return plane3(p, q, [p[0] + h[0], p[1] + h[1], p[2]], up);
}

export function intersect3(p1, p2, p3) {
  // solve n_i . x = d_i
  const [a, b, c] = [p1.n, p2.n, p3.n];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const x = (p1.d * (b[1] * c[2] - b[2] * c[1]) - a[1] * (p2.d * c[2] - b[2] * p3.d) + a[2] * (p2.d * c[1] - b[1] * p3.d)) / det;
  const y = (a[0] * (p2.d * c[2] - b[2] * p3.d) - p1.d * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * p3.d - p2.d * c[0])) / det;
  const z = (a[0] * (b[1] * p3.d - p2.d * c[1]) - a[1] * (b[0] * p3.d - p2.d * c[0]) + p1.d * (b[0] * c[1] - b[1] * c[0])) / det;
  return [x, y, z];
}

/**
 * Round brilliant from GIA's proportion parameters (Diamond Cut Grading System):
 * table size, crown angle, pavilion angle, star length, lower-girdle length, girdle thickness.
 * Width is 2 (radius 1). Bezels at 22.5 + 45k degrees as on lab plots.
 */
export function roundBrilliant({ table = 0.56, crownAngle = 34.5, pavilionAngle = 40.8, starLength = 0.50, lowerLength = 0.78, girdle = 0.035, gear = 96, girdleFacets = 128 } = {}) {
  const R = 1, W = 2;
  const H = (R - table * R) * Math.tan(rad(crownAngle));
  const g = girdle * W;
  const zb = -g;
  const P = R * Math.tan(rad(pavilionAngle));
  const bezAz = [...Array(8)].map((_, k) => 22.5 + 45 * k);
  const starAz = [...Array(8)].map((_, k) => 45 * (k + 1));   // star k lies between bezel k and bezel k+1
  const tiers = [];
  // girdle: regular polygon of girdleFacets facets, apothem R
  const gi = [...Array(girdleFacets)].map((_, k) => (k * gear) / girdleFacets + gear / girdleFacets / 2);
  tiers.push(newTier({ name: 'G', angle: 90, distance: R, indices: gi.map((k) => Math.round(k * 1e6) / 1e6) }));
  tiers.push(newTier({ name: 'T', angle: 0, distance: H, indices: [] }));
  // bezels: plane through the girdle point at angle crownAngle -> distance R sin(a)
  const bez = bezAz.map((az) => ({ n: [Math.sin(rad(crownAngle)) * Math.cos(rad(az)), Math.sin(rad(crownAngle)) * Math.sin(rad(az)), Math.cos(rad(crownAngle))], d: R * Math.sin(rad(crownAngle)) }));
  tiers.push(newTier({ name: 'A', angle: crownAngle, distance: R * Math.sin(rad(crownAngle)), indices: norm(bezAz.map((az) => ((90 - az) * gear) / 360), gear) }));
  // table corners: contour of each bezel at z = H, along its azimuth
  const inset = H / Math.tan(rad(crownAngle));
  const T = bezAz.map((az) => [(R - inset) * Math.cos(rad(az)), (R - inset) * Math.sin(rad(az)), H]);
  // star tips: on the ridge between bezels i and i+1 at starLength of the way from the table edge to the girdle
  const tableRing = { n: [0, 0, 1], d: H };
  const tips = starAz.map((az, i) => {
    const j = (i + 1) % 8;
    const G = [R * Math.cos(rad(az)), R * Math.sin(rad(az)), 0];
    // vertical plane through the azimuth line to pick the point on the ridge
    const M = [(T[i][0] + T[j][0]) / 2, (T[i][1] + T[j][1]) / 2, H];
    const target = [M[0] + (G[0] - M[0]) * starLength, M[1] + (G[1] - M[1]) * starLength, 0];
    const vert = { n: [-Math.sin(rad(az)), Math.cos(rad(az)), 0], d: 0 }; // plane containing the azimuth line
    // the ridge point at the target's radial position: intersect bezel i, bezel j and the vertical plane through the target perpendicular to the azimuth
    const perp = { n: [Math.cos(rad(az)), Math.sin(rad(az)), 0], d: Math.hypot(target[0], target[1]) };
    return intersect3(bez[i], bez[j], perp);
  });
  // stars: plane through T_i, T_{i+1} and the tip
  const starPl = plane3(T[0], T[1], tips[0], true);
  tiers.push(newTier({ name: 'C', angle: tierFromPlane(starPl.n, starPl.d, gear).angle, distance: starPl.d, indices: norm(starAz.map((az) => ((90 - az) * gear) / 360), gear) }));
  // upper girdle facets: through the tip and the two girdle points on either side
  const G0 = [R * Math.cos(rad(bezAz[0])), R * Math.sin(rad(bezAz[0])), 0];
  const Gs = [R * Math.cos(rad(starAz[0])), R * Math.sin(rad(starAz[0])), 0];
  const upPl = plane3(tips[0], G0, Gs, true);
  const upT = tierFromPlane(upPl.n, upPl.d, gear);
  tiers.push(newTier({ name: 'B', angle: upT.angle, distance: upT.distance, indices: expandIndex(upT.index, gear, 8, true) }));
  // pavilion mains through the culet and the girdle points at the bezel azimuths
  const culet = [0, 0, zb - P];
  const mainPl = planeAz([R * Math.cos(rad(bezAz[0])), R * Math.sin(rad(bezAz[0])), zb], culet, bezAz[0], false);
  const mT = tierFromPlane(mainPl.n, mainPl.d, gear);
  tiers.push(newTier({ name: 'P', angle: mT.angle, distance: mT.distance, indices: norm(bezAz.map((az) => ((90 - az) * gear) / 360), gear) }));
  // lower girdle facets: junction on the ridge between mains at lowerLength from the girdle towards the culet
  const mains = bezAz.map((az) => planeAz([R * Math.cos(rad(az)), R * Math.sin(rad(az)), zb], culet, az, false));
  const Gj = [R * Math.cos(rad(starAz[0])), R * Math.sin(rad(starAz[0])), zb];
  const perp = { n: [Math.cos(rad(starAz[0])), Math.sin(rad(starAz[0])), 0], d: R * (1 - lowerLength) };
  const J = intersect3(mains[0], mains[1], perp);
  const lowPl = plane3(J, [R * Math.cos(rad(bezAz[0])), R * Math.sin(rad(bezAz[0])), zb], Gj, false);
  const lT = tierFromPlane(lowPl.n, lowPl.d, gear);
  tiers.push(newTier({ name: 'L', angle: lT.angle, distance: lT.distance, indices: expandIndex(lT.index, gear, 8, true) }));
  return {
    name: 'Round brilliant (GIA proportions)', gear, fold: 8, mirror: true, ri: 2.42,
    headings: ['Round brilliant', `GIA Excellent mid-range: table ${Math.round(table * 100)}%, crown ${crownAngle}, pavilion ${pavilionAngle}, star ${Math.round(starLength * 100)}%, lower girdle ${Math.round(lowerLength * 100)}%, girdle ${Math.round(girdle * 100)}%`],
    footnotes: ['Generated from GIA Diamond Cut Grading System proportion definitions.'],
    notes: [
      'GIA Excellent cut grade (round brilliant), typical ranges: table 54-57%, crown angle 34-35, pavilion angle 40.6-41, star length 50%, lower girdle length 75-80%, girdle thin to slightly thick, total depth 59-62.5%.',
      'Tolkowsky (1919) ideal: table 53%, crown angle 34.5, pavilion angle 40.75, crown height 16.2%, pavilion depth 43.1%.',
      'Lab plotting template: 8 bezels at 22.5 + 45k degrees, 8 stars, 16 upper and 16 lower girdle facets, 8 pavilion mains.',
    ],
    tiers,
    params: { table, crownAngle, pavilionAngle, starLength, lowerLength, girdle },
  };
}

function norm(idx, gear) {
  const set = new Set(idx.map((k) => Math.round((((k % gear) + gear) % gear) * 1e6) / 1e6));
  return [...set].sort((a, b) => a - b);
}

/**
 * Girdle preform tier for an outline given as a support function h(azimuth) (distance from the
 * axis to the tangent line), sampled at `count` indices. E.g. an ellipse with semi-axes a (x) and
 * b (y): h(t) = sqrt(a^2 cos^2 t + b^2 sin^2 t).
 */
export function girdleFromSupport(h, count, gear, offset = 0) {
  const indices = [], distances = [];
  for (let k = 0; k < count; k++) {
    const idx = Math.round((((k + offset) * gear) / count) * 1e6) / 1e6;
    const az = rad(azimuthDeg(idx, gear));
    indices.push(idx); distances.push(h(az));
  }
  return newTier({ name: 'G', angle: 90, distance: distances[0], indices, distances });
}

export function ellipseSupport(a, b) {
  return (t) => Math.sqrt(a * a * Math.cos(t) ** 2 + b * b * Math.sin(t) ** 2);
}
