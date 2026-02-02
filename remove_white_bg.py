#!/usr/bin/env python3
"""
去除 float-icon.png 的白色背景（仅抠掉与画布边缘连通的白色），保留图标内的白色元素。
需要: pip install Pillow
"""

try:
    from PIL import Image
except ImportError:
    print("需要安装 Pillow: pip install Pillow")
    exit(1)

import os

def is_white(pixel, threshold=250):
    """判断是否为白色/近白色（用于背景）"""
    if len(pixel) == 4:
        r, g, b, a = pixel
        if a < 128:
            return False
    else:
        r, g, b = pixel[:3]
    return r >= threshold and g >= threshold and b >= threshold

def remove_white_background(input_path, output_path=None, threshold=250):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    data = img.load()

    # 从边缘开始，找出所有与边缘连通的白色像素
    seen = set()
    stack = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or x >= w or y < 0 or y >= h:
            continue
        seen.add((x, y))
        pixel = data[x, y]
        if not is_white(pixel, threshold):
            continue
        # 将与此背景白色连通的像素设为透明
        data[x, y] = (255, 255, 255, 0)
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                stack.append((nx, ny))

    out = output_path or input_path
    img.save(out, "PNG")
    print(f"已去除白色背景并保存: {out}")

if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, "icons", "float-icon.png")
    if not os.path.isfile(path):
        print(f"未找到: {path}")
        exit(1)
    remove_white_background(path)
