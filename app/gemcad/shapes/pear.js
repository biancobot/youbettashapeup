// Pear brilliant: French tip (default) and uncorrected point. Built with ../shapebuild.js exactly
// the way ../fancy.js builds the marquise: a facet that reaches the girdle touches the girdle polygon
// at the vertex nearest the plot's radial azimuth and takes the outline normal there as its azimuth;
// every other facet is a plane through three meet points or a ridge intersection. One mirror line
// (the long axis): fold 1 + mirror, one representative facet per class on the right half (x >= 0).
//
// Conventions: half-width 1 (width 2), length along y with the point at +y (radial azimuth 90) and
// the head at -y, table at z = H, girdle top z = 0, girdle bottom z = -g.
//
// Reference plot: IGI report FDR727566220 (Pear Brilliant), plotting diagram 1055 x 530 px, crown
// view left, pavilion view right, point at the bottom. FDR733542230 carries the identical template;
// FDR728551644 is a different (modified) template and was not used. The stone of FDR727566220
// measures 13.37 x 7.67 mm (L:W 1.74) but the plot is drawn at L:W 1.45 (crown 524 x 362 px on the
// line centres), so IGI's pear template is fixed and not scaled to the stone; 1.45 is the default
// ratio here. Positions below are in units of the plot's half-width (crown 181 px, pavilion 183.5 px),
// x from the axis, y from the equator (widest section) towards the point, i.e. model coordinates.
//
// Outline (least-squares fit, rms 1.5 px): head = circle, radius 0.99 of the half-width, centred 0.03
// above the equator; wings = circular arcs of radius 2.21, centred at (-/+1.22, 0.03), tangent to
// the head circle and meeting at the point with an included angle of about 110 degrees. The model
// uses the clean form of this: unit head circle centred on the equator, wing arcs through the point
// tangent to it at (+/-1, 0); the arc radius then follows from the length alone (see pearOutline).
//
// Crown (right half), radial azimuth in degrees and plan position:
//   girdle contacts  head bezel 270 (0, -1); shoulder bezel 317.2 (0.722, -0.669); belly bezel 5.4
//                    (0.985, 0.092); wing bezel 55.3 (0.735, 1.059); point bezel 90 (0, 1.895)
//   upper girdle junctions on the girdle  head-shoulder 293.6 (0.398, -0.911); shoulder-belly 337.4
//                    (0.911, -0.379); belly-wing 30.8 (0.929, 0.553); wing-point 74.5 (0.423, 1.523)
//   star tips        head-shoulder (0.317, -0.731); shoulder-belly (0.715, -0.294); belly-wing
//                    (0.680, 0.505); wing-point (0.233, 1.373)
//   table corners    head apex (0, -0.576) az 270; shoulder (0.403, -0.381) az 316.6; belly (0.537,
//                    0.095) az 10.1; wing (0.310, 0.834) az 69.6; point apex (0, 1.227) az 90
//   The table is an eight-sided polygon with apexes on the axis at both ends (the head apex is where
//   the two head stars' edges cross the table edges, drawn as an X on the plot); width 1.07 (54% of
//   the stone's width), length 1.80 (62% of the length), centred 0.33 towards the point.
// Pavilion (right half): the culet sits at 37.6% of the length from the head (0.089 towards the
//   point from the equator); eight mains, none on the axis:
//   main contacts    head 294.4 (0.415, -0.918); shoulder 342.0 (0.943, -0.306); wing 31.1 (0.932,
//                    0.562); point 73.6 (0.445, 1.513)
//   lower girdle junction contacts on the girdle  head 270; head-shoulder 318.1 (0.743, -0.668);
//                    shoulder-wing 4.7 (0.994, 0.082); wing-point 55.5 (0.737, 1.073); point 90
//   junctions on the ridges, relative to the culet  head (0, -0.330); head-shoulder (0.212, -0.220)
//                    i.e. 0.305 at 314 deg; shoulder-wing (0.293, 0) on the x axis; wing-point
//                    (0.179, 0.248) i.e. 0.306 at 54 deg; point (0, 0.325)
//
// Fit: with the defaults below the design's vertices lie within 0.02 of the plot's on average (crown
// 0.019, pavilion 0.015; girdle contacts are quantised to the 128-facet girdle, about 0.03). The one
// larger residual is the wing-point star tip of the uncorrected variant (0.08): on a stone with planar
// bezels that tip lies on the wing/point ridge, and the template draws it 0.08 off that ridge.
import { newTier } from '../design.js?v=128';
import {
  rad, deg, norm360, girdleVertices, vertexNear, vertexNearY, lift,
  planeThrough, mirrorX, zPlane, yPlane, xPlane, azPlane, perpPlane, classTier,
  girdleFromSupport, girdleEqualLength, plane3, intersect3,
} from '../shapebuild.js?v=128';

