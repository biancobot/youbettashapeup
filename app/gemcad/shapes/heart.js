// Heart brilliant starting designs: the IGI plotting template's facet pattern with typical
// angles, French tips by default. Built the way ../fancy.js builds the marquise: a facet that
// reaches the girdle touches the girdle polygon at a vertex chosen by radial azimuth, and its
// azimuth is the outline normal there; the other facets are planes through three meet points.
//
// The heart is not convex: the cleft between the lobes is a notch in the outline, and the two
// cleft facets of the crown (and the two cleft mains of the pavilion) meet along the mirror plane
// in a concave groove. The kernel only intersects half-spaces, so the stone is modelled as the
// UNION OF TWO CONVEX HALVES split along x = 0: every facet is built for the right half (x >= 0);
// a facet whose plane would also cut into the left half (the girdle, the cleft facets, the lobe
// facets whose contacts face the other lobe) becomes a pair of tiers marked `half: 'right'` and
// `half: 'left'` (its mirror image), each applied to its half only; the other facets stay
// ordinary mirror-symmetric tiers. designPlanes(design, half) builds each half with the
// splitting plane, unionHalves() drops the internal seam faces and merges the facets that cross
// the seam (table, point bezel, hub facets), and mesh.js draws no line between coplanar faces,
// so the table shows no seam while the groove edges, which are real creases, do.
//
// Orientation: width 2 along x, length along y, point at -y (radial azimuth 270), cleft at +y,
// as GIA and IGI plots draw a heart; table at z = H, girdle top at z = 0.
import { newTier, tierFromPlane } from '../design.js';
import {
  rad, deg, heartHalfOutline, mirrorSupport, chordAz, girdleVertices, vertexNear, vertexNearY, lift,
  planeThrough, planeAz, mirrorX, zPlane, yPlane, azPlane, perpPlane, classTier, girdleFromSupport, plane3, intersect3,
} from '../shapebuild.js';

