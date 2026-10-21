# 鱼价查 · 四端功能展示图拼接
# 读取 demo/shots 下四张高清截图，统一高度缩放后拼成 2x2 网格（左列宽屏端、右列手机端），
# 加标题条与顶部大标题，输出单张 PNG 到桌面。
import os
from PIL import Image, ImageDraw, ImageFont

SHOTS = 'demo/shots'
OUT = r'C:/Users/岳思雨/OneDrive/桌面/鱼价查_四端功能展示.png'
FONT = r'C:/Windows/Fonts/msyh.ttc'

def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)

THUMB_H = 1080      # 每张缩略图统一高度
TITLE_H = 96        # 标题条高度
INNER_GAP = 30      # 同列上下格间距
COL_GAP = 44        # 左右列间距
MARGIN = 52         # 外边距
TOP_H = 150         # 顶部大标题区高度

cells = [
    ('web',   'Web 网站（H5）',          '全国行情浏览 · 智能搜索 · 地图选省 · 关注与日报表'),
    ('admin', '管理后台',                '用户治理 · 价格数据修正 · 阈值推送 · 审计日志'),
    ('mini',  '微信小程序',              'UniApp 同源编译，行情/搜索/关注/地图/日报随身查'),
    ('app',   '移动 App（iOS / Android）','原生手机壳预览，与小程序同一套客户端'),
]

imgs = {}
for key, _, _ in cells:
    im = Image.open(f'{SHOTS}/{key}.png').convert('RGB')
    w, h = im.size
    nw = max(1, round(w * THUMB_H / h))
    imgs[key] = im.resize((nw, THUMB_H), Image.LANCZOS)

left_w = max(imgs['web'].size[0], imgs['admin'].size[0])
right_w = max(imgs['mini'].size[0], imgs['app'].size[0])
cell_h = TITLE_H + THUMB_H
row_h = 2 * cell_h + INNER_GAP
content_w = left_w + COL_GAP + right_w
canvas_w = MARGIN * 2 + content_w
canvas_h = MARGIN * 2 + TOP_H + row_h

canvas = Image.new('RGB', (canvas_w, canvas_h), 'white')
d = ImageDraw.Draw(canvas)

# 顶部大标题
cx = canvas_w // 2
d.text((cx, MARGIN + 22), '鱼价查 · 四端功能展示图', font=font(52, True), fill='#0A6E78', anchor='mm')
d.text((cx, MARGIN + 86), '智慧渔业全国水产品价格日报系统   —   Web · 管理后台 · 微信小程序 · 移动 App',
       font=font(25, False), fill='#5A6B7B', anchor='mm')

def draw_cell(x, y, key, name, desc):
    iw = imgs[key].size[0]
    bar = Image.new('RGB', (iw, TITLE_H), '#EAF5F6')
    canvas.paste(bar, (x, y))
    d.text((x + 22, y + 18), name, font=font(34, True), fill='#0A6E78', anchor='lt')
    d.text((x + 22, y + 60), desc, font=font(21, False), fill='#3C5560', anchor='lt')
    canvas.paste(imgs[key], (x, y + TITLE_H))
    d.rectangle([x, y, x + iw - 1, y + TITLE_H + THUMB_H - 1], outline='#D5E3E6', width=2)

left_x = MARGIN
right_x = MARGIN + left_w + COL_GAP
top_y = MARGIN + TOP_H

draw_cell(left_x,  top_y,                          'web',   cells[0][1], cells[0][2])
draw_cell(left_x,  top_y + cell_h + INNER_GAP,     'admin', cells[1][1], cells[1][2])
draw_cell(right_x, top_y,                          'mini',  cells[2][1], cells[2][2])
draw_cell(right_x, top_y + cell_h + INNER_GAP,     'app',   cells[3][1], cells[3][2])

canvas.save(OUT, optimize=True)
print('SAVED', OUT, canvas.size)
