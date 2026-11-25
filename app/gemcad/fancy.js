// Marquise brilliant starting design. Other fancy shapes live in ./shapes/.
import { newTier } from './design.js?v=122';
import {
  rad, deg, marquiseSupport, marquiseOutline, girdleVertices, vertexNear, vertexNearY, lift,
  planeThrough, mirrorX, mirrorY, zPlane, yPlane, xPlane, azPlane, perpPlane, classTier,
  girdleFromSupport, girdleEqualLength, plane3, intersect3,
} from './shapebuild.js?v=122';
export { marquiseSupport, marquiseOutline, girdleVertices };

/**
 * Marquise brilliant starting point, pattern of the IGI plotting templates:
 * crown (default, `crown: 'sideBezel'`, IGI FDR689598882 and FDR779652382): table, 8 bezels (2 points,
 * 4 wings, 2 sides), 8 stars, 16 upper girdle facets;
 * crown variant (`crown: 'sideHub'`, IGI FDR762535113): the side bezel kites are replaced by a hub on
 * each side of the girdle where five facets meet: two half-side bezels (each tangent to the girdle
 * at a contact well above the side), two flank upper girdle facets forming the side, and one side
 * star between the half-bezels and the table. Point and wing bezels as before, but the wing contact
 * sits higher (67 instead of 59 degrees) and the bezel kites' side corners are lifted off the girdle:
 * table, 8 bezels (2 points, 4 wings, 4 half-sides), 10 stars, 20 upper girdle facets;
 * pavilion (all three reports): 8 mains meeting at the culet, 16 lower girdle facets.
 * French tips (default) replace each point bezel by the GIA arrangement: a hub vertex on the axis
 * where eight facets meet (two tip facets at the point, two small upper girdle facets, the two
 * wing bezels and two half-bezels reaching the table corner).
 */
