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
  MeshBuilder, planeFrom3, planeNoTwist, planeZ, intersectPlanes, pointOnLineNearestXY, pointOnLineAtPlane,
  normalize, GIRDLE,
} from './core.js';
import { buildByCutting, cutPlane } from './clip.js';

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

/** Slope (tan of the angle to the girdle plane) of a plane. */
export function planeSlope(pl) { return Math.hypot(pl.n[0], pl.n[1]) / Math.abs(pl.n[2]); }

/**
 * Plane with slope tanA that passes through the girdle point G and the point S (S inward and
 * above/below G). Of the two possible azimuths the one closest to `prefer` is used.
 * Returns null when no such plane exists.
 */
export function planeThroughWithAngle(G, S, tanA, prefer) {
  const d = [S[0] - G[0], S[1] - G[1]];
  const L = Math.hypot(d[0], d[1]);
  const c = -(S[2] - G[2]) / tanA;
  if (L < 1e-12 || Math.abs(c) > L) return null;
  const dh = [d[0] / L, d[1] / L];
  const perp = [-dh[1], dh[0]];
  const a = c / L, bb = Math.sqrt(Math.max(0, 1 - a * a));
  const u1 = [dh[0] * a + perp[0] * bb, dh[1] * a + perp[1] * bb];
  const u2 = [dh[0] * a - perp[0] * bb, dh[1] * a - perp[1] * bb];
  const u = (u1[0] * prefer[0] + u1[1] * prefer[1]) >= (u2[0] * prefer[0] + u2[1] * prefer[1]) ? u1 : u2;
  return planeFromAngle(G, u, tanA, G[2]);
}

/**
 * Half-facet plane: contains the girdle chord from Ga to Gb (both at zBase) and descends
 * outwards (away from the origin) with slope tanA. This is how upper and lower girdle facets
 * are cut: at a set angle, until they meet the girdle at both ends.
 */
export function chordPlane(Ga, Gb, zBase, tanA) {
  const cx = (Ga[0] + Gb[0]) / 2, cy = (Ga[1] + Gb[1]) / 2;
  const dx = Gb[0] - Ga[0], dy = Gb[1] - Ga[1];
  let u = normalize([dy, -dx, 0]);
  if (u[0] * cx + u[1] * cy < 0) u = [-u[0], -u[1], 0];
  return planeFromAngle([cx, cy], [u[0], u[1]], tanA, zBase);
}

/**
 * Slope for a half facet between the girdle points Ga and Gb: at least `delta` degrees steeper
 * than both neighbouring kites, and steep enough that the plane, extended inwards, clears the
 * apex point (table centre for the crown, culet for the pavilion) by `margin`.
 */
