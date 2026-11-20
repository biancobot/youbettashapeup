// Modified brilliants with straight-sided or cushion outlines:
//   - princess (square modified brilliant): X-crown, chevron pavilion
//   - radiant (cut-cornered rectangular modified brilliant): X-crown, fan pavilion
//   - square cushion modified brilliant: brilliant crown (built elsewhere), fan pavilion
//
// The crown of the princess/radiant family: table, four corner facets, one long facet along
// each side next to the girdle, and four triangles meeting at an X on each side. The fan
// pavilion: four corner mains meeting at the culet, four side apexes each carrying a fan of
// triangles to the girdle, and a V facet at the middle of each side. Everything except the
// corner mains is a triangle, and the corner mains are built on their own plane, so all
// facets are planar.

import { MeshBuilder, planeFrom3, planeZ, GIRDLE } from './core.js';
import { addGirdle } from './brilliant.js';

const P3 = (p, z) => [p[0], p[1], z];

/**
 * Crown for princess / radiant. outline must be a rectangle or cut-cornered rectangle whose
 * vertices are exactly the corners (no intermediate points) with anchors ka0..ka3 / kb0..kb3:
 * for corner q (0 = upper-right, 1 = upper-left, 2 = lower-left, 3 = lower-right), ka is the
 * cut-corner end on the side (left/right edge) and kb the end on the top/bottom edge; for a
 * plain rectangle both name the same corner vertex.
 */
export function addXCrown(mb, outline, topZ, {
  W, L, crownHeight: H, tableInset: t, innerInset: a, innerAngle = 45, xDrop = 0.08,
}) {
  const w = W / 2, l = L / 2;
  const sx = [1, -1, -1, 1], sy = [1, 1, -1, -1];
  const T = sx.map((x, q) => [x * (w - t), sy[q] * (l - t), H]);       // table corners per quadrant
  const Atop = sx.map((x, q) => [x * (w - t), sy[q] * (l - a)]);        // inner-line ends on top/bottom sides
  const Bside = sx.map((x, q) => [x * (w - a), sy[q] * (l - t)]);       // inner-line ends on left/right sides
  const Ka = sx.map((_, q) => outline.point(`ka${q}`));
  const Kb = sx.map((_, q) => outline.point(`kb${q}`));
  const cut = Math.hypot(Ka[0][0] - Kb[0][0], Ka[0][1] - Kb[0][1]) > 1e-9;
  // Corner facet planes: through both cut-corner ends (girdle) and the table corner; with a
  // plain rectangle the kite is symmetric and the inner points take a chosen steepness.
  const zA = new Array(4), zB = new Array(4);
  for (let q = 0; q < 4; q++) {
    if (cut) {
      const pl = planeFrom3(P3(Ka[q], 0), P3(Kb[q], 0), T[q]);
      zA[q] = planeZ(pl, Atop[q][0], Atop[q][1]);
      zB[q] = planeZ(pl, Bside[q][0], Bside[q][1]);
    } else {
      zA[q] = zB[q] = a * Math.tan((innerAngle * Math.PI) / 180);
    }
  }
  mb.face(T, 'table');
  for (let q = 0; q < 4; q++) {
    const poly = [P3(Ka[q], 0)];
    if (cut) poly.push(P3(Kb[q], 0));
    poly.push(P3(Atop[q], zA[q]), T[q], P3(Bside[q], zB[q]));
    mb.face(poly, 'corner');
  }
  // sides: top (q 1 -> 0), left (1 -> 2), bottom (2 -> 3), right (3 -> 0)
  const sides = [
    { ends: [1, 0], A: Atop, Kedge: Kb, xy: (z) => [0, (l - a) - (t - a) * 0.47] },
    { ends: [1, 2], A: Bside, Kedge: Ka, xy: (z) => [-((w - a) - (t - a) * 0.47), 0] },
    { ends: [2, 3], A: Atop, Kedge: Kb, xy: (z) => [0, -((l - a) - (t - a) * 0.47)] },
    { ends: [3, 0], A: Bside, Kedge: Ka, xy: (z) => [(w - a) - (t - a) * 0.47, 0] },
  ];
  for (const s of sides) {
    const [q0, q1] = s.ends;
    const zAq = s.A === Atop ? zA : zB;
    const A0 = P3(s.A[q0], zAq[q0]), A1 = P3(s.A[q1], zAq[q1]);
    const K0 = P3(s.Kedge[q0], 0), K1 = P3(s.Kedge[q1], 0);
    mb.face([K0, K1, A1, A0], 'upper');
    const xy = s.xy();
    const zX = (zAq[q0] + H) / 2 - xDrop * H;
    const X = [xy[0], xy[1], zX];
    mb.face([A0, A1, X], 'x');
    mb.face([T[q0], T[q1], X], 'x');
    mb.face([A0, T[q0], X], 'x');
    mb.face([A1, T[q1], X], 'x');
  }
  for (let k = 0; k < topZ.length; k++) topZ[k] = 0;
  mb.meta = { tableCorners: T };
}

