// Generic brilliant-cut builder.
//
// Topology (matches the lab plotting diagrams for round, oval, pear, marquise, heart and
// cushion brilliants):
//   crown:    table, n bezels (kites), n stars (triangles), 2n upper girdle facets
//   pavilion: n mains (kites meeting at the culet), 2n lower girdle facets
//
// Crown. Each bezel is a plane through its girdle anchor with a prescribed crown angle and
// azimuth (direction of steepest descent; by default radial from the table centre). The
// table is the plane z = H. The table corner of a bezel is the point of its z = H contour
// nearest the kite axis, adjacent bezel planes meet along a line and the star tip sits on
// that line at a chosen plan-view position. Since every vertex is constructed on the planes
// it belongs to, all facets are exactly planar, and because every bezel descends outwards
// the lines between neighbours are always valleys.
//
// Pavilion. Each main is a plane through the culet and its girdle anchor (steepest line from
// culet to anchor), so the pavilion angle follows from the pavilion depth and the culet
// position. Lower-half junctions sit on the lines where neighbouring mains meet.

import {
  MeshBuilder, planeFrom3, planeNoTwist, planeZ, intersectPlanes, pointOnLineNearestXY,
  normalize, GIRDLE,
} from './core.js';

const rad = (d) => (d * Math.PI) / 180;

/** Outward unit normal of the outline at point k (mean of the two adjacent segment normals). */
export function outlineNormal(outline, k) {
  const pts = outline.points, N = pts.length;
  const a = pts[(k + N - 1) % N], b = pts[k], c = pts[(k + 1) % N];
  const n1 = normalize([b[1] - a[1], -(b[0] - a[0]), 0]);
  const n2 = normalize([c[1] - b[1], -(c[0] - b[0]), 0]);
  const n = normalize([n1[0] + n2[0], n1[1] + n2[1], 0]);
  return [n[0], n[1]];
}

/** Plane through G (z = zBase) descending outwards along unit direction u with slope tanAlpha. */
function planeFromAngle(G, u, tanAlpha, zBase) {
  const h = [-u[1], u[0], 0];
  const inward = [G[0] - u[0], G[1] - u[1], zBase + tanAlpha];
  return planeFrom3([G[0], G[1], zBase], [G[0] + h[0], G[1] + h[1], zBase], inward);
}

