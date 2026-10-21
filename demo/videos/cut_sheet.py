# 将"片段起始帧"拼成带时间标签的网格图（文件名 cNN_时间.png）
import os
from PIL import Image, ImageDraw, ImageFont

FONT = r'C:/Windows/Fonts/msyh.ttc'
BASE = os.path.dirname(os.path.abspath(__file__))
CUTS = os.path.join(BASE, 'cuts')

def font(sz):
    return ImageFont.truetype(FONT, sz)

for name, cols in [('mini', 4), ('web', 3), ('admin', 4)]:
    d = os.path.join(CUTS, name)
    files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
    if not files:
        print('SKIP', name); continue
    im0 = Image.open(os.path.join(d, files[0]))
    tw, th = im0.size
    lh = 34
    rows = (len(files) + cols - 1) // cols
    W, H = cols * tw, rows * (th + lh)
    canvas = Image.new('RGB', (W, H), '#20242B')
    dr = ImageDraw.Draw(canvas)
    for i, f in enumerate(files):
        t = float(f.rsplit('_', 1)[1].replace('.png', ''))
        r, c = divmod(i, cols)
        x, y = c * tw, r * (th + lh)
        dr.rectangle([x, y, x + tw - 1, y + lh - 1], fill='#0A6E78')
        dr.text((x + 10, y + 4), f'#{i+1}  {int(t//60):02d}:{t%60:04.1f}', font=font(22), fill='white')
        canvas.paste(Image.open(os.path.join(d, f)), (x, y + lh))
    out = os.path.join(BASE, f'sheet_cuts_{name}.png')
    canvas.save(out, optimize=True)
    print('SAVED', name, canvas.size, len(files))
