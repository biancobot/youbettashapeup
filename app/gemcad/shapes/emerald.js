// Emerald cut: cut-cornered rectangular step cut, pattern of the IGI plotting template.
// Contract: export `templates` ({ key: { name, note, make({ girdleFacets, ratio }) -> design } }) and
// `plots` ([{ id, label }], image at designs/plots/<id>.png). Facets are built with ../shapebuild.js.
//
// Construction. The girdle is an octagon: a rectangle (half-width 1, half-length L:W) with 45-degree
// cut corners, one girdle facet per edge (girdleFromPolygon). Every step row is a horizontal
// octagon (the step line) at a height z; a row's three facet classes (side at azimuth 0/180, end at
// 90/270, corner at 45 + 90k) are the planes through the row's lower octagon edge at z_k and its
// upper octagon edge at z_(k+1). Because all facets of a row share the same two horizontal
// octagons, each facet is an exact trapezoid and the rows meet cleanly at the octagon vertices;
// the facet angles follow from the plan insets and the row heights. The side rows' angles are the
// design parameters; the end and corner angles of a row follow from its measured insets (the plot
// insets the corner rows about 1.25 times more than the side rows, so the corner facets are
// shallower). The pavilion's last row converges to a keel line: its side facets meet at the keel,
// its end facets are triangles whose tip is the keel end, and its corner facets are triangles
// through their step line and the keel end.
//
// Plot measurements (IGI FDR713510206, 1055 x 530 px; crown view left, pavilion right; half-width
// 153.5 px, half-length 243.5 px, so L:W = 1.586 and the four corners of each view agree to 2-3 px).
// Positions in units of the half-width, measured from the girdle outline (the side line is x = 1,
// the end line is y = L:W). The corner cut is the leg of the 45-degree corner triangle; a step
// octagon's corner cut is the mean of its two measured corner-vertex offsets (the plot draws the
// corner step lines at about 52 degrees to the width axis rather than parallel to the 45-degree
// girdle corner, so the two offsets differ by up to 0.07; the design keeps the corner facets
// parallel to the girdle corner, i.e. the corner facets' azimuth is the corner-edge normal).
//   girdle corner cut: 40 px = 0.26 (same on crown and pavilion views)
//   crown rows (side inset, end inset, corner cut): 19.25 px, 19.25 px, 36 px = (0.125, 0.125, 0.235);
//     39.5 px, 40 px, 34.5 px = (0.257, 0.260, 0.225); table 57.75 px, 60 px, 29.75 px = (0.376, 0.391, 0.194)
//     -> table 63% of the width, 76% of the length
//   pavilion rows (side inset, end inset, corner cut): 37.5 px, 37 px, 30 px = (0.244, 0.241, 0.197);
//     74.5 px, 73.5 px, 19.5 px = (0.485, 0.479, 0.127); 111.5 px, 110 px, 9.75 px = (0.726, 0.717, 0.064);
//     keel from the end: 148.5 px = 0.967 from the end, i.e. its ends at y = +/-0.616; the plot draws
//     the keel as a 6 px (0.04) wide strip (a long faceted culet); this design keeps a sharp keel line.
import { newTier } from '../design.js?v=133';
import { rad, deg, girdleFromPolygon, planeThrough, zPlane, classTier } from '../shapebuild.js?v=133';

/** Measured step octagons: side inset x, end inset y (from the girdle lines) and corner cut c, in half-widths. */
const CROWN_STEPS = [
  { x: 0.125, y: 0.125, c: 0.235 },
  { x: 0.257, y: 0.260, c: 0.225 },
  { x: 0.376, y: 0.391, c: 0.194 },   // table
];
const PAVILION_STEPS = [
  { x: 0.244, y: 0.241, c: 0.197 },
  { x: 0.485, y: 0.479, c: 0.127 },
  { x: 0.726, y: 0.717, c: 0.064 },
];
const KEEL_INSET = 0.967;   // keel end measured from the girdle end line, in half-widths (0.616 from the centre at L:W 1.586)

