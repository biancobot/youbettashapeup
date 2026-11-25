import * as THREE from '../vendor/three/three.module.js';
import { LineSegments2 } from '../vendor/three/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/lines/LineMaterial.js';
import { designMesh, stoneStats } from './gemcad/mesh.js?v=76';
import { createEditor } from './editor.js?v=76';
import { createUnderlay } from './underlay.js?v=76';
import { templates, plots } from './gemcad/templates.js?v=76';
window.__templates = { templates, plots };
import { VIEWS, getView } from './views.js?v=76';
import { captionFor } from './gemcad/captions.js?v=76';
import { createPave, cobblestoneStonesGen, checkPacking, paveSizes, hexafoilStones, convexHull, rng } from './pave.js?v=76';
import { weightEstimator, weightFamily, chartSize, CHART_SOURCE } from './gemcad/weights.js?v=76';
import { singleCut } from './gemcad/shapes/oldcuts.js?v=76';

// ----------------------------------------------------------------------------- state
const params = new URLSearchParams(location.search);
const state = {
  shapeId: 'design',
  viewId: params.get('view') || 'front',
  lineWidth: parseFloat(params.get('lw') || '1.5'),
  girdleLines: params.get('girdle') !== '0',
  spin: parseFloat(params.get('spin') || '0'),
  exportScale: 2,
  zoom: parseFloat(params.get('zoom') || '1'),
  pan: [0, 0],                     // camera offset across the sheet, world units
  projection: params.get('proj') === 'perspective' ? 'perspective' : 'orthographic',
  fov: parseFloat(params.get('fov') || '30'),
  // Drawing sheet: the base view is the stone as currently rotated; projected views hang off it.
  sheet: {
    standard: params.get('standard') === 'first' ? 'first' : 'third',
    gaps: { left: 0.3, right: 0.3, above: 0.3, below: 0.3 },   // in stone widths, between view bounding boxes
    views: [],                                                 // { id, parent, dir, gap, kind: 'ortho' | '3d', rot, locked, hidden, offset, scale }
    base: { locked: false, hidden: false },                    // the base view's own lock and hidden-line flags
    grid: params.get('grid') === '1',                          // table of cells around the views
    gridMargin: 0.15,                                          // border outside the outermost views, in stone widths
    gridOpacity: parseFloat(params.get('gridopacity') || '0.5'),
    origin: [0, 0],                                            // where the base view sits on the page (world units)
    // Page: a sheet of paper centred on the origin; the stone's width occupies `stoneWidth` inches of it
    page: { enabled: params.get('page') === '1', width: 8.5, height: 8.5, stoneWidth: 2, dpi: 300, fit: 0.8 },
    // Background: cobblestone pavé of the current stone in random sizes and orientations, or a hexafoil of marquises
    text: { auto: true, title: { enabled: false, text: 'Title', font: 'Georgia, serif', size: 28, bold: true, italic: false, align: 'center', width: 0.8, pos: null, locked: false }, description: { enabled: false, text: '', font: 'Georgia, serif', size: 12, bold: false, italic: false, align: 'center', width: 0.6, pos: null, locked: false } },
    pave: { enabled: false, pattern: 'cobblestone', minOpacity: 0.15, maxOpacity: 0.6, maxCarats: 5, minCarats: 0.02, singleBelow: 0.2, mmPerInch: 25.4, margin: 0.03, seedCount: 6, samples: 40, patience: 80, maxCircles: 3000, seed: 1, labels: true, hexCarats: 3, hexOpacity: 0.35, hexCircles: true },
    nextId: 1,
  },
};
if (params.get('ui') === '0') document.body.classList.add('noui');

// ----------------------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setClearColor(0xffffff, 1);

const scene = new THREE.Scene();
const underlay = createUnderlay(scene);
const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
const perspCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
let camera = orthoCamera;

const occluderMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
});
const lineMat = new LineMaterial({ color: 0x000000, linewidth: state.lineWidth, worldUnits: false, depthTest: true, depthWrite: true });
lineMat.resolution.set(1, 1);
const pave = createPave(scene, occluderMat);
// Hidden lines: the same edges drawn light grey only where they lie behind the stone's surface
// (depth test "greater" against the occluder faces); drawn after the faces and before the
// visible lines, so visible black lines stay on top where the two cross.
const hiddenMat = new LineMaterial({ color: 0xbdbdbd, linewidth: state.lineWidth, worldUnits: false, depthTest: true, depthWrite: false });
hiddenMat.depthFunc = THREE.GreaterDepth;
hiddenMat.resolution.set(1, 1);

let geo = null;                 // current shape buffers
let meshGeometry = null, hardGeometry = null;
const baseQ = new THREE.Quaternion();   // orientation of the base view
const instances = new Map();            // view id -> { group, mesh, hard, smooth, lastQ, lastMode, q, pos, bbox }

// --------------------------------------------------------------- projection rotations
// A view projected from its parent is the parent rotated by 90 degrees about a screen axis.
// Third-angle: the view to the right shows the right side; first-angle: it shows the left side.
const q90 = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), (deg * Math.PI) / 180);
const PROJECT = {
  third: { right: q90([0, 1, 0], -90), left: q90([0, 1, 0], 90), above: q90([1, 0, 0], 90), below: q90([1, 0, 0], -90) },
  first: { right: q90([0, 1, 0], 90), left: q90([0, 1, 0], -90), above: q90([1, 0, 0], -90), below: q90([1, 0, 0], 90) },
};
const DIR_LABEL = { left: 'Left of', right: 'Right of', above: 'Above', below: 'Below' };
// A 3D (pictorial) view hangs off its parent like a projected view but is the parent tilted by
// its own rotation, initially the isometric tilt; dragging over it changes that rotation alone.
const ISO_TILT = () => getView('iso').q.clone();

function allViewIds() { return ['base', ...state.sheet.views.map((v) => v.id)]; }

function makeInstance(id) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(meshGeometry, occluderMat);
  const hard = new LineSegments2(hardGeometry, lineMat);
  const smooth = new LineSegments2(new LineSegmentsGeometry().setPositions(new Float32Array(6)), lineMat);
  smooth.visible = false;
  const hiddenHard = new LineSegments2(hardGeometry, hiddenMat);
  const hiddenSmooth = new LineSegments2(new LineSegmentsGeometry().setPositions(new Float32Array(6)), hiddenMat);
  hiddenHard.visible = false; hiddenSmooth.visible = false;
  mesh.renderOrder = 0; hiddenHard.renderOrder = 1; hiddenSmooth.renderOrder = 1; hard.renderOrder = 2; smooth.renderOrder = 2;
  group.add(mesh, hiddenHard, hiddenSmooth, hard, smooth);
  scene.add(group);
  const inst = { id, group, mesh, hard, smooth, hiddenHard, hiddenSmooth, lastQ: null, lastMode: null, q: new THREE.Quaternion(), pos: [0, 0], bbox: null, scale: 1 };
  instances.set(id, inst);
  return inst;
}

function disposeInstances() {
  for (const inst of instances.values()) {
    scene.remove(inst.group);
    inst.smooth.geometry.dispose();
    inst.hiddenSmooth.geometry.dispose();
  }
  instances.clear();
}

let design = null;
function setDesign(d) {
  design = d;
  disposeInstances();
  if (meshGeometry) meshGeometry.dispose();
  if (hardGeometry) hardGeometry.dispose();
  geo = designMesh(d);
  meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
  hardGeometry = new LineSegmentsGeometry().setPositions(geo.hardEdges);
  for (const vid of allViewIds()) makeInstance(vid);
  state.shapeId = (d.name || 'design').replace(/[^\w-]+/g, '_').toLowerCase();
  if (state.sheet.text.auto) applyCaption();   // the shape's publishable caption, until the user writes their own
  selectedVertex = null;
  updateProps();
  layout(true);
  updateMeetPoints();
}

// ----------------------------------------------------------------------------- meet points
let selectedVertex = null;
let meetPoints = null, meetMarker = null;
const meetMat = new THREE.PointsMaterial({ color: 0x2563eb, size: 7, sizeAttenuation: false, depthTest: false });
const markerMat = new THREE.PointsMaterial({ color: 0xdc2626, size: 13, sizeAttenuation: false, depthTest: false });
function updateMeetPoints() {
  const base = instances.get('base');
  if (!base || !geo) return;
  if (meetPoints) { base.group.remove(meetPoints); meetPoints.geometry.dispose(); meetPoints = null; }
  if (meetMarker) { base.group.remove(meetMarker); meetMarker.geometry.dispose(); meetMarker = null; }
  if (!state.showMeet) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(geo.vertices, 3));
  meetPoints = new THREE.Points(g, meetMat); meetPoints.renderOrder = 10; base.group.add(meetPoints);
  if (selectedVertex) {
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(selectedVertex), 3));
    meetMarker = new THREE.Points(m, markerMat); meetMarker.renderOrder = 11; base.group.add(meetMarker);
  }
}
function pickVertex(clientX, clientY) {
  const base = instances.get('base'); if (!base || !geo) return null;
  const rect = canvas.getBoundingClientRect();
  const v = new THREE.Vector3(); let best = null, bd = 14;
  for (let i = 0; i < geo.verts.length; i++) {
    v.set(...geo.verts[i]).applyQuaternion(base.q).add(new THREE.Vector3(base.pos[0], base.pos[1], 0)).project(camera);
    const sx = rect.left + (v.x + 1) / 2 * rect.width, sy = rect.top + (1 - v.y) / 2 * rect.height;
    const d = Math.hypot(sx - clientX, sy - clientY);
    if (d < bd) { bd = d; best = geo.verts[i]; }
  }
  return best;
}

