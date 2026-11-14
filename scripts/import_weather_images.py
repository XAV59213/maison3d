#!/usr/bin/env python3
"""Import approved Maison 3D weather photos into the HACS integration.

Usage:
    python scripts/import_weather_images.py /path/to/maison3d_images_meteo.zip

This intentionally does not alter the uploaded photographs or invent
missing night/storm/moon variants.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZipFile, BadZipFile

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "custom_components" / "maison3d" / "www" / "images"
IMAGES = {
    "jour": "day.jpg",
    "nuageux": "cloudy.jpg",
    "pluie": "rain.jpg",
    "neige": "snow.jpg",
}

def import_archive(source: Path, output: Path = DESTINATION) -> dict[str, int]:
    """Write exactly four verified JPEGs from the user's weather archive."""
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
            if not data.startswith(b"\\xff\\xd8\\xff") and not data.startswith(bytes.fromhex("ffd8ff")):
                raise ValueError(f"Invalid JPEG header: {member}")
            if not data.endswith(bytes.fromhex("ffd9")):
                raise ValueError(f"Invalid JPEG end marker: {member}")
            entries[destination] = data
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
    print("Commit the 4 JPEGs under custom_components/maison3d/www/images/.")

if __name__ == "__main__":
    main()
