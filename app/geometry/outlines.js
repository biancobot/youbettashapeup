// 2D girdle outlines. Every outline is a dense counter-clockwise polyline in the XY plane
// (width along X, length along Y, both centred on the origin) plus named "anchors":
// outline points that facets attach to. Anchors are placed by polar angle (degrees,
// counter-clockwise from +X) measured from the outline's centre, which is how the
// lab plotting diagrams were read.

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Intersection of the ray from c at angle `deg` with the closed polyline. */
function rayHit(pts, c, deg) {
  const dx = Math.cos(rad(deg)), dy = Math.sin(rad(deg));
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-14) continue;
    const t = ((p[0] - c[0]) * ey - (p[1] - c[1]) * ex) / den; // along the ray
    const u = ((p[0] - c[0]) * dy - (p[1] - c[1]) * dx) / den; // along the segment
    if (t > 0 && u >= -1e-12 && u <= 1 + 1e-12) {
      if (!best || t > best.t) best = { t, i, u: Math.min(1, Math.max(0, u)) };
    }
  }
  if (!best) throw new Error(`rayHit: no intersection at ${deg} deg`);
  return best;
}

/**
 * Build an outline object from a dense polyline and a map of anchor name -> polar angle.
 * Anchors are inserted into the polyline (or snapped to an existing vertex within eps).
 */
export function makeOutline(polyline, anchorAngles, { center = [0, 0], eps = 2e-4 } = {}) {
  let pts = polyline.map((p) => [p[0], p[1]]);
  if (signedArea(pts) < 0) pts.reverse();
  const anchors = {};
  // Insert anchors one by one; keep a parallel array of name lists so indices survive insertions.
  const names = Array.from({ length: pts.length }, () => []);
  for (const [name, deg] of Object.entries(anchorAngles)) {
    const hit = rayHit(pts, center, deg);
    const p = pts[hit.i], q = pts[(hit.i + 1) % pts.length];
    const x = p[0] + (q[0] - p[0]) * hit.u, y = p[1] + (q[1] - p[1]) * hit.u;
    const dp = Math.hypot(x - p[0], y - p[1]), dq = Math.hypot(x - q[0], y - q[1]);
    if (dp < eps) {
      names[hit.i].push(name);
    } else if (dq < eps) {
      names[(hit.i + 1) % pts.length].push(name);
    } else {
      pts.splice(hit.i + 1, 0, [x, y]);
      names.splice(hit.i + 1, 0, [name]);
    }
  }
  names.forEach((list, i) => { for (const n of list) anchors[n] = i; });
  for (const name of Object.keys(anchorAngles)) {
    if (!(name in anchors)) throw new Error(`anchor ${name} lost`);
  }
  const N = pts.length;
  return {
    points: pts,
    anchors,
    center,
    /** indices from a to b going counter-clockwise, inclusive. */
    range(a, b) {
      const out = [];
      let i = a;
      out.push(i);
      let guard = 0;
      while (i !== b && guard++ < N + 1) { i = (i + 1) % N; out.push(i); }
      return out;
    },
    point(name) { return pts[anchors[name]]; },
  };
}

// ---------------------------------------------------------------------------
// Dense polylines for each outline family. Width is 1 unless stated.
// ---------------------------------------------------------------------------

export function circlePolyline(r = 0.5, n = 128) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  return pts;
}

/** Ellipse with half-width a and half-length b, sampled roughly evenly by arc length. */
export function ellipsePolyline(a, b, n = 160) {
  // Sample finely by parameter, then resample by cumulative arc length.
  const fine = [];
  const m = n * 8;
  for (let i = 0; i <= m; i++) {
    const t = (i / m) * TAU;
    fine.push([a * Math.cos(t), b * Math.sin(t)]);
  }
  return resample(fine, n, true);
}