function syncInstances() {
  const ids = allViewIds();
  for (const id of ids) if (!instances.has(id)) makeInstance(id);
  for (const id of [...instances.keys()]) {
    if (!ids.includes(id)) {
      const inst = instances.get(id);
      scene.remove(inst.group);
      inst.smooth.geometry.dispose();
      inst.hiddenSmooth.geometry.dispose();
      instances.delete(id);
    }
  }
}

/** Smooth girdle edges are drawn only where the girdle turns away from the viewer. */
/** Positions of the girdle (smooth) edges to draw for rotation qn: all of them, or only the silhouette. */
function smoothEdgesFor(qn, g = geo) {
  const s = g.smooth;
  const n = s.normalsA.length / 3;
  const out = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let draw = state.girdleLines;
    if (!draw) {
      va.set(s.normalsA[3 * i], s.normalsA[3 * i + 1], s.normalsA[3 * i + 2]).applyQuaternion(qn);
      vb.set(s.normalsB[3 * i], s.normalsB[3 * i + 1], s.normalsB[3 * i + 2]).applyQuaternion(qn);
      draw = (va.z > 0) !== (vb.z > 0);
    }
    if (draw) for (let k = 0; k < 6; k++) out.push(s.positions[6 * i + k]);
  }
  return out;
}
function updateSilhouette(inst, force) {
  const qn = inst.q;
  if (!force && inst.lastQ && inst.lastQ.equals(qn) && inst.lastMode === state.girdleLines) return;
  inst.lastQ = qn.clone();
  inst.lastMode = state.girdleLines;
  const s = geo.smooth;
  const out = smoothEdgesFor(qn);
  inst.smooth.geometry.dispose();
  if (out.length) {
    inst.smooth.geometry = new LineSegmentsGeometry().setPositions(new Float32Array(out));
    inst.smooth.visible = true;
  } else {
    inst.smooth.geometry = new LineSegmentsGeometry().setPositions(new Float32Array(6));
    inst.smooth.visible = false;
  }
  // hidden girdle lines: every girdle edge when the girdle lines are on, otherwise none (a
  // silhouette has no hidden part)
  inst.hiddenSmooth.geometry.dispose();
  inst.hiddenSmooth.geometry = state.girdleLines && s.positions.length ? new LineSegmentsGeometry().setPositions(s.positions) : new LineSegmentsGeometry().setPositions(new Float32Array(6));
}
/** Show or hide an instance's hidden-line pass. */
function applyHidden(inst, on) {
  inst.hiddenHard.visible = on;
  inst.hiddenSmooth.visible = on && state.girdleLines;
}

/** Screen-space bounding box of the stone under rotation q. */
function bboxFor(q) {
  const v = new THREE.Vector3();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const a = geo.vertices;
  for (let i = 0; i < a.length; i += 3) {
    v.set(a[i], a[i + 1], a[i + 2]).applyQuaternion(q);
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

let overall = { minX: -1, minY: -1, maxX: 1, maxY: 1 };

// ----------------------------------------------------------------------------- sheet grid
// A table whose cells hold the views: views whose horizontal extents overlap share a column,
// views whose vertical extents overlap share a row; lines run midway between neighbouring
// columns and rows, with a border a margin outside the outermost views.
const gridMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: state.sheet.gridOpacity, depthTest: false });
const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
gridLines.renderOrder = -1; gridLines.visible = false; scene.add(gridLines);
/** Merge overlapping intervals [a, b] into sorted disjoint bands. */
function bands(intervals) {
  const sorted = intervals.slice().sort((p, q) => p[0] - q[0]); const out = [];
  for (const [a, b] of sorted) { const last = out[out.length - 1]; if (last && a <= last[1]) last[1] = Math.max(last[1], b); else out.push([a, b]); }
  return out;
}
/** Page rectangle in world units, centred on the origin (the stone's width, 2 units, is `stoneWidth` inches). */
function pageRect() {
  const pg = state.sheet.page, k = 2 / pg.stoneWidth;   // world units per inch
  const w = pg.width * k, h = pg.height * k;
  return { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2, k };
}
const pageMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthTest: false });
const pageLines = new THREE.LineSegments(new THREE.BufferGeometry(), pageMat);
pageLines.renderOrder = -2; pageLines.visible = false; scene.add(pageLines);
function updatePage() {
  const pg = state.sheet.page;
  pageLines.visible = pg.enabled;   // the page outline is always drawn (and exported) with the page
  if (!pg.enabled) return;
  const r = pageRect();
  const pts = [r.minX, r.minY, -4.5, r.maxX, r.minY, -4.5, r.maxX, r.minY, -4.5, r.maxX, r.maxY, -4.5, r.maxX, r.maxY, -4.5, r.minX, r.maxY, -4.5, r.minX, r.maxY, -4.5, r.minX, r.minY, -4.5];
  pageLines.geometry.dispose();
  pageLines.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}
// ----------------------------------------------------------------------------- text blocks
// A title and a description drawn on the sheet as text rendered to a canvas texture on a plane,
// so they export with the page and the pavé flows round them. Sizes are in points at the page
// scale (1 pt = 1/72 in); the canvas is rendered at TEXT_PX_PER_INCH so a 300 DPI export is crisp.
const TEXT_PX_PER_INCH = 300;
const TEXT_IDS = ['title', 'description'];
const textBlocks = new Map();   // id -> { mesh, canvas, texture, key, w, h }
/** Break text into lines that fit maxWidth (canvas px), on words, honouring newlines. */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = words[0];
    for (const w of words.slice(1)) { const t = line + ' ' + w; if (ctx.measureText(t).width <= maxWidth) line = t; else { lines.push(line); line = w; } }
    lines.push(line);
  }
  return lines;
}
/** Render a block's text to its canvas; returns the block's size in world units. */
function renderTextBlock(tb, b, k, wrapWorld) {
  const px = (b.size / 72) * TEXT_PX_PER_INCH, pxPerWorld = TEXT_PX_PER_INCH / k;
  const font = `${b.italic ? 'italic ' : ''}${b.bold ? 'bold ' : ''}${px}px ${b.font}`;
  const ctx = tb.canvas.getContext('2d');
  ctx.font = font;
  const maxW = Math.max(px, b.width * wrapWorld * pxPerWorld);
  const lines = wrapText(ctx, b.text, maxW);
  const lineH = px * 1.25, pad = px * 0.25;
  const textW = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
  const cw = Math.ceil(Math.min(maxW, textW) + 2 * pad), ch = Math.ceil(lines.length * lineH + 2 * pad);
  tb.canvas.width = cw; tb.canvas.height = ch;
  ctx.clearRect(0, 0, cw, ch);
  ctx.font = font; ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  // draw character by character (so the glyph boxes below match what is drawn) and record each
  // glyph's ink box, canvas px: the pavé packs up to the letters, not the block's rectangle
  const glyphs = [];
  lines.forEach((l, i) => {
    const lw = ctx.measureText(l).width, base = pad + (i + 1) * lineH - px * 0.3;
    let x = b.align === 'left' ? pad : b.align === 'right' ? cw - pad - lw : (cw - lw) / 2;
    for (const chr of l) {
      const m = ctx.measureText(chr);
      if (chr.trim()) { ctx.fillText(chr, x, base); glyphs.push([x - (m.actualBoundingBoxLeft || 0), base - (m.actualBoundingBoxAscent || px * 0.7), x + (m.actualBoundingBoxRight || m.width), base + (m.actualBoundingBoxDescent || 0)]); }
      x += m.width;
    }
  });
  tb.glyphs = glyphs;
  tb.texture.needsUpdate = true;
  tb.w = cw / pxPerWorld; tb.h = ch / pxPerWorld; tb.pxPerWorld = pxPerWorld;
}
/** Where a block goes when it has no position yet: the title near the top of the page, the description under it. */
function defaultTextPos(id, h) {
  const r = pageRect(), k = r.k;
  const top = state.sheet.page.enabled ? r.maxY : (isFinite(overall.maxY) ? overall.maxY + 0.5 * k : 0.5 * k);
  if (id === 'title' || !state.sheet.text.title.rect) return [0, top - 0.6 * k - h / 2];
  return [0, state.sheet.text.title.rect.minY - 0.15 * k - h / 2];
}
function updateText() {
  const r = pageRect(), k = r.k;
  const wrapWorld = state.sheet.page.enabled ? r.maxX - r.minX : Math.max(2, isFinite(overall.maxX) ? overall.maxX - overall.minX : 2);
  for (const id of TEXT_IDS) {
    const b = state.sheet.text[id];
    let tb = textBlocks.get(id);
    if (!b.enabled || !String(b.text).trim()) { if (tb) tb.mesh.visible = false; b.rect = null; b.glyphs = null; continue; }
    if (!tb) {
      const canvas = document.createElement('canvas'), texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
      mesh.renderOrder = 20; scene.add(mesh);
      tb = { mesh, canvas, texture, key: null, w: 1, h: 1 }; textBlocks.set(id, tb);
    }
    const key = JSON.stringify([b.text, b.font, b.size, b.bold, b.italic, b.align, b.width, k, wrapWorld]);
    if (tb.key !== key) { renderTextBlock(tb, b, k, wrapWorld); tb.key = key; }
    if (!b.pos) b.pos = defaultTextPos(id, tb.h);
    tb.mesh.position.set(b.pos[0], b.pos[1], 4); tb.mesh.scale.set(tb.w, tb.h, 1); tb.mesh.visible = true;
    b.rect = { minX: b.pos[0] - tb.w / 2, maxX: b.pos[0] + tb.w / 2, minY: b.pos[1] - tb.h / 2, maxY: b.pos[1] + tb.h / 2 };
    // the glyph boxes in world coordinates (canvas y runs down), counter-clockwise polygons for the packer
    const ox = b.rect.minX, oy = b.rect.maxY, k1 = 1 / tb.pxPerWorld;
    b.glyphs = tb.glyphs.map(([x0, y0, x1, y1]) => [[ox + x0 * k1, oy - y1 * k1], [ox + x1 * k1, oy - y1 * k1], [ox + x1 * k1, oy - y0 * k1], [ox + x0 * k1, oy - y0 * k1]]);
  }
}
/** Fill the title and description from the current shape's caption (publishable, descriptive wording). */
function applyCaption() {
  const c = captionFor(typeof editor !== 'undefined' && editor ? editor.templateKey : '', design ? design.name : '');
  state.sheet.text.title.text = c.title; state.sheet.text.description.text = c.description;
  const t = document.getElementById('tttext'), d = document.getElementById('tdtext');
  if (t) t.value = c.title; if (d) d.value = c.description;
  for (const id of TEXT_IDS) { const tb = textBlocks.get(id); if (tb) tb.key = null; }
}
/** The text block under a screen point, if any. */
function hitText(clientX, clientY) {
  if (camera !== orthoCamera) return null;
  const rect = canvas.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1, ny = 1 - ((clientY - rect.top) / rect.height) * 2;
  const wx = camera.position.x + (nx * (camera.right - camera.left)) / 2, wy = camera.position.y + (ny * (camera.top - camera.bottom)) / 2;
  for (const id of TEXT_IDS) { const b = state.sheet.text[id]; if (b.rect && wx >= b.rect.minX && wx <= b.rect.maxX && wy >= b.rect.minY && wy <= b.rect.maxY) return b; }
  return null;
}
/** Centre a text block on the page: axis 'x' horizontally, 'y' vertically. */
function snapCentreText(id, axis) {
  const b = state.sheet.text[id]; if (!b.pos) return;
  const r = pageRect();
  if (axis === 'x') b.pos[0] = (r.minX + r.maxX) / 2; else b.pos[1] = (r.minY + r.maxY) / 2;
  layout(true);
}
/** Put a text block back at its default place. */
function resetTextPos(id) { state.sheet.text[id].pos = null; layout(true); }

