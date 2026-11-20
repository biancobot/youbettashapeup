// Shape registry: one entry per cutting style, with the proportions used to build it.
// All linear sizes are fractions of the stone width; angles in degrees.
//
// Anchor angles are polar angles (counter-clockwise from +X, head of the stone at 90) read
// from the IGI report plotting diagrams, which are the same template for every stone of a
// given cutting style.

import {
  makeOutline, circlePolyline, ellipsePolyline, pearPolyline, marquisePolyline,
  heartPolyline, cushionPolyline, cutCorneredPolyline, rectanglePolyline, angleOf, halfWidthAt,
} from './outlines.js';
import { buildBrilliant } from './brilliant.js';
import { GIRDLE } from './core.js';
import { buildStepCut } from './stepcut.js';
import { addXCrown, addChevronPavilion, addFanPavilion, addCushionFanPavilion } from './modified.js';

const deg = (d) => ((d % 360) + 360) % 360;

/** Anchor names for an alternating bezel/junction ring: b0, s0, b1, s1, ... */
function ring(bezelAngles, junctionAngles) {
  const anchors = {};
  bezelAngles.forEach((a, i) => { anchors[`b${i}`] = deg(a); });
  junctionAngles.forEach((a, i) => { anchors[`s${i}`] = deg(a); });
  return anchors;
}
function names(prefix, n) { return Array.from({ length: n }, (_, i) => `${prefix}${i}`); }
function addAnchors(anchors, prefix, angles) {
  angles.forEach((a, i) => { anchors[`${prefix}${i}`] = deg(a); });
  return anchors;
}

/** Polar angle (deg) of the ellipse point at parametric angle t (deg). */
function ellipsePolar(a, b, tDeg) {
  const t = (tDeg * Math.PI) / 180;
  return angleOf([a * Math.cos(t), b * Math.sin(t)]);
}

/**
 * Star tips beside a point: a fraction `down` of the way from the point bezel's table corner
 * to the point, at `wide` times the local half-width. Returns [left, right] targets.
 */
function pointTips(outline, pointY, tableCornerY, down, wide) {
  const y = tableCornerY + (pointY - tableCornerY) * down;
  const hw = halfWidthAt(outline.points, y) * wide;
  return [[-hw, y], [hw, y]];
}

const ringSpec = (n, extra = {}) => ({
  bezels: names('b', n).map((g, i) => ({ girdle: g, ...(extra.bezel ? extra.bezel(i) : {}) })),
  stars: names('s', n).map((g, i) => ({ girdle: g, ...(extra.star ? extra.star(i) : {}) })),
});

// ---------------------------------------------------------------------------

