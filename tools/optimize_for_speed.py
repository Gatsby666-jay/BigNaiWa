"""按「DPR=3 实际渲染尺寸」重采样水果贴图 → WebP；并压缩赞助二维码。
输出：
  assets/fruits/NN-xxx.webp   （体积大幅下降，清晰度按需保留）
  assets/sponsor-qr.png / sponsor-qr2.png （二维码保持无损，仅缩小到 1:1 显示尺寸）

为什么不是简单等比例缩小：上一版模糊的根因是「按 CSS 显示尺寸裁小」，
没算 DPR=3，导致高分屏放大发虚。这里每个水果按其**最大设备像素**重采样。
"""
from PIL import Image
import glob, os, math

ASSET_FILL = 0.92
DPR_MAX = 2.72  # 实测最大 device scale：手机 dpr3 / rect.width≈374 → 1122/420

FRUITS = [
    ('01-grape', 17), ('02-cherry', 23), ('03-orange', 31), ('04-lemon', 39),
    ('05-kiwi', 48), ('06-tomato', 58), ('07-peach', 69), ('08-pineapple', 81),
    ('09-coconut', 94), ('10-halfmelon', 108), ('11-watermelon', 124),
]


def round8(n):
    return int(math.ceil(n / 8.0) * 8)


def target_px(r):
    need = (r * 2.0 / ASSET_FILL) * DPR_MAX
    return max(96, min(512, round8(need)))


def human(n):
    return f'{n/1024:.1f} KB'


total_before = total_after = 0
print('=== 水果贴图 → WebP ===')
for name, r in FRUITS:
    src = f'assets/fruits/{name}.png'
    dst = f'assets/fruits/{name}.webp'
    before = os.path.getsize(src)
    im = Image.open(src).convert('RGBA')
    px = target_px(r)
    if px < 512:
        im = im.resize((px, px), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=90, method=6)
    after = os.path.getsize(dst)
    total_before += before
    total_after += after
    print(f'{name:16} r={r:<4} {px:>3}px  {human(before):>9} → {human(after):>9}')
print(f'{"水果合计":16} {"":>4} {"":>6} {human(total_before):>9} → {human(total_after):>9}')

print('\n=== 赞助二维码（缩小到显示尺寸，WebP 无损保证可扫）===')
for src, dst in [('assets/sponsor-qr.jpg', 'assets/sponsor-qr.webp'),
                 ('assets/sponsor-qr2.jpg', 'assets/sponsor-qr2.webp')]:
    before = os.path.getsize(src)
    im = Image.open(src).convert('RGB')
    w, h = im.size
    # 显示最大 150 CSS px × dpr3 = 450；等比缩到长边 ≤ 450
    scale = min(1.0, 450.0 / max(w, h))
    if scale < 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    im.save(dst, 'WEBP', lossless=True, method=6)
    after = os.path.getsize(dst)
    print(f'{os.path.basename(src):22} {w}x{h} → {im.size[0]}x{im.size[1]}  {human(before):>9} → {human(after):>9}')

print('\n=== 目录合计 ===')
print('assets/fruits(.webp):', human(sum(os.path.getsize(f) for f in glob.glob('assets/fruits/*.webp'))))
print('sponsor qr(.webp)   :', human(sum(os.path.getsize(f) for f in glob.glob('assets/sponsor-qr*.webp'))))
