// Plot underlay: a lab plotting diagram drawn over the stone in the front or back view so a
// design can be traced against it. The image's dark lines are recoloured and multiplied over the
// drawing, scaled so the plot's girdle width equals the stone's width.
import * as THREE from '../vendor/three/three.module.js';

export function createUnderlay(scene, { color = [220, 0, 0] } = {}) {
  const state = { visible: true, opacity: 0.6, view: 'front', scale: 1, dx: 0, dy: 0, mirror: false, stretch: false, bbox: null, aspect: 1, name: '' };
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: state.opacity, depthTest: false, depthWrite: false, blending: THREE.MultiplyBlending });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 20; mesh.visible = false;
  scene.add(mesh);

  /** Load an image (File, Blob or URL) and build the tinted texture. */
  async function load(src, name) {
    const img = await loadImage(src);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height); const d = data.data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const dark = d[i + 3] > 40 && lum < 140;
      if (dark) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      // dark pixels become the tint colour, everything else white (multiply blending leaves white untouched)
      const t = dark ? 1 - lum / 140 : 0;
      d[i] = 255 - (255 - color[0]) * t; d[i + 1] = 255 - (255 - color[1]) * t; d[i + 2] = 255 - (255 - color[2]) * t; d[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    if (x1 <= x0) throw new Error('no dark lines found in the image');
    state.bbox = { x0, y0, x1, y1, w: c.width, h: c.height };
    state.aspect = c.height / c.width;
    state.name = name || '';
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    if (mat.map) mat.map.dispose();
    mat.map = tex; mat.needsUpdate = true;
    return state;
  }

  /**
   * Place the underlay for the current base view. stoneBox: [[minx,miny,minz],[maxx,maxy,maxz]] of
   * the stone in model space (width along x). pos: base view position on the sheet.
   */
  function place(stoneBox, pos, currentView) {
    const shown = state.visible && mat.map && (state.view === 'always' || state.view === currentView);
    mesh.visible = !!shown;
    if (!shown) return;
    const b = state.bbox;
    const stoneW = stoneBox[1][0] - stoneBox[0][0];
    const plotW = b.x1 - b.x0;                       // plot girdle width in pixels
    const unitsPerPx = (stoneW / plotW) * state.scale;
    // with `stretch`, the plot is also scaled along the length so its girdle length matches the
    // stone's (an affine fit, for comparing a design built at another L:W than the plot's)
    const stoneL = stoneBox[1][1] - stoneBox[0][1], plotL = b.y1 - b.y0;
    const unitsPerPxY = state.stretch ? (stoneL / plotL) * state.scale : unitsPerPx;
    const w = b.w * unitsPerPx, h = b.h * unitsPerPxY;
    // centre of the plot's girdle bbox goes to the stone's centre
    const cx = (b.x0 + b.x1) / 2 - b.w / 2, cy = (b.y0 + b.y1) / 2 - b.h / 2;   // offsets of the bbox centre from the image centre (px)
    const sx = state.mirror ? -1 : 1;
    mesh.scale.set(w * sx, h, 1);
    const stoneCx = (stoneBox[0][0] + stoneBox[1][0]) / 2, stoneCy = (stoneBox[0][1] + stoneBox[1][1]) / 2;
    mesh.position.set(pos[0] + stoneCx - cx * unitsPerPx * sx + state.dx, pos[1] + stoneCy + cy * unitsPerPxY + state.dy, 2.5);
    mat.opacity = state.opacity;
  }

  return { state, load, place, mesh };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = () => reject(new Error('could not load image'));
    if (typeof src === 'string') img.src = src; else img.src = URL.createObjectURL(src);
  });
}