// ----------------------------------------------------------------------------- pavé background
let paveInfo = { count: 0, note: '' };
function paveArea() {
  if (state.sheet.page.enabled) { const r = pageRect(); return { minX: r.minX, maxX: r.maxX, minY: r.minY, maxY: r.maxY }; }
  const w = overall.maxX - overall.minX, h = overall.maxY - overall.minY;   // no page: a generous border round the sheet
  return { minX: overall.minX - 0.75 * w, maxX: overall.maxX + 0.75 * w, minY: overall.minY - 0.75 * h, maxY: overall.maxY + 0.75 * h };
}
/** The views' outlines on the sheet (convex hull of each view's projected vertices), the obstacles the background flows round. */
function paveObstacles() {
  const v = new THREE.Vector3(), out = [];
  for (const inst of instances.values()) {
    const pts = [], a = geo.vertices, sc = inst.scale || 1;
    for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]).applyQuaternion(inst.q); pts.push([inst.pos[0] + v.x * sc, inst.pos[1] + v.y * sc]); }
    out.push(convexHull(pts));
  }
  for (const id of TEXT_IDS) { const b = state.sheet.text[id]; if (b.rect && b.glyphs) out.push(...b.glyphs); }   // one box per letter, so the stones pack up to the characters
  return out;
}
function updatePave() {
  const pv = state.sheet.pave;
  pave.visible = pv.enabled;
  if (!pv.enabled || !geo || !design) { pave.job = null; paveInfo = { count: 0, note: '', busy: false }; renderPaveInfo(); return; }
  const st = stoneStats(geo, design);
  const est = weightEstimator(design.name, st.ratio, st.depth);
  const family = weightFamily(design.name);
  const pattern = pv.pattern === 'hexafoil' && family === 'marquise' ? 'hexafoil' : 'cobblestone';
  // sizes: the estimator's millimetre widths at the page's scale; shapes without an estimator use the round factor, unlabelled
  const sizer = est || weightEstimator('round', st.ratio, st.depth);
  const worldPerMm = pageRect().k / pv.mmPerInch;
  const area = paveArea(), obstacles = paveObstacles();
  const r3 = (v) => Math.round(v * 50) / 50;
  const key = JSON.stringify([state.shapeId, geo.faceCount, state.girdleLines, pattern, pv, [area.minX, area.maxX, area.minY, area.maxY].map(r3), obstacles.map((o) => [o.length, ...o[0].map(r3), ...o[Math.floor(o.length / 2)].map(r3)]), [...instances.values()].map((i) => [i.pos.map(r3), i.scale]), st.W, st.L]);
  // the face-up outline (convex hull of the stone's plan) and its edges
  const pts = []; for (let i = 0; i < geo.vertices.length; i += 3) pts.push([geo.vertices[i], geo.vertices[i + 1]]);
  const hull = convexHull(pts);
  const hullEdges = []; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; hullEdges.push(a[0], a[1], 0, b[0], b[1], 0); }
  let stones, check = null, circles = null;
  // the hexafoil is offered only on a marquise page
  const hexOpt = document.querySelector('#pavepattern option[value="hexafoil"]'); if (hexOpt) hexOpt.disabled = family !== 'marquise';
  if (pattern === 'hexafoil') { stones = hexafoilStones(hull, area, obstacles, (sizer.widthMm(pv.hexCarats) * worldPerMm) / 2, pv.hexOpacity, rng(pv.seed), pv.hexCircles); circles = stones.circles; }
  else {
    // circle radii from carat weights: the circumscribed circle of the stone at that weight
    const hullR = Math.max(...hull.map(([x, y]) => Math.hypot(x, y)));
    const rOf = (ct) => (hullR * sizer.widthMm(ct) * worldPerMm) / 2;
    // melee as single cuts only on a round page: with any other shape the small stones stay that shape
    const roundPage = family === 'round' || /single cut/i.test(design.name);
    const settings = { ...pv, rMin: rOf(pv.minCarats), rMax: rOf(pv.maxCarats), rSingle: roundPage ? rOf(pv.singleBelow) : 0, seedMin: rOf(pv.maxCarats) * 0.6, margin: pv.margin * 2, gapPad: 0.04 };
    if (pave.lastKey !== key) {
      // the packing takes seconds on a full page: run it in time slices so the page keeps drawing
      // and the info line shows progress; a newer request replaces the job in flight
      if (pave.job && pave.job.key === key) return;
      const t0 = performance.now();
      const gen = cobblestoneStonesGen(hull, area, obstacles, paveSizes(sizer, pv.maxCarats, worldPerMm, pv.labels && !!est, (c) => chartSize(family, c, st.ratio), st.L, st.W), settings, rng(pv.seed));
      const job = { key, t0, progress: { placed: 0 } };
      pave.job = job;
      const finish = (res) => {
        if (pave.job !== job) return;   // superseded
        pave.job = null;
        const check = { ...checkPacking(res.stones.slice(0, res.stones.length - (res.stats.gapFilled || 0)).map((q) => ({ x: q.x, y: q.y, r: q.r })), area, obstacles, settings.margin), gapFilled: res.stats.gapFilled || 0, ms: Math.round(performance.now() - t0) };
        pave.lastCheck = check; pave.lastStones = res.stones;
        finishPave(res.stones, check);
      };
      const pump = () => {
        if (pave.job !== job) return;
        const slice = performance.now();
        let r = gen.next();
        while (!r.done && performance.now() - slice < 25) { job.progress = r.value; r = gen.next(); }
        if (r.done) { finish(r.value); return; }
        job.progress = r.value;
        paveInfo = { count: job.progress.placed, check: null, note: `Packing the pavé: ${job.progress.placed} stones placed${job.progress.fitting ? `, fitting ${job.progress.fitting} ct stones into the gaps` : ''} (${((performance.now() - t0) / 1000).toFixed(1)} s)…`, busy: true };
        renderPaveInfo();
        setTimeout(pump, 0);
      };
      paveInfo = { count: 0, check: null, note: 'Packing the pavé…', busy: true };
      renderPaveInfo();
      setTimeout(pump, 0);
      return;
    }
    stones = pave.lastStones; check = pave.lastCheck;
  }
  pave.job = null;
  finishPave(stones, check);
  function finishPave(stones, check) {
  // melee geometry: a round single cut (bruted round girdle) for the stones under the threshold
  if (!updatePave.single || updatePave.single.girdleLines !== state.girdleLines) {
    const sg = designMesh(singleCut({ girdleFacets: 64 }));
    updatePave.single = { girdleLines: state.girdleLines, meshPositions: sg.positions, hardEdges: sg.hardEdges, smoothPositions: new Float32Array(smoothEdgesFor(new THREE.Quaternion(), sg)) };
  }
  pave.build({ key, stones, circles, circleOpacity: pv.hexOpacity, meshPositions: geo.positions, hardEdges: geo.hardEdges, smoothPositions: new Float32Array(smoothEdgesFor(new THREE.Quaternion())), hullEdges: new Float32Array(hullEdges), single: updatePave.single });
  pave.lastKey = key;
  const singles = stones.filter((q) => q.kind === 'single').length;
  const packNote = check ? `${singles ? ` ${singles} stones under ${pv.singleBelow} ct are single cuts.` : ''} Packing: ${check.count} circles, ${check.tangent2} touching two or more boundaries, ${check.overlaps} overlaps, ${check.intrusions} intrusions${check.gapFilled ? `, plus ${check.gapFilled} smaller stones fitted into the circles' corners` : ''} (${check.ms} ms).` : '';
  paveInfo = { count: stones.length, check, busy: false, note: pattern === 'hexafoil' ? `Hexafoil: ${stones.length} marquises of ${pv.hexCarats} ct (${(sizer.widthMm(pv.hexCarats) * st.ratio).toFixed(1)} x ${sizer.widthMm(pv.hexCarats).toFixed(1)} mm) on circles of radius ${((stones.R / worldPerMm) || 0).toFixed(1)} mm${circles ? `, ${circles.length} circles drawn` : ''}.` : (est ? `${stones.length} stones, ${est.label} estimator (factor ${est.factor.toFixed(5)}): 1 ct is ${est.widthMm(1).toFixed(2)} mm wide, 5 ct ${est.widthMm(5).toFixed(2)} mm; the labelled outlines use the ${CHART_SOURCE} dimensions${chartSize(family, 1, st.ratio) ? ` (1 ct ${chartSize(family, 1, st.ratio).length.toFixed(1)} x ${chartSize(family, 1, st.ratio).width.toFixed(1)} mm)` : ''}.` : `${stones.length} stones; no weight estimator covers this shape, so sizes use the round factor and no carat labels are drawn.`) + packNote };
  renderPaveInfo();
  }
}
function renderPaveInfo() {
  const el = document.getElementById('paveinfo'); if (el) el.textContent = paveInfo.note;
  const bar = document.getElementById('paveprogress'); if (bar) bar.hidden = !paveInfo.busy;
}
function updateGrid() {
  gridLines.visible = state.sheet.grid && instances.size > 0;
  if (!gridLines.visible) return;
  const xs = [], ys = [];
  for (const inst of instances.values()) { xs.push([inst.pos[0] + inst.bbox.minX, inst.pos[0] + inst.bbox.maxX]); ys.push([inst.pos[1] + inst.bbox.minY, inst.pos[1] + inst.bbox.maxY]); }
  const cols = bands(xs), rows = bands(ys), m = state.sheet.gridMargin * 2;   // stone widths -> world units (width = 2)
  const x0 = overall.minX - m, x1 = overall.maxX + m, y0 = overall.minY - m, y1 = overall.maxY + m;
  const vx = [x0, x1], hy = [y0, y1];
  for (let i = 0; i + 1 < cols.length; i++) vx.push((cols[i][1] + cols[i + 1][0]) / 2);
  for (let i = 0; i + 1 < rows.length; i++) hy.push((rows[i][1] + rows[i + 1][0]) / 2);
  const pts = [];
  for (const x of vx) pts.push(x, y0, -4, x, y1, -4);
  for (const y of hy) pts.push(x0, y, -4, x1, y, -4);
  gridLines.geometry.dispose();
  gridLines.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  gridMat.opacity = state.sheet.gridOpacity;
  gridLines.userData.cells = (cols.length) * (rows.length);
}