/** Resample a polyline (open or closed) to n points evenly spaced by arc length. */
export function resample(pts, n, closed) {
  const cum = [0];
  const m = pts.length;
  const segs = closed ? m : m - 1;
  for (let i = 0; i < segs; i++) {
    const p = pts[i], q = pts[(i + 1) % m];
    cum.push(cum[i] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const total = cum[cum.length - 1];
  const out = [];
  const count = closed ? n : n + 1;
  for (let k = 0; k < count; k++) {
    const s = (k / n) * total;
    let i = 0;
    while (i < segs - 1 && cum[i + 1] < s) i++;
    const p = pts[i], q = pts[(i + 1) % m];
    const l = cum[i + 1] - cum[i];
    const u = l > 0 ? (s - cum[i]) / l : 0;
    out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
  }
  return out;
}

/** Circular arc from angle a0 to a1 (radians, signed sweep) around c with radius r. */
function arc(c, r, a0, a1, n, includeEnd = true) {
  const pts = [];
  const count = includeEnd ? n + 1 : n;
  for (let i = 0; i < count; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]);
  }
  return pts;
}

/**
 * Circular arc from Q to P that is tangent at Q to a circle centred at O (Q on that circle),
 * bulging outwards. Returns points from Q to P inclusive.
 */
function tangentArc(O, Q, P, n) {
  const d = [(O[0] - Q[0]), (O[1] - Q[1])];
  const dl = Math.hypot(d[0], d[1]);
  const dh = [d[0] / dl, d[1] / dl];               // from Q towards the circle centre
  const pq = [P[0] - Q[0], P[1] - Q[1]];
  const Rw = (pq[0] * pq[0] + pq[1] * pq[1]) / (2 * (pq[0] * dh[0] + pq[1] * dh[1]));
  const C = [Q[0] + dh[0] * Rw, Q[1] + dh[1] * Rw];
  let a0 = Math.atan2(Q[1] - C[1], Q[0] - C[0]);
  let a1 = Math.atan2(P[1] - C[1], P[0] - C[0]);
  let sweep = a1 - a0;
  while (sweep > Math.PI) sweep -= TAU;
  while (sweep < -Math.PI) sweep += TAU;
  return arc(C, Rw, a0, a0 + sweep, n, true);
}

/**
 * Pear: semicircular head of radius W/2 and two convex wings meeting at a point. Each wing is a
 * circular arc tangent to the head circle at `wingStart` degrees below the widest point, which
 * sets how full the lower body is (the IGI template is quite full, about 25 degrees).
 */
export function pearPolyline(W = 1, L = 1.5, { wingStart = 25, n = 160 } = {}) {
  const r = W / 2;
  const O = [0, L / 2 - r];                      // centre of the head circle
  const P = [0, -L / 2];                         // the point
  const thL = Math.PI + rad(wingStart);          // left tangent point angle
  const thR = -rad(wingStart);                   // right tangent point angle
  const pts = [];
  pts.push(...arc(O, r, thR, thL, 96, true));    // head: right tangent point, over the top, to the left one
  const QL = pts[pts.length - 1];
  pts.push(...tangentArc(O, QL, P, 48).slice(1));
  const QR = pts[0];
  const right = tangentArc(O, QR, P, 48).reverse(); // P -> QR
  pts.push(...right.slice(1, -1));
  return resampleKeeping(pts, n, [P]);
}

/** Points along a circular-arc segment from A to B bulging to the right (-1) or left (+1) of A->B. */
function bulgedSegment(A, B, bulge, n, side = 1) {
  const pts = [];
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * side, ny = (dx / len) * side; // normal pointing to the bulge side
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const s = bulge * len * 4 * u * (1 - u); // parabolic approximation of an arc
    pts.push([A[0] + dx * u + nx * s, A[1] + dy * u + ny * s]);
  }
  return pts;
}

/** Resample to n points but keep the listed corner points exactly. */
function resampleKeeping(pts, n, corners) {
  const out = resample(pts, n, true);
  for (const c of corners) {
    // snap the nearest resampled point onto the corner
    let best = 0, bd = Infinity;
    for (let i = 0; i < out.length; i++) {
      const d = Math.hypot(out[i][0] - c[0], out[i][1] - c[1]);
      if (d < bd) { bd = d; best = i; }
    }
    out[best] = [c[0], c[1]];
  }
  return out;
}