/*
 * Positions measured on IGI report FDR675586951 (plot 1055 x 530 px; crown left half, centre
 * (264, 264) px, pavilion right half, centre (794, 264.5) px; half-width 232 px; units: the
 * half-width; y along the length, +y towards the cleft; radial azimuth in degrees
 * counter-clockwise from +x). Plot L:W 1.052 (488 x 464 px). The same pattern is on
 * FDR685548981 and FDR728551327.
 *
 * Outline: lobe circle centre (0.44, 0.51) r 0.56 (fit residual 0.012), lower arc centre
 * (-1.32, 1.05) R 2.46 (residual 0.012), nearly tangent to the lobe (gap 0.06); cleft (0, 0.858);
 * point (0, -1.05).
 *
 * Crown (px -> units). Table octagon with a notch at the cleft; the template draws the notch
 * vertex AT the girdle cleft (table vertex C = girdle cleft), which no real table can do.
 *   C  cleft / table notch        (264, 67)  -> (0, 0.849)
 *   J1 cleft star tip             (393, 59)  -> (0.556, 0.884)   five lines meet: C, Ga, Gb, Gc, V
 *   Ga cleft facet contact        (317, 31)  -> (0.228, 1.004)  az 77.2
 *   Gb upper girdle junction      (405, 29)  -> (0.608, 1.013)  az 59.0
 *   Gc lobe bezel contact         (468, 68)  -> (0.879, 0.845)  az 43.9
 *   V  table corner (lobe)        (400, 115) -> (0.586, 0.642)  az 47.6
 *   W  lobe/side star tip         (457, 140) -> (0.832, 0.534)
 *   Gd side bezel upper contact   (494, 145) -> (0.991, 0.513)  az 27.4
 *   X  table corner (side)        (408, 210) -> (0.621, 0.233)  az 20.6  (on the straight line V-A)
 *   Ge side bezel lower contact   (482, 230) -> (0.940, 0.147)  az  8.9
 *   A  side/lower star tip        (415, 288) -> (0.651, -0.103)  five lines meet: Ge, Gf, Gg, X, D
 *   Gf upper girdle junction      (445, 312) -> (0.780, -0.207) az -14.9
 *   Gg lower bezel upper contact  (391, 390) -> (0.547, -0.543) az -44.8
 *   D  table corner (lower)       (341, 350) -> (0.332, -0.371) az -48.2
 *   B0 table bottom vertex        (264, 416) -> (0, -0.655)     0.376 of the half-length from the point
 *   E  lower/point star tip       (292, 440) -> (0.121, -0.759)
 *   Gh lower bezel lower contact  (316, 462) -> (0.224, -0.853) az -75.3
 *   P  point                      (264, 505) -> (0, -1.04)
 * The template draws the bezel edges and star edges as single straight lines crossing each
 * other (Ge-A-D-B0, Gh-E-B0, W-X-D-E): the facets are table, 2 cleft facets (C-Ga-J1), lobe
 * bezels (kites V-J1-Gc-W), side bezels (X-W-Gd-Ge-A, touching the girdle along Gd-Ge), lower
 * bezels (D-A-Gg-Gh-E, touching along Gg-Gh), point bezel (B0-E-P-E'), 8 stars (C-J1-V, V-W-X,
 * X-A-D, D-E-B0), 12 upper girdle facets (J1: Ga-Gb, Gb-Gc; W: Gc-Gd; A: Ge-Gf, Gf-Gg; E: Gh-P).
 *
 * Pavilion. A line runs the whole length on the axis: the cleft groove (Cp-K1), the lobe mains'
 * ridge (K1-K2), the point mains' ridge (K2-K3) and the keel (K3-P).
 *   Cp cleft                      (794, 67)  -> (0, 0.851)
 *   Gb lobe main contact          (903, 25)  -> (0.47, 1.03)    lobe top; used at az 65 so the
 *                                                               outline normal is 85 (see below)
 *   K1 cleft mains' apex (axis)   (794, 167) -> (0, 0.420)
 *   Jp lobe/side junction         (843, 187) -> (0.211, 0.334)  az 57.7, r 0.395
 *   Gc lower girdle junction      (985, 53)  -> (0.823, 0.912)  az 47.9
 *   Gd side main contact          (1022, 128)-> (0.983, 0.588)  az 30.9
 *   K2 culet (axis)               (794, 235) -> (0, 0.127)      0.12 of the half-length above centre
 *   Q  side/lower junction        (857, 235) -> (0.272, 0.127)  az 25.0, r 0.300
 *   Gs lower girdle junction      (1013, 235)-> (0.944, 0.127)  az  7.7
 *   Gf lower main contact         (985, 300) -> (0.823, -0.153) az -10.5
 *   R  lower/point junction       (840, 282) -> (0.198, -0.075) az -20.7, r 0.212
 *   Gh lower girdle junction      (937, 371) -> (0.616, -0.459) az -36.7
 *   Gk point main contact         (884, 425) -> (0.388, -0.692) az -60.7
 *   K3 point mains' apex (axis)   (794, 300) -> (0, -0.153)
 * Facets: 2 cleft mains (Cp-Gb-K1, touching along the arc Cp-Gb), 8 mains meeting at the culet
 * (lobe Gb-K1-K2-Jp, side Jp-Gd-Q-K2, lower Q-Gf-R-K2, point R-Gk-K3-K2), 14 lower girdle
 * facets (Jp: Gb-Gc, Gc-Gd; Q: Gd-Gs, Gs-Gf; R: Gf-Gh, Gh-Gk; K3: Gk-P).
 */
const PLOT = {
  ratio: 1.05, lobe: 0.56, lowerRadius: 2.46,
  crown: { Ga: 77.2, Gb: 59.0, Gtop: 68, Gc: 43.9, V: 47.6, Gd: 27.4, X: 20.6, Ge: 8.9, Gf: -14.9, Gg: -44.8, D: -48.2, Gh: -75.3, B0: 0.376 },
  pav: { Gb: 65, Gc: 47.9, Gd: 30.9, Gs: 7.7, Gf: -10.5, Gh: -36.7, Gk: -60.7, K1: 0.420, Jp: [57.7, 0.395], Q: [25.0, 0.300], R: [-20.7, 0.212], K3: -0.153,
    // lower girdle facets touch the girdle at the middle of their arcs; the cleft main near the cleft (the
    // arc from the cleft to the lobe top is long: a chord would cut through the girdle, a contact at the
    // middle would leave a hill at the cleft)
    Lcleft: 86, L1: 56.5, L2: 39.5, L3: 19.5, L4: -1, L5: -24, L6: -49, L7: -75.5 },
};

