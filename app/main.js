import * as THREE from 'three';
import { LineSegments2 } from '../vendor/three/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/three/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/three/lines/LineMaterial.js';
import { SHAPES, buildShape } from './geometry/shapes.js';
import { VIEWS, getView } from './views.js';

// ----------------------------------------------------------------------------- state
const params = new URLSearchParams(location.search);
const state = {
  shapeId: params.get('shape') || 'round',
  viewId: params.get('view') || 'front',
  lineWidth: parseFloat(params.get('lw') || '1.5'),
  girdleLines: params.get('girdle') === '1',
  exportScale: 2,
  zoom: parseFloat(params.get('zoom') || '1'),
  projection: params.get('proj') === 'perspective' ? 'perspective' : 'orthographic',
  fov: parseFloat(params.get('fov') || '30'),
  // Drawing sheet: the base view is the stone as currently rotated; projected views hang off it.
  sheet: {
    standard: params.get('standard') === 'first' ? 'first' : 'third',
    gaps: { left: 0.3, right: 0.3, above: 0.3, below: 0.3 },   // in stone widths, between view bounding boxes
    views: [],                                                 // { id, parent, dir, gap }
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
const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
const perspCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
let camera = orthoCamera;

const occluderMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
});
const lineMat = new LineMaterial({ color: 0x000000, linewidth: state.lineWidth, worldUnits: false, depthTest: true, depthWrite: true });
lineMat.resolution.set(1, 1);

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

function allViewIds() { return ['base', ...state.sheet.views.map((v) => v.id)]; }

function makeInstance(id) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(meshGeometry, occluderMat);
  const hard = new LineSegments2(hardGeometry, lineMat);
  const smooth = new LineSegments2(new LineSegmentsGeometry().setPositions(new Float32Array(6)), lineMat);
  smooth.visible = false;
  group.add(mesh, hard, smooth);
  scene.add(group);
  const inst = { id, group, mesh, hard, smooth, lastQ: null, lastMode: null, q: new THREE.Quaternion(), pos: [0, 0], bbox: null };
  instances.set(id, inst);
  return inst;
}

function disposeInstances() {
  for (const inst of instances.values()) {
    scene.remove(inst.group);
    inst.smooth.geometry.dispose();
  }
  instances.clear();
}

function loadShape(id) {
  disposeInstances();
  if (meshGeometry) meshGeometry.dispose();
  if (hardGeometry) hardGeometry.dispose();
  geo = buildShape(id);
  meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
  hardGeometry = new LineSegmentsGeometry().setPositions(geo.hardEdges);
  for (const vid of allViewIds()) makeInstance(vid);
  state.shapeId = id;
  updateProps();
  layout(true);
}

