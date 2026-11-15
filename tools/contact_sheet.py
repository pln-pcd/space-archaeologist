"""Contact sheet of PNGs: python -I tools/contact_sheet.py <out.jpg> <png...> (3 columns, 640 px tiles)"""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
W, H, C = 640, 360, 3
R = (len(files) + C - 1) // C
sheet = Image.new("RGB", (W * C, H * R), (20, 16, 46))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H))
    sheet.paste(im, ((i % C) * W, (i // C) * H))
    d.text(((i % C) * W + 8, (i // C) * H + 6), f.split("/")[-1].split("\\")[-1], fill=(255, 230, 160))
sheet.save(out, quality=85)
