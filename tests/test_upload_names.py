"""Upload helpers (file names, path safety) without Home Assistant installed."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path

COMPONENT = Path(__file__).resolve().parents[1] / "custom_components" / "maison3d"


def load_upload():
    stubs = {
        "aiohttp": types.ModuleType("aiohttp"),
        "homeassistant": types.ModuleType("homeassistant"),
        "homeassistant.components": types.ModuleType("homeassistant.components"),
        "homeassistant.components.http": types.ModuleType("homeassistant.components.http"),
        "homeassistant.core": types.ModuleType("homeassistant.core"),
        "homeassistant.exceptions": types.ModuleType("homeassistant.exceptions"),
        "homeassistant.helpers": types.ModuleType("homeassistant.helpers"),
        "homeassistant.helpers.http": types.ModuleType("homeassistant.helpers.http"),
    }
    stubs["aiohttp"].web = types.SimpleNamespace(Request=object, Response=object)
    stubs["homeassistant.components.http"].__dict__.update(
        KEY_HASS_USER="hass_user", HomeAssistantView=object, StaticPathConfig=lambda *a: a)
    stubs["homeassistant.core"].HomeAssistant = object
    stubs["homeassistant.exceptions"].Unauthorized = type("Unauthorized", (Exception,), {})
    stubs["homeassistant.helpers.http"].KEY_HASS = "hass"
    previous = {name: sys.modules.get(name) for name in stubs}
    sys.modules.update(stubs)
    try:
        spec = importlib.util.spec_from_file_location("maison3d_upload_stub", COMPONENT / "upload.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        for name, old in previous.items():
            if old is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = old
    return module


class UploadNamesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upload = load_upload()

    def test_safe_names(self):
        safe = self.upload.safe_name
        self.assertEqual(safe("neige-nuit", "IMG_001.JPEG"), ("neige-nuit", ".jpg"))
        self.assertEqual(safe("", "Ma Maison été.png"), ("ma-maison-ete", ".png"))
        self.assertEqual(safe("", "..%2F..%2Fsecrets.webp"), ("secrets", ".webp"))
        self.assertEqual(safe("../../../etc/passwd", "a.jpg"), ("passwd", ".jpg"))
        self.assertEqual(safe("..", "a.jpg"), ("photo", ".jpg"))
        self.assertEqual(len(safe("x" * 200, "a.jpg")[0]), 60)
        for bad in ("a.gif", "a.svg", "a.jpg.exe", "a", ""):
            self.assertIsNone(safe("", bad), bad)

    def test_magic_bytes(self):
        formats = self.upload.FORMATS
        self.assertTrue(formats[".jpg"][1](b"\xff\xd8\xff\xe0"))
        self.assertFalse(formats[".jpg"][1](b"<svg"))
        self.assertTrue(formats[".png"][1](b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(formats[".webp"][1](b"RIFF\x00\x00\x00\x00WEBP"))
        self.assertEqual(self.upload.MAX_BYTES, 10 * 1024 * 1024)

    def test_write_stays_in_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "www" / "maison3d"
            path = self.upload._write(folder, "a.jpg", b"123")
            self.assertEqual(path.read_bytes(), b"123")
            with self.assertRaises(ValueError):
                self.upload._write(folder, "../evil.jpg", b"x")
            self.assertFalse((Path(tmp) / "www" / "evil.jpg").exists())

    def test_view_is_admin_only(self):
        source = (COMPONENT / "upload.py").read_text(encoding="utf-8")
        self.assertIn("requires_auth = True", source)
        self.assertIn("if user is None or not user.is_admin:", source)
        self.assertIn("hass.async_add_executor_job(_write", source)


if __name__ == "__main__":
    unittest.main()