/** Recompute orientations and positions of every view, then the camera. */
function layout(force) {
  if (!geo) return;
  syncInstances();
  const base = instances.get('base');
  // spin about the stone's own table axis, applied before the view rotation
  base.q.copy(baseQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (state.spin * Math.PI) / 180));
  base.pos = [state.sheet.origin[0], state.sheet.origin[1]];
  base.bbox = bboxFor(base.q);
  base.scale = 1;
  applyHidden(base, state.sheet.base.hidden);
  const placed = [];   // views laid out so far, to stack siblings that share a side of the same parent
  for (const v of state.sheet.views) {
    const parent = instances.get(v.parent);
    const inst = instances.get(v.id);
    inst.q.copy(v.kind === '3d' ? v.rot : PROJECT[state.sheet.standard][v.dir]).multiply(parent.q);
    inst.scale = v.kind === '3d' ? v.scale || 1 : 1;
    inst.bbox = bboxFor(inst.q);
    if (inst.scale !== 1) for (const k of ['minX', 'minY', 'maxX', 'maxY']) inst.bbox[k] *= inst.scale;
    applyHidden(inst, !!v.hidden);
    const gap = v.gap ?? state.sheet.gaps[v.dir];
    // anchor: the parent, or the outermost earlier sibling on the same side, so views on one side line up outward
    const sibling = placed.filter((w) => w.parent === v.parent && w.dir === v.dir).pop();
    const anchor = sibling ? instances.get(sibling.id) : parent;
    placed.push(v);
    const pb = anchor.bbox, cb = inst.bbox, pp = anchor.pos;
    if (v.dir === 'right') inst.pos = [pp[0] + pb.maxX + gap - cb.minX, pp[1]];
    else if (v.dir === 'left') inst.pos = [pp[0] + pb.minX - gap - cb.maxX, pp[1]];
    else if (v.dir === 'above') inst.pos = [pp[0], pp[1] + pb.maxY + gap - cb.minY];
    else inst.pos = [pp[0], pp[1] + pb.minY - gap - cb.maxY];
    if (v.kind === '3d' && v.offset) { inst.pos[0] += v.offset[0]; inst.pos[1] += v.offset[1]; }   // dragged to a new place
  }
  overall = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const inst of instances.values()) {
    inst.group.quaternion.copy(inst.q);
    inst.group.position.set(inst.pos[0], inst.pos[1], 0);
    inst.group.scale.setScalar(inst.scale || 1);
    updateSilhouette(inst, force);
    overall.minX = Math.min(overall.minX, inst.pos[0] + inst.bbox.minX);
    overall.maxX = Math.max(overall.maxX, inst.pos[0] + inst.bbox.maxX);
    overall.minY = Math.min(overall.minY, inst.pos[1] + inst.bbox.minY);
    overall.maxY = Math.max(overall.maxY, inst.pos[1] + inst.bbox.maxY);
  }
  updateGrid();
  updatePage();
  updateText();
  if (force) updatePave();
  updateCamera(stage.clientWidth, stage.clientHeight);
  const b = instances.get('base');
  if (b && geo) underlay.place(geo.bbox, b.pos, state.viewId);
  if (typeof autosave === 'function') autosave();
}

// ----------------------------------------------------------------------------- camera / size
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  updateCamera(w, h);
  lineMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  hiddenMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  pave.setResolution(renderer.domElement.width, renderer.domElement.height);
}

