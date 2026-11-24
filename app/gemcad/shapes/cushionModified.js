// Square cushion modified brilliant (IGI's label for the "crushed ice" cushion family).
// One template per distinct pavilion pattern found on IGI report plots, each traced from one
// report's plotting diagram. Built with ../shapebuild.js the way ../fancy.js builds the marquise:
// a facet that reaches the girdle touches the girdle polygon at a vertex chosen by the plot's
// contact azimuth, every other facet is a plane through three measured meet points, and each
// symmetry class is one tier.
//
// Conventions: half-width 1 (width 2, length 2 * ratio), table at z = H, girdle top z = 0, girdle
// bottom z = -g, culet at z = -g - Pd. Plot positions are measured on the IGI plots in units of the
// half-width (x right, y up, origin at the stone's centre) and recorded beside each facet.
//
// Outline: Minkowski sum of a square (half-side a) and a circle (radius r), a + r = 1, with r read
// off each plot's corner radius (0.57 to 0.67 on the five plots). Girdle: 128 facets offset half a
// step so the contacts fall on polygon vertices; between two contacts the girdle scallops.
//
// Symmetry: IGI's crown template (four of the five plots) is only two-fold symmetric, the table
// reaching 0.66 of the half-width along one axis and 0.59 along the other, and so are those
// pavilions; those designs use fold 2 + mirror and build one representative facet per class in the
// top-right quadrant. FDR715558200 is four-fold throughout: fold 4 + mirror, one facet per class
// in the 0 to 45 degree octant.
import { newTier } from '../design.js?v=58';
import { cushionOutline as bowedCushionOutline } from './cushion.js?v=58';
const BOW = 0.01;   // outward bow of the sides, fraction of the half-width (the plots' sides are not quite straight)
import {
  deg, lift, vertexNear, girdleVertices, planeThrough, planeAz, mainThrough, yPlane, xPlane, classTier,
  girdleFromSupport, girdleEqualLength, plane3, intersect3, cushionOutline, pointOn, azOf,
} from '../shapebuild.js?v=58';

const IGI_RANGES = 'IGI Excellent ranges (square cushion modified brilliant): L:W 1.00-1.05 (1.06+ is graded as rectangular), total depth 62-68%, table 55-62%, crown height 8-16%, girdle 2-6% (thin to thick), pavilion depth 40-56%, culet pointed to small. IGI publishes no crown or pavilion angle for this shape.';
const NO_GIA = 'GIA assigns no cut grade to cushion diamonds.';

// --------------------------------------------------------------------------- shared crown
// IGI's cushion crown pattern (top-right quadrant, positions in half-widths):
//   G90 girdle top midpoint; A junction of the top bezel, two upper girdle facets, the corner facet
//   and the top star; B1, B2, B3 girdle contacts; C table vertex on the axis; D table corner; K
//   junction of the corner facet, side star and two upper girdle facets; E table vertex on the side.
// Facets: table; top bezel kite G90-A-C-A'; side bezel kite G0-K-E-K'; stars (C, A, D) and (D, K, E)
// on the table edges; corner facet (A, B2, K, D); upper girdle facets (G90, B1, A), (A, B1, B2),
// (K, B2, B3) and (K, B3, G0). Two-fold: 1 + 2 + 2 + 4 x 7 = 37 facets. Four-fold (the diagonal
// mirror supplies the side classes): 1 + 4 + 8 + 4 + 8 + 8 = 33.
function buildCrown({ add, verts, H, fold, sc }, P) {
  const Gt = lift(vertexNear(verts, 90), 0), G0 = lift(vertexNear(verts, 0), 0);
  const C = [0, sc(P.C)[1], H], D = [...sc(P.D), H], E = [P.E[0], 0, H];
  const girdlePt = (p) => lift(vertexNear(verts, azOf(sc(p))), 0);
  const B1 = girdlePt(P.B1), B2 = girdlePt(P.B2);
  // bezels: tangent to the girdle at the axis contact, reaching the table at C (top) and E (side)
  const topBezel = add('A top', planeThrough(deg(Math.atan2(H, Gt[1] - C[1])), 90, Gt));
  let A, corner;
  if (fold === 4) {
    // corner facet symmetric about the diagonal: through B2 and the table corner D, both on it
    corner = planeThrough(deg(Math.atan2(H, Math.hypot(...B2) - Math.hypot(D[0], D[1]))), 45, B2);
    A = intersect3(topBezel, corner, yPlane(sc(P.A)[1]));
  } else {
    A = pointOn(topBezel, ...sc(P.A));
    corner = plane3(A, B2, D, true);
  }
  add('UG top', plane3(Gt, B1, A, true));
  add('UG corner-top', plane3(A, B1, B2, true));
  add('corner', corner);
  add('star top', plane3(C, A, D, true));
  if (fold === 4) return { A, C, D };
  const B3 = girdlePt(P.B3);
  const sideBezel = add('A side', planeThrough(deg(Math.atan2(H, G0[0] - E[0])), 0, G0));
  const K = intersect3(corner, sideBezel, yPlane(sc(P.K)[1]));
  add('star side', plane3(D, K, E, true));
  add('UG corner-side', plane3(K, B2, B3, true));
  add('UG side', plane3(K, B3, G0, true));
  return { A, C, D, K, E };
}

