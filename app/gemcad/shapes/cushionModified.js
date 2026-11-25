// Square cushion modified brilliant: the facet pattern of a GIA plotting diagram for a square
// cushion modified brilliant (crushed-ice pavilion), eight-fold symmetric on a square outline.
// Built with ../shapebuild.js the way ../fancy.js builds the marquise: a facet that reaches the
// girdle does so at girdle polygon vertices (a kite touches it at one vertex with the outline
// normal as its azimuth, a lower or upper girdle facet runs through two), every other facet is a
// plane through its meet points, and each symmetry class is one tier.
//
// Conventions: half-width 1 (width 2, length 2 * ratio), table at z = H, girdle top z = 0, girdle
// bottom z = -g, culet at z = -g - Pd. Plan positions are measured on the plot in half-widths
// (x right, y up, origin at the stone's centre) and recorded beside each point. The plot is
// square and eight-fold symmetric; the design is built as fold 2 + mirror with the top (y axis)
// and side (x axis) classes both built, so an L:W above 1 stretches the pattern along the length.
//
// Outline: a square of half-side 1 - r (sides bowed out by 0.01 so the girdle has no flats) with
// quarter circles of radius r at the corners; the plot's flats end at 0.55 of the half-width, so
// r = 0.45. Girdle: 128 facets, with vertices at the axes, the flat ends and the corner arcs'
// midpoints (the contacts) and equal lengths between them.
//
// Crown (top-right quadrant): table octagon with vertices C (0, 0.66) on the axes and D
// (0.53, 0.53) at the corners; bezel kite G90-A-C-A' with A (0.46, 0.79) the junction of the
// bezel, two upper girdle facets, the corner facet and the star; upper girdle facets (G90, B1, A)
// along the flat and (A, B1, B2) along the corner arc, B1 the end of the flat and B2 the corner
// vertex on the diagonal; corner facet kite (A, B2, K, D), K the side's A; star (C, A, D).
// 1 + 4 + 8 + 4 + 16 = 33 facets.
//
// Pavilion (top-right octant, from the y axis to the diagonal): girdle kite G90-CR-CC-CL with
// CC (0, 0.71) on the axis and CR (0.42, 0.79); lower girdle facets (G90, B1, CR) along the flat
// and (B1, B2, CR) along the corner arc; corner kite (B2, CR, K, CR') with K (0.53, 0.53) on the
// diagonal; three fan facets from the hub T (0, 0.24): (T, CR, K), (T, M, CR) and (T, CC, M)
// with M (0.20, 0.72) on the girdle kite where its edge CC-CR bends; the main kite (T, culet, S, K)
// with S the side's hub. 4 + 8 + 8 + 4 + 8 + 8 + 8 + 4 = 52 facets, plus a square culet facet
// when one is set. The upper and lower girdle facets along the corner arcs would each cover 45
// degrees of a circle of radius 0.45 if they met the flat-side ones at the flat's end, and the
// arc's sagitta times their slopes would dig 3% of the width into the girdle, so the scallop
// would be large; the corner-arc facets are painted (cut flatter: upper 34, lower 48 degrees) and
// the contact between the axis-side and corner-side facets sits 12 degrees round the arc from the
// flat's end so the two share the sagitta, which keeps the girdle at 3.5% on the hills (the
// contacts) and 1.9% in the valleys, 2.9% on average.
import { newTier } from '../design.js?v=117';
import { cushionOutline as bowedCushionOutline } from './cushion.js?v=117';
import {
  deg, lift, vertexNear, girdleVertices, planeThrough, planeAz, mainThrough, yPlane, xPlane, classTier,
  girdleEqualLength, plane3, intersect3, pointOn, azOf, chordAz,
} from '../shapebuild.js?v=117';

const BOW = 0.01;   // outward bow of the sides, fraction of the half-width

const IGI_RANGES = 'IGI Excellent ranges (square cushion modified brilliant): L:W 1.00-1.05 (1.06+ is graded as rectangular), total depth 62-68%, table 55-62%, crown height 8-16%, girdle 2-6% (thin to thick), pavilion depth 40-56%, culet pointed to small. IGI publishes no crown or pavilion angle for this shape.';
const NO_GIA = 'GIA assigns no cut grade to cushion diamonds.';