function updateCamera(w, h) {
  const aspect = w / h;
  let cx = (overall.minX + overall.maxX) / 2, cy = (overall.minY + overall.maxY) / 2;
  const gm = state.sheet.grid ? state.sheet.gridMargin * 2 : 0;   // keep the grid border in view
  let ex = (overall.maxX - overall.minX) / 2 + gm, ey = (overall.maxY - overall.minY) / 2 + gm;
  if (state.sheet.page.enabled) { const r = pageRect(); cx = 0; cy = 0; ex = (r.maxX - r.minX) / 2; ey = (r.maxY - r.minY) / 2; }   // frame the page
  cx += state.pan[0]; cy += state.pan[1];
  // half-height of the view in world units: fit the sheet (or the page) with a margin
  let half = Math.max(ey, ex / aspect) * (state.sheet.page.enabled ? 1.04 : 1.12) / state.zoom;
  if (!isFinite(half) || half <= 0) half = 1;
  const multi = state.sheet.views.length > 0;
  if (state.projection === 'perspective' && !multi) {
    camera = perspCamera;
    camera.fov = state.fov;
    camera.aspect = aspect;
    const d = half / Math.tan((state.fov * Math.PI) / 360);
    camera.position.set(cx, cy, d);
    camera.near = Math.max(0.01, d - 4);
    camera.far = d + 4;
    camera.lookAt(cx, cy, 0);
  } else {
    camera = orthoCamera;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.position.set(cx, cy, 5);
    camera.lookAt(cx, cy, 0);
  }
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(stage);

// ----------------------------------------------------------------------------- rotation
let drag = null;
/** The 3D view under a pointer position (world-space bounding boxes), or null for the base. */
function hitView3d(clientX, clientY) {
  if (camera !== orthoCamera || !state.sheet.views.some((v) => v.kind === '3d')) return null;
  const rect = canvas.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1, ny = 1 - ((clientY - rect.top) / rect.height) * 2;
  const wx = camera.position.x + (nx * (camera.right - camera.left)) / 2, wy = camera.position.y + (ny * (camera.top - camera.bottom)) / 2;
  let best = null, bestArea = Infinity;
  for (const v of state.sheet.views) {
    if (v.kind !== '3d') continue;
    const inst = instances.get(v.id); if (!inst || !inst.bbox) continue;
    const b = inst.bbox, p = inst.pos;
    if (wx < p[0] + b.minX || wx > p[0] + b.maxX || wy < p[1] + b.minY || wy > p[1] + b.maxY) continue;
    const area = (b.maxX - b.minX) * (b.maxY - b.minY);
    if (area < bestArea) { best = v; bestArea = area; }
  }
  return best;
}
canvas.addEventListener('pointerdown', (e) => {
  const pan = e.button === 1 || e.button === 2 || e.ctrlKey || e.metaKey;   // middle or right button, or ctrl/cmd-drag: pan the sheet
  const text = pan ? null : hitText(e.clientX, e.clientY);
  drag = { x: e.clientX, y: e.clientY, roll: e.shiftKey, move: e.altKey, pan, moved: false, text, view3d: pan || text ? null : hitView3d(e.clientX, e.clientY) };
  canvas.setPointerCapture(e.pointerId);
  if (pan) e.preventDefault();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
/** World units per CSS pixel of the current orthographic camera. */
function worldPerPixel() { const rect = canvas.getBoundingClientRect(); return (camera.right - camera.left) / rect.width; }
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  if (!drag.moved) return;
  if (drag.pan) {   // pan the camera across the sheet
    const wpp = worldPerPixel();
    state.pan[0] -= dx * wpp; state.pan[1] += dy * wpp;
    drag.x = e.clientX; drag.y = e.clientY; resize(); return;
  }
  if (drag.text) {   // a drag over a text block moves it (no modifier needed); a locked block stays put
    if (!drag.text.locked) { const wpp = worldPerPixel(); drag.text.pos[0] += dx * wpp; drag.text.pos[1] -= dy * wpp; layout(false); }
    drag.x = e.clientX; drag.y = e.clientY; return;
  }
  // locks: a locked 3D view ignores the drag; a locked base ignores drags everywhere else (the projected views follow it)
  if (drag.view3d ? drag.view3d.locked : state.sheet.base.locked) { drag.x = e.clientX; drag.y = e.clientY; return; }
  if (drag.move) {   // alt-drag: move the 3D view on the sheet, or the whole arrangement (the base and everything hung off it)
    const wpp = worldPerPixel();
    if (drag.view3d) { const v = drag.view3d; v.offset = v.offset || [0, 0]; v.offset[0] += dx * wpp; v.offset[1] -= dy * wpp; }
    else { state.sheet.origin[0] += dx * wpp; state.sheet.origin[1] -= dy * wpp; }
    drag.x = e.clientX; drag.y = e.clientY; layout(false); return;
  }
  const rect = canvas.getBoundingClientRect();
  const target = drag.view3d ? drag.view3d.rot : baseQ;   // a 3D view rotates on its own; anything else rotates the base
  if (drag.roll) {
    let cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    if (drag.view3d) {   // roll about the 3D view's own centre
      const inst = instances.get(drag.view3d.id), b = inst.bbox;
      const sx = rect.width / (camera.right - camera.left), sy = rect.height / (camera.top - camera.bottom);
      cx = rect.left + rect.width / 2 + (inst.pos[0] + (b.minX + b.maxX) / 2 - camera.position.x) * sx;
      cy = rect.top + rect.height / 2 - (inst.pos[1] + (b.minY + b.maxY) / 2 - camera.position.y) * sy;
    }
    const a0 = Math.atan2(drag.y - cy, drag.x - cx), a1 = Math.atan2(e.clientY - cy, e.clientX - cx);
    target.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(a1 - a0)));
  } else {
    const k = 0.008;
    target.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k));
    target.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k));
  }
  drag.x = e.clientX; drag.y = e.clientY;
  anim = null;
  if (!drag.view3d) { state.viewId = 'custom'; markView(); }
  layout(false);
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && drag.moved && state.sheet.pave.enabled && !drag.pan) layout(true);   // the free area changed: repack the pavé
  if (drag && !drag.moved) {
    const v = pickVertex(e.clientX, e.clientY);
    selectedVertex = v;
    updateMeetPoints();
    const info = document.getElementById('info');
    if (info) info.textContent = v ? `Meet point: (${v.map((c) => c.toFixed(4)).join(', ')})` : '';
  }
  drag = null;
});
const endDrag = () => { drag = null; };
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const v = hitView3d(e.clientX, e.clientY);
  if (v) {   // the wheel over a 3D view scales that view; elsewhere it zooms the sheet
    if (v.locked) return;
    v.scale = Math.min(5, Math.max(0.2, (v.scale || 1) * Math.exp(-e.deltaY * 0.0015)));
    renderViewList(); layout(true); return;
  }
  // zoom about the cursor: the world point under it stays put
  const rect = canvas.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1, ny = 1 - ((e.clientY - rect.top) / rect.height) * 2;
  const before = [camera.position.x + (nx * (camera.right - camera.left)) / 2, camera.position.y + (ny * (camera.top - camera.bottom)) / 2];
  state.zoom = Math.min(20, Math.max(0.2, state.zoom * Math.exp(-e.deltaY * 0.0015)));
  resize();
  if (camera === orthoCamera) {
    const after = [camera.position.x + (nx * (camera.right - camera.left)) / 2, camera.position.y + (ny * (camera.top - camera.bottom)) / 2];
    state.pan[0] += before[0] - after[0]; state.pan[1] += before[1] - after[1];
    resize();
  }
}, { passive: false });
/** Fit the sheet (or the page) in the preview again. */
function fitView() { state.zoom = 1; state.pan = [0, 0]; resize(); }
/**
 * Scale all the views together so the whole arrangement spans `fraction` of the page (of its
 * height or width, whichever binds) and centre it: sets the page's stone width and the origin.
 */
function fitViewsToPage(fraction = state.sheet.page.fit) {
  const pg = state.sheet.page; if (!instances.size) return;
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const inst of instances.values()) { bb[0] = Math.min(bb[0], inst.pos[0] + inst.bbox.minX); bb[1] = Math.min(bb[1], inst.pos[1] + inst.bbox.minY); bb[2] = Math.max(bb[2], inst.pos[0] + inst.bbox.maxX); bb[3] = Math.max(bb[3], inst.pos[1] + inst.bbox.maxY); }
  const wStone = (bb[2] - bb[0]) / 2, hStone = (bb[3] - bb[1]) / 2;   // arrangement size in stone widths
  pg.stoneWidth = Math.min((fraction * pg.height) / hStone, (fraction * pg.width) / wStone);
  // centre: the arrangement's extent in world units does not change with the stone width, so shift the origin by its centre
  state.sheet.origin[0] -= (bb[0] + bb[2]) / 2; state.sheet.origin[1] -= (bb[1] + bb[3]) / 2;
  const el = document.getElementById('pagestone'); if (el) el.value = pg.stoneWidth.toFixed(3);
  layout(true);
}

let anim = null;
function snapTo(viewId, instant = false) {
  const v = getView(viewId);
  state.viewId = v.id;
  markView();
  if (instant) { baseQ.copy(v.q); anim = null; layout(false); return; }
  anim = { from: baseQ.clone(), to: v.q.clone(), t0: performance.now(), dur: 280 };
}

// ----------------------------------------------------------------------------- export
function exportPNG(scaleFactor) {
  if (state.sheet.page.enabled) return exportPage();
  const w = stage.clientWidth, h = stage.clientHeight;
  // never export the meet-point markers
  const showMeet = state.showMeet; state.showMeet = false; updateMeetPoints();
  const pr = renderer.getPixelRatio();
  const lw = lineMat.linewidth;
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(w * scaleFactor), Math.round(h * scaleFactor), false);
  lineMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  hiddenMat.resolution.copy(lineMat.resolution); pave.setResolution(renderer.domElement.width, renderer.domElement.height);
  lineMat.linewidth = lw * scaleFactor / pr; hiddenMat.linewidth = lineMat.linewidth; pave.setLineWidth(lineMat.linewidth);
  updateCamera(w, h);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(pr);
  lineMat.linewidth = lw; hiddenMat.linewidth = lw; pave.setLineWidth(lw);
  resize();
  state.showMeet = showMeet; updateMeetPoints();
  const suffix = state.sheet.views.length ? `sheet-${state.sheet.standard}-angle` : state.viewId;
  const filename = `${state.shapeId}-${suffix}.png`;
  saveFile(filename, url);
}
/** Export exactly the page at its print resolution: width x height inches at `dpi`, page outline included. */
function exportPage() {
  const pg = state.sheet.page, r = pageRect();
  const pw = Math.round(pg.width * pg.dpi), ph = Math.round(pg.height * pg.dpi);
  const showMeet = state.showMeet; state.showMeet = false; updateMeetPoints();
  const pr = renderer.getPixelRatio(), lw = lineMat.linewidth;
  renderer.setPixelRatio(1);
  renderer.setSize(pw, ph, false);
  lineMat.resolution.set(pw, ph); hiddenMat.resolution.set(pw, ph); pave.setResolution(pw, ph);
  // keep the lines the same thickness relative to the stone as on screen
  const screenPxPerUnit = stage.clientWidth / (orthoCamera.right - orthoCamera.left), pagePxPerUnit = pw / (r.maxX - r.minX);
  lineMat.linewidth = lw * pagePxPerUnit / screenPxPerUnit / pr; hiddenMat.linewidth = lineMat.linewidth; pave.setLineWidth(lineMat.linewidth);
  const cam = orthoCamera;
  cam.left = r.minX; cam.right = r.maxX; cam.top = r.maxY; cam.bottom = r.minY; cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(pr); lineMat.linewidth = lw; hiddenMat.linewidth = lw; pave.setLineWidth(lw);
  resize();
  state.showMeet = showMeet; updateMeetPoints();
  saveFile(`${state.shapeId}-page-${pg.width}x${pg.height}in-${pg.dpi}dpi.png`, url);
}

/** Hand a data: URL to the viewer: through the claude.ai downloads capability when the page runs as an artifact, otherwise a plain download. */
async function saveFile(filename, dataUrl) {
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        const blob = await (await fetch(dataUrl)).blob();
        await downloads.save({ filename, data: blob });
        return;
      }
    } catch (e) {
      if (e && e.code === 'declined') return;
      console.warn('download capability failed, falling back', e);
    }
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ----------------------------------------------------------------------------- sheet views
function addView(parentId, dir, kind = 'ortho') {
  const id = `v${state.sheet.nextId++}`;
  state.sheet.views.push({ id, parent: parentId, dir, gap: null, kind, rot: kind === '3d' ? ISO_TILT() : null, locked: false, hidden: false, offset: [0, 0], scale: 1 });
  renderViewList();
  layout(true);
  return id;
}
/**
 * Centre a view on the page (or the origin when no page is set): axis 'x' centres it
 * horizontally, 'y' vertically. A 3D view moves on its own; any other view moves the whole
 * arrangement, since projected views are tied to the base.
 */
