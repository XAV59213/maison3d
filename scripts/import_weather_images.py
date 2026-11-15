#!/usr/bin/env python3
"""Import approved Maison 3D weather photos into the HACS integration.

Usage:
    python scripts/import_weather_images.py /path/to/maison3d_images_meteo.zip

The archive contains JPEG photos (maison3d/<name>.jpg). They are checked,
then stored as WebP (quality 80, same size, no retouching) like every bundled
photo. Missing night/storm/moon variants are never invented.
"""
from __future__ import annotations

import argparse
import io
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "custom_components" / "maison3d" / "www" / "images"
# Archive member name -> file name used by the photo view (www/images/).
IMAGES = {
    "jour": "jour.webp",
    "nuageux": "nuageux.webp",
    "pluie": "pluie.webp",
    "neige": "neige.webp",
}
WEBP_QUALITY = 80


def to_webp(data: bytes) -> bytes:
    """Re-encode one verified JPEG as WebP without changing its pixels' size."""
    from PIL import Image  # only needed when importing

    with Image.open(io.BytesIO(data)) as image:
        output = io.BytesIO()
        image.convert("RGB").save(output, "WEBP", quality=WEBP_QUALITY, method=6)
    return output.getvalue()


def import_archive(source: Path, output: Path = DESTINATION) -> dict[str, int]:
    """Write exactly four photos (verified JPEGs, stored as WebP) from the user's weather archive."""
    if not source.is_file():
        raise FileNotFoundError(source)
    if source.stat().st_size > 40_000_000:
        raise ValueError("Archive exceeds the 40 MB safety limit.")
    entries: dict[str, bytes] = {}
    with ZipFile(source) as archive:
        for name, destination in IMAGES.items():
            member = f"maison3d/{name}.jpg"
            info = archive.getinfo(member)
            if info.file_size > 12_000_000:
                raise ValueError(f"Image too large: {member}")
            data = archive.read(info)
            if not data.startswith(bytes.fromhex("ffd8ff")):
                raise ValueError(f"Invalid JPEG header: {member}")
            if not data.endswith(bytes.fromhex("ffd9")):
                raise ValueError(f"Invalid JPEG end marker: {member}")
            entries[destination] = to_webp(data)
    output.mkdir(parents=True, exist_ok=True)
    for name, data in entries.items():
        (output / name).write_bytes(data)
    return {name: len(data) for name, data in entries.items()}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="maison3d_images_meteo.zip")
    args = parser.parse_args()
    imported = import_archive(args.archive)
    for name, size in imported.items():
        print(f"OK images/{name}: {size} bytes")
    print("Commit the 4 WebP photos under custom_components/maison3d/www/images/.")

if __name__ == "__main__":
    main()
