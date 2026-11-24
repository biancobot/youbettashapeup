// Step-cut shields: straight-sided outlines (a point at the bottom, up to two pairs of corners,
// and either a straight top edge or an apex at the top) cut in steps, as in the reference
// photographs of shield-cut diamonds: concentric rows of facets parallel to the girdle edges on
// the crown, step rows on the pavilion converging on a culet point. Three presets differ only in
// proportions, measured from the photographs and the face-up silhouettes drawn for them:
//   kite shield       (L:W 1.40, apex at the top, shoulders 59% wide 17% down, widest 73% down),
//   hexagonal shield  (L:W 0.59, apex at the top, widest 33% down, lower corners 79% wide 69% down),
//   wide shield       (L:W 0.75, top edge 90% of the width, widest 12% down, lower corners 34% wide 88% down).
// Built like the emerald in ./emerald.js: every row is one set of planes at one angle, each with
// the azimuth of its girdle edge's outward normal, through the previous row's step line, so the
// step polygons are exact inward offsets of the girdle polygon and every meet point is exact.
// One mirror line: fold 1 + mirror. Width 2 along x, length 2 * ratio along y, point at -y.
import { newTier } from '../design.js?v=62';
import { rad, deg, girdleFromPolygon, planeThrough, plane3, classTier } from '../shapebuild.js?v=62';

/**
 * Outline vertices (counter-clockwise from the point) for the proportions. topWidth: top edge
 * half-width as a fraction of the half-width (0 = an apex). corners: [[halfWidth, posFromTop], ...]
 * corner pairs between the top and the point, in any order (posFromTop is a fraction of the
 * length); half-widths are scaled so the widest is 1. Returns { poly, right, hasTop } with
 * right = the right half's vertices from the point to the top.
 */
export function shieldPolygon(ratio, topWidth, corners) {
  const L = 2 * ratio, yT = ratio;
  const cs = corners.filter((c) => c[0] > 0 && c[1] > 0 && c[1] < 1).sort((a, b) => b[1] - a[1]);   // from the point upwards
  const scale = Math.max(topWidth, ...cs.map((c) => c[0]));
  const right = [[0, -ratio], ...cs.map(([w, pos]) => [w / scale, yT - pos * L])];
  right.push(topWidth > 0 ? [topWidth / scale, yT] : [0, yT]);
  const left = right.filter((p) => p[0] > 0).map((p) => [-p[0], p[1]]).reverse();
  return { poly: [...right, ...left], right, hasTop: topWidth > 0 };
}

/**
 * Inward offset of a convex polygon by distance d (edges stay parallel; corners move along
 * bisectors). An edge that would reverse (short edges near the widest point swallowed by their
 * neighbours) is dropped and the offset recomputed. Returns { poly, orig } where orig[i] is the
 * index of the input edge that output edge i came from (input edges keep their identity through
 * successive offsets via the caller's own bookkeeping).
 */
function offsetPolygon(poly, d) {
  const n = poly.length, lines = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
    const nx = y1 - y0, ny = -(x1 - x0), l = Math.hypot(nx, ny);   // outward normal of a counter-clockwise edge
    lines.push({ nx: nx / l, ny: ny / l, c: (nx * x0 + ny * y0) / l - d, dx: (x1 - x0) / l, dy: (y1 - y0) / l, orig: i });
  }
  let keep = lines;
  for (;;) {
    const m = keep.length, out = [];
    for (let i = 0; i < m; i++) {
      const a = keep[(i - 1 + m) % m], b = keep[i], det = a.nx * b.ny - a.ny * b.nx;
      out.push([(a.c * b.ny - b.c * a.ny) / det, (a.nx * b.c - b.nx * a.c) / det]);
    }
    let worst = -1, worstLen = 0.03;   // edges shorter than this (half-widths) are dropped: they would be slivers
    for (let i = 0; i < m; i++) {
      const [x0, y0] = out[i], [x1, y1] = out[(i + 1) % m];
      const len = (x1 - x0) * keep[i].dx + (y1 - y0) * keep[i].dy;   // signed length along the original edge direction
      if (len < worstLen) { worst = i; worstLen = len; }
    }
    if (worst < 0 || m <= 3) return { poly: out, orig: keep.map((l) => l.orig) };
    keep = keep.filter((_, i) => i !== worst);
  }
}

/**
 * Step-cut shield starting point. crownRows / pavilionRows: [inset in half-widths, side angle]
 * per row from the girdle inwards; the last pavilion row runs from its step line to the culet.
 */
