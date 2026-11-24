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
import { newTier } from '../design.js?v=73';
import {
  rad, deg, girdleEqualLength, girdleVertices, vertexNear, lift,
  planeThrough, zPlane, azPlane, perpPlane, classTier, plane3, intersect3, azOf,
} from '../shapebuild.js?v=73';
import { cushionOutline, cushionBrilliant } from './cushion.js?v=73';

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
 * Old mine cut: the antique cushion brilliant, the round brilliant's 58-facet arrangement on a
 * cushion outline with a small table, high steep crown, deep pavilion, short lower girdle facets,
 * a thick girdle and a large flat culet. Built with the cushion brilliant's construction
 * (./cushion.js): every bezel and main is a kite tangent to the girdle at one contact (sides,
 * ends, corners) reaching a table corner or the culet square, stars between the bezels, and upper
 * and lower girdle facets in pairs meeting on the girdle between the contacts.
 * table: fraction of the width (and of the length); culet: flat-to-flat width of the square culet
 * as a fraction of the width; crownAngle: the side bezels'; pavilionAngle: the side mains' (the
 * pavilion depth follows from it and the culet); starHeight: star tips, fraction of the crown
 * height; lowerLength: the lower girdle facets' reach along the main ridges from the girdle.
 */
export function oldMine({
  ratio = 1.05, corner = 0.6, bow = 0.01, table = 0.46, crownAngle = 42, pavilionAngle = 44, girdle = 0.04, culet = 0.13,
  starHeight = 0.55, lowerLength = 0.55, gear = 96, girdleFacets = 64,
} = {}) {
  const W = 2, l = ratio, r = Math.min(corner, Math.min(1, l) - bow - 1e-3);
  const cw = culet;   // culet half-width in half-widths (the culet is `culet` of the width across)
  const pavilionDepth = (1 - cw) * Math.tan(rad(pavilionAngle)) / W;   // side mains at pavilionAngle from the girdle to the culet square
  // lower girdle junctions on the corner ridges, lowerLength of the way from the corner contact to the culet corner
  const cornerX = 1 - r - bow + r * Math.SQRT1_2, cornerY = l - r - bow + r * Math.SQRT1_2;
  const ridgeSide = cornerX - lowerLength * (cornerX - cw), ridgeEnd = (cornerY - lowerLength * (cornerY - cw * l)) / l;
  // girdle contacts: the corner kites at the middle of the corner arcs; the upper and lower girdle
  // junctions 12 degrees round each corner arc from the flat's end, so the chord along each flat
  // takes a little of the arc and the chord over the corner the rest (a junction at the flat's end
  // would leave the corner chord 45 degrees of arc, which digs half the girdle)
  const cx = 1 - r - bow, cy = l - r - bow, th = rad(78);
  const contacts = { corner: [cornerX, cornerY / l], ue: [cx + r * Math.cos(th), (cy + r * Math.sin(th)) / l], us: [cx + r * Math.sin(th), (cy + r * Math.cos(th)) / l] };
  const d = cushionBrilliant({
    ratio, corner: r, bowSides: bow, bowEnds: bow, crownAngle, girdle, pavilionDepth,
    tableWidth: table, tableLength: table, tableCorner: [table * Math.SQRT1_2, table * Math.SQRT1_2], starHeight,
    culet: [cw, cw / l], ridgeEnd, ridgeSide, gear, girdleFacets, contacts,
  });
  const H = d.tiers.find((t) => t.name === 'T').distance, g = girdle * W, Pd = pavilionDepth * W;
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const ang = (name) => Math.round(Math.abs(d.tiers.find((t) => t.name === name).angle) * 10) / 10;
  const total = (H + g + Pd) / W;
  return {
    ...d,
    name: 'Old mine cut (starting point)',
    headings: ['Old mine cut', `L:W ${ratio}, table ${pct(table)}, crown ${crownAngle}, crown height ${pct(H / W)}, pavilion ${pavilionAngle}, culet ${pct(culet)}, girdle ${pct(girdle)}`],
    footnotes: ['Starting point: the antique cushion brilliant with a small table, high crown, deep pavilion and large culet.'],
    notes: [
      'Ideal dimensions: none published. GIA grades old mine cuts for polish and symmetry but assigns no cut grade, and no lab publishes proportion ranges; antique stones vary widely because each was cut by hand to its rough. Typical of surviving stones (GIA and auction-house descriptions): cushion outline with L:W 1.00-1.15, table 38-50%, crown height 15-20%, crown angle 40-45, pavilion depth 42-50%, pavilion angle 42-46, culet 8-15% of the width (large and open, visible face up), girdle thick and often uneven, short lower girdle facets (about 50-60%).',
      `This design: L:W ${ratio}, corner radius ${pct(corner)} of the half-width, sides bowed ${pct(bow)}, table ${pct(table)} (octagon), crown angle ${crownAngle} (side bezels; end bezels ${ang('A end')}, corner bezels ${ang('A corner')}), crown height ${pct(H / W)}, girdle ${pct(girdle)}, pavilion angle ${pavilionAngle} (side mains; end ${ang('P end')}, corner ${ang('P corner')}), pavilion depth ${pct(pavilionDepth)}, culet ${pct(culet)} of the width flat to flat, star tips ${pct(starHeight)} of the crown height, lower girdle facets ${pct(lowerLength)} of the way from the girdle to the culet along the corner ridges, total depth ${pct(total)}.`,
      'Pattern: 58 facets as on a round brilliant: 8 bezel kites (2 sides, 2 ends, 4 corners) each tangent to the girdle at one contact and reaching a table corner, 8 stars, 16 upper girdle facets in pairs meeting on the girdle between the contacts; 8 main kites from the contacts to the corners of the flat culet, 16 lower girdle facets the same way; the table and the culet.',
    ],
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
      { key: 'starHeight', label: 'Star tips', default: 0.55, step: 0.05, min: 0.2, max: 0.95, title: 'Fraction of the crown height' },
      { key: 'lowerLength', label: 'Lower girdle length', default: 0.55, step: 0.05, min: 0.2, max: 0.9, title: 'Reach of the lower girdle facets from the girdle along the corner ridges, fraction of the way to the culet' },
    ],
    make: (o = {}) => oldMine(o),
  },
};
export const plots = [];
