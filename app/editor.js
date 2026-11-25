// Design editor: tiers table, symmetry-aware index entry, cut-to-meet-point, .asc import/export.
import { newTier, expandIndex, distanceThrough, parseAsc, toAsc, resetIds } from './gemcad/design.js?v=80';
import { roundBrilliant } from './gemcad/generators.js?v=80';
import { templates, preforms } from './gemcad/templates.js?v=80';

export function createEditor({ onChange, getSelectedVertex, saveText }) {
  let design = roundBrilliant();
  let selectedTier = null;

  const el = (id) => document.getElementById(id);
  const tbody = el('tiers');

  function parseIndices(text, gear) {
    const out = [];
    for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
      const m = tok.match(/^(-?\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/);
      if (!m) continue;
      const v = parseFloat(m[1]);
      out.push(((v % gear) + gear) % gear);
    }
    return [...new Set(out.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  }

  function render() {
    el('dname').value = design.name;
    el('gear').value = design.gear;
    el('fold').value = design.fold;
    el('mirror').checked = design.mirror;
    tbody.innerHTML = '';
    design.tiers.forEach((t, i) => {
      const tr = document.createElement('tr');
      if (t.id === selectedTier) tr.classList.add('sel');
      tr.innerHTML = `
        <td><input class="name" value="${esc(t.name)}" title="Facet name"></td>
        <td><input class="angle" type="number" step="0.01" value="${fmt(t.angle)}" title="Angle to the girdle plane: 0 table, 90 girdle, negative pavilion"></td>
        <td><input class="dist" type="number" step="0.0001" value="${fmt(t.distance, 4)}" title="Centre-to-facet distance" ${t.distances ? 'disabled' : ''}></td>
        <td><input class="idx" value="${t.distances ? t.indices.length + ' (preform)' : t.indices.map(fmtIdx).join(' ')}" title="Index wheel positions" ${t.distances ? 'disabled' : ''}></td>
        <td class="acts">
          <button class="meet" title="Cut this tier so the facet passes through the selected meet point">meet</button>
          <button class="hide" title="Hide or show this tier">${t.hidden ? 'show' : 'hide'}</button>
          <button class="up" title="Move up">↑</button><button class="down" title="Move down">↓</button>
          <button class="del" title="Delete tier">×</button>
        </td>`;
      tr.addEventListener('click', () => { selectedTier = t.id; markSelected(); });
      tr.querySelector('.name').addEventListener('change', (e) => { t.name = e.target.value; changed(false); });
      tr.querySelector('.angle').addEventListener('change', (e) => { t.angle = clampAngle(parseFloat(e.target.value)); changed(); });
      tr.querySelector('.dist').addEventListener('change', (e) => { t.distance = parseFloat(e.target.value) || 0; changed(); });
      tr.querySelector('.idx').addEventListener('change', (e) => { t.indices = parseIndices(e.target.value, design.gear); changed(); });
      tr.querySelector('.meet').addEventListener('click', (e) => { e.stopPropagation(); cutToMeet(t); });
      tr.querySelector('.hide').addEventListener('click', (e) => { e.stopPropagation(); t.hidden = !t.hidden; changed(); });
      tr.querySelector('.up').addEventListener('click', (e) => { e.stopPropagation(); if (i > 0) { design.tiers.splice(i, 1); design.tiers.splice(i - 1, 0, t); changed(); } });
      tr.querySelector('.down').addEventListener('click', (e) => { e.stopPropagation(); if (i < design.tiers.length - 1) { design.tiers.splice(i, 1); design.tiers.splice(i + 1, 0, t); changed(); } });
      tr.querySelector('.del').addEventListener('click', (e) => { e.stopPropagation(); design.tiers.splice(i, 1); changed(); });
      tbody.appendChild(tr);
    });
    markSelected();
    renderNotes();
  }
  function markSelected() {
    [...tbody.children].forEach((tr, i) => tr.classList.toggle('sel', design.tiers[i].id === selectedTier));
  }
  function changed(rebuild = true) {
    if (rebuild) onChange(design);
    render();
  }
  function renderNotes() {
    const box = el('notes'); if (!box) return;
    const notes = design.notes || [];
    box.innerHTML = notes.length ? '<ul>' + notes.map((n) => `<li>${esc(n)}</li>`).join('') + '</ul>' : '<div class="hint">No notes for this design.</div>';
    const ta = el('notesedit'); if (ta) ta.value = notes.join('\n');
  }
  el('notesedit').addEventListener('change', (e) => { design.notes = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean); renderNotes(); });
  function cutToMeet(t) {
    const v = getSelectedVertex();
    if (!v) { setStatus('Select a meet point in the view first (click near a vertex).'); return; }
    if (!t.indices.length) { t.distance = v[2]; changed(); return; }
    // distance so that the facet at the tier's first index passes through v; the symmetric
    // facets then pass through the symmetric points
    const idx = nearestIndexTo(t, v);
    t.distance = distanceThrough(t, idx, design.gear, v);
    if (t.distances) t.distances = null;
    setStatus(`${t.name || 'tier'}: distance ${t.distance.toFixed(5)} through meet point at index ${fmtIdx(idx)}.`);
    changed();
  }
  function nearestIndexTo(t, v) {
    const az = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    let best = t.indices[0], bd = Infinity;
    for (const k of t.indices) {
      const a = 90 - (360 * k) / design.gear;
      const d = Math.abs(((a - az + 540) % 360) - 180);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function setStatus(msg) { el('estatus').textContent = msg; }

  // ---- header fields
  el('dname').addEventListener('change', (e) => { design.name = e.target.value; });
  el('gear').addEventListener('change', (e) => { design.gear = parseFloat(e.target.value) || 96; changed(); });
  el('fold').addEventListener('change', (e) => { design.fold = parseInt(e.target.value, 10) || 1; });
  el('mirror').addEventListener('change', (e) => { design.mirror = e.target.checked; });

  // ---- add tier
  el('addtier').addEventListener('click', () => {
    const angle = clampAngle(parseFloat(el('nangle').value));
    const index = parseFloat(el('nindex').value) || 0;
    const dist = parseFloat(el('ndist').value) || 0.5;
    const indices = el('nsym').checked ? expandIndex(index, design.gear, design.fold, design.mirror) : [index];
    const t = newTier({ name: el('nname').value || '', angle, distance: dist, indices });
    design.tiers.push(t); selectedTier = t.id;
    const v = getSelectedVertex();
    if (v && el('nmeet').checked) { t.distance = distanceThrough(t, nearestIndexTo(t, v), design.gear, v); }
    changed();
  });

  // ---- templates / generators
  const sel = el('template');
  for (const [key, tpl] of Object.entries(templates)) {
    const o = document.createElement('option'); o.value = key; o.textContent = tpl.name; sel.appendChild(o);
  }
  // Proportions form: each template declares `params` ([{ key, label, default, step, min, max, list }]);
  // the inputs feed make(), and any change rebuilds the design from the template.
  const pbox = el('tpl-params');
  function renderParams() {
    const tpl = templates[sel.value]; pbox.innerHTML = '';
    for (const p of (tpl && tpl.params) || []) {
      const lab = document.createElement('label'); lab.textContent = p.label + ' ';
      const inp = document.createElement('input'); inp.dataset.param = p.key; inp.title = p.title || p.key;
      if (p.list) { inp.type = 'text'; inp.className = 'list'; inp.value = p.default.join(', '); }
      else { inp.type = 'number'; inp.value = p.default; if (p.step) inp.step = p.step; if (p.min != null) inp.min = p.min; if (p.max != null) inp.max = p.max; }
      inp.addEventListener('change', () => loadTemplate());
      lab.appendChild(inp); pbox.appendChild(lab);
    }
    pbox.style.display = pbox.children.length ? '' : 'none';
  }
  function templateOptions() {
    const tpl = templates[sel.value]; const opts = {};
    const gf = parseInt(el('tpl-gf').value, 10); if (gf > 0) opts.girdleFacets = gf;
    for (const p of (tpl && tpl.params) || []) {
      const inp = pbox.querySelector(`input[data-param="${p.key}"]`); if (!inp) continue;
      if (p.list) { const v = inp.value.split(/[\s,;]+/).filter(Boolean).map(Number); if (v.length && v.every(Number.isFinite)) opts[p.key] = v; }
      else { const v = parseFloat(inp.value); if (Number.isFinite(v)) opts[p.key] = v; }
    }
    return opts;
  }
  function loadTemplate() {
    const tpl = templates[sel.value]; if (!tpl) return;
    try { design = resetIds(tpl.make(templateOptions())); selectedTier = null; setStatus(tpl.note || ''); changed(); }
    catch (err) { setStatus('Could not build with these proportions: ' + err.message); }
  }
  // Load as soon as the selection changes, however it changes: the change event, input events, and
  // keyboard navigation on the closed select (arrow keys and type-ahead), which some browsers only
  // report once the control loses focus.
  let loadedKey = null;
  function syncTemplate() { if (sel.value === loadedKey) return; loadedKey = sel.value; renderParams(); loadTemplate(); }
  sel.addEventListener('change', syncTemplate);
  sel.addEventListener('input', syncTemplate);
  sel.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 0;
    if (!step || e.altKey || e.metaKey) return;   // alt/cmd + arrow opens the native list; let the browser handle that
    e.preventDefault();
    sel.selectedIndex = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + step));
    syncTemplate();
  });
  sel.addEventListener('keyup', syncTemplate);   // type-ahead selection by letter
  el('loadtemplate').addEventListener('click', loadTemplate);
  loadedKey = sel.value; renderParams();
  const psel = el('preform');
  for (const [key, pf] of Object.entries(preforms)) { const o = document.createElement('option'); o.value = key; o.textContent = pf.name; psel.appendChild(o); }
  el('applypreform').addEventListener('click', () => {
    const pf = preforms[psel.value]; if (!pf) return;
    const tier = pf.make({ ratio: parseFloat(el('pf-ratio').value) || 1, corner: parseFloat(el('pf-corner').value) || 0, count: parseInt(el('pf-count').value, 10) || 64, gear: design.gear });
    const gi = design.tiers.findIndex((t) => Math.abs(t.angle) === 90);
    if (gi >= 0 && el('pf-replace').checked) design.tiers[gi] = tier; else design.tiers.unshift(tier);
    setStatus(`Girdle preform: ${pf.name}, ${tier.indices.length} facets.`); changed();
  });
  // ---- import / export
  el('ascfile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { design = resetIds(parseAsc(await f.text())); selectedTier = null; setStatus(`Loaded ${f.name}: ${design.tiers.length} tiers.`); changed(); }
    catch (err) { setStatus('Could not read file: ' + err.message); }
    e.target.value = '';
  });
  el('exportasc').addEventListener('click', () => saveText(`${(design.name || 'design').replace(/[^\w-]+/g, '_')}.asc`, toAsc(design)));
  el('exportjson').addEventListener('click', () => saveText(`${(design.name || 'design').replace(/[^\w-]+/g, '_')}.json`, JSON.stringify(design, null, 2)));

  render();
  return {
    get design() { return design; },
    set design(d) { design = resetIds(d); selectedTier = null; changed(); },
    render, setStatus,
    /** Select a template in the form without loading it (restoring a saved setup); returns the param inputs. */
    setTemplate(key) { if ([...sel.options].some((o) => o.value === key)) { sel.value = key; loadedKey = key; renderParams(); } return [...pbox.querySelectorAll('input[data-param]')]; },
    get templateKey() { return sel.value; },
  };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fmt = (v, p = 2) => (Math.round(v * 10 ** p) / 10 ** p).toString();
const fmtIdx = (k) => (Number.isInteger(k) ? String(k) : String(Math.round(k * 1000) / 1000));
const clampAngle = (a) => Math.max(-90, Math.min(90, isFinite(a) ? a : 0));