// --------------------------------------------------------------------------- pavilions
// Facets that run along the girdle over an arc (mains and ring facets) are planes tangent to the
// girdle polygon at the vertex in the middle of their arc, azimuth = the outline normal there, at
// the design's ring angle; the facets meeting them do so on their edges, at the plot's plan
// positions, so the girdle is thicker by the arc's sagitta times the slope at those junctions
// instead of being cut to nothing in the middle of the arc. Only the corner mains, which touch the
// girdle at one point, use a girdle vertex directly.
const girdleMid = (ctx, p, q) => { const v = vertexNear(ctx.verts, (azOf(ctx.sc(p)) + azOf(ctx.sc(q))) / 2); return { v, p: lift(v, -ctx.g), az: ctx.outline.normalAz(v.az) }; };

/**
 * Fan pavilion (IGI sample plot): two hubs on each axis near the culet; from the hub on the y axis
 * a fan of three facets reaches the girdle between the axis main and the corner, the corner main
 * is a quad through the culet, and the x-axis hub carries a fan of three more. 32 facets.
 */
function pavilionFans(ctx, Q) {
  const { add, verts, g, zc, outline, sc, ringAngle, sideAngle } = ctx;
  const Gt = lift(vertexNear(verts, 90), -g), G0 = lift(vertexNear(verts, 0), -g);
  const b2v = vertexNear(verts, azOf(sc(Q.B2))), B2 = lift(b2v, -g);
  // top main: tangent at the girdle top midpoint; T, V1 and the fan contact B1 on it
  const top = add('P top', planeThrough(-ringAngle, 90, Gt));
  const T = pointOn(top, ...sc(Q.T)), V1 = pointOn(top, ...sc(Q.V1)), B1 = pointOn(top, ...sc(Q.B1));
  // corner main: through the culet and the girdle contact B2, azimuth = outline normal at B2;
  // both hubs lie on it
  const cornerMain = add('P corner', mainThrough(outline.normalAz(b2v.az), B2, zc));
  const H1 = pointOn(cornerMain, ...sc(Q.H1)), H2 = pointOn(cornerMain, ...sc(Q.H2));
  add('F top-a', plane3(T, V1, H1, false));
  add('F top-b', plane3(V1, B1, H1, false));
  add('F top-c', plane3(B1, B2, H1, false));
  // side main: tangent at the girdle side midpoint; S, V2 and the fan contact B3 on it
  const side = add('P side', planeThrough(-sideAngle, 0, G0));
  const S = pointOn(side, ...sc(Q.S)), V2 = pointOn(side, ...sc(Q.V2)), B3 = pointOn(side, ...sc(Q.B3));
  add('F side-a', plane3(B2, B3, H2, false));
  add('F side-b', plane3(B3, V2, H2, false));
  add('F side-c', plane3(V2, S, H2, false));
  return { H1, H2, T, S };
}

/**
 * Ring-and-chevron pavilion (FDR743505846): an outer ring of eight facets along the girdle (top,
 * corner, side), inside it hubs on each axis with chevrons to the ring and a quad corner main
 * through the culet. 28 facets.
 */
