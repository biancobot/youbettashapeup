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

/** Hull scaled by s (a number, or [sx, sy] in the stone's own frame), turned by ang and moved to (cx, cy). */
const transform = (hull, s, ang, cx, cy) => { const c = Math.cos(ang), sn = Math.sin(ang), sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s; return hull.map(([x, y]) => [cx + sx * x * c - sy * y * sn, cy + sx * x * sn + sy * y * c]); };

/** Signed distance from (x, y) to a convex polygon (counter-clockwise): negative inside. */
export function sdPolygon(poly, x, y) {
  let inside = true, best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ey = by - ay, px = x - ax, py = y - ay;
    if (ex * py - ey * px < 0) inside = false;
    const t = Math.max(0, Math.min(1, (px * ex + py * ey) / (ex * ex + ey * ey || 1)));
    const d = Math.hypot(px - t * ex, py - t * ey);
    if (d < best) best = d;
  }
  return inside ? -best : best;
}

/**
 * Tangent circle packing ("cobblestone pavé" / snow setting). Circles of many radii fill the
 * free space of `area` around the obstacle polygons: each new circle is put at a local maximum
 * of the clearance function (distance to the nearest page edge, obstacle edge or placed circle)
 * with radius equal to that clearance, so it touches three boundaries; gaps are filled by
 * progressively smaller circles down to rMin. `seeds` are circles placed first at random
 * (the labelled chart-size stones, and a few large ones), each where it fits.
 * Returns { circles: [{ x, y, r, seed }], stats }.
 */
export function packTangent(area, obstacles, settings, random, seeds = []) {
  const { rMin, rMax, margin } = settings;
  const circles = [];
  // spatial grid of placed circles, cell = 2 rMax
  const cell = Math.max(2 * rMax, 1e-6), grid = new Map();
  const key = (ix, iy) => ix * 100003 + iy;
  const insert = (c) => {
    const i0 = Math.floor((c.x - c.r) / cell), i1 = Math.floor((c.x + c.r) / cell), j0 = Math.floor((c.y - c.r) / cell), j1 = Math.floor((c.y + c.r) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); }
  };
  const edgeClear = (x, y) => Math.min(x - area.minX, area.maxX - x, y - area.minY, area.maxY - y);
  const obstacleClear = (x, y) => { let b = Infinity; for (const o of obstacles) { const d = sdPolygon(o, x, y) - margin; if (d < b) b = d; } return b; };
  /** clearance(x, y): min distance to any boundary; `bound` lets the circle search stop early. */
  const clearance = (x, y) => {
    let b = Math.min(edgeClear(x, y), obstacleClear(x, y));
    if (b <= 0) return b;
    const reach = b + rMax, i0 = Math.floor((x - reach) / cell), i1 = Math.floor((x + reach) / cell), j0 = Math.floor((y - reach) / cell), j1 = Math.floor((y + reach) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = grid.get(key(i, j)); if (!list) continue;
      for (const c of list) { const d = Math.hypot(c.x - x, c.y - y) - c.r; if (d < b) { b = d; if (b <= 0) return b; } }
    }
    return b;
  };
  const place = (x, y, r, extra) => { const c = { x, y, r, ...extra }; circles.push(c); insert(c); return c; };
  const aw = area.maxX - area.minX, ah = area.maxY - area.minY;
  // seeds: given circles first (where they fit), then a few random large ones
  for (const sd of seeds) {
    for (let k = 0; k < 400; k++) {
      const x = area.minX + sd.r + random() * (aw - 2 * sd.r), y = area.minY + sd.r + random() * (ah - 2 * sd.r);
      if (clearance(x, y) >= sd.r) { place(x, y, sd.r, { seed: sd }); break; }
    }
  }
  for (let n = 0; n < settings.seedCount; n++) {
    const r = settings.seedMin + random() * (rMax - settings.seedMin);
    for (let k = 0; k < 200; k++) {
      const x = area.minX + r + random() * (aw - 2 * r), y = area.minY + r + random() * (ah - 2 * r);
      if (clearance(x, y) >= r) { place(x, y, r, {}); break; }
    }
  }
  // fill: best of N random samples, hill-climbed to a local maximum of clearance
  let fails = 0, climbs = 0;
  const dirs = []; for (let k = 0; k < 8; k++) dirs.push([Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
  while (circles.length < settings.maxCircles && fails < settings.patience) {
    let bx = 0, by = 0, bc = -Infinity;
    for (let n = 0; n < settings.samples; n++) {
      const x = area.minX + random() * aw, y = area.minY + random() * ah, c = clearance(x, y);
      if (c > bc) { bc = c; bx = x; by = y; }
    }
    let step = Math.max(bc, rMin);
    for (let it = 0; it < 80 && step > rMin * 1e-3; it++) {
      let improved = false;
      for (const [dx, dy] of dirs) {
        const x = bx + dx * step, y = by + dy * step;
        if (x < area.minX || x > area.maxX || y < area.minY || y > area.maxY) continue;
        const c = clearance(x, y);
        if (c > bc + 1e-9) { bc = c; bx = x; by = y; improved = true; }
      }
      if (!improved) step /= 2;
      climbs++;
    }
    if (bc < rMin) { fails++; continue; }
    fails = 0;
    place(bx, by, Math.min(bc, rMax), {});
  }
  return { circles, stats: { count: circles.length, climbs } };
}

/**
 * Acceptance check for a packing: overlaps between circles, intrusions into obstacles or past
 * the area edge, and how many circles touch at least two boundaries (within tol).
 */
export function checkPacking(circles, area, obstacles, margin, tol = 1e-4) {
  let overlaps = 0, intrusions = 0, tangent2 = 0, maxOverlap = 0;
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i]; let touches = 0;
    const edge = Math.min(a.x - area.minX, area.maxX - a.x, a.y - area.minY, area.maxY - a.y) - a.r;
    if (edge < -tol) intrusions++;
    if (Math.abs(edge) <= tol) touches++;
    for (const o of obstacles) { const d = sdPolygon(o, a.x, a.y) - margin - a.r; if (d < -tol) intrusions++; if (Math.abs(d) <= tol) touches++; }
    for (let j = 0; j < circles.length; j++) {
      if (i === j) continue; const b = circles[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
      if (d < -tol) { if (j > i) { overlaps++; maxOverlap = Math.max(maxOverlap, -d); } }
      if (Math.abs(d) <= tol) touches++;
    }
    if (touches >= 2) tangent2++;
  }
  return { overlaps, maxOverlap, intrusions, tangent2, count: circles.length };
}

