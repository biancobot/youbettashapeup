// Shield brilliant: a pear-like outline whose head is a large-radius arc blending through rounded
// shoulders into sides that meet at a point, cut brilliant style. There is no lab plotting template for shields (IGI's fancy-shape
// guidelines do not cover them and GIA assigns no cut grade), so the pattern follows the pear's:
// bezels at the head, the shoulders, the bellies and the wings, a French tip (default) or a point bezel,
// stars between the bezels, upper girdle facets in pairs meeting at junctions on the girdle, and
// a pavilion of mains meeting at the culet with lower girdle facets in pairs. Built like the
// marquise in ../fancy.js: girdle contacts are polygon vertices (the point is an exact vertex),
// facets touching the girdle have the
// outline normal as azimuth, the rest pass through meet points. One mirror line: fold 1 + mirror.
//
// Orientation: width 2 along x, length along y, top edge at +y, point at -y (radial azimuth 270).
import { newTier } from '../design.js?v=58';
import {
  rad, deg, norm360, polygonSupport, girdleVertices, vertexNear, vertexNearY, lift,
  planeThrough, mirrorX, zPlane, yPlane, azPlane, perpPlane, classTier, girdleEqualLength, plane3, intersect3, chordRun } from '../shapebuild.js?v=58';

/**
 * Shield outline, half-width 1 at the widest point, length 2 * ratio: a head arc of large radius
 * `headRadius` at the top, blending through shoulder arcs of radius `shoulder` into the side arcs
 * that meet at the point (0, -ratio); the sides' widest point (x = 1) is at y = widest * ratio.
 * All arcs are mutually tangent, so the outline is smooth everywhere but the point.
 */
export function shieldOutline(ratio, widest = 0.45, headRadius = 1.8, shoulder = 0.4) {
  const yTop = ratio, yW = widest * ratio, P = [0, -ratio];
  const R2 = (1 + (yTop + yW) ** 2) / 2, cS = [1 - R2, yW];              // side circle through the point, apex at x = 1
  const Rt = Math.max(headRadius, 1.05), cT = [0, yTop - Rt];           // head circle, apex at the top
  const rs = Math.min(shoulder, Rt - 0.05, R2 - 0.05);
  // shoulder circle centre: at distance R2 - rs from cS and Rt - rs from cT (intersection of two circles)
  const d = Math.hypot(cS[0] - cT[0], cS[1] - cT[1]), r1 = Rt - rs, r2 = R2 - rs;
  const aa = (r1 * r1 - r2 * r2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, r1 * r1 - aa * aa));
  const ux = (cS[0] - cT[0]) / d, uy = (cS[1] - cT[1]) / d;
  const c1 = [cT[0] + aa * ux - hh * uy, cT[1] + aa * uy + hh * ux], c2 = [cT[0] + aa * ux + hh * uy, cT[1] + aa * uy - hh * ux];
  const cR = c1[0] > 0 && c1[1] > c2[1] ? c1 : (c2[0] > 0 ? c2 : c1);   // the right-hand, upper solution
  // tangency points: on the line from each big centre through the shoulder centre
  const tangentOn = (c, R) => { const vx = cR[0] - c[0], vy = cR[1] - c[1], l = Math.hypot(vx, vy); return [c[0] + (R * vx) / l, c[1] + (R * vy) / l]; };
  const T1 = tangentOn(cS, R2), T2 = tangentOn(cT, Rt);
  const arc = (c, R, from, to, n) => { const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]); let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]); while (a1 > a0) a1 -= 2 * Math.PI; return [...Array(n)].map((_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [c[0] + R * Math.cos(t), c[1] + R * Math.sin(t)]; }); };
  // right half, clockwise from the top centre: head arc to T2, shoulder arc to T1, side arc to the point
  const half = [...arc(cT, Rt, [0, yTop], T2, 200), ...arc(cR, rs, T2, T1, 120), ...arc(cS, R2, T1, P, 400)];
  const left = half.slice(1).reverse().map(([x, y]) => [-x, y]);   // exact mirror image
  const poly = [...half, P, ...left];
  poly.reverse();   // counter-clockwise
  const support = polygonSupport(poly);
  const point = (az) => {
    const dd = [Math.cos(rad(az)), Math.sin(rad(az))];
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length], ex = p1[0] - p0[0], ey = p1[1] - p0[1];
      const den = dd[0] * ey - dd[1] * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (p0[0] * ey - p0[1] * ex) / den, u = (p0[0] * dd[1] - p0[1] * dd[0]) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best[0])) best = [t, [p0[0] + u * ex, p0[1] + u * ey]];
    }
    return best ? best[1] : [0, 0];
  };
  const normalAz = (az) => {
    const [x, y] = point(az), ax = Math.abs(x);
    if (ax < 1e-9 && y < 0) return 270;
    // which arc: compare distances to the three centres (right half)
    const dT = Math.abs(Math.hypot(ax - cT[0], y - cT[1]) - Rt), dR = Math.abs(Math.hypot(ax - cR[0], y - cR[1]) - rs), dS = Math.abs(Math.hypot(ax - cS[0], y - cS[1]) - R2);
    const c = dT <= dR && dT <= dS ? cT : (dR <= dS ? cR : cS);
    const na = deg(Math.atan2(y - c[1], ax - c[0]));
    return norm360(x >= 0 ? na : 180 - na);
  };
  const shoulderAz = deg(Math.atan2(cR[1] + rs * (cR[1] - (cT[1] + cS[1]) / 2) / Math.hypot(cR[0], 1e-9 + cR[1]), cR[0]));   // rough; replaced below
  const shoulderMid = (() => { const a0 = Math.atan2(T2[1] - cR[1], T2[0] - cR[0]); let a1 = Math.atan2(T1[1] - cR[1], T1[0] - cR[0]); while (a1 > a0) a1 -= 2 * Math.PI; const t = (a0 + a1) / 2; return [cR[0] + rs * Math.cos(t), cR[1] + rs * Math.sin(t)]; })();
  return { ratio, yT: yTop, R2, cS, Rt, cT, rs, cR, T1, T2, shoulderMid, shoulderAz: deg(Math.atan2(shoulderMid[1], shoulderMid[0])), support, point, normalAz, poly };
}