/** Princess pavilion: four tiers of chevrons, every facet a triangle fanning from a corner. */
export function addChevronPavilion(mb, outline, botZ, { W, L, girdle: g, pavilionDepth: P, tiers = [0.15, 0.3, 0.45, 0.6], profile = 1.3 }) {
  const w = W / 2, l = L / 2;
  const zb = -g, zc = zb - P;
  const C = [0, 0, zc];
  const depth = (t) => zb + (zc - zb) * (1 - Math.pow(t, profile));
  const up = tiers.map((t) => [0, t * l, depth(t)]);
  const down = tiers.map((t) => [0, -t * l, depth(t)]);
  const left = tiers.map((t) => [-t * w, 0, depth(t)]);
  const right = tiers.map((t) => [t * w, 0, depth(t)]);
  const corners = [[w, l], [-w, l], [-w, -l], [w, -l]].map((p) => P3(p, zb));
  const rays = [
    [up, right], [up, left], [down, left], [down, right],   // axis lists per corner: vertical then horizontal
  ];
  const n = tiers.length;
  for (let q = 0; q < 4; q++) {
    const [v, h] = rays[q];
    const seq = [...v.slice().reverse(), C, ...h];            // outermost vertical tier ... C ... outermost horizontal tier
    for (let i = 0; i < seq.length - 1; i++) mb.face([corners[q], seq[i], seq[i + 1]], 'chevron');
  }
  // girdle-side triangles
  mb.face([corners[1], corners[0], up[n - 1]], 'lower');
  mb.face([corners[2], corners[1], left[n - 1]], 'lower');
  mb.face([corners[3], corners[2], down[n - 1]], 'lower');
  mb.face([corners[0], corners[3], right[n - 1]], 'lower');
  for (let k = 0; k < botZ.length; k++) botZ[k] = zb;
}

/**
 * Fan pavilion (radiant, square cushion modified brilliant). Anchors per quadrant q
 * (0 upper-right, 1 upper-left, 2 lower-left, 3 lower-right):
 *   ka{q}: end of the corner region on the left/right side, kb{q}: end on the top/bottom side
 *   top1,top2 / left1,left2 / bot1,bot2 / right1,right2: two fan points per side, counter-clockwise
 * Side V points sit at the middle of each side, inset by `vInset` (fraction of the half extent).
 */