/**
 * Emerald cut starting point. Angles are those of the side facets of each row, from the girdle
 * inwards; crown and pavilion heights follow from them and the plot's insets. L:W, corner cut and
 * girdle thickness (fraction of the width) are free. The stone is convex, so every class's angles
 * must decrease row by row; the keel row's end facets are steeper than its side facets (their run
 * to the keel end is shorter), so the keel angle must be about 3 degrees below the third row's.
 */
export function emeraldStep({
  ratio = 1.58, corner = 0.26, crownAngles = [40, 33, 26], pavilionAngles = [52, 46, 42, 39], girdle = 0.03,
  gear = 96, crownSteps = CROWN_STEPS, pavilionSteps = PAVILION_STEPS, keelInset = KEEL_INSET,
} = {}) {
  const W = 2, l = ratio, c = corner, g = girdle * W, keelEnd = l - keelInset;
  const verts = [[1, -(l - c)], [1, l - c], [1 - c, l], [-1 + c, l], [-1, l - c], [-1, -(l - c)], [-1 + c, -l], [1 - c, -l]];
  const tiers = [girdleFromPolygon(verts, gear)];
  const addClass = (name, plane) => { tiers.push(classTier(name, plane, gear, 2, true)); return plane; };
  // octagon k in plan: side line x = a, end line y = b, corner line x + y = a + b - c (support h along 45 degrees)
  const octagon = ({ x, y, c }) => { const a = 1 - x, b = l - y; return { a, b, h: (a + b - c) / Math.SQRT2 }; };
  const girdleOct = octagon({ x: 0, y: 0, c });
  const S2 = Math.SQRT1_2;
  // planes of one row between octagons lo (at z0) and hi (at z1); sign +1 crown, -1 pavilion
  const row = (prefix, lo, z0, hi, z1, sign) => {
    const dz = Math.abs(z1 - z0);
    addClass(`${prefix} side`, planeThrough(sign * deg(Math.atan2(dz, lo.a - hi.a)), 0, [lo.a, 0, z0]));
    addClass(`${prefix} end`, planeThrough(sign * deg(Math.atan2(dz, lo.b - hi.b)), 90, [0, lo.b, z0]));
    addClass(`${prefix} corner`, planeThrough(sign * deg(Math.atan2(dz, lo.h - hi.h)), 45, [lo.h * S2, lo.h * S2, z0]));
  };

  // ---- crown: rows from the girdle (z = 0) up to the table
  let z = 0, lo = girdleOct;
  crownSteps.forEach((s, k) => {
    const hi = octagon(s), dz = (lo.a - hi.a) * Math.tan(rad(crownAngles[k]));
    row(`C${k + 1}`, lo, z, hi, z + dz, 1);
    z += dz; lo = hi;
  });
  const H = z;
  tiers.push(newTier({ name: 'T', angle: 0, distance: H, indices: [] }));

  // ---- pavilion: rows from the girdle bottom (z = -g) down to the keel
  z = -g; lo = girdleOct;
  pavilionSteps.forEach((s, k) => {
    const hi = octagon(s), dz = (lo.a - hi.a) * Math.tan(rad(pavilionAngles[k]));
    row(`P${k + 1}`, lo, z, hi, z - dz, -1);
    z -= dz; lo = hi;
  });
  // keel row: side facets meet at the keel line x = 0; end and corner facets are triangles to the keel end
  const kAngle = pavilionAngles[pavilionSteps.length];
  const zk = z - lo.a * Math.tan(rad(kAngle)), dz = z - zk, n = pavilionSteps.length + 1;
  addClass(`P${n} side`, planeThrough(-kAngle, 0, [lo.a, 0, z]));
  addClass(`P${n} end`, planeThrough(-deg(Math.atan2(dz, lo.b - keelEnd)), 90, [0, lo.b, z]));
  addClass(`P${n} corner`, planeThrough(-deg(Math.atan2(dz, lo.h - keelEnd * S2)), 45, [lo.h * S2, lo.h * S2, z]));
  const Pd = -g - zk;

  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const tbl = octagon(crownSteps[crownSteps.length - 1]);
  const list = (a) => a.map((v) => `${v}`).join('/');
  const cornerAngles = (steps, angles) => {
    let prev = girdleOct; const out = [];
    steps.forEach((s, k) => { const hi = octagon(s), d = (prev.a - hi.a) * Math.tan(rad(angles[k])); out.push(deg(Math.atan2(d, prev.h - hi.h)).toFixed(1)); prev = hi; });
    return out.join('/');
  };
  return {
    name: 'Emerald cut (starting point)', gear, fold: 2, mirror: true, ri: 2.42,
    headings: ['Emerald cut starting point', `L:W ${ratio}, corner cut ${corner}, crown steps ${list(crownAngles)}, pavilion steps ${list(pavilionAngles)}`],
    footnotes: ['Starting point: IGI plot pattern (three crown rows, three pavilion rows and a keel row) with typical step angles. Trace against the plot underlay.'],
    notes: [
      'Ideal dimensions: none published as a complete parameter set. GIA assigns no cut grade to emerald-cut diamonds.',
      'IGI Excellent ranges (emerald): L:W 1.35-1.56, total depth 60-68%, table 58-68%, crown height 11-16%, crown angle 30-40, girdle 2-6% (thin to thick), pavilion depth 47-53%, pavilion angle 40-43, culet none or long (faceted).',
      `This design: L:W ${ratio}, crown height ${pct(H / W)}, girdle ${pct(girdle)}, pavilion depth ${pct(Pd / W)}, total depth ${pct((H + g + Pd) / W)}, table ${pct(tbl.a)} of the width and ${pct(tbl.b / l)} of the length. Side-facet angles: crown rows ${list(crownAngles)} (corner rows ${cornerAngles(crownSteps, crownAngles)}), pavilion rows ${list(pavilionAngles)} from the girdle to the keel (corner rows ${cornerAngles(pavilionSteps, pavilionAngles)}); end and corner angles follow from the plot's insets at the same row heights. Sharp keel line ${pct(keelEnd / l)} of the length long (the plot draws a long faceted culet).`,
      'Plot pattern (IGI template, FDR713510206): crown: table and three step rows, each of 2 side, 2 end and 4 corner facets (24 crown facets); 8 girdle facets; pavilion: three step rows of 8 facets and a keel row of 8 (2 side facets meeting at the keel, 2 end and 4 corner triangles converging on the keel ends): 32 pavilion facets; 65 facets in all.',
      `Measured on the plot (units of the half-width): L:W 1.586 (just above IGI's 1.56), girdle corner cut 0.26 (45 degrees), crown step lines at 0.125, 0.257 and 0.376 (table) from the side, pavilion step lines at 0.244, 0.485 and 0.726, keel ends 0.967 from the ends (0.616 from the centre). The plot's corner step lines run at about 52 degrees to the width axis; the design keeps them parallel to the 45-degree girdle corner (flat girdle), so their ends deviate from the plot by up to 0.03 of the half-width.`,
      'Step rows are horizontal octagons: every facet of a row runs between the same two step lines, so all meet points are exact; the angle of each end and corner facet follows from the row height and its plan inset.',
    ],
    tiers,
  };
}

