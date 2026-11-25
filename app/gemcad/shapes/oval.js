// Oval brilliant starting designs: the IGI plotting template's facet pattern with typical angles.
// Two templates share the crown and differ in the pavilion: 8 mains (IGI FDR683533599,
// FDR749558450) or 4 mains (FDR733542179). Built the way ../fancy.js builds the marquise: a facet
// that reaches the girdle touches the girdle polygon at a vertex chosen by radial azimuth, and its
// azimuth is the outline normal there; the other facets are planes through three meet points.
import { newTier } from '../design.js?v=92';
import {
  ellipseOutline, girdleVertices, vertexNear, lift, planeThrough, planeAz, mainThrough,
  mirrorX, mirrorY, zPlane, yPlane, xPlane, azPlane, perpPlane, classTier, girdleFromSupport, girdleEqualLength, plane3, intersect3, chordRun,
} from '../shapebuild.js?v=92';

/*
 * Positions measured on the IGI plots (units: the half-width; y along the length; radial azimuth
 * in degrees counter-clockwise from the right-hand side). Plot L:W 1.43 (480 x 335 px crown,
 * 489 x 342 px pavilion on FDR749558450; 528 x 368 px on FDR733542179).
 *
 * Crown (FDR749558450, centre (264, 265.5) px, half-width 167.5 px, half-length 240 px). The
 * pattern is the round brilliant's: 8 bezel kites with girdle contacts at the shoulders and the
 * sides, 8 stars (one on each axis between the two shoulder or the two side bezels, one on each
 * diagonal between a shoulder and a side bezel), 16 upper girdle facets whose pairs meet on the
 * girdle at the axes and at 54 degrees, and an octagonal table. Positions normalised: x in
 * half-widths, y as a fraction of the half-length.
 *   girdle contacts: shoulder bezel G1 (0.367, 0.925) az 74.5; upper-girdle junction Gm
 *     (0.719, 0.683) az 53.7; side bezel G2 (0.899, 0.392) az 32.0; junctions on the axes.
 *   table corners: head T1 (0.182, 0.508), side T2 (0.499, 0.217).
 *   star apexes as drawn: head (0, 0.725), diagonal (0.51, 0.517), side (0.499, 0.008); the
 *     template draws them where the bezel ridges reach the table, so the design puts them on the
 *     ridges at `starHeight` of the crown height instead.
 * Pavilion, 8 mains (FDR749558450, centre (794.5, 264) px, half-width 171 px):
 *   head main contact       G70 = (0.449, 1.253) az 70.3   (871, 50 px)
 *   lower girdle junction   M49 = (0.770, 0.880) az 48.8   (926, 113.5 px)
 *   side main contact       G26 = (0.931, 0.463) az 26.4   (954, 185 px)
 *   junctions: axis J_head = (0, 0.339) = 0.237 of the half-length; diagonal J = (0.215, 0.251),
 *   az 49.4, r 0.330; side J_side = (0.332, 0).
 * Pavilion, 4 mains (FDR733542179, centre (749.5, 265) px, half-width 185 px):
 *   lower girdle junction   M68 = (0.482, 1.230) az 68.6   (839, 37.5 px)
 *   main contact            G45 = (0.807, 0.818) az 45.4   (899, 114 px)
 *   lower girdle junction   M24 = (0.935, 0.419) az 24.1   (922.5, 187.5 px)
 *   junctions: axis J_head = (0, 0.257) = 0.18 of the half-length; side J_side = (0.259, 0).
 *   Four lower girdle facets meet at each junction; the mains meet at the culet.
 */
const PLOT = {
  ratio: 1.43,
  crown: { G1: 74.5, Gm: 53.7, G2: 32.0, T1: [0.182, 0.508], T2: [0.499, 0.217] },
  pav8: { G1: 70.3, M49: 48.8, G2: 26.4, Jhead: 0.237, Jdiag: [49.4, 0.330], Jside: 0.332 },
  pav4: { M68: 68.6, G45: 45.4, M24: 24.1, Jhead: 0.18, Jside: 0.259 },
};

