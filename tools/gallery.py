# Compose tools/out/gallery-tiles into one labelled PNG: python3 tools/gallery.py [out.png]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tiles = os.path.join(root, 'tools', 'out', 'gallery-tiles')
m = json.load(open(os.path.join(tiles, 'manifest.json')))
S = m['size']; views = m['views']; keys = m['keys']
cols = 2; cell_w = S * len(views) + 20; cell_h = S + 34; pad = 10
rows = (len(keys) + cols - 1) // cols
im = Image.new('RGB', (cols * cell_w + pad, rows * cell_h + pad), 'white'); d = ImageDraw.Draw(im)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except Exception: font = ImageFont.load_default()
for i, k in enumerate(keys):
    x0 = pad + (i % cols) * cell_w; y0 = pad + (i // cols) * cell_h
    d.text((x0, y0), k['name'], fill='black', font=font)
    for j, v in enumerate(views):
        t = Image.open(os.path.join(tiles, f"{k['key']}-{v}.png")).convert('RGB')
        im.paste(t, (x0 + j * S, y0 + 24))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'tools', 'out', 'gallery.png')
im.save(out, optimize=True); print(out, im.size)