function pavilionRing(ctx, Q) {
  const { add, verts, g, zc, outline, sc, ringAngle } = ctx;
  const Gt = lift(vertexNear(verts, 90), -g), G0 = lift(vertexNear(verts, 0), -g);
  // ring: top facet tangent at the girdle top; corner facet tangent in the middle of its arc
  // G1-G2 and through Q1 (on the top facet)
  const top = add('R top', planeThrough(-ringAngle, 90, Gt));
  const T = pointOn(top, ...sc(Q.T)), Q1 = pointOn(top, ...sc(Q.Q1));
  const m12 = girdleMid(ctx, Q.G1, Q.G2);
  const cornerRing = add('R corner', planeAz(m12.p, Q1, m12.az, false));
  const Q2 = pointOn(cornerRing, ...sc(Q.Q2));
  // side facet: azimuth 0 through the side midpoint and Q3 (on the corner facet); its angle follows
  const Q3 = pointOn(cornerRing, ...sc(Q.Q3));
  const side = add('R side', planeAz(G0, Q3, 0, false));
  const S = pointOn(side, ...sc(Q.S));
  // corner main through the culet and Q2, azimuth mainAz (the corner's outline normal unless the
  // variant turns it a little toward the x axis so the side chevron clears the culet); hubs on it
  const cornerMain = add('P corner', mainThrough(ctx.mainAz ?? outline.normalAz(azOf(sc(Q.Q2))), Q2, zc));
  const H1 = pointOn(cornerMain, ...sc(Q.H1)), H2 = pointOn(cornerMain, ...sc(Q.H2));
  const chevB = add('C top-b', plane3(Q1, Q2, H1, false));
  const V1 = intersect3(top, chevB, yPlane(sc(Q.V1)[1]));
  add('C top-a', plane3(T, V1, H1, false));
  const chevC = add('C side-b', plane3(Q2, Q3, H2, false));
  const V2 = intersect3(side, chevC, yPlane(sc(Q.V2)[1]));
  add('C side-a', plane3(V2, S, H2, false));
  return { H1, H2, T, S, Q1, Q2, Q3, V1, V2 };
}

/**
 * Dense crushed-ice pavilion (FDR631497388, the same template as FDR778608949): an outer ring of
 * twelve facets along the girdle (two per side, one per corner, the side ones split by a line from
 * the girdle midpoint), a second row of five facets per quadrant, and fans from two hubs per axis
 * reaching the culet through a quad corner main. 44 facets.
 */
function pavilionDense(ctx, Q) {
  const { add, verts, g, zc, outline, sc, ringAngle, sideAngle } = ctx;
  const Gt = lift(vertexNear(verts, 90), -g), G0 = lift(vertexNear(verts, 0), -g);
  // outer ring: (Gt, G1, Q1) tangent in the middle of the arc Gt-G1 at ringAngle, Q1 on it
  const mt1 = girdleMid(ctx, [0, 1], Q.G1);
  const topRing = add('R top', planeThrough(-ringAngle, mt1.az, mt1.p));
  const Q1 = pointOn(topRing, ...sc(Q.Q1));
  // second row on the axis: (Gt, Q1, V1, T, V1', Q1')
  const axisRow = add('R axis', plane3(Gt, Q1, [-Q1[0], Q1[1], Q1[2]], false));
  const V1 = pointOn(axisRow, ...sc(Q.V1)), T = pointOn(axisRow, ...sc(Q.T));
  // corner ring facet (Q1, G1, G2) and the second-row corner facet (Q1, G2, G3, Q3, M): tangent in
  // the middle of their arcs, through Q1
  const m12 = girdleMid(ctx, Q.G1, Q.G2), m23 = girdleMid(ctx, Q.G2, Q.G3);
  add('R corner', planeAz(m12.p, Q1, m12.az, false));
  const cornerRow = add('R corner-row', planeAz(m23.p, Q1, m23.az, false));
  const M = pointOn(cornerRow, ...sc(Q.M));
  // side ring (Q3, G3, G0, G3', Q3', S) tangent at the side midpoint at sideAngle; Q3 where it meets
  // the corner row, at the plot's height (the hubs sit so close to the culet that the fans need a
  // side ring steeper than one through the plot's Q3 would be)
  const side = add('R side', planeThrough(-sideAngle, 0, G0));
  const Q3 = intersect3(cornerRow, side, yPlane(sc(Q.Q3)[1]));
  const S = pointOn(side, ...sc(Q.S)), V2 = pointOn(side, ...sc(Q.V2));
  // corner main (M, H1, O, H2) through the culet; hubs on it
  const cornerMain = add('P corner', mainThrough(outline.normalAz(azOf(sc(Q.M))), M, zc));
  const H1 = pointOn(cornerMain, ...sc(Q.H1)), H2 = pointOn(cornerMain, ...sc(Q.H2));
  add('F top-a', plane3(T, V1, H1, false));
  add('F top-b', plane3(V1, Q1, H1, false));
  add('F top-c', plane3(Q1, M, H1, false));
  add('F side-a', plane3(M, Q3, H2, false));
  add('F side-b', plane3(Q3, V2, H2, false));
  add('F side-c', plane3(V2, S, H2, false));
  return { H1, H2, T, S, Q1, Q3, M, V2 };
}

