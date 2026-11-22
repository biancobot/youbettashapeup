// Fancy-shape starting designs. These reproduce the facet pattern of the lab plotting template
// with angles from the published proportion ranges; the free meet points are set by simple
// rules and are meant to be adjusted against the plot underlay. They are labelled as such.
import { newTier, azimuthDeg } from './design.js';
import { girdleFromSupport } from './generators.js';

const rad = (d) => (d * Math.PI) / 180;
const idx = (az, gear) => Math.round(((((90 - az) % 360) + 360) % 360) * gear / 360 * 1e6) / 1e6;

/** Support function of a marquise outline (two circular arcs), half-width 1, half-length l. */
export function marquiseSupport(w, l) {
  const R = (l * l + w * w) / (2 * w), c = R - w, sinMax = l / R;
  return (t) => {
    const ct = Math.abs(Math.cos(t)), st = Math.abs(Math.sin(t));
    return st <= sinMax ? R - c * ct : l * st;
  };
}

/** Facet plane (unit normal, distance) for angle (GemCad sign convention), azimuth and distance. */
function planeOf(angle, az, dist) {
  const a = rad(Math.abs(angle)), sign = angle >= 0 ? 1 : -1;
  return { n: [Math.sin(a) * Math.cos(rad(az)), Math.sin(a) * Math.sin(rad(az)), sign * Math.cos(a)], d: dist };
}
/** Point on the ridge of planes p, q at radial distance r along azimuth az (intersection with the vertical plane perpendicular to az). */
function ridgeAt(p, q, az, r) {
  const v = { n: [Math.cos(rad(az)), Math.sin(rad(az)), 0], d: r };
  const [a, b, c] = [p.n, q.n, v.n];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const x = (p.d * (b[1] * c[2] - b[2] * c[1]) - a[1] * (q.d * c[2] - b[2] * v.d) + a[2] * (q.d * c[1] - b[1] * v.d)) / det;
  const y = (a[0] * (q.d * c[2] - b[2] * v.d) - p.d * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * v.d - q.d * c[0])) / det;
  const z = (a[0] * (b[1] * v.d - q.d * c[1]) - a[1] * (b[0] * v.d - q.d * c[0]) + p.d * (b[0] * c[1] - b[1] * c[0])) / det;
  return [x, y, z];
}
const through = (angle, az, pt) => { const { n } = planeOf(angle, az, 0); return n[0] * pt[0] + n[1] * pt[1] + n[2] * pt[2]; };
const norm360 = (a) => ((a % 360) + 360) % 360;

/** Plane through the girdle tangent line at azimuth az (support h) rising at `angle`: distance h sin(angle). */
const crownDist = (h, angle) => h * Math.sin(rad(angle));
/** Pavilion plane through the culet (depth P below the girdle base at z = -g) and the girdle tangent line at support h. */
function pavilion(h, P, g) { const ang = Math.atan2(P, h); return { angle: -(ang * 180) / Math.PI, distance: h * Math.sin(ang) + g * Math.cos(ang) }; }

/**
 * Marquise brilliant starting point. Pattern (IGI plot): bezels at the two points, the two sides
 * and four wings; stars between; 16 upper girdle facets; 8 pavilion mains between the crown
 * bezels with junction lines at the points, sides and diagonals; 16 lower girdle facets.
 * Point bezels are cut shallower than the wing and side bezels, as on real stones.
 */
