// Step cuts (emerald cut, square emerald / asscher): concentric rows of trapezoidal facets.
//
// Every ring is a cut-cornered rectangle whose edges are parallel to the girdle's, so each
// facet between two rings is a trapezoid and therefore exactly planar. The crown ends at the
// table; the pavilion converges either to a keel line (emerald) or to a point (asscher).

import { MeshBuilder } from './core.js';
import { addGirdle } from './brilliant.js';
import { makeOutline, cutCorneredPolyline } from './outlines.js';

/** 8 corners of a cut-cornered rectangle, counter-clockwise from the right side's lower corner. */
function ringPoints(w, l, k, z) {
  return [
    [w, -l + k, z], [w, l - k, z], [w - k, l, z], [-w + k, l, z],
    [-w, l - k, z], [-w, -l + k, z], [-w + k, -l, z], [w - k, -l, z],
  ];
}

/** Facets between two rings with the same corner structure (8 quads). */
function stepTier(mb, outer, inner, tag) {
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    mb.face([outer[i], outer[j], inner[j], inner[i]], tag);
  }
}

/**
 * @param W, L   width (1) and length
 * @param c      corner cut as a fraction of W (measured along the side)
 * @param crown  { height, rows: [{ width, height }] } rows from the girdle inward, widths and
 *               heights as fractions of W; the table is what remains inside the last row
 * @param pavilion { depth, rows: [{ width, height }], keel: fraction of L (0 for a point culet) }
 */
export function buildStepCut({ W = 1, L = 1.4, c = 0.15, girdle = 0.035, crown, pavilion }) {
  const w = W / 2, l = L / 2, k = c * W;
  const outline = makeOutline(cutCorneredPolyline(W, L, c), {});
  const mb = new MeshBuilder();

  // ---- crown
  let prev = ringPoints(w, l, k, 0);
  let d = 0, z = 0;
  for (const row of crown.rows) {
    d += row.width; z += row.height;
    const ring = ringPoints(w - d, l - d, k * (w - d) / w, z);
    stepTier(mb, prev, ring, 'crown-step');
    prev = ring;
  }
  mb.face(prev, 'table');

  // ---- pavilion
  const zb = -girdle;
  prev = ringPoints(w, l, k, zb);
  d = 0; z = zb;
  for (const row of pavilion.rows) {
    d += row.width; z += -row.height;
    const ring = ringPoints(w - d, l - d, k * (w - d) / w, z);
    stepTier(mb, prev, ring, 'pavilion-step');
    prev = ring;
  }
  const zc = zb - pavilion.depth;
  if (pavilion.keel > 0) {
    // last tier converges to a keel line along the length axis
    const kl = (pavilion.keel * L) / 2;
    const top = [0, kl, zc], bot = [0, -kl, zc];
    // prev indices: 0 right-lower, 1 right-upper, 2 top-right, 3 top-left, 4 left-upper, 5 left-lower, 6 bottom-left, 7 bottom-right
    mb.face([prev[0], prev[1], top, bot], 'pavilion-keel');          // right long side
    mb.face([prev[1], prev[2], top], 'pavilion-keel');               // upper-right corner
    mb.face([prev[2], prev[3], top], 'pavilion-keel');               // top end
    mb.face([prev[3], prev[4], top], 'pavilion-keel');               // upper-left corner
    mb.face([prev[4], prev[5], bot, top], 'pavilion-keel');          // left long side
    mb.face([prev[5], prev[6], bot], 'pavilion-keel');               // lower-left corner
    mb.face([prev[6], prev[7], bot], 'pavilion-keel');               // bottom end
    mb.face([prev[7], prev[0], bot], 'pavilion-keel');               // lower-right corner
  } else {
    const culet = [0, 0, zc];
    for (let i = 0; i < 8; i++) mb.face([prev[i], prev[(i + 1) % 8], culet], 'pavilion-keel');
  }

  const N = outline.points.length;
  addGirdle(mb, outline, new Array(N).fill(0), new Array(N).fill(zb));
  const table = crown.rows.reduce((acc, r) => acc - 2 * r.width, W);
  mb.meta = { table };
  return mb;
}