/**
 * Stones for the cobblestone pattern: a tangent packing of the free space around the view
 * outlines, with the current shape drawn inside every circle (its circumscribed circle is the
 * packed circle) at a random turn and opacity. Labelled chart-size stones are the first seeds.
 * hull: the face-up outline at natural size; hullR its circumradius.
 */
export function cobblestoneStones(hull, area, obstacles, sizes, settings, random) {
  const hullR = Math.max(...hull.map(([x, y]) => Math.hypot(x, y)));
  const seeds = [];
  for (const sz of sizes) if (sz.label) {
    const sc = sz.labelScale || sz.scale, r = Array.isArray(sc) ? Math.max(...hull.map(([x, y]) => Math.hypot(sc[0] * x, sc[1] * y))) : hullR * sc;
    seeds.push({ r, carats: sz.carats, scale: sc });
  }
  seeds.sort((a, b) => b.r - a.r);
  const { circles, stats } = packTangent(area, obstacles, settings, random, seeds);
  const stones = circles.map((c) => {
    const opacity = settings.minOpacity + random() * (settings.maxOpacity - settings.minOpacity);
    if (c.seed) return { x: c.x, y: c.y, angle: random() * Math.PI * 2, scale: c.seed.scale, carats: c.seed.carats, label: c.seed.carats, opacity, r: c.r };
    return { x: c.x, y: c.y, angle: random() * Math.PI * 2, scale: c.r / hullR, carats: null, label: null, opacity, r: c.r };
  });
  // Second pass for shapes that are not round: a stone inscribed in its circle leaves the circle's
  // corners empty, so smaller stones are tried in those gaps with their real outlines (separating
  // axis test against the placed stones' outlines and the obstacles), largest first.
  const inR = Math.min(...hull.map(([x, y], i) => { const [bx, by] = hull[(i + 1) % hull.length]; return Math.abs(x * by - y * bx) / Math.hypot(bx - x, by - y); }));
  if (hullR / inR > 1.12 && settings.gapFill !== false) {
    const polys = stones.map((st) => transform(hull, st.scale, st.angle, st.x, st.y));
    const areaPoly = [[area.minX, area.minY], [area.maxX, area.minY], [area.maxX, area.maxY], [area.minX, area.maxY]];
    const grown = obstacles.map((o) => { const cx = o.reduce((a, p) => a + p[0], 0) / o.length, cy = o.reduce((a, p) => a + p[1], 0) / o.length; return o.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * settings.margin, y + (dy / l) * settings.margin]; }); });
    const g = 1 + settings.gapPad;
    let added = 0;
    for (const sz of sizes) {
      if (sz.label) continue;
      const sc = sz.scale, r = hullR * sc * g;
      if (r < settings.rMin) break;
      let fails = 0;
      for (let k = 0; k < 2500 && fails < settings.patience; k++) {
        const x = area.minX + r + random() * (area.maxX - area.minX - 2 * r), y = area.minY + r + random() * (area.maxY - area.minY - 2 * r);
        const ang = random() * Math.PI * 2;
        const poly = transform(hull, sc * g, ang, x, y);
        let bad = poly.some(([px, py]) => px < area.minX || px > area.maxX || py < area.minY || py > area.maxY) || grown.some((o) => overlap(poly, o));
        if (!bad) for (let i = 0; i < stones.length; i++) { const q = stones[i]; if (Math.hypot(q.x - x, q.y - y) < q.r + r && overlap(poly, polys[i])) { bad = true; break; } }
        if (bad) { fails++; continue; }
        fails = 0; added++;
        stones.push({ x, y, angle: ang, scale: sc, carats: sz.carats, label: null, opacity: settings.minOpacity + random() * (settings.maxOpacity - settings.minOpacity), r: hullR * sc });
        polys.push(transform(hull, sc, ang, x, y));
      }
    }
    stats.gapFilled = added;
  }
  return { stones, stats };
}