export const SHAPES = [
  {
    id: 'round',
    name: 'Round brilliant',
    lab: 'Round Brilliant',
    family: 'brilliant',
    proportions: {
      ratio: 1.0, crownAngle: 34.5, crownHeight: 0.15, girdle: 0.03, pavilionDepth: 0.43,
      starLength: 0.5, lowerLength: 0.78,
      notes: 'GIA Excellent: table 54-57%, crown angle 34-35, pavilion angle 40.6-41, star 50%, lower half 75-80%. Table size follows from crown angle and height.',
    },
    build(p) {
      // Lab plots put a star (upper-half junction) at 12 o'clock and bezels at 1:30, 3:00 ...
      const bezelsAt = Array.from({ length: 8 }, (_, i) => 22.5 + 45 * i);
      const starsAt = Array.from({ length: 8 }, (_, i) => 45 * (i + 1));
      const outline = makeOutline(circlePolyline(0.5, 256), ring(bezelsAt, starsAt), { segments: p.girdleFacets });
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: { crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta, ...ringSpec(8) },
        pavilion: { halfDelta: p.lowerHalfDelta, culet: [0, 0], mains: names('b', 8), junctions: names('s', 8), lowerLength: p.lowerLength },
      });
    },
  },

  {
    id: 'oval',
    name: 'Oval brilliant',
    lab: 'Oval Brilliant',
    family: 'brilliant',
    proportions: {
      ratio: 1.4, crownAngle: 34.5, crownHeight: 0.14, girdle: 0.035, pavilionDepth: 0.43,
      starLength: 0.5, lowerLength: 0.78,
      notes: 'IGI Excellent: L:W 1.35-1.50, table 56-62%, crown height 12.5-16%, crown angle 33-38.5, pavilion depth 41-46.5%, pavilion angle 39.5-42.5.',
    },
    build(p) {
      const a = 0.5, b = 0.5 * p.ratio;
      // Crown: bezels at the ends, sides and diagonals (parametric 0, 45, 90 ...), stars between.
      // Pavilion (as plotted): junction lines at the ends and sides, mains between them.
      const bezT = Array.from({ length: 8 }, (_, i) => 45 * i);
      const starT = Array.from({ length: 8 }, (_, i) => 22.5 + 45 * i);
      const anchors = ring(bezT.map((t) => ellipsePolar(a, b, t)), starT.map((t) => ellipsePolar(a, b, t)));
      addAnchors(anchors, 'm', starT.map((t) => ellipsePolar(a, b, t)));
      addAnchors(anchors, 'j', bezT.map((t) => ellipsePolar(a, b, t)));
      const outline = makeOutline(ellipsePolyline(a, b, 320), anchors, { segments: p.girdleFacets });
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: { crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta, ...ringSpec(8) },
        // main i sits between junction i and junction i+1
        pavilion: { halfDelta: p.lowerHalfDelta, culet: [0, 0], mains: names('m', 8), junctions: names('j', 8).map((_, i) => `j${(i + 1) % 8}`), lowerLength: p.lowerLength },
      });
    },
  },

  {
    id: 'pear',
    name: 'Pear brilliant',
    lab: 'Pear Brilliant',
    family: 'brilliant',
    proportions: {
      ratio: 1.5, crownAngle: 35, pointAngle: 24, crownHeight: 0.14, girdle: 0.035, pavilionDepth: 0.435,
      starLength: 0.5, pointStarDown: 0.28, pointStarWide: 0.56, lowerLength: 0.78, culetY: 0.12, wingStart: 25,
      notes: 'IGI Excellent: L:W 1.40-1.75, table 57.5-62%, crown height 11.5-16%, crown angle 33-38, pavilion depth 41-46%, pavilion angle 38-42.5. The point bezel is cut shallower; the culet sits toward the head.',
    },
    build(p) {
      const L = p.ratio;
      // Polar angles read from the IGI pear template (head at 90, point at 270).
      const bez = [90, 123, 160.5, 219, 270, 321, 379.5, 417];           // head, shoulder, belly, wing, point, wing, belly, shoulder
      const stars = [107, 138, 186.5, 248, 292, 353.5, 402, 433];          // junctions between consecutive bezels
      const mains = [108, 143.5, 188, 246.7, 293.3, 352, 396.5, 432];
      const juncs = [125, 161.6, 221.7, 270, 318.3, 378.4, 415, 450];     // junction i between main i and i+1
      const anchors = ring(bez, stars);
      addAnchors(anchors, 'm', mains);
      addAnchors(anchors, 'j', juncs);
      const outline = makeOutline(pearPolyline(1, L, { wingStart: p.wingStart, n: 320 }), anchors, { segments: p.girdleFacets });
      // Bezel azimuths (direction of steepest descent) read from the kite axes of the IGI template.
      // The point bezel runs along the axis at its own angle; its star tips are placed from the
      // plot and the wing bezels take whatever angle meets them.
      const az = [90, 131.5, 185, 205, 270, 335, 355, 408.5];
      const tableY = -L / 2 + p.crownHeight / Math.tan((p.pointAngle * Math.PI) / 180);
      const [tipL, tipR] = pointTips(outline, -L / 2, tableY, p.pointStarDown, p.pointStarWide);
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: {
          crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta,
          ...ringSpec(8, {
            bezel: (i) => ({
              azimuth: az[i],
              ...({ 4: { angle: p.pointAngle }, 3: { through: 'next', solve: 'angle' }, 5: { through: 'prev', solve: 'angle' } }[i] || {}),
            }),
            star: (i) => ({ 3: { mode: 'onNext', target: tipL }, 4: { mode: 'onPrev', target: tipR } }[i] || {}),
          }),
        },
        pavilion: {
          halfDelta: p.lowerHalfDelta, culet: [0, p.culetY * L],
          // mains beside the point pass just under it so their planes do not slice the point off
          mains: names('m', 8).map((g, i) => (i === 3 || i === 4 ? { girdle: g, third: 'j3', thirdDrop: 0.03 } : g)),
          junctions: names('j', 8), lowerLength: p.lowerLength,
        },
      });
    },
  },

  {
    id: 'marquise',
    name: 'Marquise brilliant',
    lab: 'Marquise Brilliant',
    family: 'brilliant',
    proportions: {
      ratio: 2.0, crownAngle: 35, pointAngle: 23, crownHeight: 0.14, girdle: 0.035, pavilionDepth: 0.435,
      starLength: 0.5, pointStarDown: 0.3, pointStarWide: 0.68, lowerLength: 0.78,
      notes: 'IGI Excellent: L:W 1.80-2.20, table 57-62%, crown height 11.5-16.5%, crown angle 33-38.5, pavilion depth 41.5-46%, pavilion angle 39.5-42.5. Point bezels are cut shallower.',
    },
    build(p) {
      const L = p.ratio;
      const bez = [90, 121.6, 180, 239.7, 270, 300.3, 360, 418.4];
      const stars = [103.3, 148.5, 213.4, 256.7, 283.3, 328.5, 393.4, 436.7];
      const mains = [125.5, 160.5, 199.5, 234.5, 305.5, 340.5, 379.5, 414.5];
      const juncs = [143.8, 180, 216.2, 270, 323.8, 360, 396.2, 450];
      const anchors = ring(bez, stars);
      addAnchors(anchors, 'm', mains);
      addAnchors(anchors, 'j', juncs);
      const outline = makeOutline(marquisePolyline(1, L, { n: 320 }), anchors, { segments: p.girdleFacets });
      // Side bezels descend straight outwards, wings a little towards the points, points along the axis.
      const az = [90, 160, 180, 200, 270, 340, 0, 20];
      const tableY = L / 2 - p.crownHeight / Math.tan((p.pointAngle * Math.PI) / 180);
      const [topL, topR] = pointTips(outline, L / 2, tableY, p.pointStarDown, p.pointStarWide);
      const [botL, botR] = pointTips(outline, -L / 2, -tableY, p.pointStarDown, p.pointStarWide);
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: {
          crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta,
          ...ringSpec(8, {
            bezel: (i) => ({
              azimuth: az[i],
              ...({
                0: { angle: p.pointAngle }, 4: { angle: p.pointAngle },
                1: { through: 'prev', solve: 'angle' }, 7: { through: 'next', solve: 'angle' },
                3: { through: 'next', solve: 'angle' }, 5: { through: 'prev', solve: 'angle' },
              }[i] || {}),
            }),
            star: (i) => ({
              0: { mode: 'onPrev', target: topL }, 7: { mode: 'onNext', target: topR },
              3: { mode: 'onNext', target: botL }, 4: { mode: 'onPrev', target: botR },
            }[i] || {}),
          }),
        },
        pavilion: {
          halfDelta: p.lowerHalfDelta, culet: [0, 0],
          // mains beside the points pass just under the point so their planes do not slice it off
          mains: names('m', 8).map((g, i) => ({ girdle: g, ...({ 0: { third: 'j7', thirdDrop: 0.03 }, 7: { third: 'j7', thirdDrop: 0.03 }, 3: { third: 'j3', thirdDrop: 0.03 }, 4: { third: 'j3', thirdDrop: 0.03 } }[i] || {}) })),
          junctions: names('j', 8), lowerLength: p.lowerLength,
        },
      });
    },
  },

  {
    id: 'heart',
    name: 'Heart brilliant',
    lab: 'Heart Brilliant',
    family: 'brilliant',
    proportions: {
      ratio: 0.95, crownAngle: 34.5, pointAngle: 30, lobeAngle: 50, crownHeight: 0.13, girdle: 0.045, pavilionDepth: 0.41,
      upperHalfDelta: 0, lowerHalfDelta: 0,   // assembled explicitly: half facets meet the star tips and junctions directly
      starLength: 0.5, pointStarDown: 0.24, pointStarWide: 0.42, lowerLength: 0.78, culetY: 0.06, lobeR: 0.27, wingStart: 15,
      notes: 'IGI Excellent: L:W 0.85-0.95, table 58-64%, crown height 11.5-14%, crown angle 32-38, pavilion depth 39-43%, pavilion angle 39-42.5.',
    },
    build(p) {
      const L = p.ratio;
      // Nine bezels: lobe tops, shoulders, sides, wings and the point. The cleft is a star whose
      // tip lies on the girdle, so the two lobe-top bezel planes pass through the cleft.
      const bez = [103, 148, 190, 224, 270, 316, 350, 392, 437];
      const stars = [124, 170, 207, 250, 290, 333, 370, 416, 450]; // last one = cleft (90)
      const mains = [115, 149, 191.6, 241, 299, 348.4, 391, 425];
      const juncs = [133, 173, 216, 270, 324, 367, 407, 450];
      const anchors = ring(bez, stars);
      addAnchors(anchors, 'm', mains);
      addAnchors(anchors, 'j', juncs);
      const outline = makeOutline(heartPolyline(1, L, { lobeR: p.lobeR, wingStart: p.wingStart, n: 400 }), anchors, { segments: p.girdleFacets });
      const tableY = -L / 2 + p.crownHeight / Math.tan((p.pointAngle * Math.PI) / 180);
      const [tipL, tipR] = pointTips(outline, -L / 2, tableY, p.pointStarDown, p.pointStarWide);
      // Lobe-top bezels contain the cleft chord; the others descend along the girdle normal.
      // The point bezel runs along the axis at its own angle and the wings meet its star tips.
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: {
          crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta,
          ...ringSpec(9, {
            bezel: (i) => ({
              0: { third: 's8', angle: p.lobeAngle, tableTarget: 'axis' },
              8: { third: 's8', angle: p.lobeAngle, tableTarget: 'axis' },
              4: { azimuth: 270, angle: p.pointAngle },
              3: { through: 'next', solve: 'angle' }, 5: { through: 'prev', solve: 'angle' },
            }[i] || {}),
            star: (i) => ({
              8: { onGirdle: true },
              3: { mode: 'onNext', target: tipL }, 4: { mode: 'onPrev', target: tipR },
              0: { length: 0.65 }, 7: { length: 0.65 },
            }[i] || {}),
          }),
        },
        pavilion: {
          halfDelta: p.lowerHalfDelta, culet: [0, p.culetY * L],
          mains: names('m', 8).map((g, i) => ({ girdle: g, ...({ 0: { third: 'j7' }, 7: { third: 'j7' }, 3: { third: 'j3' }, 4: { third: 'j3' } }[i] || {}) })),
          junctions: names('j', 8), lowerLength: p.lowerLength,
        },
        cut: false,   // the cleft makes the outline non-convex: facets are assembled explicitly
      });
    },
  },
  {
    id: 'cushion',
    name: 'Cushion brilliant',
    lab: 'Cushion Brilliant',
    family: 'brilliant',
    proportions: {
      ratio: 1.1, crownAngle: 35, crownHeight: 0.13, girdle: 0.035, pavilionDepth: 0.45,
      starLength: 0.5, lowerLength: 0.78, keel: 0.12, squareness: 3.0,
      notes: 'IGI Excellent (square cushion): L:W 1.00-1.05, table 55-62%, crown height 8-16%, pavilion depth 40-56%. Elongated cushion brilliants are typically 1.05-1.20. Round-brilliant style pavilion with a short keel.',
    },
    build(p) {
      const L = p.ratio;
      const diag = (Math.atan2(L, 1) * 180) / Math.PI;            // polar angle of the corners
      const corner = [diag, 180 - diag, 180 + diag, 360 - diag];
      // bezels at the ends, sides and corners; stars half way between
      const bez = [90, 180 - diag, 180, 180 + diag, 270, 360 - diag, 360, 360 + diag];
      const mid = (a, b) => (a + b) / 2;
      const stars = bez.map((a, i) => mid(a, bez[(i + 1) % 8] + (i === 7 ? 360 : 0)));
      const anchors = ring(bez, stars);
      const outline = makeOutline(cushionPolyline(1, L, { p: p.squareness, n: 384 }), anchors, { segments: p.girdleFacets });
      const keel = { x: 0, y0: -p.keel * L / 2, y1: p.keel * L / 2 };
      // end mains on the keel ends, side mains on both, corner mains on the near end
      const ends = ['b', 'b', 'both', 'a', 'a', 'a', 'both', 'b'];
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: { crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta, ...ringSpec(8) },
        pavilion: {
          halfDelta: p.lowerHalfDelta, keel, mains: names('b', 8).map((g, i) => ({ girdle: g, end: ends[i] })),
          junctions: names('s', 8), lowerLength: p.lowerLength,
        },
      });
    },
  },

  {
    id: 'cushion-modified',
    name: 'Square cushion modified brilliant',
    lab: 'Square Cushion Modified Brilliant',
    family: 'modified',
    proportions: {
      ratio: 1.0, crownAngle: 35, crownHeight: 0.13, girdle: 0.035, pavilionDepth: 0.46,
      starLength: 0.5, squareness: 3.0, fanSpan: 13,
      notes: 'IGI Excellent: L:W 1.00-1.05, table 55-62%, crown height 8-16%, pavilion depth 40-56%. Brilliant crown; pavilion with four corner mains and a fan of facets on each side (crushed-ice style).',
    },
    build(p) {
      const L = p.ratio;
      const diag = (Math.atan2(L, 1) * 180) / Math.PI;
      const bez = [90, 180 - diag, 180, 180 + diag, 270, 360 - diag, 360, 360 + diag];
      const stars = bez.map((a, i) => (a + bez[(i + 1) % 8] + (i === 7 ? 360 : 0)) / 2);
      const anchors = ring(bez, stars);
      const fs = p.fanSpan;
      const cornerAt = [diag, 180 - diag, 180 + diag, 360 - diag];
      // V feet on each side, the corner points, and two fan anchors on each side of every corner
      const feet = { top1: 90 - fs, top2: 90 + fs, left1: 180 - fs, left2: 180 + fs, bot1: 270 - fs, bot2: 270 + fs, right1: 360 - fs, right2: fs };
      Object.assign(anchors, feet);
      const quadrants = [];
      const sidesOf = [['right', 'up', 'right2', 'top1'], ['up', 'left', 'top2', 'left1'], ['left', 'down', 'left2', 'bot1'], ['down', 'right', 'bot2', 'right1']];
      cornerAt.forEach((c, q) => {
        const [first, second, footA, footB] = sidesOf[q];
        const a0 = feet[footA], a1 = feet[footB];
        const chain = [footA];
        for (let i = 1; i <= 2; i++) { anchors[`c${q}_${i}`] = deg(a0 + ((c - a0) * i) / 3); chain.push(`c${q}_${i}`); }
        anchors[`k${q}`] = deg(c); chain.push(`k${q}`);
        for (let i = 1; i <= 2; i++) { anchors[`c${q}_${i + 2}`] = deg(c + ((a1 - c) * i) / 3); chain.push(`c${q}_${i + 2}`); }
        chain.push(footB);
        quadrants.push({ first, second, chain, k: 3 });
      });
      const outline = makeOutline(cushionPolyline(1, L, { p: p.squareness, n: 384 }), anchors, { segments: p.girdleFacets });
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        crown: { crownAngle: p.crownAngle, starLength: p.starLength, halfDelta: p.upperHalfDelta, ...ringSpec(8) },
        cut: false,
        customPavilion: (mb, o, botZ) => addCushionFanPavilion(mb, o, botZ, { W: 1, L, girdle: p.girdle, pavilionDepth: p.pavilionDepth, quadrants }),
      });
    },
  },

  {
    id: 'princess',
    name: 'Princess cut',
    lab: 'Square Modified Brilliant',
    family: 'modified',
    proportions: {
      ratio: 1.0, crownHeight: 0.11, girdle: 0.035, pavilionDepth: 0.58, table: 0.70, innerInset: 0.06, bandAngle: 45,
      chevrons: 4,
      notes: 'IGI Excellent: L:W 1.00-1.05, table 65-74%, crown height 8-14.5%, pavilion depth 54.5-62%, total depth 65-73%. Crown of 25 facets; pavilion with four chevron tiers.',
    },
    build(p) {
      const L = p.ratio;
      const anchors = {};
      [45, 135, 225, 315].forEach((a, q) => { anchors[`ka${q}`] = a; anchors[`kb${q}`] = a; });
      const outline = makeOutline(rectanglePolyline(1, L), anchors);
      const tiers = Array.from({ length: p.chevrons }, (_, i) => 0.15 * (i + 1));
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        customCrown: (mb, o, topZ) => addXCrown(mb, o, topZ, {
          W: 1, L, crownHeight: p.crownHeight, tableInset: (1 - p.table) / 2, innerInset: p.innerInset, bandAngle: p.bandAngle,
        }),
        cut: false,
        customPavilion: (mb, o, botZ) => addChevronPavilion(mb, o, botZ, { W: 1, L, girdle: p.girdle, pavilionDepth: p.pavilionDepth, tiers }),
      });
    },
  },

  {
    id: 'radiant',
    name: 'Radiant cut',
    lab: 'Cut-Cornered Rectangular Modified Brilliant',
    family: 'modified',
    proportions: {
      ratio: 1.2, cornerCut: 0.12, crownHeight: 0.135, girdle: 0.035, pavilionDepth: 0.515, table: 0.65, innerInset: 0.055,
      fanAt: 0.5,
      notes: 'IGI Excellent (cut-cornered square): L:W 1.00-1.05, table 62-67%, crown height 12-15%, pavilion depth 47-56%. Rectangular radiants are commonly 1.15-1.35.',
    },
    build(p) {
      const L = p.ratio;
      const w = 0.5, l = L / 2, k = p.cornerCut;
      const anchors = {};
      const sx = [1, -1, -1, 1], sy = [1, 1, -1, -1];
      for (let q = 0; q < 4; q++) {
        anchors[`ka${q}`] = angleOf([sx[q] * w, sy[q] * (l - k)]);
        anchors[`kb${q}`] = angleOf([sx[q] * (w - k), sy[q] * l]);
      }
      const f = p.fanAt * (w - k);
      const fl = p.fanAt * (l - k);
      Object.assign(anchors, {
        top1: angleOf([f, l]), top2: angleOf([-f, l]), bot1: angleOf([-f, -l]), bot2: angleOf([f, -l]),
        left1: angleOf([-w, fl]), left2: angleOf([-w, -fl]), right1: angleOf([w, -fl]), right2: angleOf([w, fl]),
      });
      const outline = makeOutline(cutCorneredPolyline(1, L, k), anchors);
      return buildBrilliant({
        outline, crownHeight: p.crownHeight, girdle: p.girdle, pavilionDepth: p.pavilionDepth,
        customCrown: (mb, o, topZ) => addXCrown(mb, o, topZ, {
          W: 1, L, crownHeight: p.crownHeight, tableInset: (1 - p.table) / 2, innerInset: p.innerInset,
        }),
        cut: false,
        customPavilion: (mb, o, botZ) => addFanPavilion(mb, o, botZ, { W: 1, L, girdle: p.girdle, pavilionDepth: p.pavilionDepth, vInset: 0.12 }),
      });
    },
  },

  {
    id: 'emerald',
    name: 'Emerald cut',
    lab: 'Emerald Cut',
    family: 'step',
    proportions: {
      ratio: 1.45, cornerCut: 0.15, girdle: 0.035, crownHeight: 0.135, pavilionDepth: 0.50, keel: 0.45,
      crownRows: [[0.075, 0.06], [0.055, 0.04], [0.06, 0.035]],
      pavilionRows: [[0.12, 0.15], [0.12, 0.13], [0.11, 0.11]],
      notes: 'IGI Excellent: L:W 1.35-1.56, table 58-68%, crown height 11-16%, crown angle 30-40, pavilion depth 47-53%, pavilion angle 40-43. Three crown steps, three pavilion steps and a keel. Row widths and heights are fractions of the width.',
    },
    build(p) {
      const rows = (r) => r.map(([width, height]) => ({ width, height }));
      return buildStepCut({
        W: 1, L: p.ratio, c: p.cornerCut, girdle: p.girdle,
        crown: { rows: rows(p.crownRows) },
        pavilion: { depth: p.pavilionDepth, rows: rows(p.pavilionRows), keel: p.keel },
      });
    },
  },

  {
    id: 'asscher',
    name: 'Asscher (square emerald)',
    lab: 'Square Emerald Cut',
    family: 'step',
    proportions: {
      ratio: 1.0, cornerCut: 0.18, girdle: 0.035, crownHeight: 0.135, pavilionDepth: 0.50, keel: 0,
      crownRows: [[0.08, 0.06], [0.06, 0.04], [0.06, 0.035]],
      pavilionRows: [[0.11, 0.15], [0.12, 0.13], [0.10, 0.11]],
      notes: 'IGI Excellent: L:W 1.00-1.05, table 58-64%, crown height 11-16%, crown angle 32-37, pavilion depth 47-54%, pavilion angle 39-43. Three crown steps, three pavilion steps converging to a point.',
    },
    build(p) {
      const rows = (r) => r.map(([width, height]) => ({ width, height }));
      return buildStepCut({
        W: 1, L: p.ratio, c: p.cornerCut, girdle: p.girdle,
        crown: { rows: rows(p.crownRows) },
        pavilion: { depth: p.pavilionDepth, rows: rows(p.pavilionRows), keel: p.keel },
      });
    },
  },
];

export function getShape(id) {
  return SHAPES.find((s) => s.id === id) || SHAPES[0];
}

/** Build a shape's mesh with optional proportion overrides. Returns the render buffers. */
export function buildShape(id, overrides = {}) {
  const shape = getShape(id);
  const p = { upperHalfDelta: 0, lowerHalfDelta: 0, girdleFacets: 128, ...shape.proportions, ...overrides };
  GIRDLE.mode = p.girdleMode === 'flat' ? 'flat' : 'hills';
  const mb = shape.build(p);
  const geo = mb.build();
  if (mb.meta && mb.meta.tableCorners) {
    const xs = mb.meta.tableCorners.map((c) => c[0]);
    const ys = mb.meta.tableCorners.map((c) => c[1]);
    p.table = Math.max(...xs) - Math.min(...xs);
    p.tableLength = (Math.max(...ys) - Math.min(...ys)) / p.ratio;
  } else if (mb.meta && mb.meta.table !== undefined) {
    p.table = mb.meta.table;
  }
  geo.proportions = p;
  geo.shape = shape;
  return geo;
}