/**
 * Oval brilliant starting point. Crown: table, 8 bezel kites (4 shoulders, 4 sides), 8 stars
 * (4 on the axes, 4 diagonal), 16 upper girdle facets. Pavilion: 8 mains (4 head, 4 side) with
 * 16 lower girdle facets, or 4 mains at the diagonals with 16 lower girdle facets.
 * Each bezel passes through its girdle contact and a table corner (side bezels through T2,
 * shoulder bezels through T1), so the bezel angles follow from the crown height and the table. Table corners are the plot's (fractions of the
 * half-width and half-length). Star apexes sit on the bezel ridges at `starHeight` of the crown.
 */
export function ovalStart({
  ratio = PLOT.ratio, crownHeight = 0.16, girdle = 0.033, pavilionDepth = 0.43,
  tableCornerHead = PLOT.crown.T1, tableCornerSide = PLOT.crown.T2,
  starHeight = 0.65, lowerDepth = 0, gear = 96, girdleFacets = 128, pavilionMains = 8, maxDip = 0.2, alignMains = true,
} = {}) {
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = ellipseOutline(l);
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 0);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { const t = classTier(name, plane, gear, 2, true); tiers.push(t); return t; };
  const table = zPlane(H);
  const mx = (p) => [-p[0], p[1], p[2]], my = (p) => [p[0], -p[1], p[2]];

  // ---- crown: girdle contacts (top-right quadrant), bezels, stars, upper girdle facets
  const pc = PLOT.crown;
  const M90v = vertexNear(verts, 90), G1v = vertexNear(verts, pc.G1), Gmv = vertexNear(verts, pc.Gm), G2v = vertexNear(verts, pc.G2), M0v = vertexNear(verts, 0);
  const M90 = lift(M90v, 0), G1 = lift(G1v, 0), Gm = lift(Gmv, 0), G2 = lift(G2v, 0), M0 = lift(M0v, 0);
  // side bezels through their contact and the side table corner, shoulder bezels through their
  // contact and the head table corner: the angles follow from the crown height and the table
  const T2 = [tableCornerSide[0], tableCornerSide[1] * l, H];
  const side = planeAz(G2, T2, outline.normalAz(G2v.az), true);
  const T1 = [tableCornerHead[0], tableCornerHead[1] * l, H];
  const head = planeAz(G1, T1, outline.normalAz(G1v.az), true);
  const sideTier = addClass('A side', side), headTier = addClass('A shoulder', head);
  // stars: apex on the ridge between neighbouring bezels at starHeight of the crown, base on the table
  const A90 = intersect3(head, mirrorX(head), zPlane(starHeight * H));
  const A45 = intersect3(head, side, zPlane(starHeight * H));
  const A0 = intersect3(side, mirrorY(side), zPlane(starHeight * H));
  addClass('C head', plane3(A90, T1, mx(T1), true));
  addClass('C diagonal', plane3(A45, T1, T2, true));
  addClass('C side', plane3(A0, T2, my(T2), true));
  // upper girdle facets: through a star apex and two girdle vertices; a facet that would dig more
  // than maxDip of the girdle into it (the ellipse curves fastest at the ends) is split at the
  // deepest point so the girdle keeps an even thickness
  const dip = maxDip * g;
  const run = (name, apex, azA, azB, z, up) => chordRun(verts, azA, azB, apex, z, up, dip).forEach((c, i, arr) => addClass(arr.length > 1 ? `${name} ${i + 1}` : name, c.plane));
  run('B head', A90, 90, pc.G1, 0, true);
  run('B shoulder', A45, pc.G1, pc.Gm, 0, true);
  run('B side-shoulder', A45, pc.Gm, pc.G2, 0, true);
  run('B side', A0, pc.G2, 0, 0, true);

  // ---- pavilion
  const zc = -g - Pd, culet = [0, 0, zc];
  const M90p = lift(M90v, -g), M0p = lift(M0v, -g);
  const main = (v, p) => mainThrough(outline.normalAz(v.az), p, zc);
  const jz = lowerDepth ? zPlane(-g - lowerDepth * Pd) : null;
  const mainTiers = [];
  if (pavilionMains === 8) {
    const pp = PLOT.pav8;
    // mains under the bezels (contacts at the crown's azimuths, lower junction under the upper
    // junction) so hills and valleys line up round the girdle; or the plot's own positions
    const az1 = alignMains ? pc.G1 : pp.G1, azm = alignMains ? pc.Gm : pp.M49, az2 = alignMains ? pc.G2 : pp.G2;
    const Gv1 = vertexNear(verts, az1), Gv2 = vertexNear(verts, az2);
    const Gp1 = lift(Gv1, -g), Gp2 = lift(Gv2, -g);
    const mH = main(Gv1, Gp1), mS = main(Gv2, Gp2);
    mainTiers.push(addClass('P head', mH), addClass('P side', mS));
    // lower girdle junctions on the ridges between mains, at the plot's plan positions
    const Jh = intersect3(mH, mirrorX(mH), jz || yPlane(pp.Jhead * l));
    const Jd = intersect3(mH, mS, jz || perpPlane(pp.Jdiag[0], pp.Jdiag[1]));
    const Js = intersect3(mS, mirrorY(mS), jz || xPlane(pp.Jside));
    run('L head', Jh, 90, az1, -g, false);
    run('L a', Jd, az1, azm, -g, false);
    run('L b', Jd, azm, az2, -g, false);
    run('L side', Js, az2, 0, -g, false);
  } else {
    const pp = PLOT.pav4;
    // the four mains sit at the diagonals, under the crown's upper-girdle junctions (not under a
    // bezel), and the lower-girdle junctions sit under the bezel contacts, so the girdle's hills
    // and valleys line up top and bottom; or the plot's own positions
    const az45 = alignMains ? pc.Gm : pp.G45, az68 = alignMains ? pc.G1 : pp.M68, az24 = alignMains ? pc.G2 : pp.M24;
    const Gv45 = vertexNear(verts, az45);
    const Gp45 = lift(Gv45, -g);
    const m = main(Gv45, Gp45);
    mainTiers.push(addClass('P', m));
    const Jh = intersect3(m, mirrorX(m), jz || yPlane(pp.Jhead * l));
    const Js = intersect3(m, mirrorY(m), jz || xPlane(pp.Jside));
    run('L head', Jh, 90, az68, -g, false);
    run('L head b', Jh, az68, az45, -g, false);
    run('L side b', Js, az45, az24, -g, false);
    run('L side', Js, az24, 0, -g, false);
  }

  const pct = (v) => `${Math.round(v * 1000) / 10}%`, ang = (t) => Math.round(Math.abs(t.angle) * 10) / 10;
  const tableW = 2 * T2[0] / W, tableL = 2 * T1[1] / W;
  const mains = pavilionMains === 8 ? '8 mains (4 head, 4 side)' : '4 mains at the diagonals';
  return {
    name: `Oval brilliant, ${mains} (starting point)`, gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Oval brilliant starting point', `L:W ${ratio}, side bezels ${ang(sideTier)}, shoulder bezels ${ang(headTier)}, pavilion ${mains}, depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: IGI plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to oval diamonds.',
      'IGI Excellent ranges (oval brilliant): L:W 1.35-1.50, total depth 58-65%, table 56-62%, crown height 12.5-16%, crown angle 33-38.5, girdle 2-6% (thin to thick), pavilion depth 41-46.5%, pavilion angle 39.5-42.5, culet pointed to small, bow tie not significant. IGI\'s guideline brochure publishes only the Excellent column for the oval.',
      `This design: L:W ${ratio}, crown height ${pct(crownHeight)}, side bezels ${ang(sideTier)} and shoulder bezels ${ang(headTier)} (each through its girdle contact and a table corner), stars ${starHeight * 100}% of the crown height at the apex, table about ${pct(tableW)} of the width by ${pct(tableL / ratio)} of the length, pavilion depth ${pct(pavilionDepth)}, mains ${mainTiers.map((t) => ang(t)).join(' and ')}, girdle ${pct(girdle)}. Angles are measured in each facet's own slope direction; they vary around the outline at a constant crown height.`,
      `Plot pattern (IGI template, L:W ${PLOT.ratio} as drawn): crown 8 bezel kites (4 at the shoulders, contact 74.5 degrees from the side; 4 at the sides, contact 32 degrees), 8 stars (4 on the axes, 4 on the diagonals), 16 upper girdle facets whose pairs meet on the girdle at the axes and at 54 degrees, octagonal table (corners at 0.18 of the half-width on the ends and 0.22 of the half-length on the sides); pavilion ${pavilionMains === 8 ? '8 mains (contacts 70 and 26 degrees from the side) meeting at the culet, 16 lower girdle facets with junctions on the axes (24% of the half-length) and the diagonals' : '4 mains at the diagonals (contact 45 degrees from the side) meeting at the culet, 16 lower girdle facets, four at each junction on the axes (18% of the half-length on the long axis, 26% of the half-width on the short)'}.`,
      `Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point. ${alignMains ? (pavilionMains === 8 ? 'The pavilion mains are cut under the bezels (contacts at the bezel azimuths, the lower-girdle junction under the upper-girdle junction) so the girdle\'s hills and valleys line up top and bottom; the plot has them a few degrees off (70.3 / 48.8 / 26.4).' : 'The four mains are cut under the crown\'s upper-girdle junctions and the lower-girdle junctions under the bezel contacts, so hills and valleys line up top and bottom; the plot has them a few degrees off (68.6 / 45.4 / 24.1).') : 'The pavilion contacts are the plot\'s own.'} The template draws the star apexes where the bezel ridges reach the table, which no real star can do; the design puts them on the ridges at the star height.`,
    ],
    tiers,
  };
}

