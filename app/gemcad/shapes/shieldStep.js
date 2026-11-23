// Step-cut shields: a pentagonal outline (a straight top edge, corners at the widest point,
// straight sides meeting at the point) cut in steps, as in the reference photographs of
// shield-cut diamonds: concentric rows of facets parallel to the girdle edges on the crown, step
// rows on the pavilion converging on a culet point. Three presets differ only in proportions:
//   kite shield   (L:W 1.25, top edge 0.5 of the width, widest 0.6 of the length from the top),
//   long shield   (L:W 2.0, top edge 0.75, widest 0.12 from the top),
//   wide shield   (L:W 0.9, top edge 0.85, widest 0.3 from the top).
// Built like the emerald in ./emerald.js: every row is one set of planes at one angle, each with
// the azimuth of its girdle edge's outward normal, through the previous row's step line, so the
// step polygons are exact inward offsets of the girdle pentagon and every meet point is exact.
// One mirror line: fold 1 + mirror. Width 2 along x, length 2 * ratio along y, point at -y.
import { newTier } from '../design.js';
import { rad, deg, girdleFromPolygon, planeThrough, plane3, classTier } from '../shapebuild.js';

/** Pentagon vertices (counter-clockwise) for the proportions: top edge half-width tw, corners at y = yT - shoulderPos * length. */
export function shieldPentagon(ratio, topWidth, shoulderPos) {
  const yT = ratio, yB = ratio - shoulderPos * 2 * ratio, tw = topWidth;
  return [[0, -ratio], [1, yB], [tw, yT], [-tw, yT], [-1, yB]];
}

/** Inward offset of a convex polygon by distance d (edges stay parallel; corners move along bisectors). */
function offsetPolygon(poly, d) {
  const n = poly.length, lines = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
    const nx = y1 - y0, ny = -(x1 - x0), l = Math.hypot(nx, ny);   // outward normal of a counter-clockwise edge
    lines.push({ nx: nx / l, ny: ny / l, c: (nx * x0 + ny * y0) / l - d });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i], det = a.nx * b.ny - a.ny * b.nx;
    out.push([(a.c * b.ny - b.c * a.ny) / det, (a.nx * b.c - b.nx * a.c) / det]);
  }
  return out;
}

/**
 * Step-cut shield starting point. crownRows / pavilionRows: [inset in half-widths, side angle]
 * per row from the girdle inwards; the last pavilion row runs from its step line to the culet.
 */
