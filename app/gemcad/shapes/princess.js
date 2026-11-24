// Princess cut (square modified brilliant) starting design, pattern of the IGI plotting template.
// Built the way ../fancy.js builds the marquise: the girdle is a square polygon (half-width 1),
// every other facet is a plane through measured meet points, and one representative facet per
// symmetry class is expanded by fold 4 + mirror (8 faces per class, 4 for classes on an axis or
// a diagonal).
//
// Vertex positions were measured on the IGI report plot FDR719531797 (1055 x 530 px; crown view
// in the left half, pavilion view in the right half; outline 511.5 x 511.5 px, so L:W = 1.00).
// Lines were least-squares fitted to the dark pixels and intersected, in all four quadrants,
// then averaged into one 4-fold symmetric set. Units: the half-width; the quadrant below is
// x > 0, y > 0 (top right of the crown view).
//
//   crown  corner           (1, 1)            girdle corner
//          Tc  table corner (0.682, 0.682)    on the diagonal (measured 0.674-0.689)
//          K1  (0.697, 0.853) and K2 (0.853, 0.697)
//                                             where the kite's edge from the corner meets the
//                                             line parallel to the girdle (measured 0.686-0.709,
//                                             0.851-0.855)
//          X   (0, 0.766)                     apex of the table on the axis, where the two cross
//                                             lines meet (measured 0.762-0.769)
//          The kite is corner-K1-Tc-K2. Between two kites, from the girdle inward: one trapezoid
//          corner-corner'-K1'-K1 (its inner edge is the line parallel to the girdle), one
//          triangle K1-K1'-X pointing at the table, and two triangles K1-Tc-X and K1'-Tc'-X.
//          The table is the octagon through the four Tc and the four X.
//   pavilion (seen from below; the pattern is the same in every quadrant)
//          V1  (0, 0.616)  V2 (0, 0.479)  V3 (0, 0.324)  V4 (0, 0.150)
//                                             where the fan lines from the corner meet the axis
//                                             (per-quadrant spread 0.60-0.63, 0.45-0.51,
//                                             0.30-0.35, 0.13-0.16: the template is drawn a
//                                             little unevenly); the same points H1..H4 lie on
//                                             the other axis
//          Nine lines leave each corner: the two girdle edges, four to V1..V4 and four to
//          H1..H4; none runs along the diagonal. So the facets are: a triangle on each side
//          (corner, corner', V1) touching the whole girdle edge; three rows of chevron triangles
//          (corner, Vi, Vi+1); and at each corner a kite (corner, V4, culet, H4) whose far
//          vertex is the culet. The plot gives no heights, so the depths of V1..V3 on the ridge
//          are parameters (`ridge`); V4 is fixed by the corner kite through the culet.
import { newTier } from '../design.js?v=72';
import { deg, girdleFromPolygon, plane3, classTier } from '../shapebuild.js?v=72';

// measured plan positions (half-width units)
const TC = 0.682, KA = 0.697, KB = 0.853, XA = 0.766;
const V = [0.616, 0.479, 0.324, 0.150];

/**
 * Princess cut starting point.
 * crownHeight, girdle, pavilionDepth: fractions of the width (IGI Excellent: crown 8-14.5%,
 * girdle 2-6%, pavilion 54.5-62%, total depth 65-73%). ridge: depths of V1..V3 below the girdle
 * as fractions of the pavilion depth (the chevron ridge on the axis must be convex: slopes
 * decreasing toward the culet).
 */
