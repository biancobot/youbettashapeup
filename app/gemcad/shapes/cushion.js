// Cushion brilliant (IGI label "CUSHION BRILLIANT"): the round brilliant's facet arrangement on a
// rectangular cushion outline. Built the way ../fancy.js builds the marquise: a facet that reaches
// the girdle touches the girdle polygon at a vertex chosen by radial azimuth, with the outline
// normal there as its azimuth; the other facets pass through three meet points.
//
// Plot measurements (IGI report FDR687547817, 1055x530 px, stone 378 x 472 px, L:W 1.249), in
// units of the half-width, x across, y along the length, averaged over the four quadrants.
// Crown: table corners on the axes (0, 0.862) and (0.584, 0), at the corners (0.452, 0.763);
// star tips (0.418, 0.959) and (0.706, 0.698) (75% and 71% of the crown height up the bezel
// ridges); girdle contacts: end bezel at 90, corner bezel (0.756, 1.024) at 53.6, side bezel at
// 0, upper-girdle junctions (0.556, 1.167) at 64.5 and (0.890, 0.805) at 42.1 degrees.
// Pavilion: culet a rectangle 0.065 x 0.37 (half-sizes 0.032, 0.186) at the centre; main ridge
// points (0.252, 0.611) and (0.415, 0.468); girdle contacts: corner main (0.739, 1.007) at 53.7,
// lower-girdle junctions (0.552, 1.164) at 64.6 and (0.885, 0.819) at 42.8 degrees.
// Outline: the Minkowski sum of a circle of radius r and a rectangle whose sides bow out as
// circular arcs (a lens along each axis, as the marquise outline): half-sides 1 - r (x) and
// L:W - r (y) including the bows. Least-squares fit of the plot outline: r = 0.60, sides bowed by
// 0.07, ends by 0.03 (rms 0.010 of the half-width; a plain rectangle plus circle fits best at
// r = 0.80 with rms 0.018 and leaves flats on which the girdle polygon bulges).
import { newTier } from '../design.js';
import {
  rad, deg, marquiseSupport, outlineFromSupport, girdleVertices, vertexNear, lift,
  planeThrough, zPlane, yPlane, xPlane, classTier, girdleFromSupport, plane3, intersect3,
} from '../shapebuild.js';

/**
 * Support function of a cushion outline: a rectangle with half-sides w and l whose sides bow out
 * by bowX (the two long sides) and bowY (the two ends) as circular arcs, with corners rounded by a
 * circle of radius r. Each pair of bowed sides is a lens (two arcs, as the marquise outline), so the
 * outline is the Minkowski sum lens + lens + circle; its support is the sum of theirs.
 */
export function cushionSupport(w, l, r, bowX = 0, bowY = 0) {
  const hx = marquiseSupport(Math.max(bowX, 1e-6), l - r - bowY);   // sides bowed along x, tips on the y axis
  const hy = marquiseSupport(Math.max(bowY, 1e-6), w - r - bowX);   // ends bowed along y, tips on the x axis
  return (t) => hx(t) + hy(t + Math.PI / 2) + r;
}

/** Cushion outline, half-width 1, half-length l: support, point and outward normal by radial azimuth. */
export function cushionOutline(l, r = 0.6, bowX = 0.07, bowY = 0.03) {
  return { l, r, bowX, bowY, ...outlineFromSupport(cushionSupport(1, l, r, bowX, bowY)) };
}

/**
 * Plane with azimuth az (its outward normal's direction) through the girdle point g and a second
 * point q above (crown) or below (pavilion) it: the facet's angle follows from the two points.
 */
function tangentThrough(az, g, q) {
  const u = [Math.cos(rad(az)), Math.sin(rad(az))];
  const run = u[0] * g[0] + u[1] * g[1] - (u[0] * q[0] + u[1] * q[1]);
  const ang = deg(Math.atan2(Math.abs(q[2] - g[2]), run));
  return planeThrough(q[2] > g[2] ? ang : -ang, az, g);
}

const PLOT_L = 1.25;   // L:W of the plot the positions were measured on
/** Girdle contacts measured on the plot, normalised: x in half-widths, y as a fraction of the half-length. */
const CONTACTS = { corner: [0.756, 1.024 / PLOT_L], ue: [0.556, 1.167 / PLOT_L], us: [0.890, 0.805 / PLOT_L] };

