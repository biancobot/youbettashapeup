// Asscher: square emerald cut (IGI "Square Emerald Cut"), a step cut on an octagonal girdle.
// Contract: export `templates` ({ key: { name, note, make({ girdleFacets, ratio }) -> design } }) and
// `plots` ([{ id, label }], image at designs/plots/<id>.png). Built with ../shapebuild.js the way
// ../fancy.js builds the marquise.
//
// Plot pattern (IGI plotting template; reports FDR691554158, FDR728551464 and FDR728551753 carry
// the same artwork to the pixel, inclusion symbols apart, so one template reproduces all three):
//   girdle: octagon, a square with large cut corners; corner vertex at 0.67 of the half-width
//           (corner cut 0.33 of the half-width = 0.165 of the width; an emerald's is about half that)
//   crown: 3 step rows, each 4 side facets (azimuth 0/90/180/270) + 4 corner facets (45/135/...),
//          then the table: 25 facets
//   pavilion: 3 step rows of 8, then 8 triangular facets (4 side, 4 corner) meeting at a point
//          culet: 32 facets
// Step lines measured on the plot (fraction of the half-width, from a weighted line fit of the
// step-line and corner-edge pixels, FDR691554158):
//   crown step polygons: side lines at 0.845, 0.695, 0.546 of the half-width (girdle line at 0.995),
//     corner edges x + y = 1.412, 1.163, 0.913 (girdle 1.662): corner vertex x/y = 0.671-0.673 on
//     every polygon, so the step polygons are scaled copies of the girdle octagon
//   pavilion: side lines at 0.769, 0.549, 0.328 (girdle 0.989); corner edges x + y = 1.288, 0.920,
//     0.551 (girdle 1.656): x/y = 0.674-0.678, again homothetic; the innermost octagon is at one
//     third of the half-width and the last row runs from it to the culet point at the centre
//   normalised to the girdle line: crown 0.85, 0.70, 0.55; pavilion 0.78, 0.555, 0.333.
// All ridges (side/corner facet intersections) therefore run straight to the centre in plan.
import { newTier } from '../design.js?v=99';
import { rad, girdleFromPolygon, planeThrough, classTier, plane3 } from '../shapebuild.js?v=99';

/**
 * Asscher starting design: step rows parallel to the girdle edges, each row one side class and one
 * corner class. The side facet of each row is set by its angle and passes through the previous
 * row's upper step line (the girdle edge at z = 0 for the first row); the corner facet passes
 * through the two ends of the previous corner step line and the measured end of this row's step
 * line, so the four facets around every step-polygon vertex meet at one point. Fold 4 + mirror:
 * each class is 8 faces or 4 (classes on the axes / diagonals).
 */