export function marquiseStart({ ratio = 1.97, crownAngle = 35, pointAngle = 25, crownHeight = 0.14, girdle = 0.035, pavilionDepth = 0.435, gear = 96, girdleFacets = 64, frenchTips = true } = {}) {
  const W = 2, l = ratio, h = marquiseSupport(1, l);
  const H = crownHeight * W, g = girdle * W, P = pavilionDepth * W;
  const tiers = [girdleFromSupport(h, girdleFacets, gear)];
  tiers.push(newTier({ name: 'T', angle: 0, distance: H, indices: [] }));
  // bezel azimuths read off the IGI plot (polar, head at 90): points, wings, sides
  const points = [90, 270], wings = [121.6, 239.7, 300.3, 418.4 - 360], sides = [180, 0];
  const mk = (name, angle, azs) => {
    const t = newTier({ name, angle, distance: 0, indices: [], distances: [] });
    for (const az of azs) { t.indices.push(idx(az, gear)); t.distances.push(crownDist(h(rad(az)), angle)); }
    return t;
  };
  // French tips (default): no bezel at the points; the point is formed by a star facet whose
  // tip is the point itself, flanked by the two upper girdle facets meeting there.
  // Uncorrected points: a shallow bezel at each point, with stars either side of it.
  const bezelTiers = [];
  if (!frenchTips) bezelTiers.push([mk('A pt', pointAngle, points), points]);
  bezelTiers.push([mk('A wing', crownAngle, wings), wings], [mk('A side', crownAngle, sides), sides]);
  for (const [t] of bezelTiers) tiers.push(t);
  // bezel planes in azimuth order for meet-point computations
  const bezList = [];
  for (const [t, azs] of bezelTiers) azs.forEach((az, i) => bezList.push({ az: norm360(az), plane: planeOf(t.angle, az, t.distances[i]) }));
  bezList.sort((p, q) => p.az - q.az);
  const starAz = (frenchTips ? [90, 148.5, 213.4, 270, 328.5, 33.4] : [103.3, 148.5, 213.4, 256.7, 283.3, 328.5, 33.4, 76.7]).map(norm360);
  const pointAz = new Set(frenchTips ? [90, 270] : []);
  const between = (az) => {  // the two bezels on either side of azimuth az
    const n = bezList.length;
    for (let i = 0; i < n; i++) {
      const a0 = bezList[i].az, a1 = bezList[(i + 1) % n].az + (i === n - 1 ? 360 : 0);
      const x = az < a0 ? az + 360 : az;
      if (x >= a0 && x <= a1) return [bezList[i].plane, bezList[(i + 1) % n].plane];
    }
    return [bezList[0].plane, bezList[1].plane];
  };
  // star tips: on the ridge between neighbouring bezels, half way from the table edge to the girdle
  const starAngle = crownAngle - 12;
  const star = newTier({ name: 'C', angle: starAngle, distance: 0, indices: [], distances: [] });
  const tips = [];
  for (const az of starAz) {
    const hs = h(rad(az));
    let tip;
    if (pointAz.has(az)) {
      tip = [hs * Math.cos(rad(az)), hs * Math.sin(rad(az)), 0];      // French tip: the star's tip is the point itself, on the girdle
    } else {
      const [p, q] = between(az);
      const top = ridgeAt(p, q, az, 0);                      // ridge line: find where it reaches z = H
      const gp = ridgeAt(p, q, az, hs);
      // z along the ridge is linear in r: solve r where z = H
      const rTable = top[2] === gp[2] ? hs * 0.5 : (H - gp[2]) * (0 - hs) / (top[2] - gp[2]) + hs;
      const r = rTable + 0.5 * (hs - rTable);
      tip = ridgeAt(p, q, az, r);
    }
    tips.push(tip);
    star.indices.push(idx(az, gear)); star.distances.push(through(starAngle, az, tip));
  }
  tiers.push(star);
  // upper girdle facets: through each star tip and the girdle at the half azimuths on either side
  const bezAz = bezList.map((b) => b.az);
  const upAngle = crownAngle + 7;
  const up = newTier({ name: 'B', angle: upAngle, distance: 0, indices: [], distances: [] });
  starAz.forEach((saz, k) => {
    const left = bezAz.filter((a) => norm360(a - saz) > 180).sort((x, y) => norm360(saz - x) - norm360(saz - y))[0];
    const right = bezAz.filter((a) => norm360(a - saz) <= 180 && a !== saz).sort((x, y) => norm360(x - saz) - norm360(y - saz))[0];
    for (const naz of [norm360(saz + (norm360(left - saz) - 360) / 2), norm360(saz + norm360(right - saz) / 2)]) {
      up.indices.push(idx(naz, gear)); up.distances.push(through(upAngle, naz, tips[k]));
    }
  });
  tiers.push(up);
  // pavilion mains between the crown bezels (plot azimuths), through the culet and the girdle
  const mainAz = [125.5, 160.5, 199.5, 234.5, 305.5, 340.5, 19.5, 54.5].map(norm360);
  const main = newTier({ name: 'P', angle: 0, distance: 0, indices: [], distances: [] });
  const mainPlanes = [];
  let mainAngle = 0;
  for (const az of mainAz) { const pv = pavilion(h(rad(az)), P, g); mainAngle = pv.angle; main.indices.push(idx(az, gear)); main.distances.push(pv.distance); mainPlanes.push({ az, plane: planeOf(pv.angle, az, pv.distance) }); }
  main.angle = mainAngle;
  tiers.push(main);
  // lower girdle facets: junction on the ridge between neighbouring mains at 78% of the way from the girdle to the culet
  const juncAz = [143.8, 180, 216.2, 270, 323.8, 0, 36.2, 90].map(norm360);
  const lowAngle = mainAngle - 1.5;
  const low = newTier({ name: 'L', angle: lowAngle, distance: 0, indices: [], distances: [] });
  const sortedMains = mainPlanes.slice().sort((p, q) => p.az - q.az);
  const mainsAround = (az) => {
    const n = sortedMains.length;
    for (let i = 0; i < n; i++) {
      const a0 = sortedMains[i].az, a1 = sortedMains[(i + 1) % n].az + (i === n - 1 ? 360 : 0);
      const x = az < a0 ? az + 360 : az;
      if (x >= a0 && x <= a1) return [sortedMains[i], sortedMains[(i + 1) % n]];
    }
    return [sortedMains[0], sortedMains[1]];
  };
  for (const jaz of juncAz) {
    const [m0, m1] = mainsAround(jaz);
    const hs = h(rad(jaz));
    const J = ridgeAt(m0.plane, m1.plane, jaz, hs * (1 - 0.78));
    for (const naz of [norm360(jaz + (norm360(m0.az - jaz) - 360) / 2), norm360(jaz + norm360(m1.az - jaz) / 2)]) {
      low.indices.push(idx(naz, gear)); low.distances.push(through(lowAngle, naz, J));
    }
  }
  tiers.push(low);
  return {
    name: 'Marquise brilliant (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Marquise brilliant starting point', `L:W ${ratio}, crown ${crownAngle}${frenchTips ? ', French tips' : ` (point bezels ${pointAngle})`}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: lab plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to marquise diamonds.',
      'IGI Excellent ranges (marquise brilliant): L:W 1.80-2.20, table 57-62%, crown height 11.5-16.5%, crown angle 33-38.5, pavilion depth 41.5-46%, pavilion angle 39.5-42.5, girdle thin to slightly thick.',
      'Points: French tips by default. No bezel facet at the point; the point is formed by a star facet with its tip on the point and the two upper girdle facets meeting there, and on the pavilion by the lower girdle facets meeting at the point. The alternative (uncorrected point) has a shallow bezel at each point.',
      'Trade practice: bow-tie visibility depends on the pavilion angles along the length; wing and side bezels at a common crown angle.',
      'Plot pattern (IGI template): 8 bezels (2 points, 4 wings, 2 sides), 8 stars, 16 upper girdle facets, 8 pavilion mains between the bezels, 16 lower girdle facets.',
    ],
    tiers,
  };
}
