// Older round-stone cutting styles.
//
// Single cut (eight cut): the simplest brilliant-style cut, used for melee. A round girdle, an
// octagonal table, eight crown facets running from the table edge to the girdle, and eight
// pavilion facets meeting at a point (or a small culet) directly under the crown facets, so the
// crown and pavilion facets line up. 17 facets, 18 with a culet. Each crown facet is tangent to
// the girdle at its centre, so on a round girdle the girdle is thinnest there and slightly
// thicker at the facet corners, as on real single cuts.
//
// Old mine cut (c. 1700-1890): the forerunner of the modern brilliant, cut by hand for candlelight.
// A cushion outline (a square with rounded corners, often slightly longer than wide), a small
// table, a high crown with steep bezels, a deep pavilion, short lower girdle facets, a thick girdle
// and a large flat culet visible through the table. 58 facets laid out like a round brilliant:
// 8 bezels (4 on the sides, 4 on the corners), 8 stars, 16 upper girdle facets, 8 pavilion mains,
// 16 lower girdle facets, table and culet. Fold 2 + mirror so a slightly rectangular outline
// keeps its symmetry.
import { newTier } from '../design.js?v=61';
import {
  rad, deg, girdleEqualLength, girdleVertices, vertexNear, lift,
  planeThrough, zPlane, azPlane, perpPlane, classTier, plane3, intersect3, azOf,
} from '../shapebuild.js?v=61';
import { cushionOutline } from './cushion.js?v=61';

/** Single cut starting point. table: fraction of the diameter; culet: fraction of the diameter (0 = point). */
export function singleCut({ table = 0.55, crownAngle = 36, pavilionAngle = 41, girdle = 0.03, culet = 0, gear = 96, girdleFacets = 64 } = {}) {
  const R = 1, W = 2, g = girdle * W, zb = -g;
  const H = (R - table * R) * Math.tan(rad(crownAngle));
  // girdle: a bruted round girdle (a regular polygon of apothem R with a vertex at azimuth 0 and
  // every 45 degrees); each crown and pavilion facet touches it at the vertex under the facet's
  // centre, a point contact, and the girdle is thicker at the facet corners, as on a real single cut
  const gi = [...Array(girdleFacets)].map((_, k) => Math.round(((k * gear) / girdleFacets + gear / girdleFacets / 2) * 1e6) / 1e6);
  const Rv = R / Math.cos(Math.PI / girdleFacets);   // radius of the girdle vertices
  const tiers = [newTier({ name: 'G', angle: 90, distance: R, indices: gi }), newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 8, true)); return plane; };
  // crown facets through the girdle vertex at azimuth 0 (and every 45 degrees)
  addClass('A', planeThrough(crownAngle, 0, [Rv, 0, 0]));
  // pavilion facets under them; with a culet the flat culet facet closes the pavilion
  const main = addClass('P', planeThrough(-pavilionAngle, 0, [Rv, 0, zb]));
  let Pd = R * Math.tan(rad(pavilionAngle));
  if (culet > 0) {
    const c = culet * R;   // culet half-width (flat to flat)
    Pd = (R - c) * Math.tan(rad(pavilionAngle));
    tiers.push(newTier({ name: 'culet', angle: -0.001, distance: g + Pd, indices: [0] }));   // a flat facet on the pavilion side
  }
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const total = H / W + girdle + Pd / W;
  return {
    name: 'Single cut (starting point)', gear, fold: 8, mirror: true, ri: 2.42,
    girdleScallop: 'eight bezels and eight pavilion facets on a round girdle: the girdle is thinnest where each facet is tangent to it and thickest where two facets meet, as on every single cut',
    headings: ['Single cut (eight cut)', `table ${pct(table)}, crown ${crownAngle}, pavilion ${pavilionAngle}, girdle ${pct(girdle)}${culet ? `, culet ${pct(culet)}` : ', pointed culet'}`],
    footnotes: ['Starting point: the eight-facet crown and pavilion of a single cut on a round girdle.'],
    notes: [
      'Ideal dimensions: none published. GIA does not grade the cut of single cuts, which are used for melee (usually under 0.05 ct) where the few large facets read brighter than a full brilliant would at that size. Trade practice: table 55-60%, crown angle 34-40, pavilion angle 41-43, girdle thin to medium, culet pointed or very small; the crown and pavilion facets are aligned.',
      `This design: table ${pct(table)} (flat to flat of the octagon), crown angle ${crownAngle}, crown height ${pct(H / W)}, girdle ${pct(girdle)} at the facet centres (thicker at the facet corners, where the flat crown facets leave the round girdle), pavilion angle ${pavilionAngle}, pavilion depth ${pct(Pd / W)}, ${culet ? `culet ${pct(culet)} of the diameter` : 'pointed culet'}, total depth ${pct(total)}.`,
      `Pattern: 8 crown facets (trapezoids from the octagonal table to the girdle, each touching the round girdle at one point under its centre), 8 pavilion facets under them${culet ? ', a flat culet' : ' meeting at a point'}, and the table: ${culet ? 18 : 17} facets plus the girdle (${girdleFacets} facets). The girdle is thinnest under the facet centres and thicker at the facet corners, as on a bruted single cut.`,
    ],
    tiers,
  };
}