export function shieldStep({
  ratio = 1.4, topWidth = 0, c1Width = 0.59, c1Pos = 0.17, c2Width = 1, c2Pos = 0.73, girdle = 0.03,
  crownRows = [[0.15, 42], [0.25, 32]], pavilionRows = [[0.22, 48], [0.2, 43]], culetPos = 0.6, gear = 96,
} = {}) {
  const W = 2, g = girdle * W, L = 2 * ratio;
  const { poly, right, hasTop } = shieldPolygon(ratio, topWidth, [[c1Width, c1Pos], [c2Width, c2Pos]]);
  const unit = Math.min(1, ratio);   // row insets are fractions of half the smaller dimension
  const tiers = [girdleFromPolygon(poly, gear)];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 1, true)); return plane; };
  // edges of the right half, counter-clockwise from the point; the top edge (if any) is its own mirror image
  const nRight = right.length - 1, nEdges = nRight + (hasTop ? 1 : 0);
  const edgeNames = nRight === 3 ? ['lower side', 'side'] : nRight === 2 ? ['side'] : [];
  edgeNames.push(hasTop ? 'shoulder' : 'head');
  if (hasTop) edgeNames.push('top');
  const edgeAz = (p0, p1) => deg(Math.atan2(-(p1[0] - p0[0]), p1[1] - p0[1]));
  // ---- crown: rows at the given angles through the step lines; the table is the last step polygon
  // step polygons may lose edges as they shrink; `orig` maps each step edge back to its girdle edge
  const rightEdges = (step, orig) => orig.map((o, i) => ({ o, i })).filter(({ o }) => o < nEdges).map(({ o, i }) => ({ name: edgeNames[o], p0: step[i], p1: step[(i + 1) % step.length] }));
  const shrink = (step, orig, inset) => { const r = offsetPolygon(step, inset); return { step: r.poly, orig: r.orig.map((i) => orig[i]) }; };
  let step = poly, orig = poly.map((_, i) => i), z = 0;
  crownRows.forEach(([inset, angle], k) => {
    for (const { name, p0, p1 } of rightEdges(step, orig)) addClass(`C${k + 1} ${name}`, planeThrough(angle, edgeAz(p0, p1), [p0[0], p0[1], z]));
    z += inset * unit * Math.tan(rad(angle)); ({ step, orig } = shrink(step, orig, inset * unit));
  });
  const H = z;
  tiers.push(newTier({ name: 'T', angle: 0, distance: H, indices: [] }));
  // ---- pavilion: step rows down from the girdle, then a culet row from the last step line to the culet point
  step = poly; orig = poly.map((_, i) => i); z = -g;
  pavilionRows.forEach(([inset, angle], k) => {
    for (const { name, p0, p1 } of rightEdges(step, orig)) addClass(`P${k + 1} ${name}`, planeThrough(-angle, edgeAz(p0, p1), [p0[0], p0[1], z]));
    z -= inset * unit * Math.tan(rad(angle)); ({ step, orig } = shrink(step, orig, inset * unit));
  });
  // culet row: planes through each inner step edge (at z) and the culet; the culet depth is set so
  // that the steepest facet of the row (the edge nearest the culet in plan) is 3 degrees shallower
  // than the last step row, and the other edges' facets are shallower still
  const culet = [0, ratio - culetPos * L, 0];
  const runs = rightEdges(step, orig).map(({ p0, p1 }) => {
    const nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]), nl = Math.hypot(nx, ny);
    return (nx * p0[0] + ny * p0[1] - nx * culet[0] - ny * culet[1]) / nl;   // plan distance from the culet to the step line
  });
  const run = Math.min(...runs);
  const culetAngle = pavilionRows[pavilionRows.length - 1][1] - 3;
  culet[2] = z - run * Math.tan(rad(culetAngle));
  for (const { name, p0, p1 } of rightEdges(step, orig)) addClass(`P${pavilionRows.length + 1} ${name}`, plane3([p0[0], p0[1], z], [p1[0], p1[1], z], culet, false));
  const Pd = -g - culet[2];
  const pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const cornersText = right.slice(1, -1).map((p) => `corners ${pct(p[0])} of the width at ${pct((ratio - p[1]) / L)} of the length from the top`).reverse().join(', ');
  return {
    name: 'Shield step cut (starting point)', gear, fold: 1, mirror: true, ri: 2.42,
    headings: ['Shield step cut starting point', `L:W ${ratio}, ${hasTop ? `top edge ${pct(topWidth)} of the width` : 'apex at the top'}, ${cornersText}`],
    footnotes: ['Starting point: step-cut pattern on a straight-sided shield outline measured from a photograph. No lab plotting template exists for shields.'],
    notes: [
      'Ideal dimensions: none published. GIA assigns no cut grade to shield-cut diamonds and IGI\'s fancy-shape cut guidelines do not cover the shape; step-cut proportions follow the emerald cut (crown height 11-16%, total depth 60-68%, girdle 2-6%).',
      `This design: L:W ${ratio}, ${hasTop ? `top edge ${pct(topWidth)} of the width` : 'apex at the top'}, ${cornersText}, crown ${crownRows.length} rows at ${crownRows.map((r) => r[1]).join('/')} degrees (insets ${crownRows.map((r) => r[0]).join('/')} of half the smaller dimension), crown height ${pct(H / W)}, girdle ${pct(girdle)}, pavilion ${pavilionRows.length} step rows at ${pavilionRows.map((r) => r[1]).join('/')} degrees plus a culet row (steepest facet ${culetAngle} degrees), pavilion depth ${pct(Pd / W)}, culet ${pct(culetPos)} of the length from the top, total depth ${pct((H + g + Pd) / W)}.`,
      `Pattern: ${poly.length} girdle facets; each crown and pavilion row has one facet per girdle edge with the edge normal as azimuth, so the step lines are exact inward offsets of the outline; the last pavilion row converges on a culet point. Row angles are those of the side facets; the other facets of a row share the angle.`,
    ],
    tiers,
  };
}