/**
 * Pear outline, half-width 1, length 2 * ratio: unit circle head centred at the origin (bottom at
 * y = -1), point at y = yP = 2 * ratio - 1, wings = circular arcs through the point tangent to the
 * head circle at (+/-1, 0). Radius Ra = (yP^2 + 1) / 2, centres (-/+(Ra - 1), 0). Returns the
 * support function (by normal angle, radians), and point / outward normal by radial azimuth.
 */
export function pearOutline(ratio) {
  const L = 2 * ratio, yP = L - 1;
  const Ra = (yP * yP + 1) / 2, xa = Ra - 1;
  const phiP = Math.atan2(yP, xa);                 // normal angle of the right wing at the point
  const support = (t) => {
    const c = Math.cos(t), s = Math.sin(t);
    if (s <= 0) return 1;                           // head half: unit circle
    const a = Math.atan2(s, c);
    if (a <= phiP) return -xa * c + Ra;             // right wing arc
    if (a >= Math.PI - phiP) return xa * c + Ra;    // left wing arc
    return yP * s;                                  // the point (corner)
  };
  const point = (az) => {
    const t = rad(az), c = Math.cos(t), s = Math.sin(t);
    if (s <= 1e-12) return [c, s];
    const sx = c >= 0 ? 1 : -1, b = -sx * xa * c;   // ray from the origin meets the wing circle |r u - C| = Ra
    const r = b + Math.sqrt(b * b - (xa * xa - Ra * Ra));
    return [r * c, r * s];
  };
  const normalAz = (az) => {
    const t = rad(az), c = Math.cos(t), s = Math.sin(t);
    if (s <= 1e-12) return norm360(az);
    if (Math.abs(c) < 1e-9) return 90;
    const [x, y] = point(az), sx = c >= 0 ? 1 : -1;
    return norm360(deg(Math.atan2(y, x + sx * xa)));
  };
  return { ratio, L, yP, Ra, xa, pointAngle: 2 * deg(phiP), support, point, normalAz };
}

/**
 * Pear brilliant starting point, pattern of the IGI plotting template:
 * crown: table, 8 bezels (head, 2 shoulders, 2 bellies, 2 wings, point), 8 stars, 16 upper girdle
 * facets; pavilion: 8 mains meeting at the culet, 16 lower girdle facets.
 * The French tip (default) replaces the point bezel by the GIA arrangement used for the marquise: a
 * hub vertex on the axis where eight facets meet (two tip facets at the point, two small upper girdle
 * facets, the two wing bezels and two half-bezels reaching the table apex).
 */