/**
 * Heart brilliant starting point.
 * Crown: table (octagon notched at the cleft), 2 cleft facets, 7 bezels (2 lobe, 2 side, 2 lower,
 * 1 point or the French-tip hub arrangement), 8 stars, 12 upper girdle facets. Pavilion: 2 cleft
 * mains, 8 mains meeting at the culet, 14 lower girdle facets.
 * `crownAngle` is the lobe and side bezel angle, `lowerAngle` the lower bezels', `pointAngle`
 * the point bezel's (uncorrected point), `cleftAngle` the cleft facets'. A cleft facet touches
 * the girdle along the chord from the cleft to Ga; where it meets its mirror image is the groove
 * from the cleft down to the table notch, whose depth follows from the angle (35, the crown
 * angle, puts the notch 0.40 of the half-length below the cleft and the cleft star tips close to
 * where the template has them; a steeper cleft facet gives a shallower notch but pushes the
 * cleft star tips out to the girdle; the template draws the notch at the cleft itself, which
 * would need vertical cleft facets). The cleft star tips sit on the cleft facet / lobe bezel ridge at `cleftTip` of the
 * crown height, the other star tips on the bezel ridges at `starHeight`. Crown facets that the
 * template draws along an arc pass through the two girdle vertices (the girdle dips slightly
 * between them); the pavilion's touch the girdle at the middle of the arc with the outline
 * normal there, so the girdle keeps its thickness under the crown dips. The culet is `culetOffset` of the half-length above the centre, towards the
 * lobes, as on the plot. The pavilion cleft mains meet on the axis at `pavilionCleft` of the
 * half-length below the cleft.
 */