function snapCentre(id, axis) {
  const inst = instances.get(id); if (!inst || !inst.bbox) return;
  const v = state.sheet.views.find((x) => x.id === id);
  const c = axis === 'x' ? inst.pos[0] + (inst.bbox.minX + inst.bbox.maxX) / 2 : inst.pos[1] + (inst.bbox.minY + inst.bbox.maxY) / 2;
  const i = axis === 'x' ? 0 : 1;
  if (v && v.kind === '3d') { v.offset = v.offset || [0, 0]; v.offset[i] -= c; }
  else state.sheet.origin[i] -= c;
  layout(false);
}
/** Put a 3D view back to the isometric tilt of its parent, at its laid-out place and natural size. */
function resetView3d(id) {
  const v = state.sheet.views.find((x) => x.id === id);
  if (v && v.kind === '3d') { v.rot = ISO_TILT(); v.offset = [0, 0]; v.scale = 1; renderViewList(); layout(true); }
}
function removeView(id) {
  const drop = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const v of state.sheet.views) if (!drop.has(v.id) && drop.has(v.parent)) { drop.add(v.id); changed = true; }
  }
  state.sheet.views = state.sheet.views.filter((v) => !drop.has(v.id));
  renderViewList();
  layout(true);
}
function clearViews() {
  state.sheet.views = [];
  renderViewList();
  layout(true);
}
function viewLabel(id) {
  if (id === 'base') return `Base (${state.viewId === 'custom' ? 'custom' : getView(state.viewId).label})`;
  const v = state.sheet.views.find((x) => x.id === id);
  const parentName = v.parent === 'base' ? 'base' : v.parent;
  return v.kind === '3d' ? `${v.id}: 3D view, ${DIR_LABEL[v.dir].toLowerCase()} ${parentName}` : `${v.id}: ${DIR_LABEL[v.dir]} ${parentName}`;
}

function renderViewList() {
  const list = document.getElementById('viewlist');
  if (!list) return;
  list.innerHTML = '';
  for (const id of allViewIds()) {
    const row = document.createElement('div');
    row.className = 'viewrow';
    const name = document.createElement('span');
    name.className = 'viewname';
    name.textContent = viewLabel(id);
    row.appendChild(name);
    const v = state.sheet.views.find((x) => x.id === id);
    const flags = document.createElement('span'); flags.className = 'viewflags';
    const check = (label, title, get, set) => {
      const l = document.createElement('label'); l.title = title;
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = get();
      c.addEventListener('change', () => { set(c.checked); layout(true); });
      l.appendChild(c); l.appendChild(document.createTextNode(label)); flags.appendChild(l);
    };
    const holder = v || state.sheet.base;
    if (!v || v.kind === '3d') check('lock', v ? 'Locked: dragging over this 3D view does nothing' : 'Locked: dragging the sheet does not rotate the base (projected views follow the base, so this locks them too)', () => !!holder.locked, (x) => { holder.locked = x; });
    check('hidden', 'Draw the hidden lines of this view in light grey', () => !!holder.hidden, (x) => { holder.hidden = x; });
    row.appendChild(flags);
    if (v) {
      const gap = document.createElement('input');
      gap.type = 'number'; gap.step = '0.05'; gap.min = '0'; gap.title = 'Gap to parent view (stone widths)';
      gap.value = (v.gap ?? state.sheet.gaps[v.dir]).toFixed(2);
      gap.addEventListener('change', () => { v.gap = parseFloat(gap.value) || 0; layout(true); });
      row.appendChild(gap);
      if (v.kind === '3d') {
        const side = document.createElement('select'); side.title = 'Which side of the parent view this 3D view sits on';
        for (const [d, l] of [['right', 'right'], ['left', 'left'], ['above', 'above'], ['below', 'below']]) { const o = document.createElement('option'); o.value = d; o.textContent = l; side.appendChild(o); }
        side.value = v.dir;
        side.addEventListener('change', () => { v.dir = side.value; renderViewList(); layout(true); });
        row.appendChild(side);
        const sc = document.createElement('input');
        sc.type = 'number'; sc.step = '0.1'; sc.min = '0.2'; sc.max = '5'; sc.title = 'Scale of this 3D view (the wheel over it also scales it)';
        sc.value = (v.scale || 1).toFixed(2);
        sc.addEventListener('change', () => { v.scale = Math.min(5, Math.max(0.2, parseFloat(sc.value) || 1)); layout(true); });
        row.appendChild(sc);
      }
    }
    const btns = document.createElement('span');
    btns.className = 'viewbtns';
    for (const [dir, glyph] of [['left', '← L'], ['right', 'R →'], ['above', '↑ A'], ['below', '↓ B']]) {
      const b = document.createElement('button');
      b.textContent = glyph; b.title = `Project a new view ${dir} of this one`;
      b.addEventListener('click', () => addView(id, dir));
      btns.appendChild(b);
    }
    for (const [axis, glyph, title] of [['x', '⇔', 'Centre this view horizontally on the page'], ['y', '⇕', 'Centre this view vertically on the page']]) {
      const b = document.createElement('button');
      b.textContent = glyph; b.title = title;
      b.addEventListener('click', () => snapCentre(id, axis));
      btns.appendChild(b);
    }
    const b3 = document.createElement('button');
    b3.textContent = '3D'; b3.title = 'Add a 3D (isometric) view of this one, placed to its right; drag over it to turn it, alt-drag to move it, wheel to scale it; it still follows this view';
    b3.addEventListener('click', () => addView(id, 'right', '3d'));
    btns.appendChild(b3);
    if (v && v.kind === '3d') {
      const r = document.createElement('button');
      r.textContent = '↺'; r.title = 'Reset this 3D view: isometric tilt, laid-out place, natural size';
      r.addEventListener('click', () => resetView3d(id));
      btns.appendChild(r);
    }
    if (v) {
      const x = document.createElement('button');
      x.textContent = '×'; x.title = 'Remove this view and the views projected from it';
      x.addEventListener('click', () => removeView(id));
      btns.appendChild(x);
    }
    row.appendChild(btns);
    list.appendChild(row);
  }
}

// ----------------------------------------------------------------------------- UI
const viewsDiv = document.getElementById('views');
for (const v of VIEWS) {
  const b = document.createElement('button');
  b.textContent = v.label; b.dataset.view = v.id;
  b.addEventListener('click', () => snapTo(v.id));
  viewsDiv.appendChild(b);
}
function markView() {
  for (const b of viewsDiv.querySelectorAll('button')) b.classList.toggle('active', b.dataset.view === state.viewId);
  const info = document.getElementById('info');
  if (info && geo && design) info.textContent = `${design.name} · ${state.viewId} · ${geo.faceCount} facets`;
  const baseName = document.querySelector('#viewlist .viewname');
  if (baseName) baseName.textContent = viewLabel('base');
}
document.getElementById('fit').addEventListener('click', () => fitView());
// 0 or Home (outside text fields): back to the original zoom and centre
document.addEventListener('keydown', (e) => { if ((e.key === '0' || e.key === 'Home') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) { fitView(); e.preventDefault(); } });

const spinIn = document.getElementById('spin'), spinNum = document.getElementById('spinnum');
function setSpin(v) {
  state.spin = ((v % 360) + 360) % 360;
  spinIn.value = state.spin; spinNum.value = state.spin;
  layout(true);
}
spinIn.value = state.spin; spinNum.value = state.spin;
spinIn.addEventListener('input', () => setSpin(parseFloat(spinIn.value) || 0));
spinNum.addEventListener('change', () => setSpin(parseFloat(spinNum.value) || 0));
for (const b of document.querySelectorAll('[data-spin]')) b.addEventListener('click', () => setSpin(state.spin + parseFloat(b.dataset.spin)));

const lw = document.getElementById('lw'), lwv = document.getElementById('lwv');
lw.value = state.lineWidth;
lwv.textContent = `${state.lineWidth} px`;
lw.addEventListener('input', () => {
  state.lineWidth = parseFloat(lw.value);
  lineMat.linewidth = state.lineWidth; hiddenMat.linewidth = state.lineWidth; pave.setLineWidth(state.lineWidth);
  lwv.textContent = `${state.lineWidth} px`;
});
const girdleCb = document.getElementById('girdle');
girdleCb.checked = state.girdleLines;
girdleCb.addEventListener('change', () => { state.girdleLines = girdleCb.checked; layout(true); });

const projSel = document.getElementById('proj');
projSel.value = state.projection;
projSel.addEventListener('change', () => { state.projection = projSel.value; resize(); });
const fovIn = document.getElementById('fov'), fovv = document.getElementById('fovv');
fovIn.value = state.fov; fovv.textContent = `${state.fov}°`;
fovIn.addEventListener('input', () => { state.fov = parseFloat(fovIn.value); fovv.textContent = `${state.fov}°`; resize(); });