export function marquiseStart({
  ratio = 2.0, crownAngle = 35, wingAngle = crownAngle, pointAngle = 21.5, crownHeight = 0.14, girdle = 0.038, pavilionDepth = 0.435,
  starHeight = 0.65, lowerDepth = 0, gear = 96, girdleFacets = 128,
  frenchTips = true, tipHubHeight = 0.75, tipTable = 0.30, tipGirdle = 0.16,
  crown = 'sideBezel', sideHub = 0.82, pavilion = 'igi', keelJunction = 0.25, pointJunction = 0.48, bellyJunction = 0.35,
} = {}) {
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const sideHubs = crown === 'sideHub';
  const outline = marquiseOutline(l);
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 90);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 2, true)); return plane; };
  // Girdle contacts, top-right quadrant (radial azimuths measured on the IGI plots; the wing contact
  // is at 59.3 on the side-bezel crown, 67.4 on the side-hub crown)
  const Pv = vertexNear(verts, 90), Sv = vertexNear(verts, 0), Uv = vertexNear(verts, sideHubs ? 67.4 : 59.3);
  const P = lift(Pv, 0), Sd = lift(Sv, 0), U = lift(Uv, 0);
  const table = zPlane(H);

  // ---- crown bezels: tangent to the girdle at the contact, azimuth = outline normal there
  const wingPlane = planeThrough(wingAngle, outline.normalAz(Uv.az), U);
  const pt = planeThrough(pointAngle, 90, P);
  let wing, hub = null, sideHubPt = null;
  // the crown's girdle contacts, top-right quadrant, that the pavilion lines up under: the point junction
  // (or the French tip's girdle point), the junction or bezel between the mains, and the side contact
  const under = {};
  // French tip at the point: hub on the ridge of the two wing bezels at tipHubHeight of the crown (kept
  // inside the outline); T is the table corner on the axis, S the wing bezel's table corner
  const frenchTip = (T, S) => {
    let V = intersect3(wing, mirrorX(wing), zPlane(tipHubHeight * H));
    if (V[1] > 0.97 * l) V = intersect3(wing, mirrorX(wing), yPlane(0.97 * l));
    hub = V;
    const Gv = vertexNearY(verts, (1 - tipGirdle) * l, 1), G = lift(Gv, 0);
    under.tip = Gv;
    addClass('C half-bezel', plane3(V, T, S, true));
    addClass('B tip', plane3(V, G, U, true));
    addClass('tip', plane3(P, V, G, true));
  };
  if (!sideHubs) {
    const side = addClass('A side', planeThrough(crownAngle, 0, Sd));
    wing = addClass('A wing', wingPlane);
    if (!frenchTips) addClass('A point', pt);
    // table corners: on the bezel's table line at the plot's radial azimuth
    const M = intersect3(side, table, azPlane(0));
    const S = intersect3(wing, table, azPlane(72.2));
    const T = frenchTips ? [0, (1 - tipTable) * l, H] : intersect3(pt, table, azPlane(90));
    // ---- stars: through the two table corners and a tip on the bezel ridge at starHeight of the
    // crown height (0.65 puts the tips where the IGI plot has them: side kites 0.74 of the half-width wide)
    const Wws = intersect3(wing, side, zPlane(starHeight * H));
    addClass('C wing-side', plane3(S, M, Wws, true));
    const Jwsv = vertexNear(verts, 33.7), Jws = lift(Jwsv, 0);
    under.between = Uv; under.side = Jwsv;
    addClass('B wing', plane3(Wws, U, Jws, true));
    addClass('B side', plane3(Wws, Jws, Sd, true));
    if (!frenchTips) {
      const Wpw = intersect3(pt, wing, zPlane(starHeight * H));
      addClass('C point-wing', plane3(T, S, Wpw, true));
      const Jpwv = vertexNear(verts, 76.7), Jpw = lift(Jpwv, 0);
      under.tip = Jpwv;
      addClass('B point', plane3(Wpw, P, Jpw, true));
      addClass('B wing-point', plane3(Wpw, Jpw, U, true));
    } else frenchTip(T, S);
  } else {
    // ---- side-hub crown, positions measured on IGI FDR762535113 (half-width 123.5 px, half-length 244 px,
    // L:W 1.98). Girdle contacts (radial azimuths): tip junction 78.3, wing 67.4, wing-side junction 51.0,
    // half-side bezel 28.7. Plan positions in half-widths: table corner X on the axis at 0.67 of the
    // half-length; wing table corner Q (0.305, 1.08) az 74.3; half-side table corner R (0.59, 0.40) az 33.9;
    // wing/half-side ridge vertex Y (0.61, 0.85) az 54.2; point/wing ridge vertex V1 (0.19, 1.52), 0.77 of the half-length;
    // side hub M at 0.82 of the half-width on the side axis.
    wing = addClass('A wing', wingPlane);
    if (!frenchTips) addClass('A point', pt);
    const Hv = vertexNear(verts, 28.7), Hd = lift(Hv, 0);
    const half = addClass('A half-side', planeThrough(crownAngle, outline.normalAz(Hv.az), Hd));
    const Q = intersect3(wing, table, azPlane(74.3));
    const R = intersect3(half, table, azPlane(33.9));
    const T = frenchTips ? [0, (1 - tipTable) * l, H] : intersect3(pt, table, azPlane(90));
    // side hub on the ridge of the two half-side bezels, at the plot's distance from the centre
    const M = intersect3(half, mirrorY(half), xPlane(sideHub));
    sideHubPt = M;
    // ridge vertex between the wing and the half-side bezel at the plot's azimuth; the wing-side star
    // runs from it to the two table corners, the side star from the hub to the table edge R-R'
    const Y = intersect3(wing, half, azPlane(54.2));
    const G3v = vertexNear(verts, 51.0), G3 = lift(G3v, 0);
    under.between = G3v; under.side = Hv;
    addClass('C wing-side', plane3(Q, R, Y, true));
    addClass('C side', plane3(R, [R[0], -R[1], R[2]], M, true));
    addClass('B wing', plane3(Y, U, G3, true));
    addClass('B side', plane3(Y, G3, Hd, true));
    addClass('B flank', plane3(M, Hd, Sd, true));
    if (!frenchTips) {
      // point/wing ridge vertex at the plot's height along the axis (0.77 of the half-length from the
      // centre); the ridge runs nearly along its own azimuth, so a y position is the stable choice
      const V1 = intersect3(pt, wing, yPlane(0.77 * l));
      const G1v = vertexNear(verts, 78.3), G1 = lift(G1v, 0);
      under.tip = G1v;
      addClass('C point-wing', plane3(T, Q, V1, true));
      addClass('B point', plane3(V1, P, G1, true));
      addClass('B wing-point', plane3(V1, G1, U, true));
    } else frenchTip(T, Q);
  }

  // ---- pavilion: mains tangent to the girdle, through the culet, with every pavilion girdle point
  // directly below a crown one (a cut-grade requirement: offset junctions read as misalignment). The
  // IGI plots put the mains at 76 and 32.6 degrees and the lower junction at 56.2; they are moved onto
  // the nearest crown contacts: the point main under the point junction (or the French tip's girdle
  // point), the lower junction under the wing bezel (side-hub crown: under the wing-side junction,
  // midway between the mains), the side main under the wing-side junction (side-hub crown: under the
  // half-side bezel)
  const culet = [0, 0, -g - Pd];
  const Av = under.tip, Bv = under.between, Cv = under.side;
  const A = lift(Av, -g), C = lift(Cv, -g), B = lift(Bv, -g), Pg = lift(Pv, -g), Sg = lift(Sv, -g);
  const mainThrough = (v, p) => {
    const az = outline.normalAz(v.az), u = [Math.cos(rad(az)), Math.sin(rad(az))];
    const h = u[0] * p[0] + u[1] * p[1];
    const ang = deg(Math.atan2(Pd, h));
    return planeThrough(-ang, az, p);
  };
  const bellyMains = pavilion === 'bellyMains';
  if (pavilion === 'mains8') {
    // ---- eight mains, one under every bezel (2 points, 4 wings, 2 sides), with two lower girdle
    // facets between each pair of mains meeting on the girdle under the upper girdle junctions:
    // every crown girdle point has a pavilion point below it and the reverse. The lower girdle
    // junctions on the ridges between mains: beside the point main at pointJunction of the
    // half-length from the centre, beside the side main at bellyJunction of the half-width
    // (the diagram's 0.48 and 0.35).
    const Uv0 = under.between, Ug = lift(Uv0, -g);
    const mP = addClass('P point', mainThrough(Pv, Pg));
    const mW = addClass('P wing', mainThrough(Uv0, Ug));
    const mS = addClass('P side', mainThrough(Sv, Sg));
    const Kp = intersect3(mP, mW, yPlane(pointJunction * l)), Ks = intersect3(mW, mS, xPlane(bellyJunction));
    addClass('L point a', plane3(Kp, Pg, A, false));
    addClass('L point b', plane3(Kp, A, Ug, false));
    addClass('L side a', plane3(Ks, Ug, C, false));
    addClass('L side b', plane3(Ks, C, Sg, false));
  } else if (pavilion === 'mains4') {
    // ---- four mains, under the wing bezels only, meeting at the culet: the keel line runs from the
    // culet to each point and the belly line to each side. The two wing mains of a point meet along
    // the keel up to the keel junction K (keelJunction of the half-length from the centre); the two
    // wing mains of a side meet along the belly line up to J (bellyJunction of the half-width). Beyond K and J the lines
    // are ridges between lower girdle facets, so the point and side bezels sit above lower girdle
    // junctions; the other lower junctions sit under the upper girdle junctions.
    const Uv0 = under.between, Ug = lift(Uv0, -g);
    const mW = addClass('P wing', mainThrough(Uv0, Ug));
    const K = intersect3(mW, mirrorX(mW), yPlane(keelJunction * l));
    const J = intersect3(mW, mirrorY(mW), xPlane(bellyJunction));
    addClass('L point', plane3(K, Pg, A, false));
    addClass('L wing a', plane3(K, A, Ug, false));
    addClass('L wing b', plane3(J, Ug, C, false));
    addClass('L side', plane3(J, C, Sg, false));
  } else if (bellyMains) {
    // ---- six mains, under the bezels on the belly (GIA wireframe): a main under each side bezel and
    // each wing bezel; none at the points. The two wing mains of a point meet along the keel line
    // (the axis) from the culet up to the keel junction K; from K to the point the keel is the ridge
    // between the two point lower girdle facets, so the point bezel (or the French tip's point) sits
    // above a lower girdle junction. Four lower girdle facets per quadrant, their girdle junctions
    // under the crown's other contacts: the point junction (or French tip girdle point) and the
    // wing-side upper girdle junction. K at keelJunction of the half-length from the centre (the
    // wireframe's 25%); the belly junctions J, between the wing and side mains, at K's depth.
    const Uv0 = under.between, Ug = lift(Uv0, -g);
    const mW = addClass('P wing', mainThrough(Uv0, Ug));
    const mS = addClass('P side', mainThrough(Sv, Sg));
    const K = intersect3(mW, mirrorX(mW), yPlane(keelJunction * l));
    const J = intersect3(mW, mS, zPlane(K[2]));
    addClass('L point', plane3(K, Pg, A, false));
    addClass('L wing a', plane3(K, A, Ug, false));
    addClass('L wing b', plane3(J, Ug, C, false));
    addClass('L side', plane3(J, C, Sg, false));
  } else {
  const mA = addClass('P point', mainThrough(Av, A));
  const mC = addClass('P side', mainThrough(Cv, C));
  // lower girdle facets: junctions on the ridges between mains, at the plot's plan positions
  // (axis: 17% of the half-length from the culet; diagonal: 0.31 of the half-width at 54 degrees;
  // side: 0.305 of the half-width), or at lowerDepth of the pavilion depth when given
  const jz = lowerDepth ? zPlane(-g - lowerDepth * Pd) : null;
  const K = intersect3(mA, mirrorX(mA), jz || yPlane(0.171 * l));
  const J = intersect3(mA, mC, jz || perpPlane(54, 0.311));
  const K2 = intersect3(mC, mirrorY(mC), jz || xPlane(0.305));
  addClass('L point', plane3(K, Pg, A, false));
  addClass('L a', plane3(J, A, B, false));
  addClass('L b', plane3(J, B, C, false));
  addClass('L side', plane3(K2, C, Sg, false));
  }

  const pct = (v) => `${Math.round(v * 100)}%`;
  const hubNote = hub ? `Hub at ${pct(1 - hub[1] / l)} of the half-length from the point, ${pct(hub[2] / H)} of the crown height.` : '';
  const sideNote = sideHubPt ? ` Side hubs at ${pct(sideHubPt[0])} of the half-width from the centre, ${pct(sideHubPt[2] / H)} of the crown height.` : '';
  const crownPattern = sideHubs
    ? 'crown (IGI FDR762535113) 8 bezels (2 points, 4 wings, 4 half-sides), 10 stars, 20 upper girdle facets: no side bezel; five facets meet at a hub on each side (two half-side bezels tangent to the girdle at 29 degrees, two flank upper girdle facets forming the side, a side star against the table), wing contact at 67 degrees'
    : 'crown 8 bezels (2 points, 4 wings, 2 sides), 8 stars, 16 upper girdle facets';
  return {
    name: 'Marquise brilliant (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Marquise brilliant starting point', `L:W ${ratio}, crown ${crownAngle}${frenchTips ? ', French tips' : ` (point bezels ${pointAngle})`}${sideHubs ? ', side hubs' : ''}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: lab plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to marquise diamonds.',
      'IGI Excellent ranges (marquise brilliant): L:W 1.80-2.20, table 57-62%, crown height 11.5-16.5%, crown angle 33-38.5, pavilion depth 41.5-46%, pavilion angle 39.5-42.5, girdle thin to slightly thick.',
      `This design: L:W ${ratio}, crown height ${pct(crownHeight)}, wing and side bezels ${crownAngle}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}. Bezel angles are measured in each facet's own slope direction; they vary around a fancy outline at a constant crown height.`,
      `Points: ${frenchTips ? 'French tips (GIA 4Cs wireframe). No bezel at the point. Eight facets meet at a hub on the axis: two tip facets forming the point, two small upper girdle facets, the two wing bezels and two half-bezels that run to the table corner. ' + hubNote : 'uncorrected, a shallow bezel at each point (' + pointAngle + ') with a star either side.'}${sideNote}`,
      pavilion === 'mains8'
        ? `Plot pattern: ${crownPattern}; pavilion 8 mains, one under every bezel (2 points, 4 wings, 2 sides), 16 lower girdle facets meeting on the girdle under the upper girdle junctions and on the ridges between mains, ${pct(pointJunction)} of the half-length from the centre beside the point mains and ${pct(bellyJunction)} of the half-width beside the side mains. Every pavilion girdle point sits under a crown one.`
        : pavilion === 'mains4'
        ? `Plot pattern: ${crownPattern}; pavilion 4 mains under the wing bezels, meeting at the culet along the keel line (up to ${pct(keelJunction)} of the half-length from the centre) and the belly line (up to ${pct(bellyJunction)} of the half-width); 16 lower girdle facets, two meeting on the keel under each point bezel and two on the belly line under each side bezel. Every pavilion girdle point sits under a crown one.`
        : bellyMains
        ? `Plot pattern: ${crownPattern}; pavilion (GIA wireframe) 6 mains, each under a side or wing bezel, the wing mains meeting along the keel line up to ${pct(keelJunction)} of the half-length from the centre; 16 lower girdle facets, two meeting on the keel under each point. Every pavilion girdle point sits under a crown one.`
        : `Plot pattern (IGI template): ${crownPattern}; pavilion 8 mains meeting at the culet (contacts about 21% and 65% of the half-length from the point), 16 lower girdle facets with junctions on the axis, the diagonals and the sides. The same pavilion template is drawn on IGI reports FDR689598882, FDR779652382 and FDR762535113.`,
      'Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point.',
    ],
    tiers,
  };
}