export function buildBrilliant(spec) {
  const { outline, crownHeight: H, girdle: g, pavilionDepth: P } = spec;
  const pts = outline.points;
  const N = pts.length;
  const A = outline.anchors;
  const need = (name) => {
    if (!(name in A)) throw new Error(`unknown anchor ${name}`);
    return A[name];
  };
  const mb = new MeshBuilder();
  const topZ = new Array(N).fill(null);
  const botZ = new Array(N).fill(null);

  const setArc = (indices, plane, arr, base) => {
    for (const k of indices) {
      const z = GIRDLE.flat ? base : planeZ(plane, pts[k][0], pts[k][1]);
      arr[k] = (k === indices[0] || k === indices[indices.length - 1]) ? base : z;
    }
  };
  const arcPoints = (indices, arr) => indices.map((k) => [pts[k][0], pts[k][1], arr[k]]);
  const P3 = (gi, z) => [pts[gi][0], pts[gi][1], z];

  /**
   * Assemble the kites and side facets of one half from solved planes and tips.
   * apex[i]: 3D apex of kite i. anchors[i]: { gi, G }. tips[i]: { pt, gi, onGirdle } between kite i and i+1.
   */
  function assembleHalf({ apex, apexEnd, anchors, planes, tips, zBase, arr, tags, apexFaces }) {
    const n = planes.length;
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n;
      const poly = [apex[i], tips[prev].pt];
      if (tips[prev].onGirdle) {
        const idx = outline.range(tips[prev].gi, anchors[i].gi);
        setArc(idx, planes[i], arr, zBase);
        poly.push(...arcPoints(idx, arr).slice(1));
      } else {
        poly.push(anchors[i].G);
      }
      if (tips[i].onGirdle) {
        const idx = outline.range(anchors[i].gi, tips[i].gi);
        setArc(idx, planes[i], arr, zBase);
        poly.push(...arcPoints(idx, arr).slice(1, -1));
      }
      poly.push(tips[i].pt);
      if (apexEnd && apexEnd[i] !== apex[i]) poly.push(apexEnd[i]);
      mb.face(poly, tags.kite);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (apexFaces) mb.face([apex[i], apex[j], tips[i].pt], 'star');
      if (tips[i].onGirdle) continue;
      const S = tips[i].pt;
      const Gj = P3(tips[i].gi, zBase);
      {
        const idx = outline.range(anchors[i].gi, tips[i].gi);
        const pl = planeFrom3(S, anchors[i].G, Gj);
        setArc(idx, pl, arr, zBase);
        mb.face([S, ...arcPoints(idx, arr)], tags.half);
      }
      {
        const idx = outline.range(tips[i].gi, anchors[j].gi);
        const pl = planeFrom3(S, Gj, anchors[j].G);
        setArc(idx, pl, arr, zBase);
        mb.face([S, ...arcPoints(idx, arr)], tags.half);
      }
    }
  }

  if (spec.customCrown) {
    spec.customCrown(mb, outline, topZ);
  } else {
  // ------------------------------------------------------------------ crown
  // Bezel plane modes: azimuth (explicit), radial, third (chord to a girdle point), through
  // ('prev' | 'next': the plane has the given angle and passes through that star tip, which
  // fixes its azimuth), default = girdle normal at the anchor.
  // Star modes: meet (default), onPrev / onNext (exact XY target, height from that bezel plane),
  // girdle (tip on the girdle; the upper halves vanish).
  const C = spec.crown;
  const nb = C.bezels.length;
  if (C.stars.length !== nb) throw new Error('crown: bezels/stars count mismatch');
  const tc = C.tableCenter || [0, 0];
  const crownAnchors = C.bezels.map((b) => { const gi = need(b.girdle); return { gi, G: P3(gi, 0) }; });
  const crownPlanes = new Array(nb).fill(null);
  const crownU = new Array(nb).fill(null);
  const crownAngles = new Array(nb).fill(null);
  const nominalInset = H / Math.tan(rad(C.crownAngle ?? 34.5));
  const T = new Array(nb).fill(null);
  const tips = new Array(nb).fill(null);
  const starSpecs = C.stars.map((s, i) => {
    const gi = need(s.girdle);
    return { ...s, gi, mode: s.onGirdle ? 'girdle' : (s.mode || 'meet') };
  });

  const solvePlane = (i) => {
    const b = C.bezels[i];
    const G = pts[crownAnchors[i].gi];
    const alpha = b.angle ?? C.crownAngle;
    if (alpha === undefined) throw new Error('crown: crownAngle missing');
    let tanA = Math.tan(rad(alpha));
    let u;
    if (b.third) {
      const Cp = pts[need(b.third)];
      const chord = normalize([Cp[0] - G[0], Cp[1] - G[1], 0]);
      u = [-chord[1], chord[0]];
      const toCentre = [tc[0] - G[0], tc[1] - G[1]];
      if (u[0] * toCentre[0] + u[1] * toCentre[1] > 0) u = [-u[0], -u[1]];
    } else if (b.through === 'both') {
      // plane through the anchor and both neighbouring tips (closes a symmetric chain exactly)
      const tp = tips[(i + nb - 1) % nb], tn = tips[i];
      if (!tp || !tn) return false;
      const pl = planeFrom3([G[0], G[1], 0], tp.pt, tn.pt);
      // express as azimuth + slope for the table corner computation
      const gx = -pl.n[0] / pl.n[2], gy = -pl.n[1] / pl.n[2]; // dz/dx, dz/dy
      const slope = Math.hypot(gx, gy);
      u = [-gx / slope, -gy / slope];
      tanA = slope;
    } else if (b.through && b.solve === 'angle') {
      // azimuth given (explicit or girdle normal); the angle is solved so the plane passes through the tip
      const tip = b.through === 'prev' ? tips[(i + nb - 1) % nb] : tips[i];
      if (!tip) return false;
      const S = tip.pt;
      u = b.azimuth !== undefined ? [Math.cos(rad(b.azimuth)), Math.sin(rad(b.azimuth))] : outlineNormal(outline, crownAnchors[i].gi);
      const run = -((S[0] - G[0]) * u[0] + (S[1] - G[1]) * u[1]);
      if (run <= 1e-9) throw new Error(`crown bezel ${i}: the ${b.through} star tip is not inward of the anchor`);
      tanA = S[2] / run;
    } else if (b.through) {
      // angle given; the azimuth is solved so the plane passes through the tip
      const tip = b.through === 'prev' ? tips[(i + nb - 1) % nb] : tips[i];
      if (!tip) return false;
      const S = tip.pt;
      const d = [S[0] - G[0], S[1] - G[1]];
      const L = Math.hypot(d[0], d[1]);
      const c = -S[2] / tanA;             // required (S - G) . u
      if (Math.abs(c) > L) throw new Error(`crown bezel ${i}: no ${alpha} deg plane reaches the ${b.through} star tip`);
      const dh = [d[0] / L, d[1] / L];
      const perp = [-dh[1], dh[0]];
      const a = c / L, bb = Math.sqrt(Math.max(0, 1 - a * a));
      const u1 = [dh[0] * a + perp[0] * bb, dh[1] * a + perp[1] * bb];
      const u2 = [dh[0] * a - perp[0] * bb, dh[1] * a - perp[1] * bb];
      const nrm = outlineNormal(outline, crownAnchors[i].gi);
      u = (u1[0] * nrm[0] + u1[1] * nrm[1]) >= (u2[0] * nrm[0] + u2[1] * nrm[1]) ? u1 : u2;
    } else if (b.azimuth !== undefined) {
      u = [Math.cos(rad(b.azimuth)), Math.sin(rad(b.azimuth))];
    } else if (b.radial) {
      const v = normalize([G[0] - tc[0], G[1] - tc[1], 0]);
      u = [v[0], v[1]];
    } else {
      u = outlineNormal(outline, crownAnchors[i].gi);
    }
    crownPlanes[i] = planeFromAngle(G, u, tanA, 0);
    crownU[i] = u;
    crownAngles[i] = (Math.atan(tanA) * 180) / Math.PI;
    // Table corner: on the z = H contour of the plane, by default straight inward from the anchor.
    const inset = H / tanA;
    let Ti = [G[0] - u[0] * inset, G[1] - u[1] * inset, H];
    if (b.tableTarget) {
      const h = [-u[1], u[0]];
      const dd = (b.tableTarget[0] - Ti[0]) * h[0] + (b.tableTarget[1] - Ti[1]) * h[1];
      Ti = [Ti[0] + h[0] * dd, Ti[1] + h[1] * dd, H];
    }
    T[i] = Ti;
    return true;
  };

  const solveTip = (i) => {
    const s = starSpecs[i];
    const j = (i + 1) % nb;
    if (s.mode === 'girdle') { tips[i] = { pt: P3(s.gi, 0), gi: s.gi, onGirdle: true }; return true; }
    // Default target: inward from the girdle junction along its normal, (1 - starLength) of the
    // nominal crown inset, i.e. the star reaches starLength of the way from the table edge to the girdle.
    const f = s.length ?? C.starLength ?? 0.5;
    const nrm = outlineNormal(outline, s.gi);
    const target = s.target || [pts[s.gi][0] - nrm[0] * (1 - f) * nominalInset, pts[s.gi][1] - nrm[1] * (1 - f) * nominalInset];
    if (s.mode === 'onPrev' || s.mode === 'onNext') {
      const pl = s.mode === 'onPrev' ? crownPlanes[i] : crownPlanes[j];
      if (!pl) return false;
      tips[i] = { pt: [target[0], target[1], planeZ(pl, target[0], target[1])], gi: s.gi, onGirdle: false };
      return true;
    }
    if (!crownPlanes[i] || !crownPlanes[j]) return false;
    const line = intersectPlanes(crownPlanes[i], crownPlanes[j]);
    const pt = pointOnLineNearestXY(line, target);
    tips[i] = { pt, gi: s.gi, onGirdle: false };
    return true;
  };

  let progress = true, guard = 0;
  while (progress && guard++ < 4 * nb + 4) {
    progress = false;
    for (let i = 0; i < nb; i++) if (!crownPlanes[i] && solvePlane(i)) progress = true;
    for (let i = 0; i < nb; i++) if (!tips[i] && solveTip(i)) progress = true;
  }
  for (let i = 0; i < nb; i++) {
    if (!crownPlanes[i]) throw new Error(`crown bezel ${i} could not be solved (circular dependency)`);
    if (!tips[i]) throw new Error(`crown star ${i} could not be solved`);
    const z = tips[i].pt[2];
    if (z > H + 1e-6 || z < -1e-6) console.warn(`crown star ${i}: tip z=${z.toFixed(4)} outside the crown`);
    // every tip must lie on both neighbouring bezel planes
    const j = (i + 1) % nb;
    const e1 = Math.abs(planeZ(crownPlanes[i], tips[i].pt[0], tips[i].pt[1]) - z);
    const e2 = Math.abs(planeZ(crownPlanes[j], tips[i].pt[0], tips[i].pt[1]) - z);
    if (e1 > 1e-6 || e2 > 1e-6) throw new Error(`crown star ${i}: tip is not on both bezel planes (check through/onPrev/onNext pairing)`);
  }
  const crownTips = tips;
  mb.face(T, 'table');
  assembleHalf({
    apex: T, anchors: crownAnchors, planes: crownPlanes, tips: crownTips, zBase: 0, arr: topZ,
    tags: { kite: 'bezel', half: 'upper' }, apexFaces: true,
  });
  mb.meta = { tableCorners: T, crownAngles, crownAzimuths: crownU.map((u) => (Math.atan2(u[1], u[0]) * 180) / Math.PI) };
  }

  // --------------------------------------------------------------- pavilion
  const zb = -g;
  if (spec.customPavilion) {
    spec.customPavilion(mb, outline, botZ);
  } else {
  const V = spec.pavilion;
  const nm = V.mains.length;
  if (V.junctions.length !== nm) throw new Error('pavilion: mains/junctions count mismatch');
  // Culet: a point, or a keel line { x, y0, y1 } whose ends the mains attach to.
  const keel = V.keel ? [[V.keel.x, V.keel.y0, zb - P], [V.keel.x, V.keel.y1, zb - P]] : null;
  const culet = keel ? [V.keel.x, (V.keel.y0 + V.keel.y1) / 2, zb - P] : [V.culet[0], V.culet[1], zb - P];
  const mainSpecs = V.mains.map((m) => (typeof m === 'string' ? { girdle: m } : m));
  const juncSpecs = V.junctions.map((j) => (typeof j === 'string' ? { girdle: j } : j));
  const pavAnchors = mainSpecs.map((m) => { const gi = need(m.girdle); return { gi, G: P3(gi, zb) }; });
  const keelEnd = (m) => (m.end === 'b' ? keel[1] : keel[0]);
  const pavPlanes = mainSpecs.map((m, i) => {
    if (keel) {
      if (m.end === 'both') return planeFrom3(keel[0], keel[1], pavAnchors[i].G);
      return planeNoTwist(keelEnd(m), pavAnchors[i].G);
    }
    if (m.third) return planeFrom3(culet, pavAnchors[i].G, P3(need(m.third), zb));
    return planeNoTwist(culet, pavAnchors[i].G);
  });
  const pavTips = juncSpecs.map((jn, i) => {
    const j = (i + 1) % nm;
    const gi = need(jn.girdle);
    if (jn.onGirdle) return { pt: P3(gi, zb), gi, onGirdle: true };
    const f = jn.length ?? V.lowerLength ?? 0.78;
    let towards = culet;
    if (keel) {
      const d0 = Math.hypot(pts[gi][0] - keel[0][0], pts[gi][1] - keel[0][1]);
      const d1 = Math.hypot(pts[gi][0] - keel[1][0], pts[gi][1] - keel[1][1]);
      towards = d0 <= d1 ? keel[0] : keel[1];
    }
    const target = jn.target || [pts[gi][0] + (towards[0] - pts[gi][0]) * f, pts[gi][1] + (towards[1] - pts[gi][1]) * f];
    const line = intersectPlanes(pavPlanes[i], pavPlanes[j]);
    const pt = pointOnLineNearestXY(line, target);
    if (pt[2] > zb + 1e-6 || pt[2] < zb - P - 1e-6) console.warn(`pavilion junction ${i}: z=${pt[2].toFixed(4)} outside the pavilion`);
    return { pt, gi, onGirdle: false };
  });
  // Kite apexes: the culet, or the keel end(s). A main attached to both ends becomes a pentagon
  // whose first apex is the keel end nearest the previous junction.
  let apex = mainSpecs.map(() => culet), apexEnd = null;
  if (keel) {
    apexEnd = [];
    apex = mainSpecs.map((m, i) => {
      if (m.end !== 'both') { const e = keelEnd(m); apexEnd.push(e); return e; }
      const prevTip = pavTips[(i + nm - 1) % nm].pt;
      const d0 = Math.hypot(prevTip[0] - keel[0][0], prevTip[1] - keel[0][1]);
      const d1 = Math.hypot(prevTip[0] - keel[1][0], prevTip[1] - keel[1][1]);
      const first = d0 <= d1 ? keel[0] : keel[1];
      apexEnd.push(first === keel[0] ? keel[1] : keel[0]);
      return first;
    });
  }
  assembleHalf({
    apex, apexEnd, anchors: pavAnchors, planes: pavPlanes, tips: pavTips, zBase: zb, arr: botZ,
    tags: { kite: 'main', half: 'lower' }, apexFaces: false,
  });
  }

  addGirdle(mb, outline, topZ, botZ);
  return mb;
}

