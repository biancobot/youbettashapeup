// Trillion (triangular brilliant) starting design, pattern of the reference drawing
// (loosegrowndiamond.com "History of Trillion Cut Diamond": top view and bottom view).
// Built the way ../fancy.js builds the marquise: the girdle is a convex polygon, every other facet
// is a plane through measured meet points, and one representative facet per symmetry class is
// expanded by fold 3 + mirror (6 faces per class, 3 for classes on a mirror line).
//
// Measured on the drawing (crown view 255 x 220 px, an equilateral triangle, apex up; the sides
// bow outward, each drawn as three girdle segments with a sagitta of about 4% of the chord):
//   table    an equilateral triangle, corners at 56% of the corner radius (same orientation)
//   M        the hub of each side, on the side's bisector at 80% of the apothem to the bowed
//            girdle; six triangles meet there: one break facet per girdle segment (three), one
//            corner-side triangle to each table corner, and one star triangle on the table edge.
//            The two corner-side triangles at a corner mirror each other about the corner's
//            bisector, which runs through the table corner.
//   pavilion seen from below: the culet is at the centroid; V, the hub of each side, lies on
//            the side's bisector at 43% of the apothem; from each corner three lines leave: to
//            V of each adjacent side and to the culet. So per side: three break facets (one per
//            girdle segment, apex V) and two mains (corner, V, culet). The pavilion has 15 facets.
// Crown 18 facets + table, pavilion 15, girdle 9: 43 facets.
// The drawing gives no heights: crown height, girdle, pavilion depth and the heights of the two
// hubs are this design's parameters.
import { newTier } from '../design.js?v=101';
import { deg, girdleFromPolygon, plane3, classTier } from '../shapebuild.js?v=101';

const R = 2 / Math.sqrt(3);   // corner radius of an equilateral triangle of width 2

/**
 * Outline vertices (counter-clockwise, apex at +y): corners at azimuths 90, 210, 330, each side a
 * circular arc of `bow` x chord sagitta split into `segments` girdle facets, equal or at the given
 * `fractions` of the arc (segments = fractions.length + 1).
 */
export function trillionOutline(bow = 0.05, segments = 3, fractions = null) {
  const fr = fractions || [...Array(Math.max(0, segments - 1))].map((_, k) => (k + 1) / segments);
  const corners = [90, 210, 330].map((a) => [R * Math.cos((a * Math.PI) / 180), R * Math.sin((a * Math.PI) / 180)]);
  const pts = [];
  for (let s = 0; s < 3; s++) {
    const p = corners[s], q = corners[(s + 1) % 3];
    const chord = Math.hypot(q[0] - p[0], q[1] - p[1]), sag = bow * chord;
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const out = [mid[0] / Math.hypot(mid[0], mid[1]), mid[1] / Math.hypot(mid[0], mid[1])];   // outward normal of the side (away from the centroid)
    pts.push(p);
    if (sag > 1e-9 && segments > 1) {
      const rad = (chord * chord / 4 + sag * sag) / (2 * sag);          // arc radius
      const centre = [mid[0] - out[0] * (rad - sag), mid[1] - out[1] * (rad - sag)];   // arc centre inside, so the arc bulges outward
      const a0 = Math.atan2(p[1] - centre[1], p[0] - centre[0]), a1 = Math.atan2(q[1] - centre[1], q[0] - centre[0]);
      let da = a1 - a0; while (da <= 0) da += 2 * Math.PI; while (da > 2 * Math.PI) da -= 2 * Math.PI;
      if (da > Math.PI) da -= 2 * Math.PI;   // the short way round
      for (const f of fr) { const a = a0 + da * f; pts.push([centre[0] + rad * Math.cos(a), centre[1] + rad * Math.sin(a)]); }
    } else if (segments > 1) {
      for (const f of fr) pts.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
    }
  }
  return pts;
}

