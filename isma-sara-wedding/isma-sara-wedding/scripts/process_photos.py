"""
Prepares photos for the website: fixes rotation, removes ALL metadata
(including GPS location), and saves two WebP sizes for fast loading.

    python3 scripts/process_photos.py ruta/a/foto.jpg nombre [ruta/a/otra.jpg otro-nombre ...]

Output: site/assets/img/fotos/<nombre>-640.webp and <nombre>-1280.webp,
plus the width/height to paste into site/config.js. Needs: pip install pillow
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

OUT = Path(__file__).resolve().parent.parent / "site/assets/img/fotos"
WIDTHS = (640, 1280)
QUALITY = 80


def process(src: Path, name: str):
    OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")  # apply rotation, drop alpha
        w, h = im.size
        sizes = []
        for target in WIDTHS:
            tw = min(target, w)  # never upscale
            th = round(h * tw / w)
            out = OUT / f"{name}-{target}.webp"
            # A fresh image without exif/icc/xmp: nothing but pixels is published.
            clean = Image.new("RGB", (tw, th))
            clean.paste(im.resize((tw, th), Image.Resampling.LANCZOS))
            clean.save(out, "WEBP", quality=QUALITY, method=6)
            sizes.append((out.name, tw, th, out.stat().st_size // 1024))
    big = sizes[-1]
    print(f"{name}: width {big[1]}, height {big[2]}  ->  " + ", ".join(f"{n} ({kb} KB)" for n, _, _, kb in sizes))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or len(args) % 2:
        sys.exit(__doc__)
    for i in range(0, len(args), 2):
        process(Path(args[i]), args[i + 1])
