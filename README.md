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

Then open `http://localhost:8000/`. The preview pane has a menu (the three dots at its top right) with Export PNG, Fit views to page and Fit preview. The page header shows its build number (currently 96); if it
shows an older one after a `git pull`, hard-reload (Ctrl+Shift+R). Pass another port as `node tools/serve.mjs 8123` if 8000
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
  (128 by default for fancy shapes, 64 for the round). Curved-outline shapes space their girdle facets by equal arc length along the outline (so every
  facet has the same length, with vertices on the axes), bezels and mains touch the girdle at a
  facet vertex, and the upper and lower girdle facets scallop the girdle between those points
  (hills at the bezels, valleys at the junctions). Polygon girdles (step cuts, princess, radiant)
  have one facet per edge.
- **Preforms.** Fancy outlines are girdle tiers whose per-index distances follow the outline:
  round, ellipse at any L:W, rectangle or cut-cornered rectangle. Apply one and design over it.
- **Round brilliant generator.** Builds the standard round brilliant from GIA's proportion
  parameters (table, crown angle, pavilion angle, star length, lower-girdle length, girdle).
  These define the cut completely, and the result matches the lab plotting diagram.
- **Plot underlay.** Load a lab plotting diagram (the bundled IGI crown and pavilion plots, GIA's
  French-tip marquise wireframe, or your own image) and it is drawn in red over the stone in the front or back view, scaled so
  its girdle width matches the stone's. Trace a design against it by adjusting tiers and
  cutting meet points. Opacity, scale trim, shift and mirror controls are provided, and "Stretch to stone L:W" also
  scales the plot along the length so a design built at another L:W can be compared with it.
- **Notes.** Each design carries notes listing published ideal dimensions and ranges where
  they exist (GIA Excellent for the round; IGI Excellent ranges for fancy shapes), the lab
  plot pattern, and trade practice. Notes are editable and saved with the design `.json`.
- **GemCad files.** Import and export `.asc` (GemCad for Windows format), so designs exchange
  with GemCad and Gem Cut Studio. Preform tiers with per-index distances are written as one
  tier per index. `designs/` holds the generated round brilliant.

## Shapes

Every traditional shape ships as a starting design reproducing its IGI plotting template, one
template per variant found on the reports (see `designs/plots/README.md` for the sources):
round brilliant (GIA proportions); marquise (French tips with GIA-wireframe proportions,
uncorrected points, both with the GIA wireframe's 6-main pavilion, the mains under the belly bezels;
uncorrected points with an 8-main pavilion, a main under every bezel, or a 4-main pavilion, mains under
the wing bezels only; and the side-hub crown variant with the IGI 8-main pavilion); pear and heart (French tip and uncorrected
point); oval (8-main and 4-main pavilions, and an 8-main variant with the bezels and mains at the heads); cushion brilliant; square cushion modified
brilliant (the crushed-ice pattern of a GIA plotting diagram, optional square culet); princess;
radiant; emerald; asscher; shield brilliant (French tip and uncorrected point, designed from the
pear's pattern since no lab template exists); step-cut shields in three proportions (a kite shield, a
hexagonal shield and a wide shield, all six-sided, measured from photographs and face-up silhouettes); trillion (triangular brilliant from a
reference drawing, bowed or straight sides, and a brilliant-style variant); round single cut (eight cut) and the antique old mine
cut (cushion, small table, high crown, deep pavilion, large culet); the heart also comes with the hand-drawn
reference profile. The heart is the one non-convex stone: it is built as the union of
two convex halves split on the mirror plane, with the cleft facets applied to one half each.
`node tools/gallery.mjs && python3 tools/gallery.py` renders every template's front, back and
iso views into one sheet. `node tools/audit.mjs` is the meet-point and girdle audit every template must
pass: facets that reach the girdle meet their neighbours at shared girdle vertices (bezel tips and
upper-girdle junctions are points on the girdle), no facet cuts the girdle below half its
thickness, no slivers, every tier produces faces.

Only the round brilliant ships as a finished design: it is the one cut whose proportions are
published as a complete parameter set. The marquise ships as a starting point: the lab plots'
facet patterns (GIA's wireframe, IGI's plots) (vertex positions measured on the crown and pavilion plots) with typical angles,
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
follow the base view, and are spaced by configurable gaps. **3D** beside a view adds an
isometric view of it on a chosen side; dragging over a 3D view turns it on its own (shift-drag
rolls it, alt-drag moves it, the wheel over it scales it, ↺ resets it) while it still follows
its parent when the base turns. Each view can be locked against accidental dragging and can
show its hidden lines in light grey. A grid option draws a table with a cell per view (columns
and rows found from the views' extents), with adjustable line opacity and border. A page
(8.5 × 8.5 by default, or Letter, A4 or custom inches, with the stone's width on the page in
inches as the drawing scale, and a Fit button that scales all the views together to a share of
the page, or of the space the title and description leave free when they are in the way, and centres them there) frames the sheet with its outline always drawn; views can be centred on it horizontally or vertically, the arrangement can be
alt-dragged across it, the preview pans (right-drag) and zooms about the cursor with a Fit button to
reframe, and Export PNG then writes the page at the chosen DPI. A background option fills the
free area, right up to the views' outlines, with a cobblestone pavé of the current stone (a tangent
circle packing: sizes from the largest chosen carat weight down to the smallest, each stone's
circumscribed circle touching its neighbours, sized by the trade weight estimators, random orientations and opacities, with outline
stones labelled 0.25 to 5 ct at the trade size chart's dimensions for shapes the estimators cover) or, for the marquise, a hexafoil:
the flower of life with a marquise in every lens and the construction circles drawn, at one size
and opacity. Title and description text blocks (font, size, bold, italic, alignment and width, dragged into place
or snapped to the page's centre, filled by the caption or by the shape notes) sit on the page with the
views. **Info page** sets the whole sheet up in one click: an 8.5 × 8.5 in page, the shape's title and its
shape note at the top, and six views (the face-up view with its left, right, above and below projections
and the pavilion below those) fitted and centred in the space under the text; the gaps, stone width,
positions and text stay adjustable afterwards. Without a page,
Export PNG writes the preview at 1x to 8x. The whole setup (design, form, views, page, grid,
background, rotation) is kept in the browser's local storage as you work and restored on the next
load; Save/Load setup writes and reads it as a .json file, Reset to defaults clears it (or open the
page with `?fresh=1`).

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
app/main.js                  renderer, rotation, views, sheets, page, meet-point picking, export
app/pave.js                  pavé and hexafoil backgrounds (packing, tiling, rendering)
app/gemcad/weights.js        diamond weight estimator factors and carat-to-millimetre sizes
tools/sizes.mjs              writes designs/size-chart.md: estimator sizes per shape beside Stuller's trade chart
tools/captions.mjs           writes designs/captions.md (the publishable title and description of every design) and designs/shape-notes.md (a fact or two per shape)
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
tools/overlay.mjs, gallery.* template over a plot underlay; gallery of every template
app/gemcad/shapebuild.js     outlines, girdle polygons, planes, symmetry-class tiers for fancy shapes
app/gemcad/shapes/           one module per shape (templates, plots, measured plot data)
vendor/three/                three.js r170 (MIT) and the fat-line add-ons
```