/**
 * Trillion starting point. crownHeight, girdle, pavilionDepth: fractions of the width (the
 * length of a side). table: table corner radius as a fraction of the corner radius. bow: sagitta
 * of each side as a fraction of its chord (0 = straight sides). segments: girdle facets per side.
 * starPos / starHeight: the crown hub M, fraction of the apothem (centroid to the bowed girdle
 * middle) and of the crown height. breakPos / breakDepth: the pavilion hub V, fraction of the
 * apothem and of the pavilion depth.
 */
export function trillionStart({
  crownHeight = 0.09, girdle = 0.03, pavilionDepth = 0.28, table = 0.56, bow = 0.04, segments = 3,
  starPos = 0.8, starHeight = 0.6, breakPos = 0.43, breakDepth = 0.65, gear = 96,
} = {}) {
  const W = 2, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const fold = 3;
  const poly = trillionOutline(bow, segments);
  const tiers = [girdleFromPolygon(poly, gear), newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, fold, true)); return plane; };

  // the bottom side (outward normal at azimuth 270, symmetric about the y axis): corners BL, BR
  // and the girdle sub-vertices between them in the polygon (which starts at the apex)
  const side = poly.slice(segments, 2 * segments + 1);   // BL ... BR, counter-clockwise (from left to right along the bottom)
  const BL = side[0], BR = side[side.length - 1];
  const apothem = R / 2 + bow * 2;   // centroid to the middle of the bowed side (chord = width = 2)
  const Tl = [table * BL[0], table * BL[1], H], Tr = [table * BR[0], table * BR[1], H];

  // ---- crown: hub M on the bisector of the side
  const M = [0, -starPos * apothem, starHeight * H];
  const at = (p, z) => [p[0], p[1], z];
  const breaks = [];
  // one class per girdle segment of the left half (the mirror supplies the right half; the middle segment of an odd count is its own mirror image)
  const half = Math.ceil(segments / 2);
  for (let k = 0; k < half; k++) breaks.push(addClass(`B${segments > 1 ? k + 1 : ''} break`, plane3(at(side[k], 0), at(side[k + 1], 0), M, true)));
  const cornerSide = addClass('A corner', plane3(at(BL, 0), Tl, M, true));
  const star = addClass('C star', plane3(Tl, Tr, M, true));

  // ---- pavilion: hub V on the bisector, culet at the centroid
  const culet = [0, 0, -g - Pd];
  const V = [0, -breakPos * apothem, -g - breakDepth * Pd];
  const pBreaks = [];
  for (let k = 0; k < half; k++) pBreaks.push(addClass(`L${segments > 1 ? k + 1 : ''} break`, plane3(at(side[k], -g), at(side[k + 1], -g), V, false)));
  const main = addClass('P main', plane3(at(BL, -g), V, culet, false));

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const ang = (pl) => Math.round(deg(Math.atan2(Math.hypot(pl.n[0], pl.n[1]), Math.abs(pl.n[2]))) * 10) / 10;
  const total = crownHeight + girdle + pavilionDepth;
  const uniq = (a) => [...new Set(a)];
  return {
    name: 'Trillion (starting point)', gear, fold, mirror: true, ri: 2.42, tableSides: 3,
    headings: ['Trillion starting point', `crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(total)}, sides bowed ${pct(bow)}`],
    footnotes: ['Starting point: pattern of the reference drawing with chosen heights. Trace against the drawing underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to trillion (triangular brilliant) diamonds and IGI\'s fancy-shape cut guidelines do not cover the shape. Trade practice: equilateral outline (L:W about 1.00 measured corner to opposite side, i.e. 0.87 as length over width), total depth 32-44% of the width for a brilliant trillion with bowed sides, table 50-70%, thin to medium girdle, no culet.',
      `This design: width (side) 100%, length (corner to opposite side) ${pct((1.5 * R + bow * 2) / 2)}, sides bowed ${pct(bow)} of the chord, ${segments} girdle facets per side, crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(total)}. Table ${pct(table)} of the corner radius. Crown: break facets ${uniq(breaks.map(ang)).join('/')}, corner-side triangles ${ang(cornerSide)}, star triangles ${ang(star)}, crown hub at ${pct(starPos)} of the apothem and ${pct(starHeight)} of the crown height. Pavilion: break facets ${uniq(pBreaks.map(ang)).join('/')}, mains ${ang(main)}, pavilion hub at ${pct(breakPos)} of the apothem and ${pct(breakDepth)} of the pavilion depth.`,
      `Plot pattern (reference drawing): crown ${3 * (segments + 3) + 1} facets: triangular table (corners at 56% of the corner radius), and on each side six triangles meeting at a hub on the side's bisector: one break facet per girdle segment, two corner-side triangles (one from each corner to its table corner) and one star triangle on the table edge. Pavilion ${3 * (segments + 2)} facets: per side one break facet per girdle segment meeting at a hub on the bisector, and two mains from the hub to the culet at the centroid; the corners each send a line to the hubs of both adjacent sides and to the culet. ${3 * segments} girdle facets. ${3 * (segments + 3) + 1 + 3 * (segments + 2) + 3 * segments} facets in all.`,
      'Only plan positions can be read off the drawing. Heights are this design\'s choice: the crown hub height (star height) sets the break facet angle, the pavilion hub depth sets the pavilion break facet angle; the mains follow from the pavilion depth. With bowed sides the crown hub must sit above about 55% of the crown height, or the break facets beside each corner come out flatter than the corner-side triangles and clip the table\'s corners (the three stars then no longer meet there).',
    ],
    tiers,
  };
}