// plan positions on the plot (half-widths, square stone, top-right octant)
const PLOT = {
  crown: { C: 0.66, D: [0.53, 0.53], A: [0.46, 0.79] },
  pavilion: { CC: 0.71, CR: [0.42, 0.79], M: [0.20, 0.72], K: [0.53, 0.53], T: 0.24 },
};

/** Square cushion modified brilliant of the GIA plot pattern. */
export function cushionModified({
  ratio = 1, crownHeight = 0.125, girdle = 0.035, pavilionDepth = 0.5, cornerAngle = 40, corner = 0.45, culet = 0,
  upperAngle = 34, lowerAngle = 48, contactArc = 12,
  gear = 96, girdleFacets = 128,
} = {}) {
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W, zc = -g - Pd;
  const outline = bowedCushionOutline(ratio, corner, BOW, BOW);
  // girdle contacts: the axis vertices, the ends of the flats and the corner vertex in the middle
  // of each corner arc; the girdle polygon gets vertices exactly there (equally spaced between)
  // the contact between the axis-side and corner-side girdle facets sits contactArc degrees round
  // the corner arc from the flat's end, so the two facets share the arc's sagitta
  const cx = 1 - corner - BOW, cy = l - corner - BOW, th = (90 - contactArc) * Math.PI / 180;   // corner arc centre; contact angle from the arc centre
  const flatEnd = { top: [cx + corner * Math.cos(th), cy + corner * Math.sin(th)], side: [cx + corner * Math.sin(th), cy + corner * Math.cos(th)] };
  const cornerMid = [cx + corner * Math.SQRT1_2, cy + corner * Math.SQRT1_2];
  const sym = (p) => [[p[0], p[1]], [-p[0], p[1]], [-p[0], -p[1]], [p[0], -p[1]]];
  const contacts = [[1, 0], [0, 1], [-1, 0], [0, -1], ...sym(flatEnd.top), ...sym(flatEnd.side), ...sym(cornerMid)].map(azOf);
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 0, contacts);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const add = (name, plane) => { tiers.push(classTier(name, plane, gear, 2, true)); return plane; };
  const sc = ([x, y]) => [x, y * l];   // plot positions (square plot) stretched to the L:W

  const vAxis = { top: vertexNear(verts, 90), side: vertexNear(verts, 0) };
  const vFlat = { top: vertexNear(verts, azOf(flatEnd.top)), side: vertexNear(verts, azOf(flatEnd.side)) };
  const vCorner = vertexNear(verts, azOf(cornerMid));
  const cornerAz = outline.normalAz(vCorner.az);
  // a plan position of the top octant, or its diagonal mirror for the side octant, stretched to the L:W
  const at = (o, p) => sc(o === 'top' ? p : [p[1], p[0]]);
  const axisAz = { top: 90, side: 0 };
  // a girdle facet: the chord through two girdle vertices (lifted to z) and the apex
  const chord = (name, apex, vA, vB, z, up) => add(name, plane3(lift(vA, z), lift(vB, z), apex, up));

  // ---- crown
  const Gt = lift(vAxis.top, 0), G0 = lift(vAxis.side, 0);
  const D = [...sc(PLOT.crown.D), H];
  // corner facet: symmetric about the corner's outline normal, through the corner vertex and the table corner D
  const B2 = lift(vCorner, 0);
  const cornerFacet = add('corner', planeAz(B2, D, cornerAz, true));
  const bezel = {}, A = {};
  for (const o of ['top', 'side']) {
    const Gax = o === 'top' ? Gt : G0, Cp = at(o, [0, PLOT.crown.C]);
    const C = [Cp[0], Cp[1], H];
    const run = o === 'top' ? Gax[1] - C[1] : Gax[0] - C[0];
    bezel[o] = add(`A ${o}`, planeThrough(deg(Math.atan2(H, run)), axisAz[o], Gax));   // kite tangent to the girdle on the axis, reaching the table at C
    // upper girdle facet along the corner arc: painted at upperAngle through the contact and the
    // corner vertex; A, the junction of the bezel, the corner facet and both upper girdle facets,
    // follows, and the upper girdle facet along the flat runs from the axis vertex to the contact
    // and A (it shares the bezel's azimuth, so it is the one that cannot be painted flatter than the bezel)
    const B1 = lift(vFlat[o], 0);
    const ugc = add(`UG corner-${o}`, planeThrough(upperAngle, chordAz(B1, B2), B1));
    A[o] = intersect3(bezel[o], cornerFacet, ugc);
    chord(`UG ${o}`, A[o], vAxis[o], vFlat[o], 0, true);
    add(`star ${o}`, plane3(C, A[o], D, true));
  }

  // ---- pavilion
  // corner kite first: tangent to the girdle at the corner vertex at cornerAngle; CR on it for both octants
  const B2p = lift(vCorner, -g);
  const cornerKite = add('P corner', planeThrough(-cornerAngle, cornerAz, B2p));
  // lower girdle facets along the corner arcs: painted at lowerAngle through the contact and the
  // corner vertex; CR, the junction of six facets, is where that facet meets the corner kite at
  // the plot's distance from the axis
  const CR = {};
  for (const o of ['top', 'side']) {
    const B1 = lift(vFlat[o], -g), lg = add(`LG corner-${o}`, planeThrough(-lowerAngle, chordAz(B1, B2p), B1));
    const p = at(o, PLOT.pavilion.CR);
    CR[o] = intersect3(cornerKite, lg, o === 'top' ? xPlane(p[0]) : yPlane(p[1]));
  }
  // K on the corner kite; the main kite through K and the culet, so the main angle follows from the pavilion depth
  const Kp = sc(PLOT.pavilion.K), K = pointOn(cornerKite, ...Kp);
  const main = add('P main', mainThrough(azOf(Kp), K, zc));
  for (const o of ['top', 'side']) {
    const Gax = lift(vAxis[o], -g);
    // girdle kite: azimuth along the axis, tangent at the axis vertex, through CR (and so through its mirror CL)
    const kite = add(`P ${o}`, planeAz(Gax, CR[o], axisAz[o], false));
    const CC = pointOn(kite, ...at(o, [0, PLOT.pavilion.CC]));
    const M = pointOn(kite, ...at(o, PLOT.pavilion.M));   // on the kite, where its edge CC-CR bends
    chord(`LG ${o}`, CR[o], vAxis[o], vFlat[o], -g, false);          // along the flat, through the axis vertex, the contact and CR
    const T = pointOn(main, ...at(o, [0, PLOT.pavilion.T]));   // hub on the main kite's edge with its mirror
    add(`F outer-${o}`, plane3(T, CR[o], K, false));
    add(`F mid-${o}`, plane3(T, M, CR[o], false));
    add(`F axis-${o}`, plane3(T, CC, M, false));
  }
  if (culet > 0) {
    // square culet facet (corners on the axes, where the mains' ridges run): the mains' height at
    // half the square's diagonal from the centre; written at -0.001 degrees because angle 0 is a table
    const half = culet * W * Math.SQRT1_2;
    const zCulet = pointOn(main, half, 0)[2];
    tiers.push(newTier({ name: 'culet', angle: -0.001, distance: -zCulet, indices: [0] }));
  }

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const mainAngle = deg(Math.atan2(Math.hypot(main.n[0], main.n[1]), Math.abs(main.n[2])));
  // the main kite crosses the corner kite at K from below: it has to be flatter, or it takes over outward of K up to the girdle
  const deviation = mainAngle >= cornerAngle ? ` The pavilion depth ${pct(pavilionDepth)} is too deep for ${cornerAngle}-degree corner kites: the mains come out at ${Math.round(mainAngle)} degrees, steeper than the corner kites, and cut them away; reduce the depth or steepen the corner kites.` : '';
  const bezelAngle = deg(Math.atan2(Math.hypot(bezel.top.n[0], bezel.top.n[1]), Math.abs(bezel.top.n[2])));
  return {
    name: 'Square cushion modified brilliant', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Square cushion modified brilliant', `L:W ${ratio}, crown height ${pct(crownHeight)}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}`],
    footnotes: ['Facet pattern of a GIA plotting diagram for a square cushion modified brilliant (crushed-ice pavilion), angles typical.'],
    notes: [
      `Ideal dimensions: none published as a complete parameter set. ${NO_GIA}`,
      IGI_RANGES,
      `This design: L:W ${ratio}, total depth ${pct(crownHeight + girdle + pavilionDepth)}, table ${pct(PLOT.crown.C)} of the width on the axes, crown height ${pct(crownHeight)}, bezels ${Math.round(bezelAngle)} degrees, girdle ${pct(girdle)}, pavilion depth ${pct(pavilionDepth)}, corner kites ${cornerAngle} degrees, mains ${Math.round(mainAngle)} degrees at the culet, culet ${culet > 0 ? `square facet ${pct(culet)} of the width` : 'pointed'}.${deviation}`,
      'Plot pattern: crown of table (octagon), 4 bezel kites on the axes, 8 stars, 4 corner facets, 16 upper girdle facets (33); pavilion of 4 girdle kites on the axes, 16 lower girdle facets, 4 corner kites, 24 fan facets from the four hubs, 4 main kites meeting at the culet (52). The upper and lower girdle facets along the corner arcs are painted (34 and 48 degrees) and meet the flat-side ones 12 degrees round the arc, so the girdle scallops little: 3.5% at the contacts, 1.9% at thinnest, 2.9% on average.',
      `Outline: square of half-side ${Math.round((1 - corner) * 100) / 100} plus corner radius ${corner} (half-widths), sides bowed by ${BOW}; eight-fold at L:W 1, stretched along the length above it.`,
      'Every facet that reaches the girdle meets it at girdle polygon vertices: the kites on the axes and at the corners touch it at one vertex with the outline normal as azimuth, the upper and lower girdle facets run through two (the axis vertex and the end of the flat, or the end of the flat and the corner vertex), so the mains, the girdle facets and the girdle share their meet points.',
    ],
    tiers,
  };
}