/**
 * Shield brilliant starting point, the pear's pattern on the shield outline. Contacts (radial
 * azimuths, right half): head (90), shoulder (middle of the shoulder arc), belly (the widest
 * point, or `sideContact`), wing (`wingContact`), point (270); pavilion mains at the head, the
 * shoulder, `pavSideContact` and `lowerContact`.
 */
export function shieldStart({
  ratio = 1.3, widest = 0.45, headRadius = 1.8, shoulder = 0.4, crownAngle = 35, shoulderAngle = 35, sideAngle = 35, wingAngle = 33, pointAngle = 25, crownHeight = 0.14, girdle = 0.033, pavilionDepth = 0.43,
  sideContact = null, wingContact = 330, pavShoulderContact = null, pavSideContact = 15, lowerContact = 300, starHeight = 0.45, culetPos = 0.5, lowerDepth = 0.65, maxDip = 0.2,
  gear = 96, girdleFacets = 128,
  frenchTip = true, tipHubHeight = 0.8, tipTable = 0.28, tipGirdle = 0.08,
} = {}) {
  const W = 2, L = ratio * W, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = shieldOutline(ratio, widest, headRadius, shoulder);
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 90, [270]);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 1, true)); return plane; };
  const table = zPlane(H);
  const sideAz = sideContact ?? deg(Math.atan2(outline.cS[1], 1));   // default: the widest point
  const shAz = outline.shoulderAz;
  const Hv = vertexNear(verts, 90), Shv = vertexNear(verts, shAz), Sv = vertexNear(verts, sideAz), Wv = vertexNear(verts, wingContact), Pv = vertexNear(verts, 270);
  const Hd = lift(Hv, 0), Sh = lift(Shv, 0), S = lift(Sv, 0), Wg = lift(Wv, 0), P = lift(Pv, 0);
  const yP = P[1];
  const bezel = (angle, v) => planeThrough(angle, outline.normalAz(v.az), lift(v, 0));

  // ---- crown bezels: head (top centre), shoulders, bellies (widest point), wings
  const head = addClass('A head', planeThrough(crownAngle, 90, Hd));
  const shoulderB = addClass('A shoulder', bezel(shoulderAngle, Shv));
  const belly = addClass('A belly', bezel(sideAngle, Sv));
  const wing = addClass('A wing', bezel(wingAngle, Wv));
  const pt = planeThrough(pointAngle, 270, P);
  if (!frenchTip) addClass('A point', pt);
  // table corners: on each bezel's table line, midway between the points where the neighbouring
  // bezel ridges reach the table (so every star has its tip beyond its base)
  const R1 = intersect3(head, shoulderB, table), R2 = intersect3(shoulderB, belly, table), R3 = intersect3(belly, wing, table);
  const A4 = frenchTip ? [0, yP + tipTable * L, H] : intersect3(pt, table, azPlane(270));
  const R4 = frenchTip ? A4 : intersect3(wing, pt, table);
  const azOf = (p) => deg(Math.atan2(p[1], p[0]));
  const T0 = intersect3(head, table, azPlane(90));
  const T1 = intersect3(shoulderB, table, azPlane((azOf(R1) + azOf(R2)) / 2));
  const T2 = intersect3(belly, table, yPlane((R2[1] + R3[1]) / 2));
  const T3 = intersect3(wing, table, yPlane((R3[1] + R4[1]) / 2));
  // ---- stars: between neighbouring bezels, tip on their ridge at starHeight of the crown
  const zs = zPlane(starHeight * H);
  const Ths = intersect3(head, shoulderB, zs), Tsb = intersect3(shoulderB, belly, zs), Tbw = intersect3(belly, wing, zs);
  addClass('C head', plane3(T0, T1, Ths, true));
  addClass('C shoulder', plane3(T1, T2, Tsb, true));
  addClass('C belly', plane3(T2, T3, Tbw, true));
  // ---- upper girdle facets in pairs meeting at a junction vertex between the contacts
  // the head and side junctions sit where the shoulder arc meets the head arc and the side arc
  // (the outline's tangency points), so no upper runs across those bends; each shoulder upper then
  // spans only half the shoulder arc and digs little into the girdle
  // Each run of upper girdle facets between a star tip's two bezel contacts is one chord facet per
  // side of the junction where the girdle is gentle, and is split at the deepest point where the
  // outline curves tightly (the head arc and the shoulders), so no facet digs more than `maxDip`
  // of the girdle thickness. The junctions start at the shoulder arc's tangency points.
  const azT2 = azOf(outline.T2), azT1 = azOf(outline.T1);
  const azJ3 = (sideAz + wingContact - 360) / 2;
  const dip = maxDip * g;
  const uppers = (name, apex, azA, azB) => chordRun(verts, azA, azB, apex, 0, true, dip).forEach((c, i, arr) => addClass(arr.length > 1 ? `${name} ${i + 1}` : name, c.plane));
  uppers('B head', Ths, 90, azT2);
  uppers('B shoulder a', Ths, azT2, shAz);
  uppers('B shoulder b', Tsb, shAz, azT1);
  uppers('B belly a', Tsb, azT1, sideAz);
  uppers('B belly b', Tbw, sideAz, azJ3);
  uppers('B wing a', Tbw, azJ3, wingContact);
  let hub = null;
  if (!frenchTip) {
    const Twp = intersect3(wing, pt, zs);
    addClass('C wing', plane3(T3, A4, Twp, true));
    uppers('B wing b', Twp, wingContact, (wingContact + 270) / 2);
    uppers('B point', Twp, (wingContact + 270) / 2, 270);
  } else {
    let V = intersect3(wing, mirrorX(wing), zPlane(tipHubHeight * H));
    const yMin = yP + 0.04 * L;
    if (V[1] < yMin) V = intersect3(wing, mirrorX(wing), yPlane(yMin));
    hub = V;
    const G = lift(vertexNearY(verts, yP + tipGirdle * L, 1), 0);
    addClass('C half-bezel', plane3(V, A4, T3, true));
    uppers('B tip', V, wingContact, azOf(G));   // from the wing contact down to the tip facet's girdle point, split where the side curves
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
  const Lv = vertexNear(verts, lowerContact), Spv = vertexNear(verts, pavSideContact), Pshv = vertexNear(verts, pavShoulderContact ?? shAz);
  const Hg = lift(Hv, -g), Ag = lift(Pshv, -g), Sg = lift(Spv, -g), Lg = lift(Lv, -g), Pg = lift(Pv, -g);
  const mHead = addClass('P head', mainAt(90, Hg));
  const mCorner = addClass('P shoulder', mainAt(outline.normalAz(Pshv.az), Ag));
  const mSide = addClass('P side', mainAt(outline.normalAz(Spv.az), Sg));
  const mLower = addClass('P lower', mainAt(outline.normalAz(Lv.az), Lg));
  // lower girdle facets: junctions on the main ridges at lowerDepth of the pavilion depth
  const jz = zPlane(-g - lowerDepth * Pd);
  const Jcs = intersect3(mCorner, mSide, jz), Jsl = intersect3(mSide, mLower, jz), Kp = intersect3(mLower, mirrorX(mLower), jz);
  const Jhs = intersect3(mHead, mCorner, jz);
  const azG2 = (pavSideContact + lowerContact - 360) / 2 + 360;
  const lowers = (name, apex, azA, azB) => chordRun(verts, azA, azB, apex, -g, false, dip).forEach((c, i, arr) => addClass(arr.length > 1 ? `${name} ${i + 1}` : name, c.plane));
  lowers('L head a', Jhs, 90, azT2);
  lowers('L head b', Jhs, azT2, Pshv.az);
  lowers('L a', Jcs, Pshv.az, azT1);
  lowers('L b', Jcs, azT1, pavSideContact);
  lowers('L c', Jsl, pavSideContact, azG2);
  lowers('L d', Jsl, azG2, lowerContact);
  lowers('L point', Kp, lowerContact, 270);

  const pct = (v) => `${Math.round(v * 100)}%`;
  const hubNote = hub ? `Hub at ${pct((hub[1] - yP) / L)} of the length from the point, ${pct(hub[2] / H)} of the crown height.` : '';
  return {
    name: 'Shield brilliant (starting point)', gear, fold: 1, mirror: true, ri: 2.42,
    headings: ['Shield brilliant starting point', `L:W ${ratio}, crown ${crownAngle}${frenchTip ? ', French tip' : ` (point bezel ${pointAngle})`}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: brilliant pattern on a shield outline with typical angles. No lab plotting template exists for shields.'],
    notes: [
      'Ideal dimensions: none published. GIA assigns no cut grade to shield-cut diamonds and IGI\'s fancy-shape cut guidelines do not cover the shape; trade practice puts shields at L:W 1.2-1.5 with proportions like a pear\'s (crown height 12-16%, pavilion depth 41-46%, girdle 2-6%).',
      `This design: L:W ${ratio}, widest point ${pct(widest)} of the half-length above the centre, head radius ${headRadius} and shoulder radius ${shoulder} half-widths, crown height ${pct(crownHeight)}, head bezel ${crownAngle}, shoulder bezels ${shoulderAngle}, belly bezels ${sideAngle}, wing bezels ${wingAngle}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}, culet ${pct(culetPos)} of the length from the top. Bezel angles are measured in each facet's own slope direction.`,
      `Point: ${frenchTip ? 'French tip (GIA 4Cs marquise wireframe arrangement): no bezel at the point; two tip facets, two small upper girdle facets, the two side bezels and two half-bezels meet at a hub on the axis. ' + hubNote : 'uncorrected, a shallow bezel at the point (' + pointAngle + ') with a star either side.'}`,
      'Pattern (the pear\'s): crown: table, head bezel, 2 shoulder bezels, 2 belly bezels at the widest point, 2 wing bezels on the lower sides, point bezel or French tip, 8 stars, 16 upper girdle facets in pairs meeting at junctions; pavilion: head, 2 shoulder, 2 side and 2 lower mains meeting at the culet, 14 lower girdle facets with junctions on the main ridges.',
      'Outline: a head arc of large radius blending through rounded shoulders into the side arcs that meet at the point, all tangent; the widest point part way down the sides. Facets touch the girdle at polygon vertices with the outline normal as azimuth.',
    ],
    tiers,
  };
}
const xPlane_ = (x) => ({ n: [1, 0, 0], d: x });

