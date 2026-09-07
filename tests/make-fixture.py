"""
生成测试用 PNG：tests/fixture.png
中间是带三个孔洞的圆盘（用来验证「洞不再被填实」），左下是一个梳状图形（用来验证复杂轮廓不再丢失）。
用法: python tests/make-fixture.py
"""
import os
from PIL import Image, ImageDraw

W = H = 400
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# --- 带三个孔洞的圆环（圆心 140,140，外径 120，内孔半径 50）---
# 两个小孔都放在环带正中（距圆心 85、半径 15），既不碰到中心孔也不碰到外缘
d.ellipse([20, 20, 260, 260], fill=(90, 160, 255, 255))          # 外圆
d.ellipse([90, 90, 190, 190], fill=(0, 0, 0, 0))                  # 中心孔  r=50
d.ellipse([65, 65, 95, 95], fill=(0, 0, 0, 0))                    # 左上小孔 r=15
d.ellipse([210, 125, 240, 155], fill=(0, 0, 0, 0))                # 右侧小孔 r=15

# --- 梳状图形（复杂轮廓 + 深槽）---
d.rectangle([20, 290, 370, 330], fill=(255, 140, 60, 255))        # 背板
for i in range(8):                                                 # 梳齿
    x0 = 25 + i * 44
    d.rectangle([x0, 330, x0 + 22, 385], fill=(255, 140, 60, 255))

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "fixture.png")
img.save(out)

# 顺带导出原始 RGBA，供 tests/export-check.mjs 在 Node 里直接跑（Node 没有 PNG 解码器）
with open(os.path.join(here, "fixture.rgba"), "wb") as f:
    f.write(img.tobytes())
with open(os.path.join(here, "fixture.json"), "w") as f:
    f.write('{"width": %d, "height": %d}' % (W, H))
print("wrote", out, "(+ fixture.rgba / fixture.json)")