/**
 * Oval brilliant with the round brilliant's arrangement on the oval: 8 bezel kites at the head,
 * the belly and the shoulders (`shoulderAz`), 8 stars between them, 16 upper girdle facets whose
 * pairs meet on the girdle midway (by arc length) between the bezel contacts; 8 pavilion mains
 * under the bezels (head, belly, shoulders) and 16 lower girdle facets whose junctions share the
 * uppers' girdle vertices, so hills and valleys line up round the girdle. The table is an octagon
 * whose corners sit on the bezel contacts' radii at `table` of the way out, so the bezel angles
 * follow from the crown height and the table.
 */
export function ovalHeadStart({
  ratio = PLOT.ratio, crownHeight = 0.16, girdle = 0.033, pavilionDepth = 0.43, table = 0.58, shoulderAz = 53,
  starHeight = 0.5, lowerDepth = 0.8, gear = 96, girdleFacets = 128, maxDip = 0.2,
} = {}) {
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = ellipseOutline(l);
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 0);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { const t = classTier(name, plane, gear, 2, true); tiers.push(t); return t; };
  const zs = zPlane(starHeight * H);
  // contacts: head (90), shoulder, belly (0); junctions midway by arc length between them
  const sorted = verts.slice().sort((a, b) => a.az - b.az);
  const between = (azA, azB) => {
    const i = sorted.indexOf(vertexNear(sorted, azA)), j = sorted.indexOf(vertexNear(sorted, azB)), n = sorted.length;
    const fwd = ((j - i) % n + n) % n, back = ((i - j) % n + n) % n;
    const step = fwd <= back ? 1 : -1, count = Math.min(fwd, back);
    return sorted[((i + step * Math.round(count / 2)) % n + n) % n];
  };
  const Hv = vertexNear(verts, 90), Dv = vertexNear(verts, shoulderAz), Sv = vertexNear(verts, 0);
  const J1v = between(90, Dv.az), J2v = between(Dv.az, 0);
  // ---- crown: each bezel through its contact and its table corner (the contact's radius at `table`)
  const corner = (v) => [table * v.p[0], table * v.p[1], H];
  const Th = corner(Hv), Td = corner(Dv), Ts = corner(Sv);
  const head = planeAz(lift(Hv, 0), Th, 90, true), shoulder = planeAz(lift(Dv, 0), Td, outline.normalAz(Dv.az), true), belly = planeAz(lift(Sv, 0), Ts, 0, true);
  const headTier = addClass('A head', head), shoulderTier = addClass('A shoulder', shoulder), bellyTier = addClass('A belly', belly);
  const Ahs = intersect3(head, shoulder, zs), Asb = intersect3(shoulder, belly, zs);
  addClass('C head', plane3(Ahs, Th, Td, true));
  addClass('C belly', plane3(Asb, Td, Ts, true));
  const dip = maxDip * g;
  const run = (name, apex, azA, azB, z, up) => chordRun(verts, azA, azB, apex, z, up, dip).forEach((c, i, arr) => addClass(arr.length > 1 ? `${name} ${i + 1}` : name, c.plane));
  run('B head', Ahs, 90, J1v.az, 0, true);
  run('B shoulder a', Ahs, J1v.az, Dv.az, 0, true);
  run('B shoulder b', Asb, Dv.az, J2v.az, 0, true);
  run('B belly', Asb, J2v.az, 0, 0, true);
  // ---- pavilion: mains under the bezels, lower junctions on their ridges at lowerDepth
  const zc = -g - Pd;
  const main = (v) => mainThrough(v === Hv ? 90 : v === Sv ? 0 : outline.normalAz(v.az), lift(v, -g), zc);
  const mH = main(Hv), mD = main(Dv), mS = main(Sv);
  const mainTiers = [addClass('P head', mH), addClass('P shoulder', mD), addClass('P belly', mS)];
  // lower girdle facets: exactly two between each pair of mains, one chord each from the main's
  // contact to the junction vertex midway between the mains (never split, unlike the uppers)
  const jz = zPlane(-g - lowerDepth * Pd);
  const Jhs = intersect3(mH, mD, jz), Jsb = intersect3(mD, mS, jz);
  const chord = (name, vA, vB, apex) => addClass(name, plane3(lift(vA, -g), lift(vB, -g), apex, false));
  chord('L head', Hv, J1v, Jhs);
  chord('L shoulder a', J1v, Dv, Jhs);
  chord('L shoulder b', Dv, J2v, Jsb);
  chord('L belly', J2v, Sv, Jsb);

  const pct = (v) => `${Math.round(v * 1000) / 10}%`, ang = (t) => Math.round(Math.abs(t.angle) * 10) / 10;
  return {
    name: 'Oval brilliant, 8 mains at the heads (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Oval brilliant starting point, bezels and mains at the heads', `L:W ${ratio}, bezels ${ang(headTier)} head / ${ang(shoulderTier)} shoulder / ${ang(bellyTier)} belly, pavilion 8 mains, depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: the round brilliant\'s arrangement on the oval outline (bezels and mains at the head, the shoulders and the belly) with typical angles.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to oval diamonds.',
      'IGI Excellent ranges (oval brilliant): L:W 1.35-1.50, total depth 58-65%, table 56-62%, crown height 12.5-16%, crown angle 33-38.5, girdle 2-6% (thin to thick), pavilion depth 41-46.5%, pavilion angle 39.5-42.5, culet pointed to small, bow tie not significant.',
      `This design: L:W ${ratio}, crown height ${pct(crownHeight)}, bezels ${ang(headTier)} at the head, ${ang(shoulderTier)} at the shoulders (contact ${shoulderAz} degrees from the side) and ${ang(bellyTier)} at the belly, each through its girdle contact and its table corner; table ${pct(table)} of the width and of the length (octagon with corners on the bezel radii); stars ${starHeight * 100}% of the crown height at the apex; pavilion depth ${pct(pavilionDepth)}, mains ${mainTiers.map((t) => ang(t)).join(' / ')} under the bezels, lower junctions at ${pct(lowerDepth)} of the pavilion depth; girdle ${pct(girdle)}. Angles are measured in each facet\'s own slope direction.`,
      'Pattern (the round brilliant\'s, as on the GemSociety oval diagram): crown of table, 8 bezels (2 head, 4 shoulder, 2 belly), 8 stars, 16 upper girdle facets whose pairs meet midway between the bezel contacts; pavilion of 8 mains under the bezels meeting at the culet and 16 lower girdle facets, two between each pair of mains, whose junctions sit on the girdle midway (by arc length) between the mains and on the main ridges at the set depth. Upper girdle facets that would dig more than the set fraction of the girdle into the ellipse\'s tight ends are split at the deepest point; the lowers never are.',
    ],
    tiers,
  };
}

