// Starting designs. Each entry: { name, note, make() -> design }.
// Only the round brilliant is derived from published proportion definitions; the others are
// editable starting points that reproduce the lab plotting template's facet pattern with
// typical angles, and are labelled as reconstructions.
import { roundBrilliant, girdleFromSupport, ellipseSupport } from './generators.js?v=119';
import { newTier, tierFromPlane, expandIndex, azimuthDeg } from './design.js?v=119';
import { marquiseSupport } from './fancy.js?v=119';
import { shapeTemplates, shapePlots } from './shapes/index.js?v=119';

const rad = (d) => (d * Math.PI) / 180;

const idx = (az, gear) => Math.round(((((90 - az) % 360) + 360) % 360) * gear / 360 * 1e6) / 1e6;
const mid = (a, b) => { let d = ((b - a) % 360 + 540) % 360 - 180; return ((a + d / 2) % 360 + 360) % 360; };

export const templates = {
  round: {
    name: 'Round brilliant (GIA proportions)', note: 'Built from GIA Diamond Cut Grading System proportion definitions.',
    params: [
      { key: 'table', label: 'Table', default: 0.56, step: 0.005, min: 0.4, max: 0.75, title: 'Table size, fraction of the diameter' },
      { key: 'crownAngle', label: 'Crown angle', default: 34.5, step: 0.1 }, { key: 'pavilionAngle', label: 'Pavilion angle', default: 40.8, step: 0.1 },
      { key: 'starLength', label: 'Star length', default: 0.5, step: 0.01, title: 'Fraction of the distance from the table edge to the girdle' },
      { key: 'lowerLength', label: 'Lower girdle', default: 0.78, step: 0.01 }, { key: 'girdle', label: 'Girdle', default: 0.035, step: 0.005, title: 'Girdle thickness at the bezels (the hills), fraction of the diameter; the valleys between the upper and lower girdle facets are thinner' },
    ],
    make: ({ girdleFacets = 128, ...o } = {}) => roundBrilliant({ girdleFacets, ...o }),
  },
  ...shapeTemplates,
  blank: { name: 'Blank: round preform only', note: 'A 64-facet round girdle and nothing else. Add tiers to design a cut.', make: ({ girdleFacets = 64 } = {}) => blank(girdleFacets) },
};
export const plots = [
  { id: 'round-crown', label: 'Round: crown (IGI)' }, { id: 'round-pavilion', label: 'Round: pavilion (IGI)' },
  ...shapePlots,
];

/** Girdle preforms: a tier of 90-degree facets whose distances follow the outline's support function. */
export const preforms = {
  round: { name: 'Round', make: ({ count = 64, gear = 96 } = {}) => girdleFromSupport(() => 1, count, gear) },
  ellipse: {
    name: 'Ellipse (oval, L:W)',
    make: ({ ratio = 1.4, count = 64, gear = 96 } = {}) => girdleFromSupport(ellipseSupport(1, ratio), count, gear),
  },
  marquise: {
    name: 'Marquise: two circular arcs (L:W)',
    make: ({ ratio = 2.0, count = 64, gear = 96 } = {}) => girdleFromSupport(marquiseSupport(1, ratio), count, gear),
  },
  rectangle: {
    name: 'Rectangle / cut-cornered (L:W, corner)',
    make: ({ ratio = 1.0, corner = 0, count = 8, gear = 96 } = {}) => {
      // support function of a cut-cornered rectangle: half-width 1, half-length ratio, corner cut c (fraction of width)
      const w = 1, l = ratio, c = corner * 2;
      const verts = c > 0
        ? [[w, -l + c], [w, l - c], [w - c, l], [-w + c, l], [-w, l - c], [-w, -l + c], [-w + c, -l], [w - c, -l]]
        : [[w, -l], [w, l], [-w, l], [-w, -l]];
      const h = (t) => Math.max(...verts.map(([x, y]) => x * Math.cos(t) + y * Math.sin(t)));
      // one facet per polygon edge: its azimuth is the edge normal
      const tier = newTier({ name: 'G', angle: 90, distance: 1, indices: [], distances: [] });
      for (let i = 0; i < verts.length; i++) {
        const [x0, y0] = verts[i], [x1, y1] = verts[(i + 1) % verts.length];
        const az = (Math.atan2(-(x1 - x0), y1 - y0) * 180) / Math.PI;   // outward normal of the edge (counter-clockwise polygon)
        const azr = (az * Math.PI) / 180;
        tier.indices.push(idx(az, gear)); tier.distances.push(h(azr));
      }
      return tier;
    },
  },
};

function blank(girdleFacets = 64) {
  return { name: 'Blank design', gear: 96, fold: 8, mirror: true, ri: 2.42, headings: ['Blank design'], footnotes: [], tiers: [girdleFromSupport(() => 1, girdleFacets, 96)] };
}
