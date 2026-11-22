// Marquise brilliant templates (generator in ../fancy.js).
import { marquiseStart } from '../fancy.js';

export const templates = {
  marquise: { name: 'Marquise brilliant, French tips (starting point)', note: 'IGI plot pattern with typical angles and GIA-style French tips; trace against the underlay and cut meet points.', make: ({ girdleFacets = 128, ratio = 2.0 } = {}) => marquiseStart({ girdleFacets, ratio }) },
  marquiseGia: { name: 'Marquise brilliant, French tips, GIA wireframe proportions', note: 'Same construction with the proportions read off GIA\'s 4Cs French-tip wireframe: table 52%, hub 23% from the point.', make: ({ girdleFacets = 128, ratio = 2.03 } = {}) => marquiseStart({ girdleFacets, ratio, crownAngle: 33, crownHeight: 0.156, tipHubHeight: 0.89, tipTable: 0.40 }) },
  marquiseStd: { name: 'Marquise brilliant, uncorrected points (starting point)', note: 'IGI plot pattern with typical angles and a shallow bezel at each point.', make: ({ girdleFacets = 128, ratio = 2.0 } = {}) => marquiseStart({ frenchTips: false, girdleFacets, ratio }) },
  marquiseSideHub: { name: 'Marquise brilliant, side hubs, French tips (IGI FDR762535113)', note: 'IGI side-hub crown pattern (no side bezel: two half-side bezels, two flank facets and a side star meet at a hub on each side) with typical angles and GIA-style French tips.', make: ({ girdleFacets = 128, ratio = 2.0 } = {}) => marquiseStart({ crown: 'sideHub', girdleFacets, ratio }) },
  marquiseSideHubStd: { name: 'Marquise brilliant, side hubs, uncorrected points (IGI FDR762535113)', note: 'IGI side-hub crown pattern with typical angles and a shallow bezel at each point, as drawn on the report.', make: ({ girdleFacets = 128, ratio = 2.0 } = {}) => marquiseStart({ crown: 'sideHub', frenchTips: false, pointAngle: 23, girdleFacets, ratio }) },
};

/** Built-in plot underlays: { id, label }; the image is designs/plots/<id>.png. */
export const plots = [
  { id: 'marquise-crown', label: 'Marquise: crown (IGI)' },
  { id: 'marquise-pavilion', label: 'Marquise: pavilion (IGI)' },
  { id: 'marquise-sidehub-crown', label: 'Marquise: side-hub crown (IGI FDR762535113)' },
  { id: 'marquise-french-gia', label: 'Marquise: French tips, crown (GIA 4Cs)' },
];