const PAGE_SIZES = { letter: [8.5, 11], letterL: [11, 8.5], square85: [8.5, 8.5], a4: [8.27, 11.69], a4L: [11.69, 8.27], custom: null };
const pageChk = document.getElementById('page'), pageSize = document.getElementById('pagesize'), pageW = document.getElementById('pagew'), pageH = document.getElementById('pageh'), pageStone = document.getElementById('pagestone'), pageDpi = document.getElementById('pagedpi'), pageFit = document.getElementById('pagefit'), pageFitBtn = document.getElementById('pagefitbtn');
if (pageChk) {
  const pg = state.sheet.page;
  const refresh = () => { pageW.value = pg.width; pageH.value = pg.height; pageStone.value = pg.stoneWidth; pageDpi.value = pg.dpi; pageChk.checked = pg.enabled; pageFit.value = Math.round(pg.fit * 100); };
  refresh();
  pageSize.value = 'square85';
  pageChk.addEventListener('change', () => { pg.enabled = pageChk.checked; layout(true); });
  pageFit.addEventListener('change', () => { pg.fit = Math.min(1, Math.max(0.05, (parseFloat(pageFit.value) || 80) / 100)); });
  pageFitBtn.addEventListener('click', () => fitViewsToPage(pg.fit));
  pageSize.addEventListener('change', () => { const sz = PAGE_SIZES[pageSize.value]; if (sz) { pg.width = sz[0]; pg.height = sz[1]; refresh(); layout(true); } });
  const num = (el, key, min) => el.addEventListener('change', () => { const v = parseFloat(el.value); if (v >= min) { pg[key] = v; pageSize.value = 'custom'; layout(true); } });
  num(pageW, 'width', 0.5); num(pageH, 'height', 0.5); num(pageStone, 'stoneWidth', 0.05); num(pageDpi, 'dpi', 36);
}
// text block controls: text and style changes redraw at once; the pavé repacks when the change is committed
{
  const $ = (id) => document.getElementById(id);
  for (const id of TEXT_IDS) {
    const b = state.sheet.text[id], p = id === 'title' ? 'tt' : 'td';
    const on = (sfx, ev, fn) => { const el = $(p + sfx); if (el) el.addEventListener(ev, () => fn(el)); };
    on('on', 'change', (el) => { b.enabled = el.checked; layout(true); });
    on('text', 'input', (el) => { b.text = el.value; state.sheet.text.auto = false; layout(false); }); on('text', 'change', () => layout(true));
    on('font', 'change', (el) => { b.font = el.value; layout(true); });
    on('size', 'input', (el) => { b.size = Math.max(4, parseFloat(el.value) || 12); layout(false); }); on('size', 'change', () => layout(true));
    on('bold', 'change', (el) => { b.bold = el.checked; layout(true); });
    on('italic', 'change', (el) => { b.italic = el.checked; layout(true); });
    on('align', 'change', (el) => { b.align = el.value; layout(true); });
    on('width', 'change', (el) => { b.width = Math.min(1, Math.max(0.1, (parseFloat(el.value) || 60) / 100)); layout(true); });
    on('lock', 'change', (el) => { b.locked = el.checked; });
    on('cx', 'click', () => snapCentreText(id, 'x')); on('cy', 'click', () => snapCentreText(id, 'y')); on('reset', 'click', () => resetTextPos(id));
  }
  const cap = $('captionbtn'); if (cap) cap.addEventListener('click', () => { state.sheet.text.auto = true; applyCaption(); layout(true); });
}
// pavé background controls
{
  const pv = state.sheet.pave, $ = (id) => document.getElementById(id);
  const bind = (id, key, parse = parseFloat, after = () => layout(true)) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = pv[key]; else el.value = pv[key]; el.addEventListener(el.type === 'range' ? 'change' : 'change', () => { pv[key] = el.type === 'checkbox' ? el.checked : parse(el.value); after(); }); };
  bind('pave', 'enabled'); bind('pavepattern', 'pattern', String); bind('pavemin', 'minOpacity'); bind('pavemax', 'maxOpacity'); bind('pavemaxct', 'maxCarats'); bind('paveminct', 'minCarats'); bind('pavesingle', 'singleBelow'); bind('pavescale', 'mmPerInch'); bind('pavemargin', 'margin'); bind('paveseeds', 'seedCount', parseInt); bind('pavelabels', 'labels'); bind('pavehexct', 'hexCarats'); bind('pavehexop', 'hexOpacity'); bind('pavehexcircles', 'hexCircles');
  for (const id of ['pavemin', 'pavemax', 'pavehexop']) { const el = $(id), v = $(id + 'v'); if (el && v) { v.textContent = `${Math.round(el.value * 100)}%`; el.addEventListener('input', () => { v.textContent = `${Math.round(el.value * 100)}%`; }); } }
  const reseed = $('pavereseed'); if (reseed) reseed.addEventListener('click', () => { pv.seed = (pv.seed + 1) % 100000; layout(true); });
}
const fitBtn = document.getElementById('fitview'); if (fitBtn) fitBtn.addEventListener('click', fitView);
const gridChk = document.getElementById('grid'), gridOp = document.getElementById('gridopacity'), gridOpV = document.getElementById('gridopacityv'), gridMarginIn = document.getElementById('gridmargin');
if (gridChk) {
  gridChk.checked = state.sheet.grid;
  gridChk.addEventListener('change', () => { state.sheet.grid = gridChk.checked; layout(true); });
  gridOp.value = state.sheet.gridOpacity; gridOpV.textContent = `${Math.round(state.sheet.gridOpacity * 100)}%`;
  gridOp.addEventListener('input', () => { state.sheet.gridOpacity = parseFloat(gridOp.value); gridOpV.textContent = `${Math.round(state.sheet.gridOpacity * 100)}%`; gridMat.opacity = state.sheet.gridOpacity; });
  gridMarginIn.value = state.sheet.gridMargin;
  gridMarginIn.addEventListener('change', () => { state.sheet.gridMargin = Math.max(0, parseFloat(gridMarginIn.value) || 0); layout(true); });
}
const standardSel = document.getElementById('standard');
standardSel.value = state.sheet.standard;
standardSel.addEventListener('change', () => { state.sheet.standard = standardSel.value; layout(true); });
for (const dir of ['left', 'right', 'above', 'below']) {
  const inp = document.getElementById(`gap-${dir}`);
  inp.value = state.sheet.gaps[dir];
  inp.addEventListener('change', () => { state.sheet.gaps[dir] = parseFloat(inp.value) || 0; layout(true); });
}
document.getElementById('clearviews').addEventListener('click', clearViews);

