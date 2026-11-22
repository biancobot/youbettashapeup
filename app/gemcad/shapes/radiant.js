// Radiant: cut-cornered rectangular modified brilliant (IGI report label "Cut Cornered
// Rectangular Modified Brilliant"). Built the way ../fancy.js builds the marquise: the girdle is
// a polygon (a rectangle with cut corners, one girdle facet per edge), the crown and pavilion
// facets are planes through meet points measured on the IGI plotting template, or set by angle
// through a girdle edge. Two mirror lines: fold 2 + mirror, one representative facet per class in
// the top-right quadrant (x right, y up, half-width 1).
//
// Plot pattern (IGI report FDR719531732, crown view left, pavilion view right), top-right quadrant:
//   crown: table (octagon with a vertex on each axis), a break row of 8 facets along the girdle
//     (end, corner, side) whose inner edges form a second octagon, then a row of triangles: an
//     end star between the two inner corners and the table's end vertex, two triangles at each
//     corner (end-corner, corner), one at each side of the table's side vertex, and a side star
//     spanning the x axis (25 crown facets);
//   pavilion: an end facet along the end edge, a corner main along each corner edge running to a
//     hub on the long axis, a side facet along each side, and two rows of chevron-style facets
//     whose meet points lie on the main ridges: at the hub (chevron Q-Ct-N, end A1-Q-N, hub-culet
//     N-Cr-C) and at the culet (Cr-P-C, C-P-S1). 28 pavilion facets, 12 of them at the culet.
//   The other cut-cornered report (FDR704583095) adds an outer band of 8 lower girdle facets to
//   the pavilion; the plot used here is the simpler, cleaner one.
//
// Measured vertex positions (units of the half-width, stone centred; L = half-length = 1.434):
//   girdle: end edge y = L, ends at x = 0.617 (crown) / 0.615 (pavilion); side x = 1, from
//     y = 0.948 (crown) / 0.935 (pavilion). Corner cut 0.38 along the end, 0.49 along the side.
//   crown: Bt (inner octagon, end) (0.51, 1.178); Br (inner octagon, side) (0.82, 0.782);
//     Ta (table end vertex) (0, 0.99); Tb (table corner) (0.54, 0.792); Ts (table side) (0.68, 0).
//   pavilion: A1 (end facet tip, on the axis) (0, 0.866); Q (chevron tip) (0.29, 1.08);
//     N (hub, on the axis) (0, 0.30); P (0.731, 0.356); S1 (side junction, on the x axis) (0.673, 0);
//     culet at the centre.
// End-region positions are kept at their distance from the end when L:W changes; the hub and P
// keep their fraction of the half-length; x positions stay in half-width units.
import { newTier } from '../design.js';
import {
  girdleFromPolygon, planeThrough, mirrorY, zPlane, yPlane, xPlane, classTier, plane3, intersect3,
} from '../shapebuild.js';

const PLOT_L = 1.434;   // half-length of the plot the positions were measured on

/**
 * Radiant starting point: IGI plot pattern with typical proportions.
 * crownAngle: the end break facet (the row along the girdle); the corner and side break facets
 * follow from the inner octagon's measured position, so the side break is steeper (the stone is
 * narrow). endAngle / sideAngle: the pavilion end and side facets along the girdle; hubDepth: the
 * hub on the long axis as a fraction of the pavilion depth. The plot's chevron geometry (the
 * chevron through the end-edge corner, the chevron tip on the end facet and the hub) only closes
 * for a narrow window of these three: at pavilion depth 50%, end 40-46, side 46-52, hub 0.87-0.98
 * (checked by building and counting faces per class). girdleFacets is accepted and ignored: the
 * girdle is the polygon, one facet per edge.
 */