export function heartStart({
  ratio = PLOT.ratio, lobe = 0.57, lowerRadius = PLOT.lowerRadius,
  crownAngle = 35, lowerAngle = 41, pointAngle = 31, cleftAngle = 35, crownHeight = 0.12, girdle = 0.04, pavilionDepth = 0.41,
  starHeight = 0.65, cleftTip = 0.65, culetOffset = 0.12, pavilionCleft = 0.41,
  gear = 96, girdleFacets = 128,
  frenchTips = true, tipHubHeight = 0.75, tipTable = PLOT.crown.B0, tipGirdle = 0.16,
} = {}) {
  const W = 2, l = ratio, H = crownHeight * W, g = girdle * W, Pd = pavilionDepth * W;
  const outline = heartHalfOutline(l, lobe, lowerRadius);
  // Girdle: one tier per half, each the preform of that half's convex outline.
  const gR = girdleFromSupport(outline.support, girdleFacets, gear, 0.5); gR.name = 'G right'; gR.half = 'right';
  const gL = girdleFromSupport(mirrorSupport(outline.support), girdleFacets, gear, 0.5); gL.name = 'G left'; gL.half = 'left';
  const verts = girdleVertices(gR, gear).filter((v) => v.p[0] >= -1e-6);   // right half of the hull polygon
  const tiers = [gR, gL, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const table = zPlane(H);
  const C = [0, outline.cleft[1], 0], P = [0, -l, 0];
  const probes = [];   // right-half points whose mirror images must stay inside every common facet
  const addProbe = (p) => { probes.push(p); return p; };
  for (const v of verts) { probes.push(lift(v, 0)); probes.push(lift(v, -g)); }
  /** Facet class: one tier (axis facet), a mirror pair, or, when the plane would cut the other half, a half-only tier and its mirror image. */
  const addClass = (name, plane) => {
    const t = tierFromPlane(plane.n, plane.d, gear);
    const k = Math.round(t.index * 1e6) / 1e6;
    if (Math.abs(plane.n[0]) < 1e-9) tiers.push(newTier({ name, angle: t.angle, distance: t.distance, indices: [k] }));
    else if (!probes.some((p) => -plane.n[0] * p[0] + plane.n[1] * p[1] + plane.n[2] * p[2] > plane.d + 1e-9)) tiers.push(classTier(name, plane, gear, 1, true));
    else {
      tiers.push(newTier({ name: `${name} R`, angle: t.angle, distance: t.distance, indices: [k], half: 'right' }));
      tiers.push(newTier({ name: `${name} L`, angle: t.angle, distance: t.distance, indices: [Math.round(((gear - k) % gear) * 1e6) / 1e6], half: 'left' }));
    }
    return plane;
  };
  const G = (az, z = 0) => lift(vertexNear(verts, az), z);
  const pc = PLOT.crown;

  // ---- crown bezels: lobe bezel tangent at Gc with the outline normal; side and lower bezels
  // through two girdle vertices (the template draws them touching the girdle along an arc)
  const Gc = G(pc.Gc), Gd = G(pc.Gd), Ge = G(pc.Ge), Gg = G(pc.Gg), Gh = G(pc.Gh), Ga = G(pc.Ga), Gb = G(pc.Gb), Gf = G(pc.Gf);
  const lobeBezel = planeThrough(crownAngle, outline.normalAz(vertexNear(verts, pc.Gc).az), Gc);
  const sideBezel = planeThrough(crownAngle, chordAz(Gd, Ge), Gd);
  const lowerBezel = planeThrough(lowerAngle, chordAz(Gg, Gh), Gg);
  const V = addProbe(intersect3(lobeBezel, table, azPlane(pc.V)));
  const X = addProbe(intersect3(sideBezel, table, azPlane(pc.X)));
  const D = addProbe(intersect3(lowerBezel, table, azPlane(pc.D)));
  // cleft facet: along the chord from the girdle cleft to Ga; the table notch T0 is where its groove reaches the table
  const cleft = planeThrough(cleftAngle, chordAz(C, Ga), C);
  const T0 = intersect3(cleft, mirrorX(cleft), table);
  const J1 = addProbe(intersect3(cleft, lobeBezel, zPlane(cleftTip * H)));
  const Wt = addProbe(intersect3(lobeBezel, sideBezel, zPlane(starHeight * H)));
  const A = addProbe(intersect3(sideBezel, lowerBezel, zPlane(starHeight * H)));
  let hub = null, B0, E;
  const pt = planeThrough(pointAngle, 270, P);
  if (!frenchTips) {
    B0 = addProbe(intersect3(pt, table, azPlane(270)));
    E = addProbe(intersect3(lowerBezel, pt, zPlane(starHeight * H)));
  } else {
    // hub on the ridge of the two lower bezels at tipHubHeight of the crown (kept inside the outline)
    hub = intersect3(lowerBezel, mirrorX(lowerBezel), zPlane(tipHubHeight * H));
    if (hub[1] < -0.97 * l) hub = intersect3(lowerBezel, mirrorX(lowerBezel), yPlane(-0.97 * l));
    addProbe(hub);
    B0 = [0, -(1 - tipTable) * l, H];
  }
  addClass('cleft', cleft);
  addClass('A lobe', lobeBezel);
  addClass('A side', sideBezel);
  addClass('A lower', lowerBezel);
  if (!frenchTips) addClass('A point', pt);
  // stars: through two table corners and the tip on the bezel ridge
  addClass('C cleft', plane3(T0, V, J1, true));
  addClass('C lobe-side', plane3(V, X, Wt, true));
  addClass('C side-lower', plane3(X, D, A, true));
  // upper girdle facets: through the star tip and two girdle vertices
  // across the lobe top the arc is long: this facet touches the girdle at the top with the outline normal (the girdle thickens towards Ga and Gb)
  const Gtop = vertexNear(verts, pc.Gtop);
  addClass('B cleft-lobe', planeAz(J1, lift(Gtop, 0), outline.normalAz(Gtop.az), true));
  addClass('B lobe', plane3(J1, Gb, Gc, true));
  addClass('B lobe-side', plane3(Wt, Gc, Gd, true));
  addClass('B side', plane3(A, Ge, Gf, true));
  addClass('B lower', plane3(A, Gf, Gg, true));
  if (!frenchTips) {
    addClass('C lower-point', plane3(D, B0, E, true));
    addClass('B point', plane3(E, Gh, P, true));
  } else {
    const Gt = lift(vertexNearY(verts, -(1 - tipGirdle) * l, 1), 0);
    addClass('C half-bezel', plane3(hub, B0, D, true));
    addClass('B tip', plane3(hub, Gt, Gh, true));
    addClass('tip', plane3(P, hub, Gt, true));
  }

  // ---- pavilion: mains tangent to the girdle at the plot contacts, through the off-centre culet
  const pp = PLOT.pav;
  const culet = [0, culetOffset * l, -g - Pd];
  const mainAt = (az) => {
    const v = vertexNear(verts, az), p = lift(v, -g);
    const naz = outline.normalAz(v.az), u = [Math.cos(rad(naz)), Math.sin(rad(naz))];
    const h = u[0] * (p[0] - culet[0]) + u[1] * (p[1] - culet[1]);
    return planeThrough(-deg(Math.atan2(Pd, h)), naz, p);
  };
  const mLobe = mainAt(pp.Gb), mSide = mainAt(pp.Gd), mLower = mainAt(pp.Gf), mPoint = mainAt(pp.Gk);
  /** Pavilion facet through the junction J, touching the girdle at the vertex near azimuth az with the outline normal there. */
  const touching = (J, az) => { const v = vertexNear(verts, az); return planeAz(J, lift(v, -g), outline.normalAz(v.az), false); };
  const K1 = addProbe(intersect3(mLobe, mirrorX(mLobe), yPlane(C[1] - pavilionCleft * l)));
  const Jp = addProbe(intersect3(mLobe, mSide, perpPlane(pp.Jp[0], pp.Jp[1])));
  const Q = addProbe(intersect3(mSide, mLower, perpPlane(pp.Q[0], pp.Q[1])));
  const R = addProbe(intersect3(mLower, mPoint, perpPlane(pp.R[0], pp.R[1])));
  const K3 = addProbe(intersect3(mPoint, mirrorX(mPoint), yPlane(pp.K3)));
  addProbe(culet);
  addClass('P cleft', touching(K1, pp.Lcleft));
  addClass('P lobe', mLobe);
  addClass('P side', mSide);
  addClass('P lower', mLower);
  addClass('P point', mPoint);
  addClass('L cleft-lobe', touching(Jp, pp.L1));
  addClass('L lobe', touching(Jp, pp.L2));
  addClass('L side a', touching(Q, pp.L3));
  addClass('L side b', touching(Q, pp.L4));
  addClass('L lower a', touching(R, pp.L5));
  addClass('L lower b', touching(R, pp.L6));
  addClass('L point', touching(K3, pp.L7));

  const pct = (v) => `${Math.round(v * 100)}%`;
  const ang = (pl) => Math.round(Math.abs(tierFromPlane(pl.n, pl.d, gear).angle) * 10) / 10;
  const hubNote = hub ? ` Hub at ${pct((hub[1] + l) / l)} of the half-length from the point, ${pct(hub[2] / H)} of the crown height.` : '';
  const halves = tiers.filter((t) => t.half === 'right').map((t) => t.name.replace(/ R$/, '')).join(', ');
  return {
    name: 'Heart brilliant (starting point)', gear, fold: 1, mirror: true, ri: 2.42,
    headings: ['Heart brilliant starting point', `L:W ${ratio}, crown ${crownAngle}${frenchTips ? ', French tip' : ` (point bezel ${pointAngle})`}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: lab plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to heart diamonds.',
      'IGI Excellent ranges (heart brilliant): L:W 0.85-0.95, total depth 51.9-61.0%, table 58-64%, crown height 11.5-14%, crown angle 32-38, girdle 2-6% (thin to thick, excluding the shoulders), pavilion depth 39-43%, pavilion angle 39-42.5, culet pointed to small. IGI publishes no Very Good column for the heart; bow-tie must not be significant.',
      `Plot L:W 1.05 (IGI reports FDR675586951, FDR685548981, FDR728551327 all use the same template), longer than IGI's Excellent range; the default ratio is the plot's.`,
      `This design: L:W ${ratio}, crown height ${pct(crownHeight)}, lobe and side bezels ${crownAngle}, lower bezels ${lowerAngle}, cleft facets ${ang(cleft)}, pavilion depth ${pct(pavilionDepth)} (mains ${ang(mLobe)} lobe, ${ang(mSide)} side, ${ang(mLower)} lower, ${ang(mPoint)} point), girdle ${pct(girdle)}, culet ${pct(culetOffset)} of the half-length above the centre. Outline: lobe radius ${lobe} of the half-width, lower arc radius ${lowerRadius}, cleft ${pct(1 - outline.cleft[1] / l)} of the half-length deep. Table notch ${pct((C[1] - T0[1]) / l)} of the half-length below the cleft.`,
      `Point: ${frenchTips ? 'French tip (GIA 4Cs wireframe). No bezel at the point. Eight facets meet at a hub on the axis: two tip facets forming the point, two small upper girdle facets, the two lower bezels and two half-bezels that run to the table corner.' + hubNote : 'uncorrected, a shallow bezel at the point (' + pointAngle + ') with a star either side.'}`,
      'Plot pattern (IGI template): crown table notched at the cleft, 2 cleft facets, 7 bezels (2 lobe kites, 2 side and 2 lower bezels touching the girdle along an arc, 1 point), 8 stars, 12 upper girdle facets; pavilion 2 cleft mains, 8 mains meeting at the culet (offset towards the lobes), 14 lower girdle facets; a line runs the full length of the pavilion on the axis (cleft groove, main ridges, keel). The template draws the table notch at the girdle cleft and the bezel and star edges as single crossing lines; a real stone has a groove from the cleft down to the table notch.',
      'Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point (the chord normal where the template shows a facet along an arc).',
      `Non-convex: the cleft makes the heart the union of two convex halves split on the mirror plane. Tiers ${halves} cut one half only (marked half:right / half:left); the others are ordinary mirror pairs. GemCad has no such facets: the .asc export marks them in the cutting instructions.`,
    ],
    tiers,
  };
}

const base = [
  { key: 'ratio', label: 'L:W', default: PLOT.ratio, step: 0.01, min: 0.7 },
  { key: 'lobe', label: 'Lobe radius', default: 0.57, step: 0.01, min: 0.51, max: 0.8, title: 'Lobe circle radius, fraction of the half-width (sets the cleft depth)' },
  { key: 'lowerRadius', label: 'Side radius', default: PLOT.lowerRadius, step: 0.1, min: 1.2, title: 'Radius of the lower sides, fraction of the half-width' },
  { key: 'crownAngle', label: 'Crown angle', default: 35, step: 0.5, title: 'Lobe and side bezel angle' },
  { key: 'lowerAngle', label: 'Lower bezels', default: 41, step: 0.5, title: 'Lower bezel angle' },
  { key: 'cleftAngle', label: 'Cleft facets', default: 35, step: 0.5, min: 10, max: 80, title: 'Cleft facet angle; the table notch depth follows' },
  { key: 'crownHeight', label: 'Crown height', default: 0.12, step: 0.005, title: 'Fraction of the width' },
  { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.41, step: 0.005, title: 'Fraction of the width' },
  { key: 'girdle', label: 'Girdle', default: 0.04, step: 0.005 },
  { key: 'starHeight', label: 'Star tips', default: 0.65, step: 0.05, min: 0.2, max: 0.95, title: 'Star tip height, fraction of the crown height' },
  { key: 'cleftTip', label: 'Cleft star tip', default: 0.65, step: 0.05, min: 0.2, max: 0.95, title: 'Cleft star tip height, fraction of the crown height' },
  { key: 'culetOffset', label: 'Culet offset', default: 0.12, step: 0.01, title: 'Culet above the centre, fraction of the half-length' },
  { key: 'pavilionCleft', label: 'Pavilion cleft', default: 0.41, step: 0.01, title: 'Cleft mains meet on the axis this far below the cleft, fraction of the half-length' },
];
const french = [
  { key: 'tipHubHeight', label: 'Hub height', default: 0.75, step: 0.01, min: 0.5, max: 0.98, title: 'French tip hub, fraction of the crown height' },
  { key: 'tipTable', label: 'Tip table corner', default: PLOT.crown.B0, step: 0.01, title: 'Table corner distance from the point, fraction of the half-length' },
  { key: 'tipGirdle', label: 'Tip girdle point', default: 0.16, step: 0.01, title: 'Tip facet girdle point from the point, fraction of the half-length' },
];

export const templates = {
  heart: { name: 'Heart brilliant, French tip (starting point)', note: 'IGI plot pattern with typical angles and a GIA-style French tip; the cleft makes the stone the union of two convex halves. Trace against the underlay and cut meet points.', params: [...base, ...french], make: (o = {}) => heartStart({ ...o }) },
  heartStd: { name: 'Heart brilliant, uncorrected point (starting point)', note: 'IGI plot pattern with typical angles and a shallow bezel at the point, as drawn on the report.', params: [...base, { key: 'pointAngle', label: 'Point bezel', default: 31, step: 0.5, title: 'Angle of the point bezel' }], make: (o = {}) => heartStart({ frenchTips: false, ...o }) },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'heart-crown', label: 'Heart: crown (IGI)' },
  { id: 'heart-pavilion', label: 'Heart: pavilion (IGI)' },
];
