#!/usr/bin/env python3
"""Generate the bundled day/night weather photos from the reference photo.

Pure retouching of www/maison3d-reference.webp (no external images). The
reference is cropped to remove the interface drawn on its edges, so the
generated photos contain no buttons: cloudy = grey sky, rain = wet darker ground, snow = white
cover on grass/vegetation/roofs, storm = dark contrasted sky, fog = grey
veil, wind = cooler contrast; every night variant = blue moonlit grade that
keeps the warm lamps and adds a glow around them.

Usage: python3 scripts/generate_variant_images.py   (requires Pillow + numpy)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WWW = Path(__file__).resolve().parents[1] / "custom_components" / "maison3d" / "www"
IMAGES = WWW / "images"
QUALITY = 80  # WebP, visually equivalent to the former JPEG files
# Region of the reference photo without the drawn interface (toolbars, slider…).
CLEAN_BOX = (80, 90, 1366, 1004)
F = np.float32


def save(array: np.ndarray, name: str) -> None:
    image = Image.fromarray((np.clip(array, 0, 1) * 255 + 0.5).astype(np.uint8))
    image.save(IMAGES / name, "WEBP", quality=QUALITY, method=6)


def blur(a: np.ndarray, radius: float) -> np.ndarray:
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=F) / 255.0


def lum(a: np.ndarray) -> np.ndarray:
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def rows(a: np.ndarray, top: float, bottom: float) -> np.ndarray:
    return np.linspace(top, bottom, a.shape[0], dtype=F)[:, None, None]


def sky_mask(a: np.ndarray) -> np.ndarray:
    """Bright, bluish or pale pixels in the upper part of the picture."""
    l = lum(a)
    blueish = np.clip((a[..., 2] - a[..., 0]) * 4 + 0.4, 0, 1)
    pale = np.clip((l - 0.55) * 3, 0, 1)
    upper = np.clip(1.6 - np.linspace(0, 1, a.shape[0], dtype=F)[:, None] * 3.2, 0, 1)
    return blur((np.maximum(blueish, pale) * upper)[..., None].repeat(3, 2), 6)[..., :1]


def desat(a: np.ndarray, amount: float) -> np.ndarray:
    return a * (1 - amount) + lum(a)[..., None] * amount


def overcast(a: np.ndarray, sky=(0.70, 0.73, 0.77), dim: float = 0.86) -> np.ndarray:
    m = sky_mask(a)
    base = desat(a, 0.35) * dim
    clouds = np.array(sky, F) * (0.85 + 0.25 * blur(lum(a)[..., None].repeat(3, 2), 25)[..., :1])
    return base * (1 - m) + clouds * m


def rain(a: np.ndarray) -> np.ndarray:
    out = overcast(a, (0.55, 0.59, 0.64), 0.72)
    lower = rows(a, 0, 1) ** 2
    wet = np.power(np.clip(out, 0, 1), 1.18) * np.array([0.92, 0.96, 1.04], F)
    return out * (1 - lower * 0.6) + wet * lower * 0.6


def snow(a: np.ndarray) -> np.ndarray:
    base = overcast(a, (0.84, 0.87, 0.91), 0.95)
    green = np.clip((a[..., 1] - np.maximum(a[..., 0], a[..., 2])) * 9 + 0.1, 0, 1)
    flat = np.clip(1 - np.abs(lum(a) - 0.45) * 1.6, 0, 1)
    noise = np.random.default_rng(7).random(a.shape[:2], dtype=F)
    cover = np.clip(green * 0.95 + flat * 0.5 * (noise > 0.3), 0, 1) * np.clip(rows(a, 0.4, 1.0)[..., 0], 0, 1)
    cover = blur(cover[..., None].repeat(3, 2), 1.4)[..., :1]
    white = np.array([0.93, 0.95, 0.99], F) * (0.9 + 0.1 * lum(a)[..., None])
    return desat(base, 0.25) * (1 - cover) + white * cover


def storm(a: np.ndarray) -> np.ndarray:
    out = overcast(a, (0.30, 0.33, 0.40), 0.62)
    return np.clip(np.power(out, 1.15) * rows(a, 0.75, 1.0), 0, 1)


def fog(a: np.ndarray, veil=(0.80, 0.83, 0.86), amount: float = 0.6) -> np.ndarray:
    soft = desat(blur(a, 2.4), 0.45)
    mix = rows(a, amount, amount * 0.55)
    return soft * (1 - mix) + np.array(veil, F) * mix


def wind(a: np.ndarray) -> np.ndarray:
    out = overcast(a, (0.66, 0.71, 0.78), 0.93)
    return np.clip((out - 0.5) * 1.08 + 0.5, 0, 1) * np.array([0.97, 0.99, 1.04], F)


def night(day: np.ndarray, lamps_from: np.ndarray, brightness: float = 0.38) -> np.ndarray:
    """Blue moonlit night; warm lamps of the original photo stay lit with a glow."""
    day = np.clip(day, 0, 1)
    src = np.clip(lamps_from, 0, 1)
    warm = np.clip((src[..., 0] - src[..., 2]) * 2.4, 0, 1)
    lamps = np.clip((lum(src) - 0.6) * 3.2, 0, 1) * warm
    glow = blur(lamps[..., None].repeat(3, 2), 16)[..., :1]
    out = np.power(day, 1.45) * brightness * np.array([0.62, 0.78, 1.18], F) + np.array([0.012, 0.022, 0.06], F)
    out = out * rows(day, 0.72, 1.0)
    l = lamps[..., None]
    out = out * (1 - l) + src * l * 1.05
    return out + glow * np.array([1.0, 0.78, 0.45], F) * 0.6


def main() -> None:
    photo = Image.open(WWW / "maison3d-reference.webp").convert("RGB")
    if photo.size[0] > 1400:  # original export with the drawn interface
        photo = photo.crop(CLEAN_BOX)
    ref = np.asarray(photo, dtype=F) / 255.0
    days = {
        "nuageux": overcast(ref), "pluie": rain(ref), "neige": snow(ref),
        "vent": wind(ref), "orage": storm(ref), "brouillard": fog(ref),
    }
    outputs = {"clair-jour.webp": ref, "clair-nuit.webp": night(ref, ref)}
    for name, day in days.items():
        outputs[f"{name}-jour.webp"] = day
        outputs[f"{name}-nuit.webp"] = night(day, ref, 0.5 if name == "neige" else 0.38)
    outputs["brouillard-nuit.webp"] = fog(night(ref, ref), (0.16, 0.19, 0.25), 0.5)
    total = 0
    for name, array in outputs.items():
        save(array, name)
        size = (IMAGES / name).stat().st_size
        total += size
        print(f"{name}: {size // 1024} Ko")
    print(f"Total: {total / 1024 / 1024:.2f} Mo")


if __name__ == "__main__":
    main()
