// Oval brilliant starting designs: the IGI plotting template's facet pattern with typical angles.
// Two templates share the crown and differ in the pavilion: 8 mains (IGI FDR683533599,
// FDR749558450) or 4 mains (FDR733542179). Built the way ../fancy.js builds the marquise: a facet
// that reaches the girdle touches the girdle polygon at a vertex chosen by radial azimuth, and its
// azimuth is the outline normal there; the other facets are planes through three meet points.
import { newTier } from '../design.js';
import {
  ellipseOutline, girdleVertices, vertexNear, lift, planeThrough, planeAz, mainThrough,
  mirrorX, mirrorY, zPlane, yPlane, xPlane, azPlane, perpPlane, classTier, girdleFromSupport, girdleEqualLength, plane3, intersect3,
} from '../shapebuild.js';

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
  ratio = PLOT.ratio, crownHeight = 0.16, girdle = 0.035, pavilionDepth = 0.43,
  tableCornerHead = PLOT.crown.T1, tableCornerSide = PLOT.crown.T2,
  starHeight = 0.65, lowerDepth = 0, gear = 96, girdleFacets = 128, pavilionMains = 8,
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
  // upper girdle facets: through a star apex and two girdle vertices
  addClass('B head', plane3(A90, M90, G1, true));
  addClass('B shoulder', plane3(A45, G1, Gm, true));
  addClass('B side-shoulder', plane3(A45, Gm, G2, true));
  addClass('B side', plane3(A0, G2, M0, true));

  // ---- pavilion
  const zc = -g - Pd, culet = [0, 0, zc];
  const M90p = lift(M90v, -g), M0p = lift(M0v, -g);
  const main = (v, p) => mainThrough(outline.normalAz(v.az), p, zc);
  const jz = lowerDepth ? zPlane(-g - lowerDepth * Pd) : null;
  const mainTiers = [];
  if (pavilionMains === 8) {
    const pp = PLOT.pav8;
    const Gv1 = vertexNear(verts, pp.G1), Mv49 = vertexNear(verts, pp.M49), Gv2 = vertexNear(verts, pp.G2);
    const Gp1 = lift(Gv1, -g), Mp49 = lift(Mv49, -g), Gp2 = lift(Gv2, -g);
    const mH = main(Gv1, Gp1), mS = main(Gv2, Gp2);
    mainTiers.push(addClass('P head', mH), addClass('P side', mS));
    // lower girdle junctions on the ridges between mains, at the plot's plan positions
    const Jh = intersect3(mH, mirrorX(mH), jz || yPlane(pp.Jhead * l));
    const Jd = intersect3(mH, mS, jz || perpPlane(pp.Jdiag[0], pp.Jdiag[1]));
    const Js = intersect3(mS, mirrorY(mS), jz || xPlane(pp.Jside));
    addClass('L head', plane3(Jh, M90p, Gp1, false));
    addClass('L a', plane3(Jd, Gp1, Mp49, false));
    addClass('L b', plane3(Jd, Mp49, Gp2, false));
    addClass('L side', plane3(Js, Gp2, M0p, false));
  } else {
    const pp = PLOT.pav4;
    const Mv68 = vertexNear(verts, pp.M68), Gv45 = vertexNear(verts, pp.G45), Mv24 = vertexNear(verts, pp.M24);
    const Mp68 = lift(Mv68, -g), Gp45 = lift(Gv45, -g), Mp24 = lift(Mv24, -g);
    const m = main(Gv45, Gp45);
    mainTiers.push(addClass('P', m));
    const Jh = intersect3(m, mirrorX(m), jz || yPlane(pp.Jhead * l));
    const Js = intersect3(m, mirrorY(m), jz || xPlane(pp.Jside));
    addClass('L head', plane3(Jh, M90p, Mp68, false));
    addClass('L head b', plane3(Jh, Mp68, Gp45, false));
    addClass('L side b', plane3(Js, Gp45, Mp24, false));
    addClass('L side', plane3(Js, Mp24, M0p, false));
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
      'Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point. The template draws the star apexes where the bezel ridges reach the table, which no real star can do; the design puts them on the ridges at the star height.',
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
  { key: 'girdle', label: 'Girdle', default: 0.035, step: 0.005 },
  { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.43, step: 0.005 },
];

export const templates = {
  oval: { name: 'Oval brilliant, 8-main pavilion (starting point)', note: 'IGI plot pattern (FDR749558450) with typical angles; trace against the underlay and cut meet points.', params, make: (o = {}) => ovalStart({ pavilionMains: 8, ...o }) },
  oval4: { name: 'Oval brilliant, 4-main pavilion (starting point)', note: 'Same crown; the pavilion variant with four mains at the diagonals (IGI FDR733542179).', params, make: (o = {}) => ovalStart({ pavilionMains: 4, ...o }) },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'oval-crown', label: 'Oval: crown (IGI)' },
  { id: 'oval-pavilion', label: 'Oval: pavilion, 8 mains (IGI)' },
  { id: 'oval4-pavilion', label: 'Oval: pavilion, 4 mains (IGI)' },
];
