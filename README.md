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
- **Proportions.** Each template declares its parameters (L:W, corner cut or radius, table size,
  crown and pavilion angles or heights, step positions, French-tip settings, and so on). They
  appear as a form under the template list; changing one rebuilds the whole design, so every
  facet follows the new outline and heights by the same meet-point rules. The round brilliant's
  GIA proportion parameters are in the same form.
- **Girdle facets.** Templates load with the girdle facet count set beside the template list
  (128 by default for fancy shapes, 64 for the round). Fancy-shape girdles are offset half a
  step so bezels and mains touch the girdle at a facet vertex, and the upper and lower girdle
  facets scallop the girdle between those points (hills at the bezels, valleys at the junctions).
- **Preforms.** Fancy outlines are girdle tiers whose per-index distances follow the outline:
  round, ellipse at any L:W, rectangle or cut-cornered rectangle. Apply one and design over it.
- **Round brilliant generator.** Builds the standard round brilliant from GIA's proportion
  parameters (table, crown angle, pavilion angle, star length, lower-girdle length, girdle).
  These define the cut completely, and the result matches the lab plotting diagram.
- **Plot underlay.** Load a lab plotting diagram (the bundled IGI crown and pavilion plots, GIA's
  French-tip marquise wireframe, or your own image) and it is drawn in red over the stone in the front or back view, scaled so
  its girdle width matches the stone's. Trace a design against it by adjusting tiers and
  cutting meet points. Opacity, scale trim, shift and mirror controls are provided.
- **Notes.** Each design carries notes listing published ideal dimensions and ranges where
  they exist (GIA Excellent for the round; IGI Excellent ranges for fancy shapes), the lab
  plot pattern, and trade practice. Notes are editable and saved with the design `.json`.
- **GemCad files.** Import and export `.asc` (GemCad for Windows format), so designs exchange
  with GemCad and Gem Cut Studio. Preform tiers with per-index distances are written as one
  tier per index. `designs/` holds the generated round brilliant.

Only the round brilliant ships as a finished design: it is the one cut whose proportions are
published as a complete parameter set. The marquise ships as a starting point: the IGI plot's
facet pattern (vertex positions measured on the crown and pavilion plots) with typical angles,
meant to be traced against the underlay. Fancy-shape facets are built the GemCad way: a facet
that reaches the girdle touches the outline at the plot's contact point, so its azimuth is the
outline normal there (not the radial direction), and the other facets pass through three meet
points. Pointed shapes (marquise, pear, heart) default to French tips as drawn in GIA's 4Cs
marquise wireframe: no bezel at the point; eight facets meet at a hub on the axis, two tip
facets forming the point, two small upper girdle facets, the two wing bezels and two
half-bezels running to the table corner. The hub sits on the wing bezels' ridge, so its
position follows the wing angle (`wingAngle`, `tipHubHeight`, `tipTable` in `marquiseStart`).
A second template uses the proportions read off GIA's wireframe (table 52%, crown 33°, hub
23% from the point) and overlays it closely; a third keeps uncorrected points (a shallow bezel
at each point). Templates take the girdle facet count and L:W from the fields beside the list; left blank, each template uses its own defaults (the plot's L:W). Other cuts are
designed in the app from a preform, or imported. `designs/` holds `.asc` exports of all three.

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