/**
 * Hexafoil (flower-of-life) tiling with marquise petals: on a triangular lattice of spacing R,
 * every pair of second neighbours (distance R * sqrt(3)) is joined by a petal across the edge
 * between them, so six petals meet tip to tip at every lattice point. The petal's length is the
 * marquise's length at the chosen size (so R = L / sqrt(3)); a marquise of L:W = sqrt(3) is the
 * exact vesica of the classic figure, longer ones leave slivers between petals.
 * Returns stones like packStones, all at one scale and opacity, centred on the area.
 */
export function hexafoilStones(hull, area, obstacles, scale, opacity, random) {
  const ys = hull.map((p) => p[1]), L = (Math.max(...ys) - Math.min(...ys)) * scale;   // petal length along the stone's y axis
  const R = L / Math.sqrt(3);
  const a = [R, 0], b = [R / 2, (R * Math.sqrt(3)) / 2];
  const dirs = [a, b, [b[0] - a[0], b[1] - a[1]]];
  const excl = obstacles;   // view outlines (convex polygons)
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
      g.position.set(st.x, st.y, 0); g.rotation.z = st.angle;
      if (Array.isArray(st.scale)) g.scale.set(st.scale[0], st.scale[1], 1); else g.scale.setScalar(st.scale);
      const mat = new LineMaterial({ color: 0x000000, linewidth: lineWidth, worldUnits: false, transparent: true, opacity: st.opacity, depthTest: true, depthWrite: true });
      mat.resolution.set(resolution[0], resolution[1]); mats.push(mat);
      if (st.label) {
        g.add(new LineSegments2(outlineGeo, mat));
        const lbl = makeLabel(`${st.label} ct`, 0.42, st.opacity);   // text height: 0.21 of the stone's width
        lbl.position.z = 0.1; lbl.rotation.z = -st.angle;            // keep the number upright
        if (Array.isArray(st.scale)) lbl.scale.set(1 / st.scale[0] * Math.min(...st.scale), 1 / st.scale[1] * Math.min(...st.scale), 1);   // undo the stretch on the text
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

/**
 * Stone sizes to pack, largest first: the chart sizes (labelled when the estimator covers the
 * shape) plus filler sizes. chartDims(carats) -> { length, width } mm from the trade chart, or
 * null: a labelled stone is stretched to those dimensions (stoneL, stoneW: the design's own
 * length and width in its units); unlabelled stones use the estimator.
 */
export function paveSizes(estimator, maxCarats, worldPerMm, labels, chartDims = () => null, stoneL = 2, stoneW = 2) {
  const chart = CHART_CARATS.filter((c) => c <= maxCarats);
  const filler = [maxCarats, 2.5, 1.25, 0.75, 0.4, 0.2, 0.15, 0.1, 0.07, 0.05, 0.03].filter((c) => c <= maxCarats);
  const all = [...new Set([...chart, ...filler])].sort((a, b) => b - a);
  return all.map((carats) => {
    const d = chart.includes(carats) ? chartDims(carats) : null;
    return { carats, scale: (estimator.widthMm(carats) * worldPerMm) / 2, label: labels && chart.includes(carats), labelScale: d ? [(d.width * worldPerMm) / stoneW, (d.length * worldPerMm) / stoneL] : null };
  });
}