export function shieldStep({
  ratio = 1.25, topWidth = 0.5, shoulderPos = 0.6, girdle = 0.035,
  crownRows = [[0.16, 42], [0.13, 34]], pavilionRows = [[0.22, 48], [0.2, 43]], culetPos = 0.55, gear = 96,
} = {}) {
  const W = 2, g = girdle * W, L = 2 * ratio;
  const poly = shieldPentagon(ratio, topWidth, shoulderPos);
  const tiers = [girdleFromPolygon(poly, gear)];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 1, true)); return plane; };
  const edgeNames = ['side', 'shoulder', 'top'];   // edges of the right half, counter-clockwise from the point: side, shoulder, top
  const edgeAz = (p0, p1) => deg(Math.atan2(-(p1[0] - p0[0]), p1[1] - p0[1]));
  // ---- crown: rows at the given angles through the step lines; the table is the last step polygon
  let step = poly, z = 0;
  crownRows.forEach(([inset, angle], k) => {
    for (let e = 0; e < 3; e++) {   // right-half edges: poly[0]->poly[1] (side), [1]->[2] (shoulder), [2]->[3] (top)
      const p0 = step[e], p1 = step[e + 1];
      addClass(`C${k + 1} ${edgeNames[e]}`, planeThrough(angle, edgeAz(p0, p1), [p0[0], p0[1], z]));
    }
    z += inset * Math.tan(rad(angle)); step = offsetPolygon(step, inset);
  });
  const H = z;
  tiers.push(newTier({ name: 'T', angle: 0, distance: H, indices: [] }));
  // ---- pavilion: step rows down from the girdle, then a culet row from the last step line to the culet point
  step = poly; z = -g;
  pavilionRows.forEach(([inset, angle], k) => {
    for (let e = 0; e < 3; e++) {
      const p0 = step[e], p1 = step[e + 1];
      addClass(`P${k + 1} ${edgeNames[e]}`, planeThrough(-angle, edgeAz(p0, p1), [p0[0], p0[1], z]));
    }
    z -= inset * Math.tan(rad(angle)); step = offsetPolygon(step, inset);
  });
  const depthSoFar = -g - z;
  // culet row: planes through each inner step edge (at z) and the culet; the culet depth follows the row's angle on the side edges
  const culet = [0, ratio - culetPos * L, 0];
  const sideP0 = step[0], sideP1 = step[1];
  const nx = sideP1[1] - sideP0[1], ny = -(sideP1[0] - sideP0[0]), nl = Math.hypot(nx, ny);
  const run = (nx * sideP0[0] + ny * sideP0[1] - nx * culet[0] - ny * culet[1]) / nl;   // plan distance from the culet to the side step line
  const culetAngle = pavilionRows[pavilionRows.length - 1][1] - 3;
  culet[2] = z - run * Math.tan(rad(culetAngle));
  for (let e = 0; e < 3; e++) {
    const p0 = step[e], p1 = step[e + 1];
    addClass(`P${pavilionRows.length + 1} ${edgeNames[e]}`, plane3([p0[0], p0[1], z], [p1[0], p1[1], z], culet, false));
  }
  const Pd = -g - culet[2];
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  return {
    name: 'Shield step cut (starting point)', gear, fold: 1, mirror: true, ri: 2.42,
    headings: ['Shield step cut starting point', `L:W ${ratio}, top edge ${pct(topWidth)} of the width, widest ${pct(shoulderPos)} of the length from the top`],
    footnotes: ['Starting point: step-cut pattern on a pentagonal shield outline. No lab plotting template exists for shields.'],
    notes: [
      'Ideal dimensions: none published. GIA assigns no cut grade to shield-cut diamonds and IGI\'s fancy-shape cut guidelines do not cover the shape; step-cut proportions follow the emerald cut (crown height 11-16%, total depth 60-68%, girdle 2-6%).',
      `This design: L:W ${ratio}, top edge ${pct(topWidth)} of the width, corners (widest point) ${pct(shoulderPos)} of the length from the top, crown ${crownRows.length} rows at ${crownRows.map((r) => r[1]).join('/')} degrees (insets ${crownRows.map((r) => r[0]).join('/')} of the half-width), crown height ${pct(H / W)}, girdle ${pct(girdle)}, pavilion ${pavilionRows.length} step rows at ${pavilionRows.map((r) => r[1]).join('/')} degrees plus a culet row at ${culetAngle} on the sides, pavilion depth ${pct(Pd / W)}, culet ${pct(culetPos)} of the length from the top, total depth ${pct((H + g + Pd) / W)}.`,
      'Pattern: five girdle facets; each crown and pavilion row has one facet per girdle edge (top, two shoulders, two sides) with the edge normal as azimuth, so the step lines are exact inward offsets of the outline; the last pavilion row converges on a culet point. Row angles are those of the side facets; the shoulder and top facets of a row share the angle.',
    ],
    tiers,
  };
}

const rows = (key, label, dflt, title) => ({ key, label, default: dflt, list: true, title });
const params = (ratio, topWidth, shoulderPos) => [
  { key: 'ratio', label: 'L:W', default: ratio, step: 0.01, min: 0.6 },
  { key: 'topWidth', label: 'Top edge', default: topWidth, step: 0.05, min: 0.1, max: 1, title: 'Top edge half-width, fraction of the half-width' },
  { key: 'shoulderPos', label: 'Widest point', default: shoulderPos, step: 0.05, min: 0.02, max: 0.9, title: 'Corners (widest point), fraction of the length from the top' },
  { key: 'girdle', label: 'Girdle', default: 0.035, step: 0.005 },
  { key: 'culetPos', label: 'Culet', default: 0.55, step: 0.01, title: 'Fraction of the length from the top' },
];
export const templates = {
  shieldStepKite: { name: 'Shield step cut, kite shield (starting point)', note: 'Pentagonal shield with the widest point low, two crown rows, two pavilion step rows and a culet row.', params: params(1.25, 0.5, 0.6), make: (o = {}) => shieldStep({ ratio: 1.25, topWidth: 0.5, shoulderPos: 0.6, ...o }) },
  shieldStepLong: { name: 'Shield step cut, long shield (starting point)', note: 'Elongated pentagonal shield, corners near the top.', params: params(2.0, 0.75, 0.12), make: (o = {}) => shieldStep({ ratio: 2.0, topWidth: 0.75, shoulderPos: 0.12, ...o }) },
  shieldStepWide: { name: 'Shield step cut, wide shield (starting point)', note: 'Heraldic shield wider than long, broad top edge.', params: params(0.9, 0.85, 0.3), make: (o = {}) => shieldStep({ ratio: 0.9, topWidth: 0.85, shoulderPos: 0.3, ...o }) },
};
export const plots = [];
