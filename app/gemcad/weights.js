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
};
const LABELS = {
  round: 'round brilliant', oval: 'oval', marquise: 'marquise', pear: 'pear', heart: 'heart', emerald: 'emerald cut',
  princess: 'princess (square modified brilliant)', radiant: 'rectangular modified brilliant', cushion: 'cushion', trillion: 'triangular brilliant',
};

/** Shape family of a design from its name, or null when no estimator covers it. */
export function weightFamily(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('round')) return 'round';
  if (n.includes('marquise')) return 'marquise';
  if (n.includes('pear')) return 'pear';
  if (n.includes('heart')) return 'heart';
  if (n.includes('oval')) return 'oval';
  if (n.includes('princess')) return 'princess';
  if (n.includes('radiant')) return 'radiant';
  if (n.includes('cushion')) return 'cushion';
  if (n.includes('asscher') || n.includes('square emerald') || n.includes('emerald')) return 'emerald';
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