/**
 * Brilliant-style trillion, the pattern of a common trilliant drawing (crown view): the sides bow
 * out and the girdle has a vertex close to each corner, so the corner is a short girdle facet.
 * Crown, per side (mirror about the side's bisector, fold 3): a hub V beside each corner (hubAcross
 * from the bisector, hubPos of the apothem out, hubHeight up) carrying the corner triangle
 * (corner, T, V) to the table corner T, the corner break facet on the short corner girdle facet
 * (corner, K, V) and the side break facet (K, middle, V); a triangle (V, middle, V') on the side
 * between the two hubs; and one star facet along the whole table edge (T, T', V', V). The two corner
 * triangles at a corner (one from each side) meet along corner-T and touch the girdle only at the
 * corner. 3 x (2 + 2 + 2 + 1 + 1) + 1 = 25 crown facets. Two things in the drawing cannot be cut:
 * its corner triangles sit on the corner girdle facets that the break facets also need, so the
 * hub's corner triangle stands in for them, and its star is drawn as two facets meeting under the
 * table edge's middle, but any plane through a table edge is symmetric about the side's bisector,
 * so the star is one facet.
 * Pavilion as the trillion: per side, one break facet per girdle segment meeting at a hub on the
 * bisector and two mains from the hub to the culet. 12 girdle facets.
 */
