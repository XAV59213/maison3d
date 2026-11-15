#!/usr/bin/env python3
"""Lighter copies (640 and 960 px wide, WebP q80) of the bundled photos.

The photo view and the barn interior photo use them through srcset/sizes
(photo-source.js: responsiveSrcset), so phones and small Lovelace cards do not
download the full-size file. Re-run after changing a bundled photo:

    python3 scripts/generate_responsive_images.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "custom_components" / "maison3d" / "www"
WIDTHS = (640, 960)
WEBP_QUALITY = 80


def sources() -> list[Path]:
    """Main photo, generated weather day/night photos and the barn interior photo."""
    images = WWW / "images"
    return [WWW / "maison3d-reference.webp", images / "grange-interieur.webp",
            *sorted(images.glob("*-jour.webp")), *sorted(images.glob("*-nuit.webp"))]


def main() -> None:
    from PIL import Image

    for source in sources():
        with Image.open(source) as image:
            rgb = image.convert("RGB")
            for width in WIDTHS:
                height = round(rgb.height * width / rgb.width)
                target = source.with_name(f"{source.stem}-{width}.webp")
                rgb.resize((width, height), Image.LANCZOS).save(target, "WEBP", quality=WEBP_QUALITY, method=6)
                print(f"{target.relative_to(ROOT)} {target.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
