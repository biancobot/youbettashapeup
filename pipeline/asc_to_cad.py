"""Exact CAD output for a GemCad-style design: STEP solid and hidden-line SVG views.

    python pipeline/asc_to_cad.py design.asc [out_dir] [--views front,back,top,bottom,left,right,iso] [--hidden]

The design is read exactly as the web app reads it (same index and angle conventions) and
built with OpenCascade as the intersection of its facet half-spaces; the views come from
OpenCascade's hidden-line algorithm, so they are exact vector drawings."""
import sys, os, math, re
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from build123d import *
from build123d import export_step
from gem.views import export_svg, VIEWS


def parse_asc(text):
    gear, tiers = 96, []
    cur = None
    for raw in text.splitlines():
        parts = raw.split()
        if not parts: continue
        if parts[0] == 'g': gear = float(parts[1]); continue
        if parts[0] == 'a':
            angle = float(parts[1].replace('−', '-')); dist = float(parts[2]); idx = []; name = ''; i = 3
            while i < len(parts):
                if parts[i] == 'n': name = parts[i + 1] if i + 1 < len(parts) else ''; i += 2; continue
                if parts[i] == 'G': break
                if re.fullmatch(r'-?\d+(\.\d+)?', parts[i]): idx.append(float(parts[i]))
                i += 1
            cur = {'name': name, 'angle': angle, 'distance': dist, 'indices': idx}; tiers.append(cur); continue
        if cur and all(re.fullmatch(r'-?\d+(\.\d+)?', t) for t in parts): cur['indices'] += [float(t) for t in parts]
    return gear, tiers


def facet_plane(angle, index, gear, dist):
    a = math.radians(abs(angle)); az = math.radians(90 - 360 * index / gear); sign = 1 if angle >= 0 else -1
    n = np.array([math.sin(a) * math.cos(az), math.sin(a) * math.sin(az), sign * math.cos(a)])
    return n, dist


def build(gear, tiers, size=6.0):
    solid = Box(size, size, size)
    for t in tiers:
        for k in (t['indices'] or [0]):
            n, d = facet_plane(t['angle'], k, gear, t['distance'])
            cutter = Plane(origin=tuple(n * d), z_dir=tuple(n)).location * Box(2 * size, 2 * size, 2 * size, align=(Align.CENTER, Align.CENTER, Align.MIN))
            solid = solid - cutter
    return solid


def main(argv):
    if len(argv) < 2: print(__doc__); return 1
    path = argv[1]; out = argv[2] if len(argv) > 2 and not argv[2].startswith('--') else os.path.join(os.path.dirname(path) or '.', 'cad')
    views = list(VIEWS); hidden = '--hidden' in argv
    for i, a in enumerate(argv):
        if a == '--views': views = argv[i + 1].split(',')
    os.makedirs(out, exist_ok=True)
    gear, tiers = parse_asc(open(path).read())
    solid = build(gear, tiers)
    base = os.path.splitext(os.path.basename(path))[0]
    export_step(solid, os.path.join(out, base + '.step'))
    for v in views: export_svg(solid, v, os.path.join(out, f'{base}-{v}.svg'), hidden=hidden)
    print(f'{base}: {len(solid.faces())} faces, STEP and {len(views)} SVG views in {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
