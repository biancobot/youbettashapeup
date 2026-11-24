// Cobblestone pavé background: the free area of the page around the views is packed with
// face-up copies of the current stone in random sizes and in-plane orientations, as if set in a
// pavé. Sizes come from the weight estimator for the shape (a stone of N carats is drawn at its
// real millimetre width at the page's scale); the largest stones go down first and smaller ones
// fill the gaps. For shapes the estimators cover, one stone of each chart size (0.25 to 5 ct) is
// drawn as a plain outline with its carat weight centred in it. Each stone gets its own opacity,
// drawn at random between the chosen minimum and maximum.
import * as THREE from '../vendor/three/three.module.js';
import { LineSegments2 } from '../vendor/three/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/lines/LineMaterial.js';
import { CHART_CARATS } from './gemcad/weights.js';

/** Deterministic random numbers so a layout is stable until reseeded. */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Convex hull (Andrew's monotone chain) of 2D points. */
export function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** Separating-axis overlap test for two convex polygons. */
function overlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
      const nx = y1 - y0, ny = -(x1 - x0);
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [x, y] of A) { const d = x * nx + y * ny; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const [x, y] of B) { const d = x * nx + y * ny; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

const transform = (hull, s, ang, cx, cy) => { const c = Math.cos(ang), sn = Math.sin(ang); return hull.map(([x, y]) => [cx + s * (x * c - y * sn), cy + s * (x * sn + y * c)]); };
const rectPoly = (r) => [[r.minX, r.minY], [r.maxX, r.minY], [r.maxX, r.maxY], [r.minX, r.maxY]];

/**
 * Pack stones into `area` (world rect) avoiding `exclusions` (world rects). hull: the stone's
 * face-up outline at its natural size (width 2). sizes: [{ carats, scale, label }] largest
 * first. Returns [{ x, y, angle, scale, carats, label, opacity }].
 */
export function packStones(hull, area, exclusions, sizes, settings, random) {
  const placed = [];   // { poly, cx, cy, r }
  const out = [];
  const gap = settings.gap;
  const hullR = Math.max(...hull.map(([x, y]) => Math.hypot(x, y)));
  const excl = exclusions.map(rectPoly);
  const aw = area.maxX - area.minX, ah = area.maxY - area.minY;
  const labelled = new Set();
  for (const size of sizes) {
    const s = size.scale, r = hullR * s * (1 + gap);
    if (2 * r > Math.min(aw, ah)) continue;
    const stoneArea = Math.PI * r * r;
    const attempts = Math.min(4000, Math.max(300, Math.round((aw * ah) / stoneArea) * 6));
    let fails = 0;
    for (let k = 0; k < attempts && fails < settings.patience; k++) {
      const cx = area.minX + r + random() * (aw - 2 * r), cy = area.minY + r + random() * (ah - 2 * r);
      const ang = random() * Math.PI * 2;
      // cheap circle pre-check against placed stones, then exact polygon tests
      let bad = false;
      const poly = transform(hull, s * (1 + gap), ang, cx, cy);
      for (const e of excl) if (overlap(poly, e)) { bad = true; break; }
      if (!bad) for (const q of placed) { if (Math.hypot(q.cx - cx, q.cy - cy) < q.r + r && overlap(poly, q.poly)) { bad = true; break; } }
      if (bad) { fails++; continue; }
      fails = 0;
      placed.push({ poly, cx, cy, r });
      const label = size.label && !labelled.has(size.carats) ? size.carats : null;
      if (label) labelled.add(size.carats);
      out.push({ x: cx, y: cy, angle: ang, scale: s, carats: size.carats, label, opacity: settings.minOpacity + random() * (settings.maxOpacity - settings.minOpacity) });
    }
  }
  return out;
}

/**
 * Hexafoil (flower-of-life) tiling with marquise petals: on a triangular lattice of spacing R,
 * every pair of second neighbours (distance R * sqrt(3)) is joined by a petal across the edge
 * between them, so six petals meet tip to tip at every lattice point. The petal's length is the
 * marquise's length at the chosen size (so R = L / sqrt(3)); a marquise of L:W = sqrt(3) is the
 * exact vesica of the classic figure, longer ones leave slivers between petals.
 * Returns stones like packStones, all at one scale and opacity, centred on the area.
 */
export function hexafoilStones(hull, area, exclusions, scale, opacity, random) {
  const ys = hull.map((p) => p[1]), L = (Math.max(...ys) - Math.min(...ys)) * scale;   // petal length along the stone's y axis
  const R = L / Math.sqrt(3);
  const a = [R, 0], b = [R / 2, (R * Math.sqrt(3)) / 2];
  const dirs = [a, b, [b[0] - a[0], b[1] - a[1]]];
  const excl = exclusions.map(rectPoly);
  const cx0 = (area.minX + area.maxX) / 2, cy0 = (area.minY + area.maxY) / 2;
  const n = Math.ceil(Math.max(area.maxX - area.minX, area.maxY - area.minY) / R) + 2;
  const out = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const px = cx0 + i * a[0] + j * b[0], py = cy0 + i * a[1] + j * b[1];
    for (const d of dirs) {
      const x = px + d[0] / 2, y = py + d[1] / 2;
      const ang = Math.atan2(d[1], d[0]);   // the stone's length (its y axis) ends up perpendicular to the edge
      const poly = transform(hull, scale, ang, x, y);
      if (poly.some(([qx, qy]) => qx < area.minX || qx > area.maxX || qy < area.minY || qy > area.maxY)) continue;
      if (excl.some((e) => overlap(poly, e))) continue;
      out.push({ x, y, angle: ang, scale, carats: null, label: null, opacity });
    }
  }
  return out;
}