export function trillionBrilliant({
  crownHeight = 0.1, girdle = 0.03, pavilionDepth = 0.3, table = 0.66, bow = 0.05, cornerCut = 0.15,
  hubAcross = 0.69, hubPos = 0.8, hubHeight = 0.5, breakPos = 0.43, breakDepth = 0.65, gear = 96,
} = {}) {
  const W = 2, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const fold = 3, segments = 4;
  const poly = trillionOutline(bow, segments, [cornerCut, 0.5, 1 - cornerCut]);
  const tiers = [girdleFromPolygon(poly, gear), newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, fold, true)); return plane; };
  const at = (p, z) => [p[0], p[1], z];
  // the bottom side: BL, K1 (near BL), Bm (middle), K2, BR
  const side = poly.slice(segments, 2 * segments + 1);
  const [BL, K1, Bm, K2, BR] = side;
  const apothem = R / 2 + bow * 2;
  const Tl = [table * BL[0], table * BL[1], H], Tr = [table * BR[0], table * BR[1], H];
  // ---- crown
  const V = [-hubAcross, -hubPos * apothem, hubHeight * H], Vr = [hubAcross, V[1], V[2]];
  addClass('C corner', plane3(at(BL, 0), Tl, V, true));             // corner triangle: the corner, the table corner and the hub (its twin at the corner comes from the next side; they meet along corner-T and touch the girdle only at the corner)
  addClass('B corner', plane3(at(BL, 0), at(K1, 0), V, true));      // break facet on the girdle segment beside the corner
  addClass('B side', plane3(at(K1, 0), at(Bm, 0), V, true));        // break facet on the segment to the side's middle
  addClass('C side', plane3(V, at(Bm, 0), Vr, true));              // triangle on the side between the hubs, apex at the girdle middle
  addClass('C star', plane3(Tl, Tr, V, true));                      // star along the whole table edge, down to the two hubs
  // ---- pavilion: hub on the bisector, culet at the centroid, break facets per girdle segment, mains
  const culet = [0, 0, -g - Pd];
  const Vp = [0, -breakPos * apothem, -g - breakDepth * Pd];
  const pBreaks = [addClass('L1 break', plane3(at(BL, -g), at(K1, -g), Vp, false)), addClass('L2 break', plane3(at(K1, -g), at(Bm, -g), Vp, false))];
  const main = addClass('P main', plane3(at(BL, -g), Vp, culet, false));

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const ang = (pl) => Math.round(deg(Math.atan2(Math.hypot(pl.n[0], pl.n[1]), Math.abs(pl.n[2]))) * 10) / 10;
  const total = crownHeight + girdle + pavilionDepth;
  const uniq = (a) => [...new Set(a)];
  return {
    name: 'Trillion, brilliant (starting point)', gear, fold, mirror: true, ri: 2.42, tableSides: 3,
    headings: ['Brilliant trillion starting point', `crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(total)}, sides bowed ${pct(bow)}`],
    footnotes: ['Starting point: pattern of a common trilliant crown drawing with chosen heights; the pavilion follows the trillion reference drawing.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to trillion (triangular brilliant) diamonds and IGI\'s fancy-shape cut guidelines do not cover the shape. Trade practice: equilateral outline, total depth 32-44% of the width for a brilliant trillion with bowed sides, table 50-70%, thin to medium girdle, no culet.',
      `This design: width (side) 100%, sides bowed ${pct(bow)} of the chord with a girdle facet of ${pct(cornerCut)} of the side at each corner, crown height ${pct(crownHeight)}, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, total depth ${pct(total)}. Table ${pct(table)} of the corner radius. Crown: hub at ${pct(hubAcross)} of the half-width from the bisector, ${pct(hubPos)} of the apothem out and ${pct(hubHeight)} of the crown height. Pavilion: break facets ${uniq(pBreaks.map(ang)).join('/')}, mains ${ang(main)}, hub at ${pct(breakPos)} of the apothem and ${pct(breakDepth)} of the pavilion depth.`,
      'Plot pattern: crown 25 facets: triangular table; per side, from a hub beside each corner, a triangle to the corner and the table corner (its twin from the next side meets it along that line), a break facet on the short girdle facet beside the corner and one on the segment to the side\'s middle; a triangle between the two hubs with its apex at the girdle middle; and one star facet along the table edge. Pavilion 18 facets: per side four break facets meeting at a hub on the bisector and two mains to the culet. 12 girdle facets. 55 facets in all.',
    ],
    tiers,
  };
}

