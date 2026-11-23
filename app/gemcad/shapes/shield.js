// Shield brilliant: a straight top edge with two corners, sides that bow out and meet at a
// point, cut brilliant style. There is no lab plotting template for shields (IGI's fancy-shape
// guidelines do not cover them and GIA assigns no cut grade), so the pattern follows the pear's:
// bezels at the top edge, the sides and the wings, a French tip (default) or a point bezel,
// stars between the bezels, upper girdle facets in pairs meeting at junctions on the girdle, and
// a pavilion of mains meeting at the culet with lower girdle facets in pairs. Built like the
// marquise in ../fancy.js: girdle contacts are polygon vertices (the top edge is one girdle
// facet, the corners and the point are exact vertices), facets touching the girdle have the
// outline normal as azimuth, the rest pass through meet points. One mirror line: fold 1 + mirror.
//
// Orientation: width 2 along x, length along y, top edge at +y, point at -y (radial azimuth 270).
import { newTier } from '../design.js';
import {
  rad, deg, norm360, polygonSupport, girdleVertices, vertexNear, vertexNearY, lift,
  planeThrough, mirrorX, zPlane, yPlane, azPlane, perpPlane, classTier, girdleEqualLength, plane3, intersect3,
} from '../shapebuild.js';

/**
 * Shield outline, half-width 1 at the widest point, length 2 * ratio: top edge at y = ratio from
 * corner to corner, sides circular arcs from the corners to the point (0, -ratio) with their
 * widest point (x = 1) at y = widest * ratio. The corner half-width follows (a little under 1).
 */
export function shieldOutline(ratio, widest = 0.55) {
  const yT = ratio, yW = widest * ratio;
  const R = (1 + (yT + yW) ** 2) / 2, cx = 1 - R, cy = yW;      // right arc: centre (cx, cy), through the point, apex at x = 1
  const a = cx + Math.sqrt(Math.max(0, R * R - (yT - yW) ** 2)); // corner half-width
  const A = [a, yT], P = [0, -yT];
  const phiA = Math.atan2(A[1] - cy, A[0] - cx), phiP = Math.atan2(P[1] - cy, P[0] - cx);
  const pts = [];
  const n = 720;
  for (let i = 0; i <= n; i++) { const ph = phiA + (phiP - phiA) * (i / n); pts.push([cx + R * Math.cos(ph), cy + R * Math.sin(ph)]); }   // right side, corner to point
  // exact mirror image for the left side so the girdle polygon is symmetric to rounding
  const right = pts.slice(0, -1), left = pts.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  const poly = [...right, P, ...left];   // corner -> point -> left corner -> top edge back: clockwise, so reverse
  poly.reverse();
  const support = polygonSupport(poly);
  const point = (az) => {   // ray from the origin at azimuth az to the outline
    const d = [Math.cos(rad(az)), Math.sin(rad(az))];
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length], ex = p1[0] - p0[0], ey = p1[1] - p0[1];
      const den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (p0[0] * ey - p0[1] * ex) / den, u = (p0[0] * d[1] - p0[1] * d[0]) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best[0])) best = [t, [p0[0] + u * ex, p0[1] + u * ey]];
    }
    return best ? best[1] : [0, 0];
  };
  const normalAz = (az) => {
    const [x, y] = point(az);
    if (Math.abs(y - yT) < 1e-6 && Math.abs(x) < a - 1e-6) return 90;                           // top edge
    if (Math.abs(y - yT) < 1e-6) { const na = deg(Math.atan2(y - cy, Math.abs(x) - cx)); return norm360(x > 0 ? (90 + na) / 2 : 180 - (90 + na) / 2); }   // corner: bisector of the top and the arc normals
    if (Math.abs(x) < 1e-9 && y < 0) return 270;                                               // point
    const na = deg(Math.atan2(y - cy, Math.abs(x) - cx));
    return norm360(x > 0 ? na : 180 - na);
  };
  return { ratio, yT, a, R, cx, cy, cornerAz: deg(Math.atan2(yT, a)), support, point, normalAz, poly };
}