/**
 * Cushion brilliant starting point, pattern of the IGI plotting template:
 * crown: table, 8 bezels (2 ends, 2 sides, 4 corners), 8 stars, 16 upper girdle facets;
 * pavilion: 8 mains, 16 lower girdle facets, a small rectangular culet (keel) along the length.
 * Lengths along y are given as fractions of the half-length so the pattern follows the L:W.
 */
export function cushionBrilliant({
  ratio = 1.25, corner = 0.6, bowSides = 0.07, bowEnds = 0.03, crownAngle = 35, girdle = 0.05, pavilionDepth = 0.435,
  tableWidth = 0.584, tableLength = 0.690, tableCorner = [0.452, 0.610], starHeight = 0.73,
  culet = [0.032, 0.149], ridgeEnd = 0.489, ridgeSide = 0.415,
  gear = 96, girdleFacets = 128,
} = {}) {
  const W = 2, l = ratio, g = girdle * W, Pd = pavilionDepth * W;
  // The plot (L:W 1.25) is two-fold symmetric: ends and sides differ. As the ratio approaches 1
  // the pattern blends to exact four-fold symmetry (every end/side pair of measurements replaced
  // by their mean, every plan point by the mean of itself and its mirror image across the
  // diagonal), so a square cushion has four identical bezels, stars and corners.
  const t = Math.max(0, Math.min(1, (l - 1) / (PLOT_L - 1)));
  const mix = (square, plot) => square + (plot - square) * t;
  const mixPt = (sq, pl) => [mix(sq[0], pl[0]), mix(sq[1], pl[1])];
  const sym = ([x, y]) => [(x + y) / 2, (x + y) / 2];
  const symPair = (a, b) => { const m = [(a[0] + b[1]) / 2, (a[1] + b[0]) / 2]; return [m, [m[1], m[0]]]; };   // diagonal mirror images
  const tw = mix((tableWidth + tableLength) / 2, tableWidth), tl = mix((tableWidth + tableLength) / 2, tableLength);
  const bowX = mix((bowSides + bowEnds) / 2, bowSides), bowY = mix((bowSides + bowEnds) / 2, bowEnds);
  const tc = mixPt(sym(tableCorner), tableCorner);
  const [ueS, usS] = symPair(CONTACTS.ue, CONTACTS.us);
  const cN = mixPt(sym(CONTACTS.corner), CONTACTS.corner), ueN = mixPt(ueS, CONTACTS.ue), usN = mixPt(usS, CONTACTS.us);
  const azOfN = ([x, y]) => deg(Math.atan2(y * l, x));   // normalised point (x in half-widths, y as a fraction of the half-length) -> radial azimuth
  const re = mix((ridgeEnd + ridgeSide) / 2, ridgeEnd), rs = mix((ridgeEnd + ridgeSide) / 2, ridgeSide);
  const H = (1 - tw) * Math.tan(rad(crownAngle));   // side bezels at crownAngle set the crown height
  const outline = cushionOutline(l, corner, bowX, bowY);
  const girdleTier = girdleFromSupport(outline.support, girdleFacets, gear, 0.5);
  const verts = girdleVertices(girdleTier, gear);
  const tiers = [girdleTier, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { const t = classTier(name, plane, gear, 2, true); tiers.push(t); return plane; };
  // Girdle contacts, top-right quadrant (radial azimuths measured on the IGI plots)
  const Ev = vertexNear(verts, 90), Sv = vertexNear(verts, 0), Cv = vertexNear(verts, azOfN(cN));
  const Uev = vertexNear(verts, azOfN(ueN)), Usv = vertexNear(verts, azOfN(usN));
  const cornerAz = outline.normalAz(Cv.az);

  // ---- crown bezels: through the girdle vertex (azimuth = outline normal there) and the plot's table corner
  const Te = [0, tl * l, H], Ts = [tw, 0, H], Tc = [tc[0], tc[1] * l, H];
  const end = addClass('A end', tangentThrough(90, lift(Ev, 0), Te));
  const cor = addClass('A corner', tangentThrough(cornerAz, lift(Cv, 0), Tc));
  const side = addClass('A side', tangentThrough(0, lift(Sv, 0), Ts));
  // ---- stars: through two table corners and a tip on the bezel ridge at starHeight of the crown height
  const Pec = intersect3(end, cor, zPlane(starHeight * H));
  const Pcs = intersect3(cor, side, zPlane(starHeight * H));
  addClass('C end', plane3(Te, Tc, Pec, true));
  addClass('C side', plane3(Tc, Ts, Pcs, true));
  // ---- upper girdle facets: through a star tip and two girdle points
  const E = lift(Ev, 0), S = lift(Sv, 0), C = lift(Cv, 0), Ue = lift(Uev, 0), Us = lift(Usv, 0);
  addClass('B end', plane3(Pec, E, Ue, true));
  addClass('B end-corner', plane3(Pec, Ue, C, true));
  addClass('B corner-side', plane3(Pcs, C, Us, true));
  addClass('B side', plane3(Pcs, Us, S, true));

  // ---- pavilion: mains through the girdle contacts and the culet rectangle (or the culet point)
  const zc = -g - Pd;
  const cw = culet ? mix((culet[0] + culet[1]) / 2, culet[0]) : 0, cl = culet ? mix((culet[0] + culet[1]) / 2, culet[1]) * l : 0;
  const Eg = lift(Ev, -g), Sg = lift(Sv, -g), Cg = lift(Cv, -g), Ueg = lift(Uev, -g), Usg = lift(Usv, -g);
  const mE = addClass('P end', tangentThrough(90, Eg, [0, cl, zc]));
  const mC = addClass('P corner', tangentThrough(cornerAz, Cg, [cw, cl, zc]));
  const mS = addClass('P side', tangentThrough(0, Sg, [cw, 0, zc]));
  // lower girdle facets: junctions on the ridges between mains at the plot's plan positions
  const Rec = intersect3(mE, mC, yPlane(re * l));
  const Rcs = intersect3(mC, mS, xPlane(rs));
  addClass('L end', plane3(Rec, Eg, Ueg, false));
  addClass('L end-corner', plane3(Rec, Ueg, Cg, false));
  addClass('L corner-side', plane3(Rcs, Cg, Usg, false));
  addClass('L side', plane3(Rcs, Usg, Sg, false));
  // culet: a flat facet at the pavilion depth. GemCad's sign convention has no flat pavilion facet
  // (angle 0 is the table), so a vanishing negative angle keeps it in the pavilion.
  if (culet) tiers.push(newTier({ name: 'culet', angle: -0.001, distance: -zc, indices: [0] }));

  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const angleOf = (name) => Math.round(Math.abs(tiers.find((t) => t.name === name).angle) * 10) / 10;
  return {
    name: 'Cushion brilliant (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Cushion brilliant starting point', `L:W ${ratio}, crown ${crownAngle}, pavilion depth ${pavilionDepth * 100}%`],
    footnotes: ['Starting point: lab plot pattern with typical angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to cushion diamonds.',
      'IGI Excellent ranges (cushion row of IGI\'s fancy-shape cut guidelines, which applies to both cushion styles): L:W 1.00-1.05 (1.06 and above is considered rectangular), total depth 62-68%, table 55-62%, crown height 8-16%, girdle 2-6% (thin to thick), pavilion depth 40-56%, culet pointed to small, symmetry and polish very good or excellent. No crown or pavilion angle ranges are given.',
      `This design: L:W ${ratio} (the IGI report plot measures 1.25), table ${pct(tw)} of the width and ${pct(tl)} of the length, crown height ${pct(H / W)}, bezels ${crownAngle} (sides), ${angleOf('A end')} (ends), ${angleOf('A corner')} (corners), pavilion depth ${pct(pavilionDepth)}, mains ${angleOf('P side')} (sides), ${angleOf('P end')} (ends), ${angleOf('P corner')} (corners), girdle ${pct(girdle)}, total depth ${pct((H + g + Pd) / W)}. Bezel and main angles are measured in each facet's own slope direction; they vary around a fancy outline at a constant crown height and pavilion depth.`,
      `Culet: ${culet ? `a small rectangle ${pct(2 * cw / W)} x ${pct(2 * cl / W)} of the width along the length, as drawn on the plot (the keel where the side and end mains meet)` : 'pointed, all mains meeting at the culet point'}.`,
      'Plot pattern (IGI template): crown 8 bezels (2 ends, 2 sides, 4 corners at about 54 degrees), 8 stars, 16 upper girdle facets; pavilion 8 mains (corner contacts at about 54 degrees), 16 lower girdle facets with junctions at about 64 and 43 degrees, small rectangular culet. Plot L:W 1.25.',
      `Girdle: ${pct(girdle)} at the bezels (hills); the upper and lower girdle facets scallop it to about half that at the junctions on the sides, where the outline bows beyond the chord from the side bezel's tip to the junction. Below L:W 1.1 raise the girdle to 6-7% or the girdle facets at those valleys vanish.`,
      'The plot is two-fold symmetric (ends and sides differ); towards L:W 1 the pattern blends to exact four-fold symmetry, so a square cushion has four identical bezels, stars and corners and a square culet.',
      `Outline: a rectangle with sides bowed out by ${Math.round(bowX * 1000) / 1000} (sides) and ${Math.round(bowY * 1000) / 1000} (ends) of the half-width, corners rounded with a circle of radius ${corner}, fitted to the plot. Facets touch the girdle at the plot positions; each facet azimuth is the outline normal at its contact point.`,
    ],
    tiers,
  };
}