export function pearStart({
  ratio = 1.45, crownAngle = 35, bellyAngle = 33.5, wingAngle = 32, pointAngle = 23, crownHeight = 0.15, girdle = 0.038, pavilionDepth = 0.435,
  culetPos = 0.376, starHeight = 0.65, lowerDepth = 0, gear = 96, girdleFacets = 128,
  frenchTip = true, tipHubHeight = 0.9, tipTable = 0.23, tipGirdle = 0.12,
  pavilion = 'bezels', keelJunction = 0.38, lowerJunction = 0.40, shoulderJunction = 340, tipArc = 0.5, pointArc = 0.5,
} = {}) {
  const W = 2, L = ratio * W, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = pearOutline(ratio), yP = outline.yP;
  const girdleTier = girdleEqualLength(outline, girdleFacets, gear, 90);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 1, true)); return plane; };
  // Girdle contacts, right half (radial azimuths measured on the IGI crown plot)
  const Hv = vertexNear(verts, 270), Sv = vertexNear(verts, 317.2), Bv = vertexNear(verts, 5.4), Wv = vertexNear(verts, 55.3), Pv = vertexNear(verts, 90);
  const Hd = lift(Hv, 0), Sd = lift(Sv, 0), Bd = lift(Bv, 0), Wd = lift(Wv, 0), P = lift(Pv, 0);
  const table = zPlane(H);

  // ---- crown bezels: tangent to the girdle at the contact, azimuth = outline normal there
  const bezel = (angle, v) => planeThrough(angle, outline.normalAz(v.az), lift(v, 0));
  const head = addClass('A head', planeThrough(crownAngle, 270, Hd));
  const shoulder = addClass('A shoulder', bezel(crownAngle, Sv));
  const belly = addClass('A belly', bezel(bellyAngle, Bv));
  const wing = addClass('A wing', bezel(wingAngle, Wv));
  const pt = planeThrough(pointAngle, 90, P);
  if (!frenchTip) addClass('A point', pt);
  // table corners: on each bezel's table line at the plot's radial azimuth
  const A0 = intersect3(head, table, azPlane(270));
  const A1 = intersect3(shoulder, table, azPlane(316.6));
  const A2 = intersect3(belly, table, azPlane(10.1));
  const A3 = intersect3(wing, table, azPlane(69.6));
  const A4 = frenchTip ? [0, yP - tipTable * L, H] : intersect3(pt, table, azPlane(90));
  // ---- stars: through two adjacent table corners and a tip on the bezel ridge at starHeight of the crown height
  const zs = zPlane(starHeight * H);
  const T1 = intersect3(head, shoulder, zs);
  const T2 = intersect3(shoulder, belly, zs);
  const T3 = intersect3(belly, wing, zs);
  addClass('C head', plane3(A0, A1, T1, true));
  addClass('C shoulder', plane3(A1, A2, T2, true));
  addClass('C belly', plane3(A2, A3, T3, true));
  // ---- upper girdle facets: two per gap, meeting the girdle at the plot's junction vertex
  const J1v = vertexNear(verts, 293.6), J2v = vertexNear(verts, shoulderJunction), J3v = vertexNear(verts, 30.8);
  const J1 = lift(J1v, 0), J2 = lift(J2v, 0), J3 = lift(J3v, 0);
  let tipV;   // the crown's girdle junction between the wing bezel and the point: the pavilion lines up under it
  addClass('B head', plane3(T1, Hd, J1, true));
  addClass('B shoulder a', plane3(T1, J1, Sd, true));
  addClass('B shoulder b', plane3(T2, Sd, J2, true));
  addClass('B belly a', plane3(T2, J2, Bd, true));
  addClass('B belly b', plane3(T3, Bd, J3, true));
  addClass('B wing a', plane3(T3, J3, Wd, true));
  let hub = null;
  if (!frenchTip) {
    const T4 = intersect3(wing, pt, zs);
    addClass('C wing', plane3(A3, A4, T4, true));
    // the wing-point upper girdle junction: at pointArc of the girdle from the point to the wing contact
    // when given (it follows the ratio, as the French tip's girdle point does), else the plot's 74.5 degrees
    if (pointArc != null) { const iP = verts.indexOf(Pv), iW = verts.indexOf(Wv); tipV = verts[iP + Math.round(pointArc * (iW - iP))]; }
    else tipV = vertexNear(verts, 74.5);
    const J4 = lift(tipV, 0);
    addClass('B wing b', plane3(T4, Wd, J4, true));
    addClass('B point', plane3(T4, J4, P, true));
  } else {
    // hub on the ridge of the two wing bezels at tipHubHeight of the crown (kept inside the outline)
    let V = intersect3(wing, mirrorX(wing), zPlane(tipHubHeight * H));
    const yMax = yP - 0.04 * L;
    if (V[1] > yMax) V = intersect3(wing, mirrorX(wing), yPlane(yMax));
    hub = V;
    // the tip girdle point: at tipArc of the girdle from the point to the wing contact when given (it
    // then follows the ratio, keeping the two facets either side of it, and the pavilion's below them,
    // from spanning too long an arc), else tipGirdle of the length from the point
    if (tipArc != null) {
      const iP = verts.indexOf(Pv), iW = verts.indexOf(Wv);
      tipV = verts[iP + Math.round(tipArc * (iW - iP))];
    } else tipV = vertexNearY(verts, yP - tipGirdle * L, 1);
    const G = lift(tipV, 0);
    addClass('C half-bezel', plane3(V, A4, A3, true));
    addClass('B tip', plane3(V, G, Wd, true));
    addClass('tip', plane3(P, V, G, true));
  }

  // ---- pavilion: mains tangent to the girdle at the plot contacts, through the culet
  const cY = -1 + culetPos * L;                      // culet position along the axis (fraction of the length from the head)
  const culet = [0, cY, -g - Pd];
  const Mh = vertexNear(verts, 294.4), Ms = vertexNear(verts, 342.0), Mw = vertexNear(verts, 31.1), Mp = vertexNear(verts, 73.6);
  const mainThrough = (v) => {
    const p = lift(v, -g), az = outline.normalAz(v.az), u = [Math.cos(rad(az)), Math.sin(rad(az))];
    const h = u[0] * p[0] + u[1] * p[1] - u[1] * cY;  // horizontal run from the culet to the contact along the facet's slope
    return planeThrough(-deg(Math.atan2(Pd, h)), az, p);
  };
  if (pavilion === 'bezels') {
    // ---- seven mains, one under every bezel but the point's (head, shoulders, bellies, wings): the
    // eight-main pattern with the point main collapsed. The two wing mains meet along the keel line
    // from the culet to the keel junction K (keelJunction half-widths from the culet towards the
    // point); from K to the point the keel is the ridge between two lower girdle facets, so the point
    // bezel (or the French tip's point) sits above a lower girdle junction. Two lower girdle facets
    // between each pair of mains meet on the girdle under the crown's upper girdle junctions (and
    // the tip junction), on the ridges between mains lowerJunction half-widths from the culet (the
    // diagram's 0.4, along the ridges at about 32, -22 and -65 degrees). Every pavilion girdle point
    // sits under a crown one and the reverse.
    const mH = addClass('P head', mainThrough(Hv));
    const mS = addClass('P shoulder', mainThrough(Sv));
    const mB = addClass('P belly', mainThrough(Bv));
    const mW = addClass('P wing', mainThrough(Wv));
    const K = intersect3(mW, mirrorX(mW), yPlane(cY + keelJunction));
    const out = (az) => perpPlane(az, lowerJunction + Math.sin(rad(az)) * cY);   // lowerJunction from the culet along azimuth az
    const Jhs = intersect3(mH, mS, out(295)), Jsb = intersect3(mS, mB, out(338)), Jbw = intersect3(mB, mW, out(32));
    const gb = (v) => lift(v, -g), Tg = gb(tipV);
    addClass('L point a', plane3(K, gb(Pv), Tg, false));
    addClass('L point b', plane3(K, Tg, gb(Wv), false));
    addClass('L wing', plane3(Jbw, gb(Wv), gb(J3v), false));
    addClass('L belly a', plane3(Jbw, gb(J3v), gb(Bv), false));
    addClass('L belly b', plane3(Jsb, gb(Bv), gb(J2v), false));
    addClass('L shoulder a', plane3(Jsb, gb(J2v), gb(Sv), false));
    addClass('L shoulder b', plane3(Jhs, gb(Sv), gb(J1v), false));
    addClass('L head', plane3(Jhs, gb(J1v), gb(Hv), false));
  } else {
  const mHead = addClass('P head', mainThrough(Mh));
  const mShoulder = addClass('P shoulder', mainThrough(Ms));
  const mWing = addClass('P wing', mainThrough(Mw));
  const mPoint = addClass('P point', mainThrough(Mp));
  // lower girdle facets: junctions on the ridges between mains at the plot's plan positions relative
  // to the culet (axis: 0.33 towards the head and 0.325 towards the point; diagonals: 0.305 at 314
  // degrees and 0.306 at 54 degrees; sides: 0.293 on the x axis), or at lowerDepth of the pavilion depth
  const jz = lowerDepth ? zPlane(-g - lowerDepth * Pd) : null;
  const fromCulet = (az, r) => perpPlane(az, r + Math.sin(rad(az)) * cY);
  const Kh = intersect3(mHead, mirrorX(mHead), jz || yPlane(cY - 0.330));
  const Jhs = intersect3(mHead, mShoulder, jz || fromCulet(314, 0.305));
  const Ks = intersect3(mShoulder, mWing, jz || xPlane(0.293));
  const Jwp = intersect3(mWing, mPoint, jz || fromCulet(54, 0.306));
  const Kp = intersect3(mPoint, mirrorX(mPoint), jz || yPlane(cY + 0.325));
  const Hg = lift(Hv, -g), Pg = lift(Pv, -g), Mhg = lift(Mh, -g), Msg = lift(Ms, -g), Mwg = lift(Mw, -g), Mpg = lift(Mp, -g);
  const L1 = lift(vertexNear(verts, 318.1), -g), Ls = lift(vertexNear(verts, 4.7), -g), L2 = lift(vertexNear(verts, 55.5), -g);
  addClass('L head', plane3(Kh, Hg, Mhg, false));
  addClass('L a', plane3(Jhs, Mhg, L1, false));
  addClass('L b', plane3(Jhs, L1, Msg, false));
  addClass('L c', plane3(Ks, Msg, Ls, false));
  addClass('L d', plane3(Ks, Ls, Mwg, false));
  addClass('L e', plane3(Jwp, Mwg, L2, false));
  addClass('L f', plane3(Jwp, L2, Mpg, false));
  addClass('L point', plane3(Kp, Mpg, Pg, false));
  }

  const pct = (v) => `${Math.round(v * 100)}%`, pct1 = (v) => `${Math.round(v * 1000) / 10}%`;
  const hubNote = hub ? `Hub at ${pct(( yP - hub[1]) / L)} of the length from the point, ${pct(hub[2] / H)} of the crown height.` : '';
  const tableW = 2 * Math.max(A1[0], A2[0], A3[0]);
  return {
    name: 'Pear brilliant (starting point)', gear, fold: 1, mirror: true, ri: 2.42,
    headings: ['Pear brilliant starting point', `L:W ${ratio}, crown ${crownAngle}, bellies ${bellyAngle}, wings ${wingAngle}${frenchTip ? ', French tip' : ` (point bezel ${pointAngle})`}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: lab plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to pear diamonds.',
      'IGI Excellent ranges (pear brilliant, "Guidelines for Excellent: Fancy Shape Cut Grading"): L:W 1.40-1.75, total depth 57.5-65%, table 57.5-62%, crown height 11.5-16%, crown angle 33-38, girdle 2-6% (thin to thick), pavilion depth 41-46%, pavilion angle 38-42.5, culet pointed to small, symmetry and polish Very Good or Excellent. Additional requirements: rounded base, even shoulders, no significant bow tie, table and culet proportionately positioned along the L:W axis. The brochure lists no Very Good ranges.',
      `This design: L:W ${ratio}, crown height ${pct(crownHeight)}, head and shoulder bezels ${crownAngle}, belly bezels ${bellyAngle}, wing bezels ${wingAngle}, pavilion depth ${pct(pavilionDepth)}, girdle ${pct(girdle)}, table width ${pct1(tableW / W)} of the width, culet ${pct1(culetPos)} of the length from the head. Bezel angles are measured in each facet's own slope direction; they vary around a fancy outline at a constant crown height.`,
      `Point: ${frenchTip ? 'French tip (GIA 4Cs marquise wireframe arrangement). No bezel at the point. Eight facets meet at a hub on the axis: two tip facets forming the point, two small upper girdle facets, the two wing bezels and two half-bezels that run to the table apex. The hub is the intersection of the two wing bezels on the mirror plane at ' + pct(tipHubHeight) + ' of the crown height. ' + hubNote : 'uncorrected, a shallow bezel at the point (' + pointAngle + ') with a star either side.'}`,
      pavilion === 'bezels' ? `Pavilion: 7 mains, one under each head, shoulder, belly and wing bezel (the 8-main pattern with the point main collapsed); the wing mains meet along the keel line to ${keelJunction} half-widths from the culet, and two lower girdle facets meet on the keel under the point. 16 lower girdle facets, their girdle junctions under the upper girdle junctions; ridge junctions ${lowerJunction} half-widths from the culet. Every pavilion girdle point sits under a crown one.` : '',
      pavilion === 'bezels' ? `Crown pattern (IGI template, report FDR727566220): 8 bezels (head, 2 shoulders, 2 bellies, 2 wings, point), 8 stars, 16 upper girdle facets, eight-sided table with an apex on the axis at each end. Changed from the plot so the facets either side of each girdle junction dig in evenly now that the pavilion lines up under them: the shoulder-belly junction at ${shoulderJunction} degrees (plot 337.4), the ${frenchTip ? 'French tip girdle point' : 'wing-point junction'} at ${frenchTip ? tipArc : pointArc} of the girdle from the point to the wing contact${frenchTip ? ', the hub at ' + pct(tipHubHeight) + ' of the crown height' : ''}. The plot is drawn at L:W 1.45 whatever the stone measures.` : '',
      pavilion === 'bezels' ? '' : 'Plot pattern (IGI template, report FDR727566220): crown 8 bezels (head, 2 shoulders, 2 bellies, 2 wings, point), 8 stars, 16 upper girdle facets, eight-sided table with an apex on the axis at each end; pavilion 8 mains meeting at the culet (none on the axis; contacts at 5% and 48% of the length from the head and at 44% and 13% from the point), 16 lower girdle facets with junctions on the axis towards the head and the point, on the two diagonals and on the sides. The plot is drawn at L:W 1.45 whatever the stone measures.',
      `Outline: head a circle of the half-width, wings circular arcs of radius ${Math.round(outline.Ra * 100) / 100} half-widths tangent to it at the widest section and meeting at the point with an included angle of ${Math.round(outline.pointAngle)} degrees (fitted to the plot: head radius 0.99, wing radius 2.21).`,
      'Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point.',
    ].filter(Boolean),
    tiers,
  };
}