export const templates = {
  cushionModified: {
    name: 'Square cushion modified brilliant',
    note: 'Square cushion modified brilliant with the crushed-ice pavilion of a GIA plotting diagram: girdle kites on the axes, corner kites, fans from four hubs and main kites meeting at the culet. Eight-fold at L:W 1. Typical angles.',
    params: [
      { key: 'ratio', label: 'L:W', default: 1, step: 0.01, min: 1, max: 1.1, title: 'Square cushion: 1.00 to 1.05 per IGI' },
      { key: 'crownHeight', label: 'Crown height', default: 0.125, step: 0.005, title: 'Fraction of the width' },
      { key: 'girdle', label: 'Girdle', default: 0.035, step: 0.005, title: 'At the hills (the contacts); the arcs between them cut it thinner' },
      { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.5, step: 0.005, title: 'The mains at the culet follow from the depth and the corner kite angle; they must stay flatter than the corner kites, so the depth has a ceiling' },
      { key: 'cornerAngle', label: 'Corner kite', default: 40, step: 1, title: 'Angle of the corner kites, degrees (the mains at the culet, which must be flatter, follow from it and the pavilion depth)' },
      { key: 'corner', label: 'Corner radius', default: 0.45, step: 0.05, min: 0.3, max: 0.55, title: 'Fraction of the half-width (the plot\'s flats end at 0.55); larger corners pull the corner kites under the mains' },
      { key: 'upperAngle', label: 'Upper girdle', default: 34, step: 1, min: 33, max: 40, title: 'Angle of the upper girdle facets along the corner arcs, degrees: flatter (painted) keeps the girdle even; the junction A follows' },
      { key: 'lowerAngle', label: 'Lower girdle', default: 48, step: 1, min: 46, max: 56, title: 'Angle of the lower girdle facets along the corner arcs, degrees: flatter (painted) keeps the girdle even, but below about 46 the fans overtake the girdle kites' },
      { key: 'contactArc', label: 'Contact', default: 12, step: 1, min: 9, max: 15, title: 'Where the axis-side and corner-side girdle facets meet (upper and lower share it): degrees round the corner arc from the end of the flat; outside 9 to 15 the facets no longer close' },
      { key: 'culet', label: 'Culet', default: 0, step: 0.01, min: 0, max: 0.1, title: 'Side of the square culet facet, fraction of the width (0: pointed)' },
    ],
    make: (o = {}) => cushionModified(o),
  },
};

/** Built-in plot underlays: none for this design. */
export const plots = [];