export function radiantStart({
  ratio = PLOT_L, cornerX = 0.38, cornerY = 0.49,
  crownHeight = 0.13, crownAngle = 35, girdle = 0.03, pavilionDepth = 0.50,
  endAngle = 43, sideAngle = 49, hubDepth = 0.92, gear = 96,
} = {}) {
  const W = 2, L = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const a = L - cornerY, b = 1 - cornerX;   // side end y, end edge end x
  // girdle octagon, counter-clockwise from the lower end of the right side
  const poly = [[1, -a], [1, a], [b, L], [-b, L], [-1, a], [-1, -a], [-b, -L], [b, -L]];
  const girdleTier = girdleFromPolygon(poly, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 2, true)); return plane; };
  const mx = (p) => [-p[0], p[1], p[2]], my = (p) => [p[0], -p[1], p[2]];
  const fromEnd = (d) => L - d;   // y of a point measured from the end of the plot

  // ---- crown: break row along the girdle (end facet by angle, corner and side through the
  // measured inner octagon corners Bt and Br), then the upper row through table vertices
  const Ct = [b, L, 0], Cr = [1, a, 0];
  const bandEnd = addClass('A end', planeThrough(crownAngle, 90, Ct));
  const Bt = intersect3(bandEnd, xPlane(0.51), yPlane(fromEnd(PLOT_L - 1.178)));
  const bandCorner = addClass('A corner', plane3(Ct, Cr, Bt, true));
  const Br = intersect3(bandCorner, xPlane(0.82), yPlane(fromEnd(PLOT_L - 0.782)));
  addClass('A side', plane3(Cr, my(Cr), Br, true));
  const Ta = [0, fromEnd(PLOT_L - 0.99), H], Tb = [0.54, fromEnd(PLOT_L - 0.792), H], Ts = [0.68, 0, H];
  addClass('C end', plane3(Bt, mx(Bt), Ta, true));
  addClass('C end-corner', plane3(Ta, Bt, Tb, true));
  addClass('C corner', plane3(Bt, Br, Tb, true));
  addClass('C corner-side', plane3(Tb, Br, Ts, true));
  addClass('C side', plane3(Br, my(Br), Ts, true));

  // ---- pavilion: end and side facets along the girdle by angle, corner mains through the hub,
  // chevron rows through the measured meet points on those planes
  const Ctg = [b, L, -g], Crg = [1, a, -g], culet = [0, 0, -g - Pd];
  const end = addClass('P end', planeThrough(-endAngle, 90, Ctg));
  const A1 = intersect3(end, xPlane(0), yPlane(fromEnd(PLOT_L - 0.866)));
  const Q = intersect3(end, xPlane(0.29), yPlane(fromEnd(PLOT_L - 1.08)));
  const N = [0, (0.30 / PLOT_L) * L, -g - hubDepth * Pd];
  addClass('P corner', plane3(Ctg, Crg, N, false));
  addClass('P hub', plane3(N, Crg, culet, false));
  addClass('L chevron', plane3(Q, Ctg, N, false));
  addClass('L end', plane3(A1, Q, N, false));
  const side = addClass('P side', planeThrough(-sideAngle, 0, Crg));
  const S1 = intersect3(side, yPlane(0), xPlane(0.673));
  const P = intersect3(side, xPlane(0.731), yPlane((0.356 / PLOT_L) * L));
  addClass('L corner-side', plane3(Crg, P, culet, false));
  addClass('L side', plane3(culet, P, S1, false));

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const angleOf = (name) => Math.round(Math.abs(tiers.find((t) => t.name === name).angle) * 10) / 10;
  const depth = crownHeight + girdle + pavilionDepth;
  return {
    name: 'Radiant (cut-cornered rectangular modified brilliant, starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Radiant, cut-cornered rectangular modified brilliant, starting point', `L:W ${ratio}, crown height ${pct(crownHeight)}, end break ${crownAngle}, pavilion depth ${pct(pavilionDepth)}`],
    footnotes: ['Starting point: IGI plot pattern with typical proportions. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to radiant diamonds.',
      'IGI Excellent ranges (cut cornered square modified brilliant; L:W 1.06 and above is considered rectangular): L:W 1.00-1.05, total depth 62-68%, table 62-67%, crown height 12-15%, girdle 2-6%, thin to thick, pavilion depth 47-56%, culet pointed, none, very small or small; final grade subject to visual confirmation.',
      `This design: L:W ${ratio}, corner cut ${cornerX} of the half-width along the ends and ${cornerY} along the sides (measured on the plot: 0.38 and 0.49), crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(depth)}, table ${pct(0.68)} of the width at the side vertices. End break facet ${crownAngle}, corner break ${angleOf('A corner')}, side break ${angleOf('A side')}; pavilion end ${endAngle}, corner mains ${angleOf('P corner')}, side ${sideAngle}, hub ${pct(hubDepth)} of the pavilion depth below the girdle. Angles are measured in each facet's own slope direction.`,
      'Plot pattern (IGI template, report FDR719531732, L:W 1.43): crown: table, 8 break facets along the girdle (2 ends, 4 corners, 2 sides) whose inner edges form a second octagon, 2 end stars, 8 corner triangles (2 per corner), 4 side triangles, 2 side stars; 25 crown facets. Pavilion: 2 end facets, 4 corner mains to a hub on the long axis, 2 side facets, one chevron row at the hubs (4 chevrons, 4 end triangles, 4 hub-culet facets) and one at the culet (8 facets); 28 pavilion facets, 12 meeting at the culet. The other IGI cut-cornered plot (FDR704583095) adds an outer band of 8 lower girdle facets.',
      'Measured on the plot (half-width units): hubs 0.30 from the centre on the long axis (21% of the half-length), end facet tips 0.57 from the ends, chevron tips at (0.29, 0.35 from the end), side junctions 0.67 from the centre on the short axis; crown inner octagon 0.26 inside the ends and 0.18 inside the sides, table end vertices 0.44 from the ends, table side vertices 0.68 from the centre.',
      'Facets touch the girdle along whole edges of the octagon; each break and girdle-row facet has the azimuth of its edge normal. Meet points inside are set by planes through three measured points.',
    ],
    tiers,
  };
}

export const templates = {
  radiant: {
    name: 'Radiant (cut-cornered rectangular modified brilliant, starting point)',
    note: 'IGI plot pattern (cut-cornered rectangle girdle, break row, chevron pavilion) with typical proportions; trace against the underlay and cut meet points.',
    make: ({ girdleFacets, ratio = PLOT_L } = {}) => radiantStart({ ratio }),   // girdleFacets: polygon girdle, ignored
  },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'radiant-crown', label: 'Radiant: crown (IGI)' },
  { id: 'radiant-pavilion', label: 'Radiant: pavilion (IGI)' },
];
