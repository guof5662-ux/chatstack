#!/usr/bin/env python3
"""
生成扩展图标的简单脚本
需要 Pillow 库: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("❌ 需要安装 Pillow 库")
    print("运行: pip install Pillow")
    exit(1)

import os

def create_icon(size, output_path):
    """创建简单的图标"""
    # 创建图像（蓝色背景）
    img = Image.new('RGB', (size, size), color='#3B82F6')
    draw = ImageDraw.Draw(img)

    # 绘制白色圆角矩形边框
    margin = size // 8
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 8,
        outline='white',
        width=max(2, size // 32)
    )

    # 添加文字 "C"（代表 ChatGPT）
    try:
        # 尝试使用系统字体
        font_size = size // 2
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        # 如果找不到字体，使用默认字体
        font = ImageFont.load_default()

    text = "C"

    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    # 绘制文字
    draw.text((x, y), text, fill='white', font=font)

    # 保存图像
    img.save(output_path, 'PNG')
    print(f"✓ 创建图标: {output_path} ({size}x{size})")

def main():
    # 确保 icons 目录存在
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    # 生成三种尺寸的图标
    sizes = {
        'icon16.png': 16,
        'icon48.png': 48,
        'icon128.png': 128
    }

    print("🎨 生成扩展图标...")

    for filename, size in sizes.items():
        output_path = os.path.join(icons_dir, filename)
        create_icon(size, output_path)

    print("\n✅ 所有图标生成完成！")
    print(f"📁 图标位置: {icons_dir}")
    print("\n你也可以使用自己设计的图标替换这些文件。")

if __name__ == '__main__':
    main()