export function princessStart({ crownHeight = 0.11, girdle = 0.03, pavilionDepth = 0.56, ridge = [0.52, 0.68, 0.81], gear = 96 } = {}) {
  const W = 2, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const fold = 4;
  const girdleTier = girdleFromPolygon([[1, -1], [1, 1], [-1, 1], [-1, -1]], gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, fold, true)); return plane; };

  // ---- crown. Corner kite: azimuth 45 through the girdle corner and the table corner; K1 and K2
  // lie on it (the plane is symmetric about the diagonal, so three points fix it).
  const C0 = [1, 1, 0], Tc = [TC, TC, H];
  const z1 = H * (1 - (KA + KB) / 2) / (1 - TC);        // height of K1 and K2 on the kite
  const K1 = [KA, KB, z1], K1m = [-KA, KB, z1], X = [0, XA, H];
  const kite = addClass('A corner', plane3(C0, Tc, K1, true));
  // side break facet: through the whole girdle edge and the line K1-K1'
  const brk = addClass('B side', plane3(C0, [-1, 1, 0], K1, true));
  // upper triangle: K1, K1' and the table apex X (azimuth 90)
  const up = addClass('C side', plane3(K1, K1m, X, true));
  // cross facets: K1, the table corner and the table apex (8 of them)
  const cross = addClass('D cross', plane3(K1, Tc, X, true));

  // ---- pavilion. Corner kite through the girdle corner and the culet (azimuth 45): V4 and H4 lie
  // on it, so their depth follows from the plan position: z4 = -g - Pd (1 - v4 / 2).
  const culet = [0, 0, -g - Pd];
  const Cg = [1, 1, -g], Cgm = [-1, 1, -g], G0 = [0, 1, -g];   // girdle corners and the mid-side point on the ridge
  const z4 = -g - Pd * (1 - V[3] / 2);
  const V4 = [0, V[3], z4];
  const main = addClass('P corner', plane3(Cg, culet, V4, false));
  const Vs = [[0, V[0], -g - ridge[0] * Pd], [0, V[1], -g - ridge[1] * Pd], [0, V[2], -g - ridge[2] * Pd], V4];
  // side main: the whole girdle edge and V1
  const side = addClass('P side', plane3(Cg, Cgm, Vs[0], false));
  // chevron rows: corner, Vi, Vi+1
  const chev = [0, 1, 2].map((i) => addClass(`L${i + 1} chevron`, plane3(Cg, Vs[i], Vs[i + 1], false)));

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const ang = (pl) => Math.round(deg(Math.atan2(Math.hypot(pl.n[0], pl.n[1]), Math.abs(pl.n[2]))) * 10) / 10;
  const slope = (p, q) => Math.round(deg(Math.atan2(Math.abs(p[2] - q[2]), Math.hypot(p[0] - q[0], p[1] - q[1]))) * 10) / 10;
  const total = crownHeight + girdle + pavilionDepth;
  return {
    name: 'Princess cut (starting point)', gear, fold, mirror: true, ri: 2.42,
    headings: ['Princess cut starting point', `crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(total)}`],
    footnotes: ['Starting point: lab plot pattern with typical proportions. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to princess diamonds.',
      'IGI Excellent ranges (princess cut, "square modified brilliant"): L:W 1.00-1.05 (1.06 and above is considered rectangular), total depth 65-73%, table 65-74%, crown height 8-14.5%, girdle 2-6% (thin to thick), pavilion depth 54.5-62%, culet pointed, none, very small or small, symmetry and polish very good or excellent. Additional requirements: the pavilion chevrons must be minimally visible face-up, and even and symmetrical. No crown or pavilion angle is specified.',
      `This design: L:W 1.00, crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(total)}. Table ${pct(TC)} across the flats (${pct(XA)} apex to apex: the table is an octagon whose side apexes stick out beyond its corners). Crown: corner kites ${ang(kite)}, side break facets ${ang(brk)}, upper side triangles ${ang(up)}, cross facets ${ang(cross)} (each in its own slope direction). Pavilion: corner mains ${ang(main)}, side mains ${ang(side)}, chevron rows ${chev.map(ang).join(', ')}; the chevron ridge on the axis slopes ${slope(G0, Vs[0])}, ${slope(Vs[0], Vs[1])}, ${slope(Vs[1], Vs[2])}, ${slope(Vs[2], Vs[3])} then ${slope(Vs[3], culet)} to the culet.`,
      'Plot pattern (IGI template): crown 21 facets: table (octagon, corners at 68% and side apexes at 77% of the half-width), 4 corner kites, and on each side a break facet along the girdle, a triangle pointing at the table apex and two cross triangles against the kites. Pavilion 32 facets: 4 corner mains (kites from the corners to the culet), 4 side mains (triangles on the whole girdle edge, apex on the axis at 62% of the half-width) and 3 rows of 8 chevron triangles fanning from the corners, their ridge points on the axes at 48%, 32% and 15% of the half-width. 4 girdle facets. 57 facets in all.',
      'Only plan positions can be read off the plot. Heights are this design\'s choice: the crown follows from the crown height alone (every crown vertex is on the table, the girdle or the corner kite); on the pavilion the depths of the three chevron ridge points are the `ridge` parameters.',
    ],
    tiers,
  };
}

export const templates = {
  princess: {
    name: 'Princess cut (starting point)',
    note: 'IGI plot pattern (square girdle, 4 corner kites, 3 chevron rows) with typical proportions; trace against the underlay and cut meet points. The girdle facet count and L:W fields are ignored (square outline).',
    params: [
      { key: 'crownHeight', label: 'Crown height', default: 0.11, step: 0.005, title: 'Fraction of the width' },
      { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
      { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.56, step: 0.005, title: 'Fraction of the width' },
      { key: 'ridge', label: 'Chevron depths', default: [0.52, 0.68, 0.81], list: true, title: 'Depth of the three chevron rows along the main ridges, fraction of the pavilion depth' },
    ],
    make: ({ girdleFacets, ratio, ...o } = {}) => princessStart(o),   // girdleFacets and ratio are accepted and ignored
  },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'princess-crown', label: 'Princess: crown (IGI)' },
  { id: 'princess-pavilion', label: 'Princess: pavilion (IGI)' },
];