/**
 * Old mine cut starting point. ratio: L:W; corner: corner radius as a fraction of the half-width;
 * table: fraction of the width (flat to flat); culet: fraction of the width; crownAngle,
 * pavilionAngle: the side bezel and side main angles (corner facets follow from the meet points);
 * starLength, lowerLength: as on the round brilliant (fraction of the way from the table edge
 * to the girdle, and from the girdle towards the culet).
 */
export function oldMine({
  ratio = 1.05, corner = 0.6, bow = 0.01, table = 0.46, crownAngle = 42, pavilionAngle = 44, girdle = 0.04, culet = 0.13,
  starLength = 0.45, lowerLength = 0.55, cornerSplit = 22.5, gear = 96, girdleFacets = 64,
} = {}) {
  const W = 2, l = ratio, r = Math.min(corner, Math.min(1, l) - bow - 1e-3), g = girdle * W, zb = -g;
  // the sides bow out slightly (antique stones are never dead straight), which also lets the upper
  // girdle facets exist beside the side bezels: on a true flat they would be coplanar with the bezel
  const outline = cushionOutline(l, r, bow, bow);
  const gT = girdleEqualLength(outline, girdleFacets, gear, 0);
  const verts = girdleVertices(gT, gear);
  const G = (az, z = 0) => lift(vertexNear(verts, az), z);
  // contacts: side (az 0), end (az 90), corner (middle of the corner arc); junctions where the flats meet the arcs
  const cx = 1 - r - bow, cy = l - r - bow;   // centre of the corner arc (the outline is a bowed rectangle swept by a circle of radius r)
  // the side and end bezels (and mains) are planes through the two ends of their flats, so the
  // upper and lower girdle facets meet them exactly there; a bowed side then dips a little under
  // the bezel at its middle (bow x tan(angle)) instead of leaving the bezel floating at the ends
  const xS = vertexNear(verts, azOf([cx + r, cy])).p[0], yE = vertexNear(verts, azOf([cx, cy + r])).p[1];   // the flats' ends: the girdle vertices nearest the arc starts
  const H = (xS - table) * Math.tan(rad(crownAngle));
  const tiers = [gT, newTier({ name: 'T', angle: 0, distance: H, indices: [] })];
  const table_ = zPlane(H);
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 2, true)); return plane; };
  const cornerPt = [cx + r * Math.SQRT1_2, cy + r * Math.SQRT1_2];
  // The side and end bezels sit along the (almost) straight sides; the upper and lower girdle
  // facets cover the corner arcs only, two per quarter arc: from the end of the flat (J0) to a
  // junction cornerSplit degrees round the arc (J1), then to the corner bezel's contact at 45
  // degrees, and the same on the other side (J2, J3). Short chords dig little into the girdle, so
  // it keeps an even thickness; a facet running diagonally from the middle of a side onto the
  // corner arc would cut deep where it crosses the end of the flat.
  const sp = rad(cornerSplit);
  const azC = azOf(cornerPt);
  const azJ0 = azOf([cx + r, cy]), azJ1 = azOf([cx + r * Math.cos(sp), cy + r * Math.sin(sp)]), azJ2 = azOf([cx + r * Math.sin(sp), cy + r * Math.cos(sp)]), azJ3 = azOf([cx, cy + r]);
  const Gs = G(0), Ge = G(90), Gc = G(azC), Gj0 = G(azJ0), Gj1 = G(azJ1), Gj2 = G(azJ2), Gj3 = G(azJ3);
  const Rc = Math.hypot(cornerPt[0], cornerPt[1]);   // corner contact distance from the centre
  // ---- crown: bezels tangent at the contacts. The side bezels have the given angle; the end and
  // corner bezels, whose contacts are further out, are flatter so the table is a scaled copy of
  // the outline (its edges at the same fraction of the way in all round), as on antique stones
  const bezS = addClass('A side', planeThrough(crownAngle, 0, [xS, 0, 0]));
  const bezE = addClass('A end', planeThrough(deg(Math.atan(Math.tan(rad(crownAngle)) / l)), 90, [0, yE, 0]));
  const bezC = addClass('A corner', planeThrough(deg(Math.atan(Math.tan(rad(crownAngle)) / Rc)), 45, Gc));
  // table corners on each bezel's centreline, star tips on the ridges, stars through two table corners and the tip
  const Ts = intersect3(bezS, table_, azPlane(0)), Te = intersect3(bezE, table_, azPlane(90)), Tc = intersect3(bezC, table_, azPlane(azC));
  const tipOn = (a, b, Ta, Tb, Gj, az) => {
    const M = [(Ta[0] + Tb[0]) / 2, (Ta[1] + Tb[1]) / 2];
    const target = [M[0] + (Gj[0] - M[0]) * starLength, M[1] + (Gj[1] - M[1]) * starLength];
    return intersect3(a, b, perpPlane(az, target[0] * Math.cos(rad(az)) + target[1] * Math.sin(rad(az))));
  };
  const tip1 = tipOn(bezS, bezC, Ts, Tc, Gj1, azJ1), tip2 = tipOn(bezC, bezE, Tc, Te, Gj2, azJ2);
  addClass('C side', plane3(Ts, Tc, tip1, true));
  addClass('C end', plane3(Tc, Te, tip2, true));
  // upper girdle facets: two short chords over each half of the corner arc, meeting at the junctions
  addClass('B side', plane3(tip1, Gj0, Gj1, true));
  addClass('B side-corner', plane3(tip1, Gj1, Gc, true));
  addClass('B corner-end', plane3(tip2, Gc, Gj2, true));
  addClass('B end', plane3(tip2, Gj2, Gj3, true));
  // ---- pavilion: mains tangent at the contacts, a flat culet, lower girdle facets in pairs
  const mS = addClass('P side', planeThrough(-pavilionAngle, 0, [xS, 0, zb]));
  const c = culet;   // culet half-width along the side direction
  const Pd = (xS - c) * Math.tan(rad(pavilionAngle));
  const zc = zb - Pd;
  const culetPl = zPlane(zc);
  // the end and corner mains reach the culet plane at the same depth with the culet a scaled copy of the outline, so they are flatter
  const mE = addClass('P end', planeThrough(-deg(Math.atan(Math.tan(rad(pavilionAngle)) / l)), 90, [0, yE, zb]));
  const mC = addClass('P corner', planeThrough(-deg(Math.atan(Math.tan(rad(pavilionAngle)) / Rc)), 45, lift(vertexNear(verts, azC), zb)));
  tiers.push(newTier({ name: 'culet', angle: -0.001, distance: -zc, indices: [0] }));
  const lowerJ = (a, b, Gj, az) => intersect3(a, b, perpPlane(az, (Gj[0] * Math.cos(rad(az)) + Gj[1] * Math.sin(rad(az))) * (1 - lowerLength)));
  const J1 = lowerJ(mS, mC, Gj1, azJ1), J2 = lowerJ(mC, mE, Gj2, azJ2);
  addClass('L side', plane3(J1, lift(vertexNear(verts, azJ0), zb), lift(vertexNear(verts, azJ1), zb), false));
  addClass('L side-corner', plane3(J1, lift(vertexNear(verts, azJ1), zb), lift(vertexNear(verts, azC), zb), false));
  addClass('L corner-end', plane3(J2, lift(vertexNear(verts, azC), zb), lift(vertexNear(verts, azJ2), zb), false));
  addClass('L end', plane3(J2, lift(vertexNear(verts, azJ2), zb), lift(vertexNear(verts, azJ3), zb), false));
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const ang = (pl) => Math.round(deg(Math.atan2(Math.hypot(pl.n[0], pl.n[1]), Math.abs(pl.n[2]))) * 10) / 10;
  const total = H / W + girdle + Pd / W;
  // culet size across the corners: where the corner mains meet the culet plane
  const culetCorner = intersect3(mC, culetPl, azPlane(azC));
  return {
    name: 'Old mine cut (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Old mine cut', `L:W ${ratio}, table ${pct(table)}, crown ${crownAngle}, crown height ${pct(H / W)}, pavilion ${pavilionAngle}, culet ${pct(culet)}, girdle ${pct(girdle)}`],
    footnotes: ['Starting point: the antique cushion brilliant with a small table, high crown, deep pavilion and large culet.'],
    notes: [
      'Ideal dimensions: none published. GIA grades old mine cuts for polish and symmetry but assigns no cut grade, and no lab publishes proportion ranges; antique stones vary widely because each was cut by hand to its rough. Typical of surviving stones (GIA and auction-house descriptions): cushion outline with L:W 1.00-1.15, table 38-50%, crown height 15-20%, crown angle 40-45, pavilion depth 42-50%, pavilion angle 42-46, culet 8-15% of the width (large and open, visible face up), girdle thick and often uneven, short lower girdle facets (about 50-60%).',
      `This design: L:W ${ratio}, corner radius ${pct(corner)} of the half-width, sides bowed ${pct(bow)}, table ${pct(table)}, crown angle ${crownAngle} (side bezels; end bezels ${ang(bezE)}, corner bezels ${ang(bezC)}), crown height ${pct(H / W)}, girdle ${pct(girdle)}, pavilion angle ${pavilionAngle} (side mains; end ${ang(mE)}, corner ${ang(mC)}), pavilion depth ${pct(Pd / W)}, culet ${pct(culet)} of the width flat to flat (${pct(Math.hypot(culetCorner[0], culetCorner[1]))} of the half-width to its corners), star length ${pct(starLength)}, lower girdle length ${pct(lowerLength)}, total depth ${pct(total)}.`,
      `Pattern: 58 facets as on a round brilliant: 8 bezels (4 along the sides, 4 on the rounded corners), 8 stars, 16 upper girdle facets as four short chords over each corner arc (junctions at ${cornerSplit} degrees from the arc ends and the corner contact at 45), 8 pavilion mains, 16 lower girdle facets the same way, the table and a flat culet. The upper and lower girdle facets dig only a little into the girdle, so its thickness stays even.`,
    ],
    tiers,
  };
}