/**
 * Sparse pavilion with a square culet facet (FDR715558200, four-fold): four axis facets from the
 * girdle midpoints to the culet square, a kite corner main from the square's corner to the girdle
 * corner, and two triangles between them on each side of the corner. 25 facets.
 */
function pavilionSquareCulet(ctx, Q) {
  const { add, tiers, verts, g, zc, sc } = ctx;
  const Gt = lift(vertexNear(verts, 90), -g);
  const B2 = lift(vertexNear(verts, 45), -g);
  const c = Q.Kc;   // half-side of the culet square
  // flat culet: one facet, written at -0.001 degrees because the model treats angle 0 as a table
  tiers.push(newTier({ name: 'culet', angle: -0.001, distance: -zc, indices: [0] }));
  const axisFacet = add('P axis', planeThrough(-deg(Math.atan2(-g - zc, Gt[1] - c)), 90, Gt));
  // kite corner main symmetric about the diagonal, through the girdle corner and the square's corner
  const kite = add('P corner', planeThrough(-deg(Math.atan2(-g - zc, Math.hypot(B2[0], B2[1]) - Math.hypot(c, c))), 45, B2));
  const J = intersect3(axisFacet, kite, xPlane(sc(Q.J)[0]));
  // lower facets (Gt, B1, J) and (J, B1, B2): tangent in the middle of their girdle arcs, through J
  const m01 = girdleMid(ctx, [0, 1], Q.B1), m12 = girdleMid(ctx, Q.B1, Q.B2);
  add('L axis', planeAz(m01.p, J, m01.az, false));
  add('L corner', planeAz(m12.p, J, m12.az, false));
  return { J };
}

