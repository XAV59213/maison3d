"""Small no-dependency checks for the published Home Assistant integration."""
from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "maison3d"

class TestMaison3D(unittest.TestCase):
    def test_manifest(self):
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["domain"], "maison3d")
        self.assertTrue(manifest["config_flow"])
        self.assertIn("panel_custom", manifest["dependencies"])

    def test_translations_are_valid(self):
        for language in ("fr", "en"):
            path = COMPONENT / "translations" / f"{language}.json"
            self.assertIn("config", json.loads(path.read_text(encoding="utf-8")))

    def test_html_and_weather_module(self):
        page = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        effects = (COMPONENT / "www" / "weather-effects.js").read_text(encoding="utf-8")
        self.assertIn('<script type="importmap">', page)
        self.assertIn('from "./weather-effects.js"', page)
        self.assertIn("maison3d:conditions", effects)
        self.assertIn('weather==="snow"', effects)
        self.assertIn('weather==="rain"', effects)
        self.assertIn('weather==="leaves"', effects)
        self.assertIn("setInterval(update,60000)", effects)

    def test_panel_bridge(self):
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        self.assertIn("postMessage", panel)
        self.assertIn("weather.", panel)
        self.assertIn("sun.sun", panel)

    def test_interactive_lovelace_card(self):
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        page = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        self.assertIn('customElements.define("maison3d-card"', card)
        self.assertIn("custom:maison3d-card", card)
        self.assertIn("maison3d:conditions", card)
        self.assertIn("mode=card", card)
        self.assertIn('get("mode")==="card"', page)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("maison3d-assets/maison3d-card.js", readme)

    def test_architecture_module(self):
        architecture = (COMPONENT / "www" / "architecture.js").read_text(encoding="utf-8")
        page = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        self.assertIn("createArchitectureKit", architecture)
        for expected in ("gableRoof", "masonryTexture", "window(", "house(", "terrace(", "wall(", "ramp(", "landscape("):
            self.assertIn(expected, architecture)
        self.assertIn('from "./architecture.js"', page)
        self.assertIn("architecture.build(g,o)", page)
        self.assertIn("architecture.landscape(scene)", page)

    def test_exact_approved_readme_image(self):
        self.assertTrue((ROOT / "assets" / "maison3d-reference.jpg").is_file())
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn('src="assets/maison3d-reference.jpg"', content)

if __name__ == "__main__":
    unittest.main()
