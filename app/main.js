import * as THREE from '../vendor/three/three.module.js';
import { LineSegments2 } from '../vendor/three/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/lines/LineMaterial.js';
import { designMesh, stoneStats } from './gemcad/mesh.js';
import { createEditor } from './editor.js';
import { createUnderlay } from './underlay.js';
import { templates, plots } from './gemcad/templates.js';
window.__templates = { templates, plots };
import { VIEWS, getView } from './views.js';

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
function updateSilhouette(inst, force) {
  const qn = inst.q;
  if (!force && inst.lastQ && inst.lastQ.equals(qn) && inst.lastMode === state.girdleLines) return;
  inst.lastQ = qn.clone();
  inst.lastMode = state.girdleLines;
  const s = geo.smooth;
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
  base.pos = [0, 0];
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
  updateCamera(stage.clientWidth, stage.clientHeight);
  const b = instances.get('base');
  if (b && geo) underlay.place(geo.bbox, b.pos, state.viewId);
}

// ----------------------------------------------------------------------------- camera / size
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  updateCamera(w, h);
  lineMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  hiddenMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
}

function updateCamera(w, h) {
  const aspect = w / h;
  const cx = (overall.minX + overall.maxX) / 2, cy = (overall.minY + overall.maxY) / 2;
  const gm = state.sheet.grid ? state.sheet.gridMargin * 2 : 0;   // keep the grid border in view
  const ex = (overall.maxX - overall.minX) / 2 + gm, ey = (overall.maxY - overall.minY) / 2 + gm;
  // half-height of the view in world units: fit the sheet with a margin
  let half = Math.max(ey, ex / aspect) * 1.12 / state.zoom;
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
  drag = { x: e.clientX, y: e.clientY, roll: e.shiftKey, move: e.altKey, moved: false, view3d: hitView3d(e.clientX, e.clientY) };
  canvas.setPointerCapture(e.pointerId);
});
/** World units per CSS pixel of the current orthographic camera. */
function worldPerPixel() { const rect = canvas.getBoundingClientRect(); return (camera.right - camera.left) / rect.width; }
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  if (!drag.moved) return;
  // locks: a locked 3D view ignores the drag; a locked base ignores drags everywhere else (the projected views follow it)
  if (drag.view3d ? drag.view3d.locked : state.sheet.base.locked) { drag.x = e.clientX; drag.y = e.clientY; return; }
  if (drag.view3d && drag.move) {   // alt-drag: move the 3D view on the sheet
    const wpp = worldPerPixel(); const v = drag.view3d; v.offset = v.offset || [0, 0];
    v.offset[0] += dx * wpp; v.offset[1] -= dy * wpp;
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
  state.zoom = Math.min(20, Math.max(0.2, state.zoom * Math.exp(-e.deltaY * 0.0015)));
  resize();
}, { passive: false });

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
  const w = stage.clientWidth, h = stage.clientHeight;
  // never export the meet-point markers
  const showMeet = state.showMeet; state.showMeet = false; updateMeetPoints();
  const pr = renderer.getPixelRatio();
  const lw = lineMat.linewidth;
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(w * scaleFactor), Math.round(h * scaleFactor), false);
  lineMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
  lineMat.linewidth = lw * scaleFactor / pr;
  updateCamera(w, h);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(pr);
  lineMat.linewidth = lw;
  resize();
  state.showMeet = showMeet; updateMeetPoints();
  const suffix = state.sheet.views.length ? `sheet-${state.sheet.standard}-angle` : state.viewId;
  const filename = `${state.shapeId}-${suffix}.png`;
  saveFile(filename, url);
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
document.getElementById('fit').addEventListener('click', () => { state.zoom = 1; resize(); });

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
  lineMat.linewidth = state.lineWidth;
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
  state, setDesign, snapTo, exportPNG, resize, addView, removeView, clearViews, resetView3d, editor, instances, camera: () => camera, gridCells: () => gridLines.userData.cells,
  loadShape(id) { const { templates } = window.__templates; if (templates[id]) editor.design = templates[id].make(); },
  setLineWidth(v) { state.lineWidth = v; lineMat.linewidth = v; },
  setGirdleLines(v) { state.girdleLines = v; layout(true); },
  setSpin,
  setZoom(z) { state.zoom = z; resize(); },
  setProjection(p, fov) { state.projection = p; if (fov) state.fov = fov; resize(); },
  underlay,
  setStandard(s) { state.sheet.standard = s; standardSel.value = s; layout(true); },
  render() { layout(true); renderer.render(scene, camera); },
};