/** Marquise: two circular arcs through the points (0, +-L/2), width W at the centre. */
export function marquisePolyline(W = 1, L = 2, { n = 160 } = {}) {
  const w = W / 2, l = L / 2;
  const R = (l * l + w * w) / (2 * w);
  const c = R - w;                 // right arc centre at (-c, 0), left arc at (+c, 0)
  const th = Math.asin(l / R);
  const pts = [];
  pts.push(...arc([-c, 0], R, -th, th, 80, true));          // right arc, bottom point to top point
  pts.push(...arc([c, 0], R, Math.PI - th, Math.PI + th, 80, true).slice(1, -1)); // left arc
  return resampleKeeping(pts, n, [[0, l], [0, -l]]);
}

/**
 * Heart: two circular lobes meeting at a cleft, wings running down to a point.
 * lobeR: lobe radius as a fraction of W. bulge: wing sagitta fraction.
 */
export function heartPolyline(W = 1, L = 0.95, { lobeR = 0.27, wingStart = 20, n = 200 } = {}) {
  const w = W / 2, r = lobeR * W;
  const xc = w - r;                       // lobe centres at (+-xc, yc)
  const yc = L / 2 - r;
  const cleft = [0, yc + Math.sqrt(Math.max(r * r - xc * xc, 0))];
  const P = [0, -L / 2];
  const OR = [xc, yc], OL = [-xc, yc];
  const cleftAngR = Math.atan2(cleft[1] - yc, cleft[0] - xc);
  const thR = -rad(wingStart);                       // right lobe: wing starts below the widest point
  const pts = [];
  pts.push(...arc(OR, r, thR, cleftAngR, 90, true)); // right lobe CCW up to the cleft
  const cleftAngL = Math.PI - cleftAngR;
  const thL = Math.PI + rad(wingStart);
  pts.push(...arc(OL, r, cleftAngL, thL, 90, true).slice(1));
  const QL = pts[pts.length - 1];
  pts.push(...tangentArc(OL, QL, P, 48).slice(1));
  const QR = pts[0];
  pts.push(...tangentArc(OR, QR, P, 48).reverse().slice(1, -1));
  return resampleKeeping(pts, n, [cleft, P]);
}

/** Cushion: superellipse |x/a|^p + |y/b|^p = 1. p around 3 gives the usual pillow outline. */
export function cushionPolyline(W = 1, L = 1.1, { p = 3.0, n = 160 } = {}) {
  const a = W / 2, b = L / 2;
  const fine = [];
  const m = 2000;
  for (let i = 0; i < m; i++) {
    const t = (i / m) * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    fine.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)]);
  }
  return resample(fine, n, true);
}

/** Cut-cornered rectangle (emerald, asscher, radiant). c = corner cut length as a fraction of W. */
export function cutCorneredPolyline(W = 1, L = 1.4, c = 0.12) {
  const w = W / 2, l = L / 2, k = c * W;
  return [
    [w, -l + k], [w, l - k], [w - k, l], [-w + k, l],
    [-w, l - k], [-w, -l + k], [-w + k, -l], [w - k, -l],
  ];
}

/** Plain rectangle (princess). */
export function rectanglePolyline(W = 1, L = 1) {
  const w = W / 2, l = L / 2;
  return [[w, -l], [w, l], [-w, l], [-w, -l]];
}

/** Polar angle in degrees of a point about a centre. */
export function angleOf(p, c = [0, 0]) {
  return ((Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI + 360) % 360;
}

/** Half-width of a closed polyline at height y (largest |x| of the outline crossings). */
export function halfWidthAt(pts, y) {
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    if ((p[1] <= y && q[1] >= y) || (p[1] >= y && q[1] <= y)) {
      if (p[1] === q[1]) { best = Math.max(best, Math.abs(p[0]), Math.abs(q[0])); continue; }
      const u = (y - p[1]) / (q[1] - p[1]);
      best = Math.max(best, Math.abs(p[0] + (q[0] - p[0]) * u));
    }
  }
  return best;
}