const base = [
  { key: 'ratio', label: 'L:W', default: 1.45, step: 0.01, min: 1.2 },
  { key: 'crownAngle', label: 'Crown angle', default: 35, step: 0.5, title: 'Head and shoulder bezel angle' },
  { key: 'bellyAngle', label: 'Belly bezels', default: 33.5, step: 0.5 },
  { key: 'wingAngle', label: 'Wing bezels', default: 32, step: 0.5 },
  { key: 'pointAngle', label: 'Point bezel', default: 23, step: 0.5, title: 'Point bezel angle (uncorrected point)' },
  { key: 'crownHeight', label: 'Crown height', default: 0.15, step: 0.005, title: 'Fraction of the width' },
  { key: 'girdle', label: 'Girdle', default: 0.038, step: 0.005 },
  { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.435, step: 0.005 },
];
const pav = [
  { key: 'shoulderJunction', label: 'Shoulder-belly junction', default: 340, step: 0.5, min: 320, max: 360, title: 'Radial azimuth of the upper girdle junction between the shoulder and belly bezels, with the lower girdle junction under it (the IGI plot has 337.4; 340 splits the head circle more evenly so the facets either side dig less)' },
  { key: 'keelJunction', label: 'Keel junction', default: 0.38, step: 0.01, min: 0.05, max: 1.2, title: 'Where the wing mains stop meeting along the keel line and the point lower girdle facets take over, half-widths from the culet towards the point' },
  { key: 'lowerJunction', label: 'Lower junctions', default: 0.40, step: 0.01, min: 0.1, max: 0.8, title: 'Lower girdle junctions on the ridges between the head, shoulder, belly and wing mains, half-widths from the culet' },
];
const french = [
  { key: 'tipHubHeight', label: 'Hub height', default: 0.9, step: 0.01, min: 0.5, max: 0.98, title: 'French tip hub, fraction of the crown height' },
  { key: 'tipTable', label: 'Tip table corner', default: 0.23, step: 0.01, title: 'Table corner distance from the point, fraction of the length' },
  { key: 'tipArc', label: 'Tip girdle point', default: 0.5, step: 0.01, min: 0.2, max: 0.8, title: 'Where the tip facet meets the girdle: share of the girdle from the point to the wing bezel contact (it follows the L:W, keeping the facets either side of it from digging into the girdle)' },
];

export const templates = {
  pear: { name: 'Pear brilliant, French tip (starting point)', note: 'IGI crown plot with typical angles and a GIA-style French tip; seven pavilion mains, one under each bezel but the point, the lower girdle facets meeting on the keel under the tip.', params: [...base, ...french, ...pav], make: (o = {}) => pearStart({ ...o }) },
  pearStd: { name: 'Pear brilliant, uncorrected point (starting point)', note: 'IGI crown plot with typical angles and a shallow bezel at the point; seven pavilion mains, one under each bezel but the point, the lower girdle facets meeting on the keel under the point bezel.', params: [...base, { key: 'pointArc', label: 'Point junction', default: 0.5, step: 0.01, min: 0.2, max: 0.8, title: 'Where the point star\'s two upper girdle facets meet the girdle: share of the girdle from the point to the wing bezel contact (it follows the L:W; the IGI plot has about 0.53 at L:W 1.45)' }, ...pav], make: (o = {}) => pearStart({ frenchTip: false, ...o }) },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'pear-crown', label: 'Pear: crown (IGI)' },
  { id: 'pear-pavilion', label: 'Pear: pavilion (IGI)' },
];
