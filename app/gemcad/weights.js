// Diamond weight estimation: the trade formulas used by appraisers and the labs' weight
// estimators, carats = length x width x depth (mm) x factor, where the factor depends on the
// shape (and, for some, on the length-to-width ratio). Factors as published in the GIA weight
// estimation tables and the usual appraisal references; they assume a medium girdle and a
// normal pavilion. Shapes without a published factor (shields, kites) get none.
const TABLES = {
  round: [[1, 0.0061]],
  oval: [[1, 0.0062]],
  marquise: [[1.5, 0.00565], [2.0, 0.0058], [2.5, 0.00585], [3.0, 0.00595]],
  pear: [[1.25, 0.00615], [1.5, 0.0060], [1.66, 0.0059], [2.0, 0.00575]],
  heart: [[1, 0.0059]],
  emerald: [[1.0, 0.0080], [1.5, 0.0092], [2.0, 0.0100], [2.5, 0.0106]],
  princess: [[1, 0.0083]],
  radiant: [[1.0, 0.0083], [1.5, 0.0092], [2.0, 0.0100]],
  cushion: [[1.0, 0.0083], [1.5, 0.0092], [2.0, 0.0100]],
  trillion: [[1, 0.0057]],
  asscher: [[1.0, 0.0080], [1.5, 0.0092], [2.0, 0.0100], [2.5, 0.0106]],
};
const LABELS = {
  round: 'round brilliant', oval: 'oval', marquise: 'marquise', pear: 'pear', heart: 'heart', emerald: 'emerald cut',
  princess: 'princess (square modified brilliant)', asscher: 'square emerald cut', radiant: 'rectangular modified brilliant', cushion: 'cushion', trillion: 'triangular brilliant',
};

/** Shape family of a design from its name, or null when no estimator covers it. */
export function weightFamily(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('asscher') || n.includes('square emerald')) return 'asscher';
  if (n.includes('old mine')) return 'cushion';   // antique cushion brilliant: the cushion factor and chart
  if (n.includes('round')) return 'round';
  if (n.includes('marquise')) return 'marquise';
  if (n.includes('pear')) return 'pear';
  if (n.includes('heart')) return 'heart';
  if (n.includes('oval')) return 'oval';
  if (n.includes('princess')) return 'princess';
  if (n.includes('radiant')) return 'radiant';
  if (n.includes('cushion')) return 'cushion';
  if (n.includes('emerald')) return 'emerald';
  if (n.includes('trillion') || n.includes('trilliant') || n.includes('triangular')) return 'trillion';
  return null;
}

/** Factor for a family at a length-to-width ratio (linear between table rows, clamped at the ends). */
export function weightFactor(family, ratio = 1) {
  const t = TABLES[family]; if (!t) return null;
  if (t.length === 1 || ratio <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (ratio <= t[i][0]) { const [r0, f0] = t[i - 1], [r1, f1] = t[i]; return f0 + ((f1 - f0) * (ratio - r0)) / (r1 - r0); }
  return t[t.length - 1][1];
}

/** Estimator for a design: { family, label, factor, widthMm(ct), carats(widthMm) } or null. ratio = L/W, depth = total depth / W. */
export function weightEstimator(name, ratio, depth) {
  const family = weightFamily(name); if (!family) return null;
  const factor = weightFactor(family, ratio);
  const k = ratio * depth * factor;   // carats = W^3 * k
  return {
    family, label: LABELS[family], factor,
    widthMm: (ct) => Math.cbrt(ct / k),
    carats: (w) => w * w * w * k,
  };
}

/** The carat sizes the weight estimators and size charts list. */
export const CHART_CARATS = [0.25, 0.33, 0.5, 1, 1.5, 2, 3, 4, 5];

// Trade size chart: Stuller's millimetre-to-carat conversion chart (blog.stuller.com, 2025),
// [length, width] in mm per carat weight; a single figure means a round or square outline. The
// 3 ct trillion entry (10.3) is out of sequence on the chart and is left out; the radiant is
// legible there only up to 1 ct.
const SIZE_CHART = {
  round: { 0.25: [4.1], 0.33: [4.4], 0.5: [5.2], 0.75: [5.7], 1: [6.4], 1.5: [7.2], 2: [8.0], 3: [9.3], 4: [10.2], 5: [11.0] },
  princess: { 0.25: [3.5], 0.33: [3.75], 0.5: [4.5], 0.75: [4.75], 1: [5.5], 1.5: [6.5], 2: [7], 3: [8], 4: [9], 5: [9.5] },
  oval: { 0.25: [5, 3.5], 0.33: [5, 4], 0.5: [6.25, 4.5], 0.75: [7, 5], 1: [8, 6], 1.5: [9, 6.5], 2: [10, 7], 3: [11.5, 8], 4: [12.5, 9], 5: [13.6, 10] },
  marquise: { 0.25: [6, 3], 0.33: [6, 3.5], 0.5: [8, 4], 0.75: [9, 5], 1: [10.5, 5.5], 1.5: [11.5, 6], 2: [12.5, 6.5], 3: [15, 7.5], 4: [15.5, 8], 5: [17.5, 8.5] },
  emerald: { 0.25: [4, 3], 0.33: [4.5, 3], 0.5: [5.5, 4], 0.75: [6, 4.5], 1: [6.5, 5], 1.5: [7.5, 5.5], 2: [8.5, 6], 3: [9.5, 7], 4: [10.5, 8], 5: [11.5, 8.5] },
  heart: { 0.25: [4, 4.5], 0.33: [4, 4.6], 0.5: [5, 5.5], 0.75: [5.5, 6], 1: [6.5, 7], 1.5: [7.25, 8], 2: [7.75, 8.5], 3: [9, 9], 4: [10, 10], 5: [11, 11] },
  pear: { 0.25: [5.5, 3.5], 0.33: [6, 4], 0.5: [7, 5], 0.75: [7.5, 5.25], 1: [8.5, 5.5], 1.5: [9.5, 6.5], 2: [11, 7], 3: [12.5, 8], 4: [13.5, 9], 5: [15, 9.5] },
  trillion: { 0.33: [5], 0.5: [6], 0.75: [7], 1: [8], 1.5: [9], 2: [10], 4: [13], 5: [14.5] },
  asscher: { 0.25: [3.5], 0.33: [3.8], 0.5: [4.5], 0.75: [5], 1: [5.5], 1.5: [6.25], 2: [7], 3: [8], 4: [8.5], 5: [9.5] },
  cushion: { 0.25: [3.6], 0.33: [3.8], 0.5: [4.5], 0.75: [5.25], 1: [5.6], 1.5: [6.5], 2: [7], 3: [8.2], 4: [8.7], 5: [9.7] },
  radiant: { 0.25: [4, 3.5], 0.33: [4.4, 3.5], 0.5: [5, 4], 0.75: [5.8, 4.5], 1: [5.9, 5] },
};
/**
 * Chart dimensions { length, width } in mm for a family at a chart carat weight, or null. A
 * single chart figure is the width; the length follows the design's own ratio for the trillion
 * (the chart gives its side) and equals the width for round and square outlines.
 */
export function chartSize(family, carats, ratio = 1) {
  const e = SIZE_CHART[family]?.[carats]; if (!e) return null;
  if (e.length === 2) return { length: e[0], width: e[1] };
  return { length: family === 'trillion' ? e[0] * ratio : e[0], width: e[0] };
}
export const CHART_SOURCE = 'Stuller millimetre-to-carat conversion chart (2025)';