const params = (o) => [
  { key: 'ratio', label: 'L:W', default: o.ratio, step: 0.01, min: 0.3 },
  { key: 'topWidth', label: 'Top edge', default: o.topWidth, step: 0.05, min: 0, max: 1, title: 'Top edge half-width, fraction of the half-width (0 = apex)' },
  { key: 'c1Width', label: 'Upper corners', default: o.c1Width, step: 0.01, min: 0, max: 1, title: 'Upper corner pair: half-width, fraction of the half-width (0 = none)' },
  { key: 'c1Pos', label: 'at', default: o.c1Pos, step: 0.01, min: 0, max: 0.99, title: 'Upper corner pair: fraction of the length from the top' },
  { key: 'c2Width', label: 'Lower corners', default: o.c2Width, step: 0.01, min: 0, max: 1, title: 'Lower corner pair: half-width, fraction of the half-width (0 = none)' },
  { key: 'c2Pos', label: 'at', default: o.c2Pos, step: 0.01, min: 0, max: 0.99, title: 'Lower corner pair: fraction of the length from the top' },
  { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
  { key: 'culetPos', label: 'Culet', default: o.culetPos, step: 0.01, title: 'Fraction of the length from the top' },
];
const KITE = { ratio: 1.4, topWidth: 0, c1Width: 0.59, c1Pos: 0.17, c2Width: 1, c2Pos: 0.73, culetPos: 0.6 };
const HEX = { ratio: 0.59, topWidth: 0, c1Width: 1, c1Pos: 0.33, c2Width: 0.79, c2Pos: 0.69, culetPos: 0.5 };
const WIDE = { ratio: 0.75, topWidth: 0.9, c1Width: 1, c1Pos: 0.12, c2Width: 0.34, c2Pos: 0.88, culetPos: 0.45 };
export const templates = {
  shieldStepKite: { name: 'Shield step cut, kite shield (starting point)', note: 'Six-sided kite shield measured from a photograph: apex at the top, shoulders 17% down, widest point 73% down; two crown rows, two pavilion step rows and a culet row.', params: params(KITE), make: (o = {}) => shieldStep({ ...KITE, ...o }) },
  shieldStepLong: { name: 'Shield step cut, hexagonal shield (starting point)', note: 'Six-sided shield wider than long, measured from the face-up silhouette drawn for the second photograph: apex at the top, widest 33% down, lower corners 69% down.', params: params(HEX), make: (o = {}) => shieldStep({ ...HEX, ...o }) },
  shieldStepWide: { name: 'Shield step cut, wide shield (starting point)', note: 'Six-sided shield wider than long, measured from the face-up silhouette drawn for the third photograph: straight top edge, widest 12% down, lower corners 88% down, blunt point.', params: params(WIDE), make: (o = {}) => shieldStep({ ...WIDE, ...o }) },
};
export const plots = [];
