// Marquise brilliant templates (generator in ../fancy.js).
import { marquiseStart } from '../fancy.js?v=90';

const base = [
  { key: 'ratio', label: 'L:W', default: 2.0, step: 0.01, min: 1.2 },
  { key: 'crownAngle', label: 'Crown angle', default: 35, step: 0.5, title: 'Side and wing bezel angle' },
  { key: 'pointAngle', label: 'Point bezel', default: 21.5, step: 0.5, title: 'Angle of the point bezel (uncorrected points) or of the line from the point to the table corner' },
  { key: 'crownHeight', label: 'Crown height', default: 0.14, step: 0.005, title: 'Fraction of the width' },
  { key: 'pavilionDepth', label: 'Pavilion depth', default: 0.435, step: 0.005, title: 'Fraction of the width' },
  { key: 'girdle', label: 'Girdle', default: 0.038, step: 0.005 },
  { key: 'starHeight', label: 'Star tips', default: 0.65, step: 0.05, min: 0.2, max: 0.95, title: 'Star tip height, fraction of the crown height' },
];
const french = [
  { key: 'tipHubHeight', label: 'Hub height', default: 0.75, step: 0.01, min: 0.5, max: 0.98, title: 'French tip hub, fraction of the crown height' },
  { key: 'tipTable', label: 'Tip table corner', default: 0.30, step: 0.01, title: 'Table corner distance from the point, fraction of the half-length' },
  { key: 'tipGirdle', label: 'Tip girdle point', default: 0.16, step: 0.01, title: 'Tip facet girdle point from the point, fraction of the half-length' },
];
const withDefaults = (list, over) => list.map((p) => (p.key in over ? { ...p, default: over[p.key] } : p));

export const templates = {
  marquiseGia: { name: 'Marquise brilliant, French tips, GIA wireframe proportions', note: 'Same construction with the proportions read off GIA\'s 4Cs French-tip wireframe: table 52%, hub 23% from the point.', params: [...withDefaults(base, { ratio: 2.03, crownAngle: 33, crownHeight: 0.156 }), ...withDefaults(french, { tipHubHeight: 0.89, tipTable: 0.40 })], make: (o = {}) => marquiseStart({ ratio: 2.03, crownAngle: 33, crownHeight: 0.156, tipHubHeight: 0.89, tipTable: 0.40, ...o }) },
  marquiseStd: { name: 'Marquise brilliant, uncorrected points (starting point)', note: 'IGI plot pattern with typical angles and a shallow bezel at each point.', params: base, make: (o = {}) => marquiseStart({ frenchTips: false, ...o }) },
  marquiseSideHub: { name: 'Marquise brilliant, side hubs, French tips (IGI FDR762535113)', note: 'IGI side-hub crown pattern (no side bezel: two half-side bezels, two flank facets and a side star meet at a hub on each side) with typical angles and GIA-style French tips.', params: [...base, { key: 'sideHub', label: 'Side hub', default: 0.82, step: 0.01, title: 'Side hub position, fraction of the half-width' }, ...french], make: (o = {}) => marquiseStart({ crown: 'sideHub', ...o }) },
  marquiseSideHubStd: { name: 'Marquise brilliant, side hubs, uncorrected points (IGI FDR762535113)', note: 'IGI side-hub crown pattern with typical angles and a shallow bezel at each point, as drawn on the report.', params: [...withDefaults(base, { pointAngle: 23 }), { key: 'sideHub', label: 'Side hub', default: 0.82, step: 0.01, title: 'Side hub position, fraction of the half-width' }], make: (o = {}) => marquiseStart({ crown: 'sideHub', frenchTips: false, pointAngle: 23, ...o }) },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'marquise-crown', label: 'Marquise: crown (IGI)' },
  { id: 'marquise-pavilion', label: 'Marquise: pavilion (IGI)' },
  { id: 'marquise-sidehub-crown', label: 'Marquise: side-hub crown (IGI FDR762535113)' },
  { id: 'marquise-french-gia', label: 'Marquise: French tips, crown (GIA 4Cs)' },
];
