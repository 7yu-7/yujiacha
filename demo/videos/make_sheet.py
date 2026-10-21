# 将抽帧结果拼成带 MM:SS 时间标签的网格图，便于人工定位功能段落
import os, sys
from PIL import Image, ImageDraw, ImageFont

FONT = r'C:/Windows/Fonts/msyh.ttc'
BASE = os.path.dirname(os.path.abspath(__file__))

JOBS = [
    # (目录, 采样间隔秒, 列数, 输出文件)
    ('mini',  6, 7, 'sheet_mini_labeled.png'),
    ('web',   5, 6, 'sheet_web_labeled.png'),
    ('admin', 5, 6, 'sheet_admin_labeled.png'),
]

def font(sz):
    return ImageFont.truetype(FONT, sz)

for name, step, cols, out in JOBS:
    d = os.path.join(BASE, 'frames', name)
    files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
    if not files:
        print('SKIP', name); continue
    im0 = Image.open(os.path.join(d, files[0]))
    tw, th = im0.size
    label_h = 30
    rows = (len(files) + cols - 1) // cols
    W, H = cols * tw, rows * (th + label_h)
    canvas = Image.new('RGB', (W, H), '#20242B')
    dr = ImageDraw.Draw(canvas)
    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x, y = c * tw, r * (th + label_h)
        t = i * step
        dr.rectangle([x, y, x + tw - 1, y + label_h - 1], fill='#0A6E78')
        dr.text((x + 8, y + 3), f'{t//60:02d}:{t%60:02d}', font=font(20), fill='white')
        canvas.paste(Image.open(os.path.join(d, f)), (x, y + label_h))
    canvas.save(os.path.join(BASE, out), optimize=True)
    print('SAVED', out, canvas.size, len(files), 'frames')