export function halfSlope(Ga, Gb, kiteA, kiteB, delta, apex, zBase, margin = 0.02) {
  const cx = (Ga[0] + Gb[0]) / 2, cy = (Ga[1] + Gb[1]) / 2;
  const dx = Gb[0] - Ga[0], dy = Gb[1] - Ga[1];
  let u = normalize([dy, -dx, 0]);
  if (u[0] * cx + u[1] * cy < 0) u = [-u[0], -u[1], 0];
  const run = (cx - apex[0]) * u[0] + (cy - apex[1]) * u[1];   // horizontal distance from the apex to the chord along u
  const rise = Math.abs(apex[2] - zBase) + margin;
  const need = run > 0.05 ? rise / run : 0;                       // chords beside the apex cannot be governed this way
  const a = Math.atan(planeSlope(kiteA)) + (delta * Math.PI) / 180;
  const b = Math.atan(planeSlope(kiteB)) + (delta * Math.PI) / 180;
  return Math.min(5, Math.max(Math.tan(a), Math.tan(b), need));
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

  const flat = GIRDLE.mode === 'flat';
  // Heights of the girdle points along an arc: from the facet plane, with the two end anchors
  // pinned to the given heights.
  const setArc = (indices, plane, arr, z0, z1 = z0) => {
    for (const k of indices) arr[k] = flat ? z0 : planeZ(plane, pts[k][0], pts[k][1]);
    arr[indices[0]] = z0;
    arr[indices[indices.length - 1]] = flat ? z0 : z1;
  };
  const arcPoints = (indices, arr) => indices.map((k) => [pts[k][0], pts[k][1], arr[k]]);
  const P3 = (gi, z) => [pts[gi][0], pts[gi][1], z];

  /**
   * Assemble the kites and side facets of one half from solved planes and tips.
   * apex[i]: 3D apex of kite i. anchors[i]: { gi, G }. tips[i]: { pt, gi, onGirdle } between kite i and i+1.
   */
  function assembleHalf({ apex, apexEnd, anchors, planes, tips, zBase, arr, tags, apexFaces, halfDelta = 0, sign = 1 }) {
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
      const idxL = outline.range(anchors[i].gi, tips[i].gi);
      const idxR = outline.range(tips[i].gi, anchors[j].gi);
      let Gj = P3(tips[i].gi, zBase);
      let plL = tips[i].half || null;
      if (plL) Gj = [Gj[0], Gj[1], planeZ(plL, Gj[0], Gj[1])];
      if (!plL) plL = planeFrom3(S, anchors[i].G, Gj);
      setArc(idxL, plL, arr, zBase, Gj[2]);
      const fl = mb.face([S, ...arcPoints(idxL, arr)], tags.half);
      let plR = planeFrom3(S, Gj, anchors[j].G);
      let plRcut = null;
      if (tips[i].half) {
        // the right-hand half is cut at the same angle through its own chord
        const apexPt = sign > 0 ? [0, 0, apex[i][2]] : apex[i];
        const tanH = halfSlope(pts[tips[i].gi], pts[anchors[j].gi], planes[i], planes[j], halfDelta, apexPt, zBase);
        plRcut = chordPlane(pts[tips[i].gi], pts[anchors[j].gi], zBase, tanH * sign);
      }
      setArc(idxR, plR, arr, Gj[2], zBase);
      const fr = mb.face([S, ...arcPoints(idxR, arr)], tags.half);
      if (tips[i].half) {
        mb.cutHalves = mb.cutHalves || [];
        mb.cutSkip = mb.cutSkip || new Set();
        mb.cutHalves.push({ plane: tips[i].half, tag: tags.half }, { plane: plRcut, tag: tags.half });
        if (fl >= 0) mb.cutSkip.add(mb.faces[fl]);
        if (fr >= 0) mb.cutSkip.add(mb.faces[fr]);
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
    if (b.tableTarget === 'axis') {
      // table corner where the bezel's table-level contour crosses the stone's axis (x = 0)
      const pl = crownPlanes[i];
      Ti = [0, (pl.d - pl.n[2] * H) / pl.n[1], H];
    } else if (b.tableTarget) {
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
    let pt = null, half = null;
    if (GIRDLE.mode !== 'flat' && (C.halfDelta ?? 7) > 0 && !s.length && !s.target) {
      // upper girdle facet cut at kite angle + delta through its two girdle points;
      // the star tip is where it meets the line between the two bezels
      const tanH = halfSlope(pts[crownAnchors[i].gi], pts[s.gi], crownPlanes[i], crownPlanes[j], C.halfDelta ?? 7, [tc[0], tc[1], H], 0);
      half = chordPlane(pts[crownAnchors[i].gi], pts[s.gi], 0, tanH);
      pt = pointOnLineAtPlane(line, half);
      if (pt && (pt[2] > H + 1e-6 || pt[2] < 0)) { console.warn(`crown star ${i}: half facet meets the bezels at z=${pt[2].toFixed(3)}`); }
    }
    if (!pt) { pt = pointOnLineNearestXY(line, target); half = null; }
    tips[i] = { pt, gi: s.gi, onGirdle: false, half };
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
    tags: { kite: 'bezel', half: 'upper' }, apexFaces: true, halfDelta: C.halfDelta ?? 7, sign: 1,
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
    let pt = null, half = null;
    if (GIRDLE.mode !== 'flat' && (V.halfDelta ?? 1.5) > 0 && !jn.length && !jn.target) {
      const tanH = halfSlope(pts[pavAnchors[i].gi], pts[gi], pavPlanes[i], pavPlanes[j], V.halfDelta ?? 1.5, culet, zb);
      half = chordPlane(pts[pavAnchors[i].gi], pts[gi], zb, -tanH);   // lower girdle facets descend inward
      pt = pointOnLineAtPlane(line, half);
      if (pt && (pt[2] > zb || pt[2] < zb - P - 1e-6)) { console.warn(`pavilion junction ${i}: lower facet meets the mains at z=${pt[2].toFixed(3)}`); }
    }
    if (!pt) { pt = pointOnLineNearestXY(line, target); half = null; }
    if (pt[2] > zb + 1e-6 || pt[2] < zb - P - 1e-6) console.warn(`pavilion junction ${i}: z=${pt[2].toFixed(4)} outside the pavilion`);
    return { pt, gi, onGirdle: false, half };
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
    tags: { kite: 'main', half: 'lower' }, apexFaces: false, halfDelta: V.halfDelta ?? 1.5, sign: -1,
  });
  }

  if (spec.cut !== false) {
    // Rebuild the stone by cutting the girdle prism with the plane of every facet found above.
    // The explicit construction only served to find consistent facet planes; the cut decides
    // the real topology and the girdle outline. Half facets cut at an angle keep their own
    // plane; the others take the plane of their explicit polygon.
    const inside = [0, 0, -g / 2];
    const planes = [];
    // Crown facets keep the material below their plane, pavilion facets the material above.
    const PAVILION = new Set(['main', 'lower', 'fan', 'v', 'corner', 'chevron', 'pavilion-step', 'pavilion-keel']);
    const orient = (pl, tag) => {
      let n = pl.n, d = pl.d;
      const wantDown = PAVILION.has(tag);           // kept side n.p - d <= 0 is "above" when n points down
      if ((n[2] < 0) !== wantDown) { n = [-n[0], -n[1], -n[2]]; d = -d; }
      return { n, d, tag };
    };
    for (const t of (mb.cutHalves || [])) planes.push(orient(t.plane, t.tag));
    for (const f of mb.faces) {
      if (f.tag === 'girdle' || (mb.cutSkip && mb.cutSkip.has(f))) continue;
      if (f.tag === 'girdle') continue;
      const v = f.idx.map((i) => mb.verts[i]);
      // first three non-collinear vertices define the plane (apex and tips come first)
      let pl = null;
      for (let a = 0; a < v.length && !pl; a++) for (let b = a + 1; b < v.length && !pl; b++) for (let c = b + 1; c < v.length && !pl; c++) {
        const n = normalize([
          (v[b][1] - v[a][1]) * (v[c][2] - v[a][2]) - (v[b][2] - v[a][2]) * (v[c][1] - v[a][1]),
          (v[b][2] - v[a][2]) * (v[c][0] - v[a][0]) - (v[b][0] - v[a][0]) * (v[c][2] - v[a][2]),
          (v[b][0] - v[a][0]) * (v[c][1] - v[a][1]) - (v[b][1] - v[a][1]) * (v[c][0] - v[a][0]),
        ]);
        const l = Math.hypot(...n);
        if (l > 0.5) {
          const area = Math.hypot(
            (v[b][1] - v[a][1]) * (v[c][2] - v[a][2]) - (v[b][2] - v[a][2]) * (v[c][1] - v[a][1]),
            (v[b][2] - v[a][2]) * (v[c][0] - v[a][0]) - (v[b][0] - v[a][0]) * (v[c][2] - v[a][2]),
            (v[b][0] - v[a][0]) * (v[c][1] - v[a][1]) - (v[b][1] - v[a][1]) * (v[c][0] - v[a][0]));
          if (area > 1e-6) pl = orient(cutPlane(v[a], v[b], v[c], inside), f.tag);
        }
      }
      if (pl) planes.push({ ...pl, tag: f.tag });
    }
    const cutMb = buildByCutting(outline, planes);
    cutMb.meta = mb.meta;
    cutMb.cutPlanes = planes;
    cutMb.cutOutline = outline;
    return cutMb;
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