/**
 * Shield brilliant starting point. Contacts (radial azimuths, right half): the top edge (90), the
 * side bezel at the widest point (or `sideContact`), the wing bezel at `wingContact`,
 * the point (270); pavilion mains at the top edge, the corner, `pavSideContact` and `lowerContact`.
 */
export function shieldStart({
  ratio = 1.3, widest = 0.55, crownAngle = 35, sideAngle = 35, wingAngle = 33, pointAngle = 25, crownHeight = 0.14, girdle = 0.04, pavilionDepth = 0.43,
  sideContact = null, wingContact = 330, pavSideContact = 20, lowerContact = 300, starHeight = 0.6, culetPos = 0.5, lowerDepth = 0.78,
  tableTop = 0.55, gear = 96, girdleFacets = 128,
  frenchTip = true, tipHubHeight = 0.8, tipTable = 0.28, tipGirdle = 0.12,
} = {}) {
  const W = 2, L = ratio * W, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = shieldOutline(ratio, widest);
  const cornerAz = outline.cornerAz;
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 90, [cornerAz, 180 - cornerAz, 270]);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 1, true)); return plane; };
  const table = zPlane(H);
  const sideAz = sideContact ?? deg(Math.atan2(outline.cy, 1));   // default: the widest point
  const Av = vertexNear(verts, cornerAz), Sv = vertexNear(verts, sideAz), Wv = vertexNear(verts, wingContact), Pv = vertexNear(verts, 270);
  const A = lift(Av, 0), S = lift(Sv, 0), Wg = lift(Wv, 0), P = lift(Pv, 0);
  const yP = P[1];
  const bezel = (angle, v) => planeThrough(angle, outline.normalAz(v.az), lift(v, 0));

  // ---- crown bezels: the top edge, the sides at the widest point, the wings on the lower sides
  // (the sides are too nearly vertical for a separate corner kite: a side bezel at the widest
  // point already runs up under the corner, so the top and side bezels share the corner region,
  // with the top-side star's uppers meeting the top bezel at the corner)
  const top = addClass('A top', planeThrough(crownAngle, 90, [0, outline.yT, 0]));
  const side = addClass('A side', bezel(sideAngle, Sv));
  const wing = addClass('A wing', bezel(wingAngle, Wv));
  const pt = planeThrough(pointAngle, 270, P);
  if (!frenchTip) addClass('A point', pt);
  // table corners: on each bezel's table line, midway between the points where the neighbouring
  // bezel ridges reach the table (so every star has its tip beyond its base)
  const R1 = intersect3(top, side, table), R2 = intersect3(side, wing, table);
  const A4 = frenchTip ? [0, yP + tipTable * L, H] : intersect3(pt, table, azPlane(270));
  const R3 = frenchTip ? A4 : intersect3(wing, pt, table);
  const T1 = intersect3(top, table, xPlane_(tableTop * R1[0]));
  const T2 = intersect3(side, table, yPlane((R1[1] + R2[1]) / 2));
  const T3 = intersect3(wing, table, yPlane((R2[1] + R3[1]) / 2));
  // ---- stars: between neighbouring bezels, tip on their ridge at starHeight of the crown
  const zs = zPlane(starHeight * H);
  const Tts = intersect3(top, side, zs), Tsw = intersect3(side, wing, zs);
  addClass('C top-side', plane3(T1, T2, Tts, true));
  addClass('C side-wing', plane3(T2, T3, Tsw, true));
  // ---- upper girdle facets in pairs meeting at a junction vertex between the contacts; the
  // top-side pair meets the top bezel's girdle edge at the corner
  const J1 = lift(vertexNear(verts, (cornerAz + sideAz) / 2), 0), J2 = lift(vertexNear(verts, (sideAz + wingContact - 360) / 2), 0);
  addClass('B corner', plane3(Tts, A, J1, true));
  addClass('B side a', plane3(Tts, J1, S, true));
  addClass('B side b', plane3(Tsw, S, J2, true));
  addClass('B wing a', plane3(Tsw, J2, Wg, true));
  let hub = null;
  if (!frenchTip) {
    const Twp = intersect3(wing, pt, zs);
    addClass('C wing-point', plane3(T3, A4, Twp, true));
    const J3 = lift(vertexNear(verts, (wingContact + 270) / 2), 0);
    addClass('B wing b', plane3(Twp, Wg, J3, true));
    addClass('B point', plane3(Twp, J3, P, true));
  } else {
    let V = intersect3(wing, mirrorX(wing), zPlane(tipHubHeight * H));
    const yMin = yP + 0.04 * L;
    if (V[1] < yMin) V = intersect3(wing, mirrorX(wing), yPlane(yMin));
    hub = V;
    const G = lift(vertexNearY(verts, yP + tipGirdle * L, 1), 0);
    addClass('C half-bezel', plane3(V, A4, T3, true));
    addClass('B tip', plane3(V, G, Wg, true));
    addClass('tip', plane3(P, V, G, true));
  }

  // ---- pavilion: mains through the culet, tangent at the top edge, the corner, the side and the lower contact
  const cY = outline.yT - culetPos * L;
  const culet = [0, cY, -g - Pd];
  const mainAt = (az, p) => {
    const u = [Math.cos(rad(az)), Math.sin(rad(az))];
    const h = u[0] * p[0] + u[1] * p[1] - u[1] * cY;
    return planeThrough(-deg(Math.atan2(Pd, h)), az, p);
  };
  const Lv = vertexNear(verts, lowerContact), Spv = vertexNear(verts, pavSideContact);
  const Ag = lift(Av, -g), Sg = lift(Spv, -g), Lg = lift(Lv, -g), Pg = lift(Pv, -g);
  const mTop = addClass('P top', mainAt(90, [0, outline.yT, -g]));
  const mCorner = addClass('P corner', mainAt(outline.normalAz(Av.az), Ag));
  const mSide = addClass('P side', mainAt(outline.normalAz(Spv.az), Sg));
  const mLower = addClass('P lower', mainAt(outline.normalAz(Lv.az), Lg));
  // lower girdle facets: junctions on the main ridges at lowerDepth of the pavilion depth
  const jz = zPlane(-g - lowerDepth * Pd);
  const Jcs = intersect3(mCorner, mSide, jz), Jsl = intersect3(mSide, mLower, jz), Kp = intersect3(mLower, mirrorX(mLower), jz);
  const G1 = lift(vertexNear(verts, (cornerAz + pavSideContact) / 2), -g), G2 = lift(vertexNear(verts, (pavSideContact + lowerContact - 360) / 2 + 360), -g);
  addClass('L a', plane3(Jcs, Ag, G1, false));
  addClass('L b', plane3(Jcs, G1, Sg, false));
  addClass('L c', plane3(Jsl, Sg, G2, false));
  addClass('L d', plane3(Jsl, G2, Lg, false));
  addClass('L point', plane3(Kp, Lg, Pg, false));

  const pct = (v) => `${Math.round(v * 100)}%`;
  const hubNote = hub ? `Hub at ${pct((hub[1] - yP) / L)} of the length from the point, ${pct(hub[2] / H)} of the crown height.` : '';
  return {
    name: 'Shield brilliant (starting point)', gear, fold: 1, mirror: true, ri: 2.42,
    headings: ['Shield brilliant starting point', `L:W ${ratio}, crown ${crownAngle}${frenchTip ? ', French tip' : ` (point bezel ${pointAngle})`}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: brilliant pattern on a shield outline with typical angles. No lab plotting template exists for shields.'],
    notes: [
      'Ideal dimensions: none published. GIA assigns no cut grade to shield-cut diamonds and IGI\'s fancy-shape cut guidelines do not cover the shape; trade practice puts shields at L:W 1.2-1.5 with proportions like a pear\'s (crown height 12-16%, pavilion depth 41-46%, girdle 2-6%).',
      `This design: L:W ${ratio}, widest point ${pct(widest)} of the half-length above the centre, corner half-width ${Math.round(outline.a * 100) / 100} of the half-width, crown height ${pct(crownHeight)}, top bezel ${crownAngle}, side bezels ${sideAngle}, wing bezels ${wingAngle}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}, culet ${pct(culetPos)} of the length from the top. Bezel angles are measured in each facet's own slope direction.`,
      `Point: ${frenchTip ? 'French tip (GIA 4Cs marquise wireframe arrangement): no bezel at the point; two tip facets, two small upper girdle facets, the two side bezels and two half-bezels meet at a hub on the axis. ' + hubNote : 'uncorrected, a shallow bezel at the point (' + pointAngle + ') with a star either side.'}`,
      'Pattern: crown: table, a top bezel along the straight edge, 2 side bezels touching at the widest point, 2 wing bezels on the lower sides, point bezel or French tip, 6 stars, 12 upper girdle facets in pairs meeting at junctions (the top-side pair meets the top bezel at the corner); pavilion: a top main along the edge, 2 corner, 2 side and 2 lower mains meeting at the culet, 10 lower girdle facets with junctions on the main ridges.',
      'Outline: straight top edge, sides circular arcs from the corners to the point with the widest point part way down, the corners a little narrower than the widest point. Facets touch the girdle at polygon vertices (top edge: one girdle facet) with the outline normal as azimuth.',
    ],
    tiers,
  };
}
const xPlane_ = (x) => ({ n: [1, 0, 0], d: x });

