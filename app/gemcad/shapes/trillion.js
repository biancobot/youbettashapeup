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
import { newTier } from '../design.js?v=138';
import { rad, deg, girdleFromPolygon, plane3, planeAz, planeThrough, intersect3, zPlane, azPlane, classTier } from '../shapebuild.js?v=138';

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

/**
 * Triangular brilliant: the round brilliant's arrangement folded three ways on a triangle with
 * curved sides. Crown: table, 6 bezel kites (one at each corner, one at the middle of each side), 6
 * stars, 12 upper girdle facets in pairs meeting on the girdle halfway between the bezel contacts.
 * Pavilion: 6 mains under the bezels meeting at the culet, 12 lower girdle facets in pairs meeting on
 * the girdle at the same junctions, so crown and pavilion are in register. The sides must curve: on a
 * straight side the side bezel and main would lie along the whole edge instead of touching its middle.
 * table: the table's corner points as a fraction of the way out to the corners; tableSide: its side
 * points as a fraction of the way out to the middles of the sides (equal values, as on the reference
 * drawing, give a six-sided table bowing out towards the sides); starHeight: star tips, fraction of the crown height; lowerDepth:
 * lower girdle junctions on the main ridges, fraction of the pavilion depth.
 */
export function triangleBrilliant({
  bow = 0.12, crownHeight = 0.115, girdle = 0.03, pavilionDepth = 0.39, table = 0.51, tableSide = 0.51,
  starHeight = 0.5, lowerDepth = 0.85, segments = 16, gear = 96, pointDown = true, crownLines = true,
  crownCurve = { table: 0.50, tableSide: 0.355, star: [0.66, 13.5] }, cornerSteep = 1, onLines = true,
} = {}) {
  const W = 2, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W, fold = 3;
  // point down (as usually drawn): the outline turned half a turn, corners at 270, 30 and 150 degrees
  const poly = trillionOutline(bow, segments).map(([x, y]) => (pointDown ? [-x, -y] : [x, y]));
  const tiers = [girdleFromPolygon(poly, gear), newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, fold, true)); return plane; };
  const at = (p, z) => [p[0], p[1], z];
  // one side, from the corner at the top (azimuth 90) to the next corner: C, the junction J a quarter
  // of the way along (halfway between the corner and the middle), the middle M
  const side = poly.slice(0, segments + 1);
  const C = side[0], J = side[Math.round(segments / 4)], M = side[segments / 2], C2 = side[segments];
  const azM = deg(Math.atan2(M[1], M[0])), azC = deg(Math.atan2(C[1], C[0]));
  // ---- crown
  let cornerB, sideB, A, Tc, Ts, linesNote = '';
  if (crownCurve) {
    // the reference drawing's crown: the lines from each corner to the opposite side are not straight but
    // bend slightly at each point they pass (star tip, table point, table point, star tip), five segments
    // from the corner to the upper girdle junction. The points are placed where the drawing has them, as
    // fractions of the corner radius: crownCurve = { table, tableSide, star: [radius, degrees off the
    // corner's axis towards the side's middle] }
    const Rc = Math.hypot(C[0], C[1]), uC = [C[0] / Rc, C[1] / Rc], uM = [Math.cos(rad(azM)), Math.sin(rad(azM))];
    const sa = rad(azC + Math.sign(((azM - azC + 540) % 360) - 180) * crownCurve.star[1]);
    Tc = [crownCurve.table * Rc * uC[0], crownCurve.table * Rc * uC[1], H];
    cornerB = addClass('A corner', planeAz(at(C, 0), Tc, azC, true));
    const Ap = [crownCurve.star[0] * Rc * Math.cos(sa), crownCurve.star[0] * Rc * Math.sin(sa)];
    A = [Ap[0], Ap[1], (cornerB.d - cornerB.n[0] * Ap[0] - cornerB.n[1] * Ap[1]) / cornerB.n[2]];
    sideB = addClass('A side', planeAz(at(M, 0), A, azM, true));
    Ts = intersect3(sideB, zPlane(H), azPlane(azM));
    linesNote = ` Crown points placed as on the reference drawing (the lines from each corner bend slightly at the star tips and table points): table points ${(crownCurve.table * 100).toFixed(0)}% of the corner radius towards the corners, star tips ${(crownCurve.star[0] * 100).toFixed(0)}% at ${crownCurve.star[1]} degrees off the corners' axes; the table points towards the side middles follow from the side bezels at ${(100 * Math.hypot(Ts[0], Ts[1]) / Rc).toFixed(1)}% (drawing ${(crownCurve.tableSide * 100).toFixed(1)}%).`;
  } else if (crownLines) {
    // laid out with straight lines, as on the reference drawing: from each corner to the two upper girdle
    // junctions on the opposite side. Where they cross: the star tips and the table's points. For the
    // side from C (corner 0) to C1, with C2 the corner opposite it: the star tip beside the junction J
    // is where the line from C to the junction of the next side nearest C1 crosses the line from C2 to
    // J; the table point towards C is where the line from C1 to the junction of the third side nearest C
    // crosses the line from C2 to J; the table point towards the side's middle is where the lines from C
    // and from C1 cross.
    const n = segments, Cs = [poly[0], poly[n], poly[2 * n]];
    const Jat = (k, f) => poly[k * n + Math.round(f * n)];
    const cross = (p1, p2, q1, q2) => { const d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [q2[0] - q1[0], q2[1] - q1[1]], den = d1[0] * d2[1] - d1[1] * d2[0]; const t = ((q1[0] - p1[0]) * d2[1] - (q1[1] - p1[1]) * d2[0]) / den; return [p1[0] + t * d1[0], p1[1] + t * d1[1]]; };
    const Aplan = cross(Cs[0], Jat(1, 0.25), Cs[2], Jat(0, 0.25));
    const TcPlan = cross(Cs[1], Jat(2, 0.75), Cs[2], Jat(0, 0.25));
    const TsPlan = cross(Cs[0], Jat(1, 0.25), Cs[1], Jat(2, 0.75));
    Tc = [TcPlan[0], TcPlan[1], H];
    cornerB = addClass('A corner', planeAz(at(C, 0), Tc, azC, true));
    // the star tip on the corner bezel; the side bezel, kite-shaped and level across the side, from the
    // side's middle through the star tips; its table point follows (a level plane through the middle
    // and the tips cannot also pass through the lines' crossing exactly)
    const zA = (cornerB.d - cornerB.n[0] * Aplan[0] - cornerB.n[1] * Aplan[1]) / cornerB.n[2];
    A = [Aplan[0], Aplan[1], zA];
    sideB = addClass('A side', planeAz(at(M, 0), A, azM, true));
    Ts = intersect3(sideB, zPlane(H), azPlane(azM));
    linesNote = ` Laid out with lines from each corner to the upper girdle junctions on the opposite side: their crossings give the star tips and the table's points (the side table point sits ${(100 * Math.hypot(Ts[0] - TsPlan[0], Ts[1] - TsPlan[1]) / 2).toFixed(1)}% of the width from the lines' crossing, where the level side bezel through the side's middle and the star tips meets the table).`;
  } else {
    // bezels through their girdle contact and their table corner
    Tc = [table * C[0], table * C[1], H];
    Ts = [tableSide * M[0], tableSide * M[1], H];
    cornerB = addClass('A corner', planeAz(at(C, 0), Tc, azC, true));
    sideB = addClass('A side', planeAz(at(M, 0), Ts, azM, true));
    A = intersect3(cornerB, sideB, zPlane(starHeight * H));   // star tip on the bezel ridge
  }
  addClass('C star', plane3(Tc, Ts, A, true));
  addClass('B corner', plane3(A, at(C, 0), at(J, 0), true));
  addClass('B side', plane3(A, at(J, 0), at(M, 0), true));
  // ---- pavilion: mains through the culet, touching the girdle at the corner and at the side's middle
  const zc = -g - Pd;
  const main = (p, az) => { const run = Math.hypot(p[0], p[1]); return planeThrough(-deg(Math.atan2(Pd, run)), az, at(p, -g)); };
  // cornerSteep > 1: the corner mains cut steeper than the line from the culet to the corner. Each still
  // touches the girdle only at its sharp corner, but no longer reaches the culet: the three side mains meet
  // there, and each corner main ends on a short ridge where the two side mains beside it meet. A steeper
  // corner main takes a larger share of the pavilion, turning the ridges between corner and side mains
  // towards the straight lines from the lower girdle junctions to the culet.
  const cornerM = addClass('P corner', planeThrough(-deg(Math.atan(cornerSteep * Pd / Math.hypot(C[0], C[1]))), azC, at(C, -g)));
  // onLines: the side mains cut a little steeper than the line from the culet to the side's middle, just
  // enough that the corners where corner and side mains meet the lower girdle facets lie on the straight
  // lines from the lower girdle junctions to the culet (lowerDepth of the way along the ridge between them,
  // from the girdle to the ridge's inner end). Each side main still touches the girdle only at the side's
  // middle but no longer reaches the culet: the three corner mains meet there, and each side main ends on a
  // short ridge where the two corner mains beside it meet. The corner and side mains come out nearly
  // equally wide (as plain mains through the culet the corner mains are needles: the corners are far
  // from the culet, so the corner mains are much the shallower).
  const C1 = side[segments], azC1 = deg(Math.atan2(C1[1], C1[0]));
  const cornerM1 = planeThrough(-deg(Math.atan(cornerSteep * Pd / Math.hypot(C1[0], C1[1]))), azC1, at(C1, -g));
  const sideAt = (f) => planeThrough(-deg(Math.atan(f * Pd / Math.hypot(M[0], M[1]))), azM, at(M, -g));
  const cornerAt = (sm) => {
    const inner = Math.abs(sm.n[2]) && sm !== null ? intersect3(sm, cornerM, cornerM1) : [0, 0, -g - Pd];
    const top = intersect3(cornerM, sm, zPlane(-g));
    return top.map((v, i) => v + lowerDepth * (inner[i] - v));
  };
  const offLine = (Kp) => (J[0] * Kp[1] - J[1] * Kp[0]) / Math.hypot(J[0], J[1]);
  let sideSteep = 1;
  if (onLines) {
    // the corner's signed distance from the line changes sign between 1 (plain mains) and 1.6: bisect
    let lo = 1, hi = 1.6; const s0 = Math.sign(offLine(cornerAt(sideAt(1 + 1e-6))));
    for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (Math.sign(offLine(cornerAt(sideAt(mid)))) === s0) lo = mid; else hi = mid; }
    sideSteep = (lo + hi) / 2;
  }
  const sideM = addClass('P side', sideSteep === 1 ? main(M, azM) : sideAt(sideSteep));
  const K = sideSteep === 1 ? intersect3(cornerM, sideM, zPlane(-g - lowerDepth * Pd)) : cornerAt(sideM);
  addClass('L corner', plane3(at(C, -g), at(J, -g), K, false));
  addClass('L side', plane3(at(J, -g), at(M, -g), K, false));

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const ang = (pl) => Math.round(deg(Math.atan2(Math.hypot(pl.n[0], pl.n[1]), Math.abs(pl.n[2]))) * 10) / 10;
  return {
    name: 'Triangular brilliant (starting point)', gear, fold, mirror: true, ri: 2.42,
    headings: ['Triangular brilliant', `sides bowed ${pct(bow)}, crown height ${pct(crownHeight)}, pavilion depth ${pct(pavilionDepth)}`],
    footnotes: ['Starting point: the round brilliant\'s pattern folded three ways on a curved triangle, with typical angles.'],
    notes: [
      'Ideal dimensions: none published. GIA assigns no cut grade to triangular diamonds and IGI\'s fancy-shape guidelines do not cover them; trade practice favours curved sides for brilliant-cut triangles (straight sides suit step and mixed cuts) and a shallow pavilion, since the corners sit far from the culet.',
      `This design: sides bowed ${pct(bow)} of their length, crown height ${pct(crownHeight)}, corner bezels ${ang(cornerB)} and side bezels ${ang(sideB)} (each through its girdle contact and its table corner)${crownCurve || crownLines ? '' : `, stars ${pct(starHeight)} of the crown height at the tip`}, pavilion depth ${pct(pavilionDepth)}, corner mains ${ang(cornerM)} and side mains ${ang(sideM)}, lower girdle junctions at ${pct(lowerDepth)} of the pavilion depth, girdle ${pct(girdle)}.${linesNote}${sideSteep !== 1 ? ` Side mains cut ${((sideSteep - 1) * 100).toFixed(1)}% steeper than the line from the culet to the side's middle, so the main corners (${pct(lowerDepth)} of the way along the ridges between corner and side mains) lie on the straight lines from the lower girdle junctions to the culet.` : ''}`,
      'Pattern: crown of table, 6 bezels (3 corners, 3 sides), 6 stars and 12 upper girdle facets; pavilion of 6 mains under the bezels and 12 lower girdle facets; the upper and lower girdle facets meet on the girdle at the same six points, halfway between the bezel contacts.',
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
  triangleBrilliant: {
    name: 'Triangular brilliant (starting point)',
    note: 'The round brilliant\'s pattern folded three ways on a curved triangle, the crown laid out with lines from each corner to the upper girdle junctions on the opposite side (their crossings give the star tips and the table), the bezels kites to the middles of the curved sides: bezels and mains at the corners and the middles of the sides, stars, and upper and lower girdle facets in pairs meeting halfway between the contacts. The L:W field is ignored (equilateral).',
    params: [
      { key: 'bow', label: 'Side bow', default: 0.12, step: 0.01, min: 0.02, max: 0.2, title: 'Sagitta of each side, fraction of its chord (a brilliant needs curved sides)' },
      { key: 'crownHeight', label: 'Crown height', default: 0.115, step: 0.005, title: 'Fraction of the width (the reference drawing\'s 11.5% gives corner bezels about 17.5 and side bezels 25; about 17% gives 25 and 34)' },
      { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
      { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.39, step: 0.005, title: 'Fraction of the width' },
      { key: 'lowerDepth', label: 'Lower junctions', default: 0.85, step: 0.05, min: 0.3, max: 0.95, title: 'Lower girdle junctions on the main ridges, fraction of the pavilion depth' },
    ],
    make: ({ girdleFacets, ratio, ...o } = {}) => triangleBrilliant(o),
  },
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