const params = [
  { key: 'ratio', label: 'L:W', default: PLOT.ratio, step: 0.01, min: 1.1 },
  { key: 'crownHeight', label: 'Crown height', default: 0.16, step: 0.005, title: 'Fraction of the width; with the table corners it sets the bezel angles' },
  { key: 'tableCornerSide', label: 'Side table corner', default: PLOT.crown.T2, list: true, title: 'x in half-widths, y as a fraction of the half-length' },
  { key: 'tableCornerHead', label: 'Head table corner', default: PLOT.crown.T1, list: true, title: 'x in half-widths, y as a fraction of the half-length' },
  { key: 'starHeight', label: 'Star tips', default: 0.65, step: 0.05, min: 0.2, max: 0.95, title: 'Fraction of the crown height' },
  { key: 'girdle', label: 'Girdle', default: 0.033, step: 0.005 },
  { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.43, step: 0.005 },
  { key: 'maxDip', label: 'Max girdle dig', default: 0.2, step: 0.05, min: 0.05, max: 0.5, title: 'How far an upper or lower girdle facet may dig into the girdle, fraction of its thickness; a facet that would dig more is split at the deepest point' },
];

export const templates = {
  oval: { name: 'Oval brilliant, 8-main pavilion (starting point)', note: 'IGI plot pattern (FDR749558450) with typical angles, the pavilion mains under the bezels; trace against the underlay and cut meet points.', params: [...params, { key: 'alignMains', label: 'Mains under bezels', default: 1, step: 1, min: 0, max: 1, title: '1: pavilion main contacts at the bezel contacts and the lower junction under the upper junction; 0: the plot\'s own positions (70.3 / 48.8 / 26.4)' }], make: (o = {}) => ovalStart({ pavilionMains: 8, ...o, alignMains: o.alignMains === undefined ? true : !!o.alignMains }) },
  oval8head: { name: 'Oval brilliant, 8 mains at the heads (starting point)', note: 'The round brilliant\'s arrangement on the oval (GemSociety diagram): bezels and mains at the head, the shoulders and the belly, stars between the bezels, upper and lower girdle facets meeting midway between the contacts.', params: [
    { key: 'ratio', label: 'L:W', default: PLOT.ratio, step: 0.01, min: 1.1 },
    { key: 'crownHeight', label: 'Crown height', default: 0.16, step: 0.005, title: 'Fraction of the width; with the table it sets the bezel angles' },
    { key: 'table', label: 'Table', default: 0.58, step: 0.01, min: 0.4, max: 0.75, title: 'Table corners at this fraction of the bezel contacts\' radii (table width and length as fractions of the stone\'s)' },
    { key: 'shoulderAz', label: 'Shoulder contact', default: 53, step: 1, min: 35, max: 70, title: 'Radial azimuth of the shoulder bezel and main contacts, degrees from the side' },
    { key: 'starHeight', label: 'Star tips', default: 0.5, step: 0.05, min: 0.2, max: 0.95, title: 'Fraction of the crown height (above about 0.6 the head stars thin to slivers against the table edge)' },
    { key: 'girdle', label: 'Girdle', default: 0.033, step: 0.005 },
    { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.43, step: 0.005 },
    { key: 'lowerDepth', label: 'Lower junctions', default: 0.8, step: 0.05, min: 0.2, max: 0.95, title: 'Lower girdle junctions on the main ridges, fraction of the pavilion depth' },
    { key: 'maxDip', label: 'Max girdle dig', default: 0.2, step: 0.05, min: 0.05, max: 0.5, title: 'How far an upper girdle facet may dig into the girdle, fraction of its thickness; a facet that would dig more is split at the deepest point (the lowers are never split)' },
  ], make: (o = {}) => ovalHeadStart(o) },
  oval4: { name: 'Oval brilliant, 4-main pavilion (starting point)', note: 'Same crown; the pavilion variant with four mains at the diagonals (IGI FDR733542179), under the crown\'s upper-girdle junctions, with the lower junctions under the bezels.', params: [...params, { key: 'alignMains', label: 'Mains under junctions', default: 1, step: 1, min: 0, max: 1, title: '1: the four mains under the crown\'s upper-girdle junctions and the lower junctions under the bezel contacts; 0: the plot\'s own positions (68.6 / 45.4 / 24.1)' }], make: (o = {}) => ovalStart({ pavilionMains: 4, ...o, alignMains: o.alignMains === undefined ? true : !!o.alignMains }) },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'oval-crown', label: 'Oval: crown (IGI)' },
  { id: 'oval-pavilion', label: 'Oval: pavilion, 8 mains (IGI)' },
  { id: 'oval4-pavilion', label: 'Oval: pavilion, 4 mains (IGI)' },
];