const params = [
  { key: 'ratio', label: 'L:W', default: 1.3, step: 0.01, min: 1 },
  { key: 'widest', label: 'Widest point', default: 0.55, step: 0.05, min: 0.1, max: 0.95, title: 'Height of the widest point, fraction of the half-length above the centre (1 = at the corners)' },
  { key: 'tableTop', label: 'Table top', default: 0.55, step: 0.05, min: 0.2, max: 0.9, title: 'Table top corner, fraction of the distance from the axis to where the top/corner ridge reaches the table' },
  { key: 'crownAngle', label: 'Top bezel', default: 35, step: 0.5 }, { key: 'sideAngle', label: 'Side bezels', default: 35, step: 0.5 }, { key: 'wingAngle', label: 'Wing bezels', default: 33, step: 0.5 },
  { key: 'crownHeight', label: 'Crown height', default: 0.14, step: 0.005 }, { key: 'girdle', label: 'Girdle', default: 0.04, step: 0.005 }, { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.43, step: 0.005 },
  { key: 'wingContact', label: 'Wing contact', default: 330, step: 1, title: 'Radial azimuth of the wing bezel contact on the lower side (270 = the point, 360 = the side)' },
  { key: 'pavSideContact', label: 'Side main', default: 20, step: 1, title: 'Radial azimuth of the pavilion side main contact' },
  { key: 'lowerContact', label: 'Lower contact', default: 300, step: 1, title: 'Radial azimuth of the lower main contact' },
  { key: 'starHeight', label: 'Star tips', default: 0.6, step: 0.05, min: 0.2, max: 0.95 },
  { key: 'culetPos', label: 'Culet', default: 0.5, step: 0.01, title: 'Fraction of the length from the top' },
];
const french = [
  { key: 'tipHubHeight', label: 'Hub height', default: 0.8, step: 0.01, min: 0.5, max: 0.98 },
  { key: 'tipTable', label: 'Tip table corner', default: 0.28, step: 0.01, title: 'Table apex distance from the point, fraction of the length' },
  { key: 'tipGirdle', label: 'Tip girdle point', default: 0.12, step: 0.01, title: 'Tip facet girdle point from the point, fraction of the length' },
];
export const templates = {
  shield: { name: 'Shield brilliant, French tip (starting point)', note: 'Brilliant pattern on a shield outline (no lab template exists); French tip at the point.', params: [...params, ...french], make: (o = {}) => shieldStart({ ...o }) },
  shieldStd: { name: 'Shield brilliant, uncorrected point (starting point)', note: 'Brilliant pattern on a shield outline with a shallow bezel at the point.', params: [...params, { key: 'pointAngle', label: 'Point bezel', default: 25, step: 0.5 }], make: (o = {}) => shieldStart({ frenchTip: false, ...o }) },
};
export const plots = [];