export const templates = {
  singleCut: {
    name: 'Single cut (eight cut), round (starting point)',
    note: '17 facets on a round girdle: octagonal table, 8 crown facets and 8 pavilion facets meeting at a point. The L:W field is ignored (round).',
    params: [
      { key: 'table', label: 'Table', default: 0.55, step: 0.01, min: 0.4, max: 0.75, title: 'Flat-to-flat width of the octagonal table, fraction of the diameter' },
      { key: 'crownAngle', label: 'Crown angle', default: 36, step: 0.5 },
      { key: 'pavilionAngle', label: 'Pavilion angle', default: 41, step: 0.5 },
      { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
      { key: 'culet', label: 'Culet', default: 0, step: 0.01, min: 0, max: 0.3, title: 'Culet width, fraction of the diameter (0 = point)' },
    ],
    make: ({ ratio, ...o } = {}) => singleCut(o),
  },
  oldMine: {
    name: 'Old mine cut, cushion (starting point)',
    note: 'Antique cushion brilliant: small table, high steep crown, deep pavilion, short lower girdle facets, thick girdle and a large flat culet; 58 facets.',
    params: [
      { key: 'ratio', label: 'L:W', default: 1.05, step: 0.01, min: 1, max: 1.3 },
      { key: 'corner', label: 'Corner radius', default: 0.6, step: 0.05, min: 0.2, max: 0.95, title: 'Corner arc radius, fraction of the half-width' },
      { key: 'bow', label: 'Side bow', default: 0.01, step: 0.005, min: 0, max: 0.15, title: 'Outward bow of the sides, fraction of the half-width' },
      { key: 'table', label: 'Table', default: 0.46, step: 0.01, min: 0.3, max: 0.65, title: 'Fraction of the width' },
      { key: 'crownAngle', label: 'Crown angle', default: 42, step: 0.5 },
      { key: 'pavilionAngle', label: 'Pavilion angle', default: 44, step: 0.5 },
      { key: 'culet', label: 'Culet', default: 0.13, step: 0.01, min: 0.02, max: 0.3, title: 'Culet width, fraction of the width' },
      { key: 'girdle', label: 'Girdle', default: 0.04, step: 0.005 },
      { key: 'starLength', label: 'Star length', default: 0.45, step: 0.05, min: 0.2, max: 0.8 },
      { key: 'lowerLength', label: 'Lower girdle', default: 0.55, step: 0.05, min: 0.3, max: 0.9 },
      { key: 'cornerSplit', label: 'Corner junction', default: 22.5, step: 0.5, min: 5, max: 40, title: 'Where the two upper (and lower) girdle facets on each half of a corner arc meet, degrees round from the arc end' },
    ],
    make: (o = {}) => oldMine(o),
  },
};
export const plots = [];
