# Gem Facet Designer

A browser app that designs faceted gemstones the way GemCad does: every facet is a plane
defined by its angle to the girdle plane, its position on an index wheel and its distance
from the stone's centre, and the stone is the intersection of those half-spaces. The result
is exact by construction, which is what makes it suitable for drawings. The app shows the
stone as a hidden-line drawing (white background, black edges, adjustable thickness), snaps
to standard views, lays out first- or third-angle drawing sheets, and exports PNG. A Python
companion produces STEP solids and exact vector SVG views with OpenCascade.

## Running

```bash
npm start
```

Then open `http://localhost:8000/`. Pass another port as `node tools/serve.mjs 8123` if 8000
is taken. The site is static ES modules, so it must be served over HTTP (not `file://`).
`diag.html` runs a step-by-step load check if the page does not come up.

## Designing

- **Tiers.** The table lists tiers: name, angle (0 = table, 90 = girdle facet, negative =
  pavilion), centre-to-facet distance, and index positions on the gear (96 by default; index
  0 at 12 o'clock, clockwise). Edit any cell and the stone rebuilds.
- **Symmetry.** Set n-fold and mirror; adding a tier with one index expands it to the
  symmetric set.
- **Meet points.** Click near a vertex in the view to select it, then press **meet** on a tier:
  its distance is set so the facet passes through that point. Add-tier can do the same with
  "through meet point".
- **Preforms.** Fancy outlines are girdle tiers whose per-index distances follow the outline:
  round, ellipse at any L:W, rectangle or cut-cornered rectangle. Apply one and design over it.
- **Round brilliant generator.** Builds the standard round brilliant from GIA's proportion
  parameters (table, crown angle, pavilion angle, star length, lower-girdle length, girdle).
  These define the cut completely, and the result matches the lab plotting diagram.
- **GemCad files.** Import and export `.asc` (GemCad for Windows format), so designs exchange
  with GemCad and Gem Cut Studio. Preform tiers with per-index distances are written as one
  tier per index. `designs/` holds the generated round brilliant.

Only the round brilliant ships as a finished design: it is the one cut whose proportions are
published as a complete parameter set. Other cuts are designed in the app, from a preform,
or imported.

## Views and sheets

Front (face-up), back, top, bottom, left, right and isometric snaps; free rotation by drag;
spin about the table axis with 22.5° and 45° quick turns; orthographic or perspective
projection. Drawing sheets: choose first- or third-angle projection, then click L, R, A or B
beside a view to project a new view from it; projected views can be projected from again,
follow the base view, and are spaced by configurable gaps. Export PNG at 1x to 8x.

## Exact CAD output

```bash
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
.venv/bin/python pipeline/asc_to_cad.py designs/round-brilliant-gia.asc out --hidden
```

Writes a STEP solid and SVG views (front, back, top, bottom, left, right, iso) produced by
OpenCascade's hidden-line algorithm, with hidden edges on a dashed layer when `--hidden` is
given. The same `.asc` the app exports is the input, read with the same conventions.

## Layout

```
index.html, diag.html        UI shell, load diagnostics
app/main.js                  renderer, rotation, views, sheets, meet-point picking, export
app/editor.js                tiers table, symmetry, preforms, .asc import/export
app/gemcad/design.js         design model, facet planes, index conventions, .asc parser/writer
app/gemcad/polytope.js       half-space clipping core
app/gemcad/generators.js     round brilliant from GIA proportions, preform support functions
app/gemcad/templates.js      starting designs and preforms
app/gemcad/mesh.js           polytope to render buffers, stone statistics
app/views.js                 standard orientations
app/geometry/core.js         small vector maths and triangulation helpers
pipeline/asc_to_cad.py       .asc to STEP and hidden-line SVG (OpenCascade via build123d)
tools/serve.mjs, shot.mjs    static server, headless screenshots
vendor/three/                three.js r170 (MIT) and the fat-line add-ons
```