// --------------------------------------------------------------------------- variants
const VARIANTS = {
  cushionMod1: {
    name: 'Square cushion modified brilliant, fan pavilion (IGI sample plot)',
    note: 'IGI\'s square cushion modified template as on the lab\'s 4 ct sample report: two-fold crown, pavilion of fans from two hubs on each axis. Traced from the plot; typical angles.',
    report: 'the IGI sample square cushion modified brilliant report (4 ct)', plot: 'cushionmod-1', fold: 2, r: 0.63,
    crown: { A: [0.439, 0.790], B1: [0.516, 0.961], B2: [0.764, 0.871], B3: [0.927, 0.585], C: [0, 0.657], D: [0.499, 0.563], K: [0.764, 0.533], E: [0.589, 0] },
    pavilion: { B1: [0.476, 0.960], B2: [0.794, 0.866], B3: [0.949, 0.572], T: [0, 0.745], V1: [0.185, 0.806], H1: [0, 0.255], H2: [0.311, 0], V2: [0.743, 0.234], S: [0.653, 0] },
    build: pavilionFans, pavilionDepth: 0.47, ringAngle: 50, sideAngle: 52,
    pattern: 'crown: table, 4 bezels (kites on the axes), 8 stars, 4 corner facets, 16 upper girdle facets (33); pavilion: 2 top mains and 2 side mains along the girdle, 4 quad corner mains meeting at the culet, 24 fan facets from the four hubs (32).',
  },
  cushionMod2: {
    name: 'Square cushion modified brilliant, ring and chevron pavilion (IGI FDR743505846)',
    note: 'Pavilion with an outer ring of eight facets along the girdle and chevrons from hubs on each axis, as on IGI report FDR743505846. Traced from the plot; typical angles.',
    report: 'IGI report FDR743505846', plot: 'cushionmod-2', fold: 2, r: 0.58,
    crown: { A: [0.484, 0.778], B1: [0.550, 0.964], B2: [0.816, 0.817], B3: [0.959, 0.611], C: [0, 0.637], D: [0.460, 0.581], K: [0.685, 0.536], E: [0.531, 0] },
    pavilion: { G1: [0.520, 0.990], G2: [0.953, 0.621], T: [0, 0.619], V1: [0.255, 0.723], Q1: [0.493, 0.825], Q2: [0.652, 0.649], Q3: [0.769, 0.545], H1: [0, 0.272], H2: [0.273, 0], V2: [0.693, 0.290], S: [0.620, 0] },
    build: pavilionRing, pavilionDepth: 0.47, ringAngle: 52, mainAz: 52,
    pattern: 'crown: table, 4 bezels, 8 stars, 4 corner facets, 16 upper girdle facets (33); pavilion: ring of 8 facets along the girdle (2 top, 2 side, 4 corner), 4 quad corner mains meeting at the culet, 16 chevron facets from the four hubs (28).',
  },
  cushionMod3: {
    name: 'Square cushion modified brilliant, dense crushed-ice pavilion (IGI FDR631497388)',
    note: 'Dense crushed-ice pavilion: outer ring of twelve facets, a second row, and fans from two hubs per axis, as on IGI reports FDR631497388 and FDR778608949 (the same template). Traced from the plot; typical angles.',
    report: 'IGI report FDR631497388 (FDR778608949 carries the same template)', plot: 'cushionmod-3', fold: 2, r: 0.63,
    crown: { A: [0.435, 0.796], B1: [0.493, 0.969], B2: [0.773, 0.866], B3: [0.934, 0.565], C: [0, 0.672], D: [0.497, 0.565], K: [0.748, 0.536], E: [0.596, 0] },
    pavilion: { G1: [0.519, 0.962], G2: [0.765, 0.864], G3: [0.899, 0.657], T: [0, 0.691], V1: [0.171, 0.733], Q1: [0.412, 0.806], M: [0.486, 0.567], Q3: [0.753, 0.531], H1: [0, 0.165], H2: [0.154, 0], V2: [0.662, 0.231], S: [0.612, 0] },
    build: pavilionDense, pavilionDepth: 0.50, ringAngle: 63, ringPerRatio: -40, sideAngle: 48,
    deviation: 'The plot puts the hubs 0.16 of the half-width from the culet, which forces fans steeper than the ring facets unless the ring is very steep (63 degrees here) and the side ring is set at 48 degrees; the junction of the corner row and the side ring then falls at 0.81 of the half-width instead of the plot\'s 0.75.',
    pattern: 'crown: table, 4 bezels, 8 stars, 4 corner facets, 16 upper girdle facets (33); pavilion: outer ring of 12 facets along the girdle, second row of 2 axis facets, 4 corner-row facets and 2 side facets, 4 quad corner mains meeting at the culet, 24 fan facets from the four hubs (44).',
  },
  cushionMod4: {
    name: 'Square cushion modified brilliant, square culet, sparse pavilion (IGI FDR715558200)',
    note: 'Four-fold variant with a small square culet facet and a sparse pavilion of 25 facets, as on IGI report FDR715558200. Traced from the plot; typical angles.',
    report: 'IGI report FDR715558200', plot: 'cushionmod-4', fold: 4, r: 0.67,
    crown: { A: [0.48, 0.64], B1: [0.655, 0.905], B2: [0.80, 0.80], C: [0, 0.531], D: [0.474, 0.474], E: [0.531, 0] },
    pavilion: { J: [0.37, 0.49], B1: [0.665, 0.90], B2: [0.80, 0.80], Kc: 0.093 },
    build: pavilionSquareCulet, pavilionDepth: 0.47,
    deviation: 'With the kite corner mains and the axis facets both reaching the culet square exactly, their ridge leaves the square\'s corner at a fixed direction, so the junction J sits at (0.36, 0.60) instead of the plot\'s (0.36, 0.50).',
    pattern: 'crown: table (octagon), 4 bezels, 8 stars, 4 corner facets, 16 upper girdle facets (33); pavilion: square culet facet, 4 axis facets, 4 kite corner mains, 16 lower facets (25).',
  },
};

