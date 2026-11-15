"""Retired weather photo URLs map to the current daytime bundled files."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "maison3d"


def load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, COMPONENT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


const = load("maison3d_const", "const.py")
logic = load("maison3d_state_logic", "state_logic.py")


class LegacyPhotoMapping(unittest.TestCase):
    def test_unsuffixed_names_become_current_day_photos(self):
        cases = {
            "/maison3d-assets/images/jour.jpg": "/maison3d-assets/images/clair-jour.webp",
            "/maison3d-assets/images/jour.webp": "/maison3d-assets/images/clair-jour.webp",
            "/maison3d-assets/images/jour.jpeg": "/maison3d-assets/images/clair-jour.webp",
            "/maison3d-assets/images/nuageux.webp?v=2": "/maison3d-assets/images/nuageux-jour.webp?v=2",
            "/maison3d-assets/images/pluie.jpg": "/maison3d-assets/images/pluie-jour.webp",
            "/maison3d-assets/images/neige.webp": "/maison3d-assets/images/neige-jour.webp",
        }
        for source, target in cases.items():
            self.assertEqual(logic.bundled_photo(source), target, source)

    def test_other_bundled_jpegs_still_become_webp(self):
        self.assertEqual(
            logic.bundled_photo("/maison3d-assets/maison3d-reference.jpg?v=3"),
            "/maison3d-assets/maison3d-reference.webp?v=3",
        )
        self.assertEqual(
            logic.bundled_photo("/maison3d-assets/images/clair-jour.jpg"),
            "/maison3d-assets/images/clair-jour.webp",
        )

    def test_user_urls_are_untouched(self):
        for url in (
            "/local/maison3d/jour.jpg",
            "/maison3d-media/a.jpg",
            "https://example.org/jour.jpg",
            "/maison3d-assets/images/../x.jpg",
        ):
            self.assertEqual(logic.bundled_photo(url), url)

    def test_http_redirect_path_drops_the_query(self):
        self.assertEqual(
            logic.rewrite_legacy_photo_path("/maison3d-assets/images/jour.webp"),
            "/maison3d-assets/images/clair-jour.webp",
        )
        self.assertEqual(
            logic.rewrite_legacy_photo_path("/maison3d-assets/images/pluie.jpg"),
            "/maison3d-assets/images/pluie-jour.webp",
        )
        self.assertIsNone(logic.rewrite_legacy_photo_path("/maison3d-assets/images/clair-jour.webp"))
        self.assertIsNone(logic.rewrite_legacy_photo_path("/local/maison3d/jour.webp"))


class StartupGraceMinutes(unittest.TestCase):
    def test_default_and_clamping(self):
        self.assertEqual(const.DEFAULT_STARTUP_GRACE_MINUTES, 15)
        self.assertEqual(const.startup_grace_minutes({}), 15)
        self.assertEqual(const.startup_grace_minutes(None), 15)
        self.assertEqual(const.startup_grace_minutes({"startup_grace_minutes": 0}), 0)
        self.assertEqual(const.startup_grace_minutes({"startup_grace_minutes": 60}), 60)
        self.assertEqual(const.startup_grace_minutes({"startup_grace_minutes": 90}), 60)
        self.assertEqual(const.startup_grace_minutes({"startup_grace_minutes": -3}), 0)
        self.assertEqual(const.startup_grace_minutes({"startup_grace_minutes": "12"}), 12)
        self.assertEqual(const.startup_grace_minutes({"startup_grace_minutes": "nope"}), 15)



init_src = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
legacy_src = (COMPONENT / "legacy_photos.py").read_text(encoding="utf-8")


class LegacyPhotoRegistration(unittest.TestCase):
    def test_does_not_touch_frozen_middlewares(self):
        self.assertNotIn("middlewares", legacy_src)
        self.assertNotIn("app.router", legacy_src)
        self.assertNotIn("middlewares", init_src)
        self.assertIn("register_legacy_photo_redirects(hass)", init_src)
        self.assertIn("HomeAssistantView", legacy_src)
        self.assertIn("requires_auth = False", legacy_src)
        # Exact views are registered before the static prefix.
        self.assertLess(
            init_src.index("register_legacy_photo_redirects(hass)"),
            init_src.index("async_register_static_paths("),
        )

    def test_exact_urls_cover_the_four_retired_photos(self):
        self.assertIn('f"/maison3d-assets/images/{name}.{ext}"', legacy_src)
        self.assertIn('for ext in ("jpg", "jpeg", "webp")', legacy_src)
        for name in ("jour", "nuageux", "pluie", "neige"):
            self.assertIn(f'"{name}"', (COMPONENT / "state_logic.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