const params = [
  { key: 'ratio', label: 'L:W', default: 1.3, step: 0.01, min: 1 },
  { key: 'widest', label: 'Widest point', default: 0.45, step: 0.05, min: 0.1, max: 0.9, title: 'Height of the widest point, fraction of the half-length above the centre' },
  { key: 'headRadius', label: 'Head radius', default: 1.8, step: 0.1, min: 1.1, title: 'Radius of the head arc, half-widths (large = nearly flat)' },
  { key: 'shoulder', label: 'Shoulder radius', default: 0.4, step: 0.05, min: 0.1, max: 0.9, title: 'Radius of the shoulder arcs, half-widths' },
  { key: 'crownAngle', label: 'Head bezel', default: 35, step: 0.5 }, { key: 'shoulderAngle', label: 'Shoulder bezels', default: 35, step: 0.5 }, { key: 'sideAngle', label: 'Belly bezels', default: 35, step: 0.5 }, { key: 'wingAngle', label: 'Wing bezels', default: 33, step: 0.5 },
  { key: 'crownHeight', label: 'Crown height', default: 0.14, step: 0.005 }, { key: 'girdle', label: 'Girdle', default: 0.033, step: 0.005 }, { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.43, step: 0.005 },
  { key: 'wingContact', label: 'Wing contact', default: 330, step: 1, title: 'Radial azimuth of the wing bezel contact on the lower side (270 = the point, 360 = the side)' },
  { key: 'pavSideContact', label: 'Side main', default: 15, step: 1, title: 'Radial azimuth of the pavilion side main contact' },
  { key: 'lowerContact', label: 'Lower contact', default: 300, step: 1, title: 'Radial azimuth of the lower main contact' },
  { key: 'starHeight', label: 'Star tips', default: 0.45, step: 0.05, min: 0.2, max: 0.95, title: 'Star tip height, fraction of the crown height (lower tips give flatter upper girdle facets that dig less)' },
  { key: 'maxDip', label: 'Max girdle dig', default: 0.2, step: 0.05, min: 0.05, max: 0.5, title: 'How far an upper or lower girdle facet may dig into the girdle, fraction of its thickness; a facet that would dig more is split at the deepest point' },
  { key: 'culetPos', label: 'Culet', default: 0.5, step: 0.01, title: 'Fraction of the length from the top' },
];
const french = [
  { key: 'tipHubHeight', label: 'Hub height', default: 0.8, step: 0.01, min: 0.5, max: 0.98 },
  { key: 'tipTable', label: 'Tip table corner', default: 0.28, step: 0.01, title: 'Table apex distance from the point, fraction of the length' },
  { key: 'tipGirdle', label: 'Tip girdle point', default: 0.08, step: 0.01, title: 'Tip facet girdle point from the point, fraction of the length (short, so the tip facet digs little into the curved side)' },
];
export const templates = {
  shield: { name: 'Shield brilliant, French tip (starting point)', note: 'Brilliant pattern on a shield outline (no lab template exists); French tip at the point.', params: [...params, ...french], make: (o = {}) => shieldStart({ ...o }) },
  shieldStd: { name: 'Shield brilliant, uncorrected point (starting point)', note: 'Brilliant pattern on a shield outline with a shallow bezel at the point.', params: [...params, { key: 'pointAngle', label: 'Point bezel', default: 25, step: 0.5 }], make: (o = {}) => shieldStart({ frenchTip: false, ...o }) },
};
export const plots = [];