function syncInstances() {
  const ids = allViewIds();
  for (const id of ids) if (!instances.has(id)) makeInstance(id);
  for (const id of [...instances.keys()]) {
    if (!ids.includes(id)) {
      const inst = instances.get(id);
      scene.remove(inst.group);
      inst.smooth.geometry.dispose();
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

/** Recompute orientations and positions of every view, then the camera. */
function layout(force) {
  if (!geo) return;
  syncInstances();
  const base = instances.get('base');
  base.q.copy(baseQ);
  base.pos = [0, 0];
  base.bbox = bboxFor(base.q);
  for (const v of state.sheet.views) {
    const parent = instances.get(v.parent);
    const inst = instances.get(v.id);
    inst.q.copy(PROJECT[state.sheet.standard][v.dir]).multiply(parent.q);
    inst.bbox = bboxFor(inst.q);
    const gap = v.gap ?? state.sheet.gaps[v.dir];
    const pb = parent.bbox, cb = inst.bbox, pp = parent.pos;
    if (v.dir === 'right') inst.pos = [pp[0] + pb.maxX + gap - cb.minX, pp[1]];
    else if (v.dir === 'left') inst.pos = [pp[0] + pb.minX - gap - cb.maxX, pp[1]];
    else if (v.dir === 'above') inst.pos = [pp[0], pp[1] + pb.maxY + gap - cb.minY];
    else inst.pos = [pp[0], pp[1] + pb.minY - gap - cb.maxY];
  }
  overall = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const inst of instances.values()) {
    inst.group.quaternion.copy(inst.q);
    inst.group.position.set(inst.pos[0], inst.pos[1], 0);
    updateSilhouette(inst, force);
    overall.minX = Math.min(overall.minX, inst.pos[0] + inst.bbox.minX);
    overall.maxX = Math.max(overall.maxX, inst.pos[0] + inst.bbox.maxX);
    overall.minY = Math.min(overall.minY, inst.pos[1] + inst.bbox.minY);
    overall.maxY = Math.max(overall.maxY, inst.pos[1] + inst.bbox.maxY);
  }
  updateCamera(stage.clientWidth, stage.clientHeight);
}

// ----------------------------------------------------------------------------- camera / size
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  updateCamera(w, h);
  lineMat.resolution.set(renderer.domElement.width, renderer.domElement.height);
}

function updateCamera(w, h) {
  const aspect = w / h;
  const cx = (overall.minX + overall.maxX) / 2, cy = (overall.minY + overall.maxY) / 2;
  const ex = (overall.maxX - overall.minX) / 2, ey = (overall.maxY - overall.minY) / 2;
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
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, roll: e.shiftKey };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  const rect = canvas.getBoundingClientRect();
  if (drag.roll) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const a0 = Math.atan2(drag.y - cy, drag.x - cx), a1 = Math.atan2(e.clientY - cy, e.clientX - cx);
    baseQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(a1 - a0)));
  } else {
    const k = 0.008;
    baseQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k));
    baseQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k));
  }
  drag.x = e.clientX; drag.y = e.clientY;
  state.viewId = 'custom';
  anim = null;
  markView();
  layout(false);
});
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
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
  const a = document.createElement('a');
  a.href = url;
  const suffix = state.sheet.views.length ? `sheet-${state.sheet.standard}-angle` : state.viewId;
  a.download = `${state.shapeId}-${suffix}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ----------------------------------------------------------------------------- sheet views
function addView(parentId, dir) {
  const id = `v${state.sheet.nextId++}`;
  state.sheet.views.push({ id, parent: parentId, dir, gap: null });
  renderViewList();
  layout(true);
  return id;
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
  return `${v.id}: ${DIR_LABEL[v.dir]} ${parentName}`;
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
    if (v) {
      const gap = document.createElement('input');
      gap.type = 'number'; gap.step = '0.05'; gap.min = '0'; gap.title = 'Gap to parent view (stone widths)';
      gap.value = (v.gap ?? state.sheet.gaps[v.dir]).toFixed(2);
      gap.addEventListener('change', () => { v.gap = parseFloat(gap.value) || 0; layout(true); });
      row.appendChild(gap);
    }
    const btns = document.createElement('span');
    btns.className = 'viewbtns';
    for (const [dir, glyph] of [['left', '←'], ['right', '→'], ['above', '↑'], ['below', '↓']]) {
      const b = document.createElement('button');
      b.textContent = glyph; b.title = `Project a view ${dir} of this one`;
      b.addEventListener('click', () => addView(id, dir));
      btns.appendChild(b);
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
const shapeSel = document.getElementById('shape');
for (const s of SHAPES) {
  const o = document.createElement('option');
  o.value = s.id; o.textContent = s.name;
  shapeSel.appendChild(o);
}
shapeSel.value = state.shapeId;
shapeSel.addEventListener('change', () => loadShape(shapeSel.value));

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
  if (info && geo) info.textContent = `${geo.shape.name} · ${state.viewId} · ${geo.faceCount} facets`;
  const baseName = document.querySelector('#viewlist .viewname');
  if (baseName) baseName.textContent = viewLabel('base');
}
document.getElementById('fit').addEventListener('click', () => { state.zoom = 1; resize(); });

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
  if (!dl || !geo) return;
  const p = geo.proportions;
  const pct = (v) => (v === undefined ? '-' : `${(v * 100).toFixed(1)}%`);
  const rows = [
    ['Lab name', geo.shape.lab],
    ['L:W', p.ratio.toFixed(2)],
    ['Table', p.table !== undefined ? `${Math.round(p.table * 100)}%` : '-'],
    ['Crown angle', p.crownAngle !== undefined ? `${p.crownAngle}°` : '-'],
    ['Crown height', pct(p.crownHeight)],
    ['Girdle', pct(p.girdle)],
    ['Pavilion depth', pct(p.pavilionDepth)],
    ['Total depth', pct(p.crownHeight + p.girdle + p.pavilionDepth)],
  ];
  dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const notes = document.getElementById('notes');
  if (notes) notes.textContent = p.notes || '';
}

// ----------------------------------------------------------------------------- loop
loadShape(state.shapeId);
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
  state, loadShape, snapTo, exportPNG, resize, addView, removeView, clearViews,
  setLineWidth(v) { state.lineWidth = v; lineMat.linewidth = v; },
  setGirdleLines(v) { state.girdleLines = v; layout(true); },
  setZoom(z) { state.zoom = z; resize(); },
  setProjection(p, fov) { state.projection = p; if (fov) state.fov = fov; resize(); },
  setStandard(s) { state.sheet.standard = s; standardSel.value = s; layout(true); },
  render() { layout(true); renderer.render(scene, camera); },
};