const params = (o) => [
  { key: 'bow', label: 'Side bow', default: o.bow, step: 0.01, min: 0, max: 0.15, title: 'Sagitta of each side, fraction of its chord (0 = straight sides)' },
  { key: 'segments', label: 'Girdle facets / side', default: o.segments, step: 1, min: 1, max: 12 },
  { key: 'table', label: 'Table', default: 0.56, step: 0.01, min: 0.3, max: 0.8, title: 'Table corner radius, fraction of the corner radius' },
  { key: 'crownHeight', label: 'Crown height', default: 0.09, step: 0.005, title: 'Fraction of the width' },
  { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
  { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.28, step: 0.005, title: 'Fraction of the width' },
  { key: 'starPos', label: 'Crown hub pos.', default: 0.8, step: 0.01, min: 0.3, max: 0.98, title: 'Crown hub on the side bisector, fraction of the apothem (centroid to the girdle middle)' },
  { key: 'starHeight', label: 'Crown hub height', default: o.starHeight, step: 0.05, min: 0.05, max: 0.95, title: 'Fraction of the crown height (above about 0.55 with bowed sides, or the corner break facets clip the table corners)' },
  { key: 'breakPos', label: 'Pavilion hub pos.', default: 0.43, step: 0.01, min: 0.1, max: 0.95, title: 'Pavilion hub on the side bisector, fraction of the apothem' },
  { key: 'breakDepth', label: 'Pavilion hub depth', default: 0.65, step: 0.05, min: 0.05, max: 0.95, title: 'Fraction of the pavilion depth' },
];
export const templates = {
  trillion: {
    name: 'Trillion (starting point)',
    note: 'Triangular brilliant from the reference drawing: sides bowed 4%, three girdle facets per side, six crown triangles and five pavilion facets per side. The L:W field is ignored (equilateral).',
    params: params({ bow: 0.04, segments: 3, starHeight: 0.6 }),
    make: ({ girdleFacets, ratio, ...o } = {}) => trillionStart(o),
  },
  trillionStraight: {
    name: 'Trillion, straight sides (starting point)',
    note: 'The same pattern on a straight-sided equilateral triangle with one girdle facet per side.',
    params: params({ bow: 0, segments: 1, starHeight: 0.5 }),
    make: ({ girdleFacets, ratio, ...o } = {}) => trillionStart({ bow: 0, segments: 1, starHeight: 0.5, ...o }),
  },
  trillionBrilliant: {
    name: 'Trillion, brilliant (starting point)',
    note: 'Brilliant-style trillion: bowed sides with a short girdle facet at each corner, a hub beside each corner carrying a corner triangle to the table corner and two break facets, a triangle between the hubs on each side and a star along each table edge. Pavilion as the trillion. The L:W field is ignored (equilateral).',
    params: [
      { key: 'bow', label: 'Side bow', default: 0.05, step: 0.01, min: 0, max: 0.15, title: 'Sagitta of each side, fraction of its chord' },
      { key: 'cornerCut', label: 'Corner facet', default: 0.15, step: 0.01, min: 0.05, max: 0.3, title: 'Length of the girdle facet at each corner, fraction of the side' },
      { key: 'table', label: 'Table', default: 0.66, step: 0.01, min: 0.3, max: 0.85, title: 'Table corner radius, fraction of the corner radius' },
      { key: 'crownHeight', label: 'Crown height', default: 0.1, step: 0.005, title: 'Fraction of the width' },
      { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
      { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.3, step: 0.005, title: 'Fraction of the width' },
      { key: 'hubAcross', label: 'Hub across', default: 0.69, step: 0.01, min: 0.3, max: 0.95, title: 'Crown hub beside each corner: distance from the side bisector, fraction of the half-width' },
      { key: 'hubPos', label: 'Hub pos.', default: 0.8, step: 0.01, min: 0.3, max: 0.98, title: 'Crown hub: fraction of the apothem from the centroid' },
      { key: 'hubHeight', label: 'Hub height', default: 0.5, step: 0.05, min: 0.05, max: 0.95, title: 'Crown hub, fraction of the crown height' },
      { key: 'breakPos', label: 'Pavilion hub pos.', default: 0.43, step: 0.01, min: 0.1, max: 0.95, title: 'Pavilion hub on the side bisector, fraction of the apothem' },
      { key: 'breakDepth', label: 'Pavilion hub depth', default: 0.65, step: 0.05, min: 0.05, max: 0.95, title: 'Fraction of the pavilion depth' },
    ],
    make: ({ girdleFacets, ratio, ...o } = {}) => trillionBrilliant(o),
  },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'trillion-crown', label: 'Trillion: crown (reference drawing)' },
  { id: 'trillion-pavilion', label: 'Trillion: pavilion (reference drawing)' },
];