/** Text as a transparent plane: the carat weight centred in an outline stone. */
function makeLabel(text, worldHeight, opacity) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = '#000'; ctx.font = '600 72px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthTest: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(worldHeight * 2, worldHeight), mat);
  m.renderOrder = 3;
  return m;
}

export { rng };
export function createPave(scene, occluderMat) {
  const group = new THREE.Group(); group.position.z = -3; scene.add(group);
  let mats = [], lastKey = null, count = 0, resolution = [1, 1], lineWidth = 1.5;
  function clear() {
    for (const ch of [...group.children]) { group.remove(ch); ch.traverse((o) => { if (o.geometry && o.userData.own) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); }
    for (const m of mats) m.dispose();
    mats = []; count = 0; lastKey = null;
  }
  /**
   * Build (or rebuild when the inputs changed). opts: { key, stones, meshGeometry, hardGeometry,
   * smoothPositions, hullEdges }; stones from packStones or hexafoilStones.
   */
  function build(o) {
    if (o.key === lastKey) return;
    clear();
    lastKey = o.key;
    const stones = o.stones;
    const outlineGeo = new LineSegmentsGeometry().setPositions(o.hullEdges);
    const smoothGeo = o.smoothPositions && o.smoothPositions.length ? new LineSegmentsGeometry().setPositions(o.smoothPositions) : null;
    for (const st of stones) {
      const g = new THREE.Group();
      g.position.set(st.x, st.y, 0); g.rotation.z = st.angle; g.scale.setScalar(st.scale);
      const mat = new LineMaterial({ color: 0x000000, linewidth: lineWidth, worldUnits: false, transparent: true, opacity: st.opacity, depthTest: true, depthWrite: true });
      mat.resolution.set(resolution[0], resolution[1]); mats.push(mat);
      if (st.label) {
        g.add(new LineSegments2(outlineGeo, mat));
        const lbl = makeLabel(`${st.label} ct`, 0.42, st.opacity);   // text height: 0.21 of the stone's width
        lbl.position.z = 0.1; lbl.rotation.z = -st.angle;            // keep the number upright
        g.add(lbl);
      } else {
        const mesh = new THREE.Mesh(o.meshGeometry, occluderMat);
        g.add(mesh, new LineSegments2(o.hardGeometry, mat));
        if (smoothGeo) g.add(new LineSegments2(smoothGeo, mat));
      }
      group.add(g);
    }
    count = stones.length;
  }
  function setResolution(w, h) { resolution = [w, h]; for (const m of mats) m.resolution.set(w, h); }
  function setLineWidth(lw) { lineWidth = lw; for (const m of mats) m.linewidth = lw; }
  return { group, build, clear, setResolution, setLineWidth, get count() { return count; }, set visible(v) { group.visible = v; }, get visible() { return group.visible; } };
}

/** Stone sizes to pack, largest first: the chart sizes (labelled when the estimator covers the shape) plus filler sizes. */
export function paveSizes(estimator, maxCarats, worldPerMm, labels) {
  const chart = CHART_CARATS.filter((c) => c <= maxCarats);
  const filler = [maxCarats, 2.5, 1.25, 0.75, 0.4, 0.2, 0.15, 0.1, 0.07, 0.05, 0.03].filter((c) => c <= maxCarats);
  const all = [...new Set([...chart, ...filler])].sort((a, b) => b - a);
  return all.map((carats) => ({ carats, scale: (estimator.widthMm(carats) * worldPerMm) / 2, label: labels && chart.includes(carats) }));
}