export function asscherStart({
  corner = 0.33,                         // corner cut, fraction of the half-width (plot: 0.33)
  crownSteps = [0.85, 0.70, 0.55],       // crown step polygons, scale of the girdle octagon (last = table)
  crownAngles = [36, 32, 28],            // side facet angles per crown row, girdle outwards
  pavilionSteps = [0.78, 0.555, 0.333],  // pavilion step polygons, scale of the girdle octagon
  pavilionAngles = [50, 45, 42],         // side facet angles per pavilion step row
  culetAngle = 40,                       // side facets of the last row, from the inner octagon to the culet point
  girdle = 0.03,                         // girdle thickness, fraction of the width
  gear = 96, ratio = 1,                  // ratio accepted for the template contract; the asscher is square (fold 4)
} = {}) {
  const W = 2, g = girdle * W, xc = 1 - corner;
  const verts = [[1, -xc], [1, xc], [xc, 1], [-xc, 1], [-1, xc], [-1, -xc], [-xc, -1], [xc, -1]];
  const girdleTier = girdleFromPolygon(verts, gear);
  const tiers = [girdleTier];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 4, true)); return plane; };
  const swap = (p) => [p[1], p[0], p[2]];   // mirror across the diagonal x = y

  // Step rows from a start line. Returns the last step line (y, z) and ridge end point.
  const rows = (prefix, steps, angles, sign, z0) => {
    let yPrev = 1, zPrev = z0, Pprev = [xc, 1, z0];
    steps.forEach((s, k) => {
      const a = angles[k];
      addClass(`${prefix}${k + 1} side`, planeThrough(sign * a, 90, [0, yPrev, zPrev]));
      const z = zPrev + sign * (yPrev - s) * Math.tan(rad(a));
      const P = [s * xc, s, z];   // end of this row's side step line, on the ridge (plot: homothetic octagons)
      addClass(`${prefix}${k + 1} corner`, plane3(Pprev, swap(Pprev), P, sign > 0));
      yPrev = s; zPrev = z; Pprev = P;
    });
    return { y: yPrev, z: zPrev, P: Pprev };
  };

  // ---- crown: rows from the girdle top (z = 0) up to the table
  const top = rows('C', crownSteps, crownAngles, 1, 0);
  const H = top.z;
  tiers.splice(1, 0, newTier({ name: 'T', angle: 0, distance: H, indices: [] }));

  // ---- pavilion: rows from the girdle bottom (z = -g) down, then the culet row to a point
  const bottom = rows('P', pavilionSteps, pavilionAngles, -1, -g);
  const zc = bottom.z - bottom.y * Math.tan(rad(culetAngle));
  const culet = [0, 0, zc];
  addClass('P4 side', planeThrough(-culetAngle, 90, [0, bottom.y, bottom.z]));
  addClass('P4 corner', plane3(bottom.P, swap(bottom.P), culet, false));

  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const Pd = -g - zc, tableSide = crownSteps[crownSteps.length - 1];
  const tableCorner = Math.hypot(tableSide * xc, tableSide);   // half the corner-to-corner table width
  const cornerAngle = (name) => { const t = tiers.find((x) => x.name === name); return t ? Math.abs(t.angle).toFixed(1) : '?'; };
  return {
    name: 'Asscher (square emerald cut), IGI plot', gear, fold: 4, mirror: true, ri: 2.42,
    headings: ['Asscher / square emerald cut, IGI plot pattern', `Crown ${crownAngles.join('/')}, pavilion ${pavilionAngles.join('/')}/${culetAngle}, corner cut ${corner}`],
    footnotes: ['Starting point: IGI plot pattern (step polygons measured on the plot) with typical step angles. Trace against the plot underlay and cut meet points.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to asscher-cut diamonds.',
      'IGI Excellent ranges (square emerald cut; L:W 1.06+ is considered rectangular): L:W 1.00-1.05, total depth 63-69%, table 58-64%, crown height 11-16%, crown angle 32-37, girdle 2-6% thin to thick, pavilion depth 47-54%, pavilion angle 39-43, culet pointed, none, very small or small.',
      `This design: square (L:W 1), table ${pct(tableSide)} of the width side to side (${pct(tableCorner)} corner to corner), crown height ${pct(H / W)}, girdle ${pct(girdle)}, pavilion depth ${pct(Pd / W)}, total depth ${pct((H + g + Pd) / W)}, point culet. Side facet angles: crown rows ${crownAngles.join(', ')} (girdle outwards); pavilion rows ${pavilionAngles.join(', ')}, culet row ${culetAngle}. Corner facets come out shallower from the meet points (tan corner = 1.414 tan side / (1 + ${xc.toFixed(2)}) for homothetic step polygons): crown ${crownAngles.map((_, k) => cornerAngle(`C${k + 1} corner`)).join(', ')}, pavilion ${pavilionAngles.map((_, k) => cornerAngle(`P${k + 1} corner`)).join(', ')}, culet row ${cornerAngle('P4 corner')}.`,
      `Girdle: octagon, a square with corner cut ${corner} of the half-width (corner vertex at ${xc.toFixed(2)} of the half-width; measured 0.67 on the plot), 8 girdle facets. The template's girdle facet count does not apply to a polygon girdle.`,
      'Plot pattern (IGI template, reports FDR691554158, FDR728551464, FDR728551753, identical artwork): crown 3 step rows of 8 facets (4 side, 4 corner) and the table, 25 facets; pavilion 3 step rows of 8 and a culet row of 8 triangles meeting at a point, 32 facets; girdle 8. 65 facets.',
      `Step polygons measured on the plot, as scale of the girdle octagon (they are scaled copies of it, corner vertex x/y 0.67 on every one): crown ${crownSteps.join(', ')} (the last is the table); pavilion ${pavilionSteps.join(', ')}, then the culet row to the centre. Every side/corner ridge runs straight to the centre in plan.`,
      'Construction: each row\'s side facet is set by its angle through the previous step line; its corner facet passes through the ends of the previous corner step line and the measured end of this row\'s step line, so the four facets at each step-polygon vertex meet at one point (GemCad meet points). Side angles are the free parameters; corner angles follow.',
    ],
    tiers,
  };
}

export const templates = {
  asscher: {
    name: 'Asscher / square emerald cut (IGI plot pattern)',
    note: 'IGI square emerald plot pattern (reports FDR691554158, FDR728551464, FDR728551753): 3 crown step rows, 3 pavilion step rows and a culet row to a point, corner cut 0.33; typical step angles. Square only (the L:W field is ignored).',
    params: [
      { key: 'corner', label: 'Corner cut', default: 0.33, step: 0.01, min: 0.05, max: 0.6, title: 'Corner cut, fraction of the half-width' },
      { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005 },
      { key: 'crownSteps', label: 'Crown steps', default: [0.85, 0.70, 0.55], list: true, title: 'Crown step polygons as a scale of the girdle octagon; the last is the table' },
      { key: 'crownAngles', label: 'Crown rows', default: [36, 32, 28], list: true, title: 'Side facet angle per crown row' },
      { key: 'pavilionSteps', label: 'Pavilion steps', default: [0.78, 0.555, 0.333], list: true },
      { key: 'pavilionAngles', label: 'Pavilion rows', default: [50, 45, 42], list: true },
      { key: 'culetAngle', label: 'Culet row', default: 40, step: 0.5 },
    ],
    make: ({ girdleFacets, ratio, ...o } = {}) => { void girdleFacets; void ratio; return asscherStart(o); },
  },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'asscher-crown', label: 'Asscher: crown (IGI FDR691554158; same plot on FDR728551464, FDR728551753)' },
  { id: 'asscher-pavilion', label: 'Asscher: pavilion (IGI FDR691554158; same plot on FDR728551464, FDR728551753)' },
];