export function addFanPavilion(mb, outline, botZ, {
  W, L, girdle: g, pavilionDepth: P, apex = 0.22, cornerApex = 0.5, cornerDrop = 0.12, vInset = 0.14, vDepth = 0.28,
}) {
  const pts = outline.points;
  const w = W / 2, l = L / 2;
  const zb = -g, zc = zb - P;
  const C = [0, 0, zc];
  // Corner main planes pass through the culet and just below the two ends of the corner girdle
  // arc; the side apexes and corner apexes are then placed on those planes, which keeps the
  // mains planar and below the girdle everywhere.
  const planes = [];
  for (let q = 0; q < 4; q++) {
    const ka = outline.anchors[`ka${q}`], kb = outline.anchors[`kb${q}`];
    planes.push(planeFrom3(C, P3(pts[ka], zb - cornerDrop * P), P3(pts[kb], zb - cornerDrop * P)));
  }
  const zAt = (q, x, y) => planeZ(planes[q], x, y);
  const A = {
    up: [0, apex * l, zAt(0, 0, apex * l)], down: [0, -apex * l, zAt(2, 0, -apex * l)],
    left: [-apex * w, 0, zAt(1, -apex * w, 0)], right: [apex * w, 0, zAt(0, apex * w, 0)],
  };
  const zV = zb + (zc - zb) * vDepth;
  const V = { up: [0, l * (1 - vInset), zV], down: [0, -l * (1 - vInset), zV], left: [-w * (1 - vInset), 0, zV], right: [w * (1 - vInset), 0, zV] };
  const vert = ['up', 'up', 'down', 'down'], horiz = ['right', 'left', 'left', 'right'];
  const setArc = (indices, plane) => {
    for (const k of indices) botZ[k] = GIRDLE.mode === 'flat' ? zb : planeZ(plane, pts[k][0], pts[k][1]);
  };
  const arcPoly = (iFrom, iTo, plane) => {
    const idx = outline.range(iFrom, iTo);
    setArc(idx, plane);
    botZ[idx[0]] = zb; botZ[idx[idx.length - 1]] = zb;
    return idx.map((k) => [pts[k][0], pts[k][1], botZ[k]]);
  };
  const Q = [];
  for (let q = 0; q < 4; q++) {
    const Av = A[vert[q]], Ah = A[horiz[q]];
    const ka = outline.anchors[`ka${q}`], kb = outline.anchors[`kb${q}`];
    const cornerMid = [(pts[ka][0] + pts[kb][0]) / 2, (pts[ka][1] + pts[kb][1]) / 2];
    const qx = cornerMid[0] * cornerApex, qy = cornerMid[1] * cornerApex;
    Q[q] = [qx, qy, zAt(q, qx, qy)];
    mb.face([C, Av, Q[q], Ah], 'main');
    // corner facet: Q with the girdle arc between the two corner anchors, counter-clockwise
    const ccwFirst = (q === 0 || q === 2) ? ka : kb;
    const ccwLast = (q === 0 || q === 2) ? kb : ka;
    const cornerPlane = planeFrom3(Q[q], P3(pts[ka], zb), P3(pts[kb], zb));
    mb.face([Q[q], ...arcPoly(ccwFirst, ccwLast, cornerPlane)], 'corner');
  }
  // fan points: t1/t2 along the top edge (CCW order), l1/l2 left, b1/b2 bottom, r1/r2 right
  const sides = [
    { apex: 'up', from: 'kb0', g: ['top1', 'top2'], to: 'kb1', qFrom: 0, qTo: 1 },
    { apex: 'left', from: 'ka1', g: ['left1', 'left2'], to: 'ka2', qFrom: 1, qTo: 2 },
    { apex: 'down', from: 'kb2', g: ['bot1', 'bot2'], to: 'kb3', qFrom: 2, qTo: 3 },
    { apex: 'right', from: 'ka3', g: ['right1', 'right2'], to: 'ka0', qFrom: 3, qTo: 0 },
  ];
  for (const s of sides) {
    const Ap = A[s.apex], Vp = V[s.apex];
    const i0 = outline.anchors[s.from], i1 = outline.anchors[s.g[0]], i2 = outline.anchors[s.g[1]], i3 = outline.anchors[s.to];
    const seg = (a, b, extra) => {
      const pl = planeFrom3(Ap, P3(pts[a], zb), extra || P3(pts[b], zb));
      return arcPoly(a, b, pl);
    };
    mb.face([Ap, Q[s.qFrom], P3(pts[i0], zb)], 'fan');
    mb.face([Ap, ...seg(i0, i1)], 'fan');
    mb.face([Ap, P3(pts[i1], zb), Vp], 'fan');
    mb.face([Ap, Vp, P3(pts[i2], zb)], 'fan');
    mb.face([Ap, ...seg(i2, i3)], 'fan');
    mb.face([Ap, P3(pts[i3], zb), Q[s.qTo]], 'fan');
    // V facet along the girdle between g1 and g2
    const vPlane = planeFrom3(Vp, P3(pts[i1], zb), P3(pts[i2], zb));
    mb.face([Vp, ...arcPoly(i1, i2, vPlane)], 'v');
  }
}