const scaleSel = document.getElementById('scale');
scaleSel.addEventListener('change', () => { state.exportScale = parseFloat(scaleSel.value); });
document.getElementById('export').addEventListener('click', () => exportPNG(state.exportScale));
// the preview's kebab menu: export, fit views to the page, fit the preview
{
  const btn = document.getElementById('stagemenubtn'), list = document.getElementById('stagemenulist');
  if (btn && list) {
    const open = (v) => { list.hidden = !v; btn.setAttribute('aria-expanded', String(v)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(list.hidden); });
    list.addEventListener('click', () => open(false));
    document.addEventListener('click', (e) => { if (!list.hidden && !list.contains(e.target) && e.target !== btn) open(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
    document.getElementById('menufitviews').addEventListener('click', () => fitViewsToPage());
    document.getElementById('menufitpreview').addEventListener('click', () => fitView());
  }
}

function updateProps() {
  const dl = document.getElementById('props');
  if (!dl || !geo || !design) return;
  const st = stoneStats(geo, design);
  const pct = (v) => (v === null || v === undefined ? '-' : `${(v * 100).toFixed(1)}%`);
  const rows = [
    ['Design', design.name],
    ['Facets', String(st.facets)],
    ['L:W', st.ratio.toFixed(3)],
    ['Table', pct(st.table)],
    ['Crown height', pct(st.crown)],
    ['Girdle', pct(st.girdle)],
    ['Pavilion depth', pct(st.pavilion)],
    ['Total depth', pct(st.depth)],
  ];
  dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const info = document.getElementById('info');
  if (info) info.textContent = `${design.name} \u00b7 ${st.facets} facets`;
}

// ----------------------------------------------------------------------------- loop
const editor = createEditor({
  onChange: (d) => setDesign(d),
  getSelectedVertex: () => selectedVertex,
  saveText: (filename, text) => saveFile(filename, 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)),
});
// ----------------------------------------------------------------------------- setup save / restore
// The whole working state (design, template form, views, page, grid, background, rotation) is
// kept in the browser's local storage as you work and restored on the next load, and can be
// saved to and loaded from a .json file.
const SETUP_KEY = 'gem-facet-designer-setup-v1';
function getSetup() {
  const pbox = document.getElementById('tpl-params');
  return {
    app: 'gem-facet-designer', version: 1, saved: new Date().toISOString(),
    template: editor.templateKey, templateParams: pbox ? [...pbox.querySelectorAll('input[data-param]')].map((i) => [i.dataset.param, i.value]) : [], girdleFacets: document.getElementById('tpl-gf').value,
    design: editor.design,
    viewId: state.viewId, baseQ: baseQ.toArray(), spin: state.spin, zoom: state.zoom, pan: state.pan, lineWidth: state.lineWidth, girdleLines: state.girdleLines,
    projection: state.projection, fov: state.fov, exportScale: state.exportScale, showMeet: state.showMeet,
    sheet: { ...state.sheet, views: state.sheet.views.map((v) => ({ ...v, rot: v.rot ? v.rot.toArray() : null })) },
  };
}
/** Push the state into the controls that mirror it. */
function syncInputs() {
  const $ = (id) => document.getElementById(id);
  const set = (id, v) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; };
  set('lw', state.lineWidth); if ($('lwv')) $('lwv').textContent = `${state.lineWidth} px`;
  set('girdle', state.girdleLines); set('proj', state.projection); set('spin', state.spin); set('spinnum', state.spin); set('meet', state.showMeet); set('scale', state.exportScale);
  const sh = state.sheet;
  set('standard', sh.standard); for (const d of ['left', 'right', 'above', 'below']) set(`gap-${d}`, sh.gaps[d]);
  set('grid', sh.grid); set('gridopacity', sh.gridOpacity); if ($('gridopacityv')) $('gridopacityv').textContent = `${Math.round(sh.gridOpacity * 100)}%`; set('gridmargin', sh.gridMargin);
  const pg = sh.page; set('page', pg.enabled); set('pagew', pg.width); set('pageh', pg.height); set('pagestone', pg.stoneWidth); set('pagedpi', pg.dpi); set('pagefit', Math.round(pg.fit * 100));
  const sizes = { 'letter': [8.5, 11], 'letterL': [11, 8.5], 'square85': [8.5, 8.5], 'a4': [8.27, 11.69], 'a4L': [11.69, 8.27] };
  set('pagesize', Object.keys(sizes).find((k) => sizes[k][0] === pg.width && sizes[k][1] === pg.height) || 'custom');
  for (const id of TEXT_IDS) { const b = sh.text[id], p = id === 'title' ? 'tt' : 'td'; set(p + 'on', b.enabled); set(p + 'text', b.text); set(p + 'font', b.font); set(p + 'size', b.size); set(p + 'bold', b.bold); set(p + 'italic', b.italic); set(p + 'align', b.align); set(p + 'width', Math.round(b.width * 100)); set(p + 'lock', b.locked); }
  const pv = sh.pave;
  for (const [id, key] of [['pave', 'enabled'], ['pavepattern', 'pattern'], ['pavemin', 'minOpacity'], ['pavemax', 'maxOpacity'], ['pavemaxct', 'maxCarats'], ['paveminct', 'minCarats'], ['pavesingle', 'singleBelow'], ['pavescale', 'mmPerInch'], ['pavemargin', 'margin'], ['paveseeds', 'seedCount'], ['pavelabels', 'labels'], ['pavehexct', 'hexCarats'], ['pavehexop', 'hexOpacity'], ['pavehexcircles', 'hexCircles']]) set(id, pv[key]);
  for (const id of ['pavemin', 'pavemax', 'pavehexop']) if ($(id + 'v')) $(id + 'v').textContent = `${Math.round($(id).value * 100)}%`;
}
function applySetup(s) {
  if (!s || s.app !== 'gem-facet-designer' || !s.sheet || !s.design) return false;
  // the template form, then the saved design itself (so hand edits to tiers survive)
  const inputs = editor.setTemplate(s.template);
  for (const [k, v] of s.templateParams || []) { const inp = inputs.find((i) => i.dataset.param === k); if (inp) inp.value = v; }
  document.getElementById('tpl-gf').value = s.girdleFacets || '';
  Object.assign(state, { viewId: s.viewId || 'front', spin: s.spin || 0, zoom: s.zoom || 1, pan: s.pan || [0, 0], lineWidth: s.lineWidth || 1.5, girdleLines: s.girdleLines !== false, projection: s.projection || 'orthographic', fov: s.fov || 30, exportScale: s.exportScale || 2, showMeet: !!s.showMeet });
  lineMat.linewidth = state.lineWidth; hiddenMat.linewidth = state.lineWidth; pave.setLineWidth(state.lineWidth);
  if (s.baseQ) baseQ.fromArray(s.baseQ);
  // merge the saved sheet into the live settings objects, keeping their identities: the controls'
  // handlers hold references to them (replacing them left the pavé controls writing to a stale copy)
  const sh = s.sheet, cur = state.sheet;
  for (const k of ['gaps', 'base', 'page', 'pave']) Object.assign(cur[k], sh[k] || {});
  for (const id of TEXT_IDS) Object.assign(cur.text[id], (sh.text || {})[id] || {}, { rect: null });
  cur.text.auto = (sh.text || {}).auto !== undefined ? !!sh.text.auto : cur.text.auto;
  for (const k of Object.keys(sh)) if (!['gaps', 'base', 'page', 'pave', 'text', 'views'].includes(k)) cur[k] = sh[k];
  cur.views = (sh.views || []).map((v) => ({ ...v, rot: v.rot ? new THREE.Quaternion().fromArray(v.rot) : null }));
  syncInputs();
  editor.design = s.design;   // rebuilds the stone and lays the sheet out
  renderViewList(); markView(); layout(true); resize();
  return true;
}
let autosaveTimer = null;
function autosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { try { localStorage.setItem(SETUP_KEY, JSON.stringify(getSetup())); } catch (e) { /* storage full or disabled: nothing to do */ } }, 600);
}
function restoreSetup() {
  if (params.get('fresh') === '1') return false;
  try { const raw = localStorage.getItem(SETUP_KEY); if (!raw) return false; const s = JSON.parse(raw); const ok = applySetup(s); if (ok) { const st = document.getElementById('setupstatus'); if (st) st.textContent = `Restored the setup from ${new Date(s.saved).toLocaleString()}.`; } return ok; }
  catch (e) { return false; }
}
{
  const $ = (id) => document.getElementById(id);
  if ($('setupsave')) $('setupsave').addEventListener('click', () => saveFile(`${state.shapeId}-setup.json`, 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(getSetup(), null, 1))));
  if ($('setupfile')) $('setupfile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const ok = applySetup(JSON.parse(await f.text())); $('setupstatus').textContent = ok ? `Loaded ${f.name}.` : `${f.name} is not a setup file.`; }
    catch (err) { $('setupstatus').textContent = 'Could not load: ' + err.message; }
    e.target.value = '';
  });
  if ($('setupreset')) $('setupreset').addEventListener('click', () => { try { localStorage.removeItem(SETUP_KEY); } catch (e) { /* ignore */ } location.href = location.pathname + '?fresh=1'; });
}

// ----------------------------------------------------------------------------- underlay UI
const uSel = document.getElementById('u-builtin');
for (const p of plots) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; uSel.appendChild(o); }
document.getElementById('u-load').addEventListener('click', async () => {
  const v = uSel.value; if (!v) return;
  try { await underlay.load(`designs/plots/${v}.png`, v); document.getElementById('u-status').textContent = `Underlay: ${v}`; layout(true); }
  catch (e) { document.getElementById('u-status').textContent = 'Could not load: ' + e.message; }
});
document.getElementById('u-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { await underlay.load(f, f.name); document.getElementById('u-status').textContent = `Underlay: ${f.name}`; layout(true); }
  catch (err) { document.getElementById('u-status').textContent = 'Could not load: ' + err.message; }
  e.target.value = '';
});
const bind = (id, key, parse = parseFloat) => { const el = document.getElementById(id); el.addEventListener('input', () => { underlay.state[key] = parse(el.value); layout(true); }); };
bind('u-opacity', 'opacity'); bind('u-scale', 'scale'); bind('u-dx', 'dx'); bind('u-dy', 'dy');
document.getElementById('u-view').addEventListener('change', (e) => { underlay.state.view = e.target.value; layout(true); });
document.getElementById('u-mirror').addEventListener('change', (e) => { underlay.state.mirror = e.target.checked; layout(true); });
document.getElementById('u-stretch').addEventListener('change', (e) => { underlay.state.stretch = e.target.checked; layout(true); });
document.getElementById('u-show').addEventListener('change', (e) => { underlay.state.visible = e.target.checked; layout(true); });

state.showMeet = params.get('meet') === '1';   // off by default; ?meet=1 turns the markers on
const meetCb = document.getElementById('meet');
meetCb.checked = state.showMeet;
meetCb.addEventListener('change', () => { state.showMeet = meetCb.checked; updateMeetPoints(); });
setDesign(editor.design);
snapTo(state.viewId, true);
renderViewList();
resize();
// pick up where the last session left off (unless the page was opened with ?fresh=1 or a tool set a view)
if (!params.has('view') && !params.has('ui')) restoreSetup();

function frame(now) {
  if (anim) {
    const t = Math.min(1, (now - anim.t0) / anim.dur);
    const e = t * (2 - t);
    baseQ.slerpQuaternions(anim.from, anim.to, e);
    if (t >= 1) anim = null;
    layout(false);
  }
  renderer.render(scene, camera);
  window.__frames = (window.__frames || 0) + 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for the screenshot tool and for scripting.
window.__viewer = {
  state, setDesign, snapTo, exportPNG, resize, addView, removeView, clearViews, resetView3d, snapCentre, snapCentreText, resetTextPos, hitText, applyCaption, fitView, fitViewsToPage, editor, getSetup, applySetup, paveInfo: () => paveInfo, paveStones: () => pave.lastStones, pageRect, instances, camera: () => camera, gridCells: () => gridLines.userData.cells,
  loadShape(id) { const { templates } = window.__templates; if (templates[id]) editor.design = templates[id].make(); },
  setLineWidth(v) { state.lineWidth = v; lineMat.linewidth = v; hiddenMat.linewidth = v; pave.setLineWidth(v); },
  setGirdleLines(v) { state.girdleLines = v; layout(true); },
  setSpin,
  setZoom(z) { state.zoom = z; resize(); },
  setProjection(p, fov) { state.projection = p; if (fov) state.fov = fov; resize(); },
  underlay,
  setStandard(s) { state.sheet.standard = s; standardSel.value = s; layout(true); },
  render() { layout(true); renderer.render(scene, camera); },
};
