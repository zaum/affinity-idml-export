from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw

desktop = Path(r'C:\Users\peter\Desktop')
out_dir = Path(__file__).resolve().parent
for page in (1, 2):
    source = Image.open(desktop / f'kisokos-source-p{page}_1.png').convert('RGB')
    imported = Image.open(desktop / f'kisokos-idml3-p{page}_1.png').convert('RGB')
    imported = imported.resize(source.size, Image.Resampling.LANCZOS)
    diff = ImageChops.difference(source, imported)
    mean = ImageStat.Stat(diff).mean
    changed = sum(1 for r, g, b in diff.getdata() if max(r, g, b) > 20)
    print(f'page {page}: mean RGB abs diff={mean}, pixels >20={changed / (source.width * source.height):.1%}')
    thumb_size = (877, 620)
    src_small = source.resize(thumb_size, Image.Resampling.LANCZOS)
    imp_small = imported.resize(thumb_size, Image.Resampling.LANCZOS)
    diff_small = diff.resize(thumb_size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (thumb_size[0] * 3, thumb_size[1] + 32), 'white')
    for x, image, label in zip((0, thumb_size[0], thumb_size[0] * 2),
                               (src_small, imp_small, diff_small), ('Source', 'IDML import', 'Difference')):
        canvas.paste(image, (x, 32))
        ImageDraw.Draw(canvas).text((x + 10, 9), label, fill='black')
    canvas.save(out_dir / f'kisokos_compare_p{page}.png')