/** Square cushion modified brilliant of one plot variant. */
export function cushionModified({ variant = 'cushionMod1', ratio = 1, crownHeight = 0.125, girdle = 0.035, pavilionDepth, gear = 96, girdleFacets = 128, ringAngle, sideAngle, mainAz } = {}) {
  const V = VARIANTS[variant];
  // the dense pavilion's feasible ring angle narrows with the L:W (63 at 1.00, 61 at 1.05)
  // (plain `if`s rather than `??=` so the module parses in browsers without logical assignment)
  if (pavilionDepth == null) pavilionDepth = V.pavilionDepth;
  if (ringAngle == null) ringAngle = V.ringAngle + (V.ringPerRatio || 0) * (ratio - 1);
  if (sideAngle == null) sideAngle = V.sideAngle != null ? V.sideAngle : ringAngle;
  if (mainAz == null) mainAz = V.mainAz;
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W, zc = -g - Pd;
  const outline = bowedCushionOutline(ratio, V.r, BOW, BOW);   // slight bow on the sides so the girdle has no flats
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 0);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const add = (name, plane) => { tiers.push(classTier(name, plane, gear, V.fold, true)); return plane; };
  const sc = ([x, y]) => [x, y * l];   // plot positions (square plot) stretched to the L:W
  const ctx = { add, tiers, verts, outline, H, g, zc, gear, fold: V.fold, sc, ringAngle, sideAngle, mainAz };
  buildCrown(ctx, V.crown);
  V.build(ctx, V.pavilion);

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const tableAcross = V.crown.E[0], tableAlong = V.crown.C[1];
  return {
    name: V.name, gear, fold: V.fold, mirror: true, ri: 2.42,
    headings: [V.name, `L:W ${ratio}, crown height ${pct(crownHeight)}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}`],
    footnotes: [`Traced from ${V.report}: facet pattern and meet points from the plot, angles typical. Trace against the plot underlay and cut meet points.`],
    notes: [
      `Ideal dimensions: none published as a complete parameter set. ${NO_GIA}`,
      IGI_RANGES,
      `This design: L:W ${ratio}, total depth ${pct(crownHeight + girdle + pavilionDepth)}, table ${pct(tableAcross)} of the width across the sides${V.fold === 2 ? ` (${pct(tableAlong)} along the other axis: IGI's template is two-fold)` : ''}, crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, culet ${V.pavilion.Kc ? `square facet ${pct(V.pavilion.Kc)} of the width` : 'pointed'}. Bezel angles follow from the crown height and the table: ${Math.round(deg(Math.atan2(H, 1 - tableAlong)))} degrees on the axis.`,
      `Reproduces ${V.report}. Plot pattern: ${V.pattern}`,
      `Outline: square of half-side ${Math.round((1 - V.r) * 100) / 100} plus corner radius ${V.r} (half-widths), fitted to the plot. ${V.fold === 4 ? 'Four-fold symmetry (fold 4 + mirror).' : 'Two-fold symmetry (fold 2 + mirror): IGI draws the cushion template with the table and the pavilion fans longer along one axis.'}`,
      'Corner mains touch the girdle at the plot contact (a girdle polygon vertex) with the outline normal as azimuth; facets running along the girdle are tangent to it in the middle of their arc and the facets meeting them do so on their edges, so the girdle is thicker at those junctions. Other facets pass through the measured meet points.' + (V.deviation ? ' ' + V.deviation : ''),
    ],
    tiers,
  };
}

export const templates = Object.fromEntries(Object.entries(VARIANTS).map(([key, V]) => [key, {
  name: V.name, note: V.note,
  params: [
    { key: 'ratio', label: 'L:W', default: 1, step: 0.01, min: 1, max: 1.1, title: 'Square cushion: 1.00 to 1.05 per IGI' },
    { key: 'crownHeight', label: 'Crown height', default: 0.125, step: 0.005, title: 'Fraction of the width' },
    { key: 'girdle', label: 'Girdle', default: 0.035, step: 0.005 },
    { key: 'pavilionDepth', label: 'Pavilion depth', default: key === 'cushionMod3' ? 0.50 : 0.47, step: 0.005 },
  ],
  make: (o = {}) => cushionModified({ variant: key, ...o }),
}]));

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'cushionmod-1-crown', label: 'Square cushion modified: crown, fan pavilion template (IGI sample)' },
  { id: 'cushionmod-1-pavilion', label: 'Square cushion modified: pavilion, fans (IGI sample)' },
  { id: 'cushionmod-2-crown', label: 'Square cushion modified: crown, ring and chevron template (IGI FDR743505846)' },
  { id: 'cushionmod-2-pavilion', label: 'Square cushion modified: pavilion, ring and chevrons (IGI FDR743505846)' },
  { id: 'cushionmod-3-crown', label: 'Square cushion modified: crown, dense crushed-ice template (IGI FDR631497388)' },
  { id: 'cushionmod-3-pavilion', label: 'Square cushion modified: pavilion, dense crushed ice (IGI FDR631497388)' },
  { id: 'cushionmod-4-crown', label: 'Square cushion modified: crown, square culet template (IGI FDR715558200)' },
  { id: 'cushionmod-4-pavilion', label: 'Square cushion modified: pavilion, square culet, sparse (IGI FDR715558200)' },
];