export { MeshBuilder, addGirdle };

/**
 * Fan pavilion for cushion outlines. Each quadrant lists its girdle anchors counter-clockwise
 * from one side's V foot to the other side's V foot, with the corner point `k` in the middle:
 *   quadrants[q] = { first: 'right'|'up'|'left'|'down', second: ..., chain: [names], k: index of the corner in chain }
 * Side feet are top1/top2, left1/left2, bot1/bot2, right1/right2 (counter-clockwise pairs).
 * The corner main (culet, first apex, corner point, second apex) lies on the plane through the
 * culet and the corner point that descends along the diagonal; fans from the apexes cover the
 * corner arcs in short planar pieces.
 */
export function addCushionFanPavilion(mb, outline, botZ, {
  W, L, girdle: g, pavilionDepth: P, apex = 0.22, vInset = 0.14, vDepth = 0.28, quadrants,
}) {
  const pts = outline.points;
  const w = W / 2, l = L / 2;
  const zb = -g, zc = zb - P;
  const C = [0, 0, zc];
  const A = {};
  const sidePos = { up: [0, apex * l], down: [0, -apex * l], left: [-apex * w, 0], right: [apex * w, 0] };
  const setArc = (indices, plane) => { for (const k of indices) botZ[k] = GIRDLE.mode === 'flat' ? zb : planeZ(plane, pts[k][0], pts[k][1]); };
  const arcPoly = (iFrom, iTo, plane) => {
    const idx = outline.range(iFrom, iTo);
    setArc(idx, plane);
    botZ[idx[0]] = zb; botZ[idx[idx.length - 1]] = zb;
    return idx.map((k) => [pts[k][0], pts[k][1], botZ[k]]);
  };
  // corner main planes and apex heights
  const planes = quadrants.map((qd) => {
    const K = pts[outline.anchors[qd.chain[qd.k]]];
    const d = Math.hypot(K[0], K[1]);
    const perp = [-K[1] / d, K[0] / d, 0];
    return planeFrom3(C, [K[0], K[1], zb], [K[0] + perp[0], K[1] + perp[1], zb]);
  });
  quadrants.forEach((qd, q) => {
    for (const side of [qd.first, qd.second]) {
      const p = sidePos[side];
      if (!A[side]) A[side] = [p[0], p[1], planeZ(planes[q], p[0], p[1])];
    }
  });
  const zV = zb + (zc - zb) * vDepth;
  const V = { up: [0, l * (1 - vInset), zV], down: [0, -l * (1 - vInset), zV], left: [-w * (1 - vInset), 0, zV], right: [w * (1 - vInset), 0, zV] };

  quadrants.forEach((qd, q) => {
    const ids = qd.chain.map((n) => outline.anchors[n]);
    const K = [pts[ids[qd.k]][0], pts[ids[qd.k]][1], zb];
    mb.face([C, A[qd.first], K, A[qd.second]], 'main');
    for (let i = 0; i < ids.length - 1; i++) {
      const Ap = i < qd.k ? A[qd.first] : A[qd.second];
      const pl = planeFrom3(Ap, P3(pts[ids[i]], zb), P3(pts[ids[i + 1]], zb));
      mb.face([Ap, ...arcPoly(ids[i], ids[i + 1], pl)], 'fan');
    }
  });
  for (const [side, f1, f2] of [['up', 'top1', 'top2'], ['left', 'left1', 'left2'], ['down', 'bot1', 'bot2'], ['right', 'right1', 'right2']]) {
    const i1 = outline.anchors[f1], i2 = outline.anchors[f2];
    const Ap = A[side], Vp = V[side];
    mb.face([Ap, P3(pts[i1], zb), Vp], 'fan');
    mb.face([Ap, Vp, P3(pts[i2], zb)], 'fan');
    const vPlane = planeFrom3(Vp, P3(pts[i1], zb), P3(pts[i2], zb));
    mb.face([Vp, ...arcPoly(i1, i2, vPlane)], 'v');
  }
}