export const templates = {
  cushion: {
    name: 'Cushion brilliant (starting point)',
    note: 'IGI plot pattern (8 bezels, 8 stars, 16 uppers; 8 mains, 16 lowers, small culet) on a rounded-rectangle outline with typical angles; trace against the underlay and cut meet points.',
    params: [
      { key: 'ratio', label: 'L:W', default: 1.1, step: 0.01, min: 1, title: 'Length to width; the IGI plot is 1.25' },
      { key: 'corner', label: 'Corner radius', default: 0.6, step: 0.02, min: 0.1, max: 1, title: 'Corner rounding, fraction of the half-width' },
      { key: 'bowSides', label: 'Bow (sides)', default: 0.07, step: 0.01, min: 0, title: 'Outward bow of the long sides, fraction of the half-width' },
      { key: 'bowEnds', label: 'Bow (ends)', default: 0.03, step: 0.01, min: 0 },
      { key: 'tableWidth', label: 'Table width', default: 0.584, step: 0.01, title: 'Table half-width at the sides, fraction of the half-width' },
      { key: 'tableLength', label: 'Table length', default: 0.690, step: 0.01, title: 'Table half-length at the ends, fraction of the half-length' },
      { key: 'crownAngle', label: 'Crown angle', default: 35, step: 0.5, title: 'Side bezel angle; sets the crown height with the table width' },
      { key: 'starHeight', label: 'Star tips', default: 0.73, step: 0.05, min: 0.2, max: 0.95, title: 'Fraction of the crown height' },
      { key: 'girdle', label: 'Girdle', default: 0.05, step: 0.005 },
      { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.435, step: 0.005 },
    ],
    make: (o = {}) => cushionBrilliant({ ratio: 1.1, ...o }),
  },
  cushionPoint: {
    name: 'Cushion brilliant, pointed culet (starting point)',
    note: 'IGI plot pattern (8 bezels, 8 stars, 16 uppers; 8 mains, 16 lowers, small culet) on a rounded-rectangle outline with typical angles; trace against the underlay and cut meet points.',
    params: [
      { key: 'ratio', label: 'L:W', default: 1.1, step: 0.01, min: 1, title: 'Length to width; the IGI plot is 1.25' },
      { key: 'corner', label: 'Corner radius', default: 0.6, step: 0.02, min: 0.1, max: 1, title: 'Corner rounding, fraction of the half-width' },
      { key: 'bowSides', label: 'Bow (sides)', default: 0.07, step: 0.01, min: 0, title: 'Outward bow of the long sides, fraction of the half-width' },
      { key: 'bowEnds', label: 'Bow (ends)', default: 0.03, step: 0.01, min: 0 },
      { key: 'tableWidth', label: 'Table width', default: 0.584, step: 0.01, title: 'Table half-width at the sides, fraction of the half-width' },
      { key: 'tableLength', label: 'Table length', default: 0.690, step: 0.01, title: 'Table half-length at the ends, fraction of the half-length' },
      { key: 'crownAngle', label: 'Crown angle', default: 35, step: 0.5, title: 'Side bezel angle; sets the crown height with the table width' },
      { key: 'starHeight', label: 'Star tips', default: 0.73, step: 0.05, min: 0.2, max: 0.95, title: 'Fraction of the crown height' },
      { key: 'girdle', label: 'Girdle', default: 0.05, step: 0.005 },
      { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.435, step: 0.005 },
    ],
    make: (o = {}) => cushionBrilliant({ ratio: 1.1, ...o, culet: null }),
  },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'cushion-crown', label: 'Cushion brilliant: crown (IGI)' },
  { id: 'cushion-pavilion', label: 'Cushion brilliant: pavilion (IGI)' },
];