export const templates = {
  emerald: {
    name: 'Emerald cut (starting point)',
    note: 'IGI plot pattern: octagonal girdle, three crown step rows, three pavilion step rows and a keel row, with typical step angles; trace against the underlay.',
    // girdleFacets is accepted and ignored: a polygon girdle has one facet per edge
    params: [
      { key: 'ratio', label: 'L:W', default: 1.58, step: 0.01, min: 1 },
      { key: 'corner', label: 'Corner cut', default: 0.26, step: 0.01, min: 0.05, max: 0.6, title: 'Corner cut, fraction of the half-width' },
      { key: 'girdle', label: 'Girdle', default: 0.03, step: 0.005, title: 'Girdle thickness, fraction of the width' },
      { key: 'crownAngles', label: 'Crown rows', default: [40, 33, 26], list: true, title: 'Side facet angle of each crown row, girdle inwards' },
      { key: 'pavilionAngles', label: 'Pavilion rows', default: [52, 46, 42, 39], list: true, title: 'Side facet angle of each pavilion row, girdle inwards, then the keel row' },
    ],
    make: ({ girdleFacets, ...o } = {}) => emeraldStep(o),
  },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'emerald-crown', label: 'Emerald: crown (IGI)' },
  { id: 'emerald-pavilion', label: 'Emerald: pavilion (IGI)' },
];
