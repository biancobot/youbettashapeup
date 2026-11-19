# youbettashapeup

A browser app that builds 3D models of the standard diamond cutting styles from the facet
patterns used on gem-lab plotting diagrams, lets you rotate them, snap to standard views,
lay out multi-view drawings in first- or third-angle projection, and export line drawings
as PNG.

Rendering is a CAD-style "hidden lines removed" view: white background, solid black edges
of adjustable thickness, no shading. Girdle surfaces are drawn with their silhouette only
(tangent edges), or with every girdle facet line if you prefer.

## Running

It is a static site with ES modules, so it needs to be served over HTTP (not opened from
`file://`). Any static server works:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

No build step and no external dependencies: three.js r170 is vendored under `vendor/`.

## Shapes

| Shape | Lab cutting style | Builder |
| --- | --- | --- |
| Round brilliant | Round Brilliant | brilliant |
| Oval brilliant | Oval Brilliant | brilliant |
| Pear brilliant | Pear Brilliant | brilliant |
| Marquise brilliant | Marquise Brilliant | brilliant |
| Heart brilliant | Heart Brilliant | brilliant (cleft handled as a star on the girdle) |
| Cushion brilliant | Cushion Brilliant | brilliant with a keel culet |
| Square cushion modified brilliant | Square Cushion Modified Brilliant | brilliant crown, fan pavilion |
| Princess | Square Modified Brilliant | X crown, chevron pavilion |
| Radiant | Cut-Cornered Rectangular Modified Brilliant | X crown, fan pavilion |
| Emerald | Emerald Cut | step cut with a keel |
| Asscher | Square Emerald Cut | step cut converging to a point |

The facet patterns follow the plotting-diagram templates printed on IGI reports (one fixed
template per cutting style; GIA uses the same patterns), and the proportions use the
mid-points of the IGI "Excellent" ranges for fancy shapes and GIA's Excellent ranges for the
round brilliant. Each shape's numbers and the source ranges are listed in
`app/geometry/shapes.js` next to the shape, and shown in the panel.

## How the geometry is built

Everything is normalised to a stone width of 1. Model axes: X = width, Y = length (head
up), Z = table normal.

- **Outline** (`outlines.js`): the girdle outline is a dense counter-clockwise polyline
  (circle, ellipse, pear and heart from tangent circular arcs, marquise from two arcs,
  cushion as a superellipse, cut-cornered rectangles). Named anchors are placed on it by
  polar angle, which is how the positions were read off the lab plots.
- **Brilliants** (`brilliant.js`): the crown is a ring of bezel planes, each defined by its
  girdle anchor, a crown angle and an azimuth (direction of steepest descent, the girdle
  normal by default). The table is the plane at crown height; table corners and star tips
  are placed on the intersections of those planes, so every facet is planar by
  construction. Pointed shapes place the star tips beside the point from the plots and let
  the neighbouring wing bezels take the angle that meets them. The pavilion is built the
  same way from mains through the culet (or keel line).
- **Modified brilliants** (`modified.js`): the princess/radiant crown (corner facets, a long
  facet along each side and four triangles meeting at an X) and the chevron and fan
  pavilions are assembled from triangles and planar quads.
- **Step cuts** (`stepcut.js`): concentric cut-cornered rings with parallel edges, so every
  step facet is a trapezoid.
- **Girdle**: drawn as a flat band as on lab diagrams. Facets that meet the girdle along a
  curved arc are then non-planar by the arc's sagitta (a fraction of a percent of the
  width). Set `scallopedGirdle: true` in a shape's proportions to keep those facets exactly
  planar and let the girdle edges scallop instead.

## Views

- **Front**: face-up, table towards you. **Back**: pavilion towards you.
- **Top / Bottom / Left / Right**: profile views from the head end, point end and the two
  sides, drawn table-up like a lab proportion diagram.
- **Isometric**: face-up view kept dominant, tilted to reveal the crown and girdle.
- Drag to rotate freely, shift-drag to roll, scroll to zoom.
- Projection: orthographic (as on lab diagrams) or perspective with an adjustable field of
  view.

## Drawing sheets

Choose third-angle or first-angle projection, then use the arrows on any view in the list
to project a view to its left, right, above or below. Projected views can be projected from
again. Gaps between views are measured between bounding boxes in stone widths, with a
default per direction and an override per projected view. Projected views follow the base
view when you rotate it. Sheets are always orthographic.

## Export

"Export PNG" saves the current canvas (single view or whole sheet) at 1x to 8x resolution
with the line thickness scaled to match.

## Screenshot tool

`tools/shot.mjs` renders shapes headlessly with Playwright and Chromium:

```bash
node tools/shot.mjs all front,back 2 700
node tools/shot.mjs pear front 1.5 900 "base:right,base:above,v1:above" third
```

Arguments: shape (or `all`), views, line width, size, sheet projections, projection
standard, projection type. Output goes to `tools/out/`.

## Layout

```
index.html              UI shell
app/main.js             renderer, rotation, views, sheet layout, export
app/views.js            predefined orientations
app/geometry/core.js    vector maths, planes, mesh builder, triangulation
app/geometry/outlines.js girdle outlines and anchors
app/geometry/brilliant.js, modified.js, stepcut.js   builders
app/geometry/shapes.js  shape registry with proportions
vendor/three/           three.js r170 (MIT) and the fat-line add-ons
```