/** Girdle band between the crown edge heights and the pavilion edge heights. */
export function addGirdle(mb, outline, topZ, botZ, { smoothAngleDeg = 25 } = {}) {
  const pts = outline.points;
  const N = pts.length;
  for (let k = 0; k < N; k++) {
    if (topZ[k] === null) throw new Error(`girdle: top height missing at outline point ${k}`);
    if (botZ[k] === null) throw new Error(`girdle: bottom height missing at outline point ${k}`);
  }
  const faceIds = [];
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    const id = mb.face([
      [pts[k][0], pts[k][1], topZ[k]],
      [pts[k1][0], pts[k1][1], topZ[k1]],
      [pts[k1][0], pts[k1][1], botZ[k1]],
      [pts[k][0], pts[k][1], botZ[k]],
    ], 'girdle');
    faceIds.push(id);
  }
  // Vertical edges between neighbouring girdle quads are smooth unless the outline turns sharply.
  for (let k = 0; k < N; k++) {
    const km = (k + N - 1) % N, k1 = (k + 1) % N;
    const a = [pts[k][0] - pts[km][0], pts[k][1] - pts[km][1]];
    const b = [pts[k1][0] - pts[k][0], pts[k1][1] - pts[k][1]];
    const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
    if (la === 0 || lb === 0) continue;
    const cosang = (a[0] * b[0] + a[1] * b[1]) / (la * lb);
    const ang = (Math.acos(Math.max(-1, Math.min(1, cosang))) * 180) / Math.PI;
    if (ang < smoothAngleDeg) {
      const top = mb.v([pts[k][0], pts[k][1], topZ[k]]);
      const bot = mb.v([pts[k][0], pts[k][1], botZ[k]]);
      mb.smoothEdge(top, bot, faceIds[km], faceIds[k]);
    }
  }
}
