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

    def test_realistic_views_and_live_3d_weather(self):
        page = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        presentation = (COMPONENT / "www" / "presentation.js").read_text(encoding="utf-8")
        ambience = (COMPONENT / "www" / "world-ambience.js").read_text(encoding="utf-8")
        effects = (COMPONENT / "www" / "weather-effects.js").read_text(encoding="utf-8")
        self.assertIn('from "./presentation.js"', page)
        self.assertIn('from "./world-ambience.js"', page)
        self.assertIn("createPresentation({THREE,camera,controls})", page)
        self.assertIn("createWorldAmbience({THREE,scene,sun})", page)
        for key in ("reference:", "elevated:", "garden:", "garage:"):
            self.assertIn(key, presentation)
        self.assertIn("THREE.Vector3", presentation)
        self.assertIn("THREE.Points(", ambience)
        self.assertIn("maison3d:weather", ambience)
        self.assertIn("windSpeed", ambience)
        self.assertIn('CustomEvent("maison3d:weather"', effects)
        self.assertIn("live?.sun", effects)

    def test_editable_photo_seasons_weather_and_moon(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        html = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertTrue((COMPONENT / "www" / "maison3d-reference.jpg").is_file())
        for key in ("day","night","cloudy","rain","snow","wind","storm","spring","summer","autumn","winter"):
            self.assertIn('"' + key + '"', photo)
        self.assertIn('from "./photo-view.js"', html)
        self.assertIn("photoView.frame(time)", html)
        self.assertIn("maison3d:entity-selection", photo)
        self.assertIn("moon_entity", photo)
        self.assertIn("moon_entity", panel)
        self.assertIn("images:this._config.images", card)
        self.assertIn("weather_entity:", card)

    def test_homeassistant_integration_options_and_diagnostics(self):
        flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        sensors = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        setup = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        editor = (COMPONENT / "www" / "maison3d-card-editor.js").read_text(encoding="utf-8")
        for key in ("weather_entity","sun_entity","moon_entity","temperature_entity","wind_entity","rain_entity","snow_entity","cloud_entity"):
            self.assertIn(key, flow)
            self.assertIn(key, sensors)
            self.assertIn(key, editor)
        self.assertIn("OptionsFlowWithReload",flow)
        self.assertIn("async_get_options_flow",flow)
        self.assertIn('async_forward_entry_setups(entry, ["sensor"])', setup)
        self.assertIn("maison3d_config",sensors)
        self.assertIn("Maison3DSourceStatusSensor",sensors)
        self.assertIn("config-changed",editor)
        self.assertIn("static getConfigElement()",card)
        self.assertIn("maison3d_config",panel)
        self.assertIn("maison3d_config",card)
        for language in ("fr","en"):
            translation = json.loads((COMPONENT / "translations" / f"{language}.json").read_text(encoding="utf-8"))
            self.assertIn("options",translation)

    def test_lunar_phases_and_lightning_visual_effects(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        editor = (COMPONENT / "www" / "maison3d-card-editor.js").read_text(encoding="utf-8")
        phases = ("new_moon", "waxing_crescent", "first_quarter",
                  "waxing_gibbous", "full_moon", "waning_gibbous",
                  "last_quarter", "waning_crescent")
        for phase in phases:
            key = "moon_" + phase
            for code in (photo, card, editor):
                self.assertIn(key, code)
        self.assertIn("ctx.shadowBlur=28", photo)
        self.assertIn("ctx.lineTo(x,y)", photo)
        self.assertIn("moonPhase(live.moon)", photo)

    def test_bundled_weather_assets_in_release(self):
        from pathlib import Path
        from hashlib import sha256
        images = COMPONENT / "www" / "images"
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        for name in ("jour.jpg", "nuageux.jpg", "pluie.jpg", "neige.jpg"):
            path = images / name
            self.assertTrue(path.is_file(), f"Missing bundled photo: {name}")
            data = path.read_bytes()
            self.assertGreater(len(data), 50000)
            self.assertTrue(data.startswith(bytes.fromhex("ffd8ff")))
            self.assertTrue(data.endswith(bytes.fromhex("ffd9")))
            self.assertIn('images/' + name, photo)
        self.assertEqual(len({sha256((images / n).read_bytes()).hexdigest()
            for n in ("jour.jpg", "nuageux.jpg", "pluie.jpg", "neige.jpg")}), 4)

    def test_photo_weather_cinematics_and_import(self):
        module = (COMPONENT / "www" / "photo-cinematics.js").read_text(encoding="utf-8")
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        importer = (ROOT / "scripts" / "import_weather_images.py").read_text(encoding="utf-8")
        self.assertIn("createPhotoCinematics", module)
        self.assertIn('from "./photo-cinematics.js"', photo)
        self.assertIn("cinematics.frame(time", photo)
        for feature in ("clouds(", "sunshine(", "drizzleShine(",
                        "snowAccumulation(", "autumnHaze(", "nightHaze("):
            self.assertIn(feature, module)
        self.assertIn('type="range"', photo)
        self.assertIn("effect_intensity", photo)
        for filename in ("day.jpg", "cloudy.jpg", "rain.jpg", "snow.jpg"):
            self.assertIn(filename, importer)
        self.assertIn("ZipFile", importer)

    def test_photo_night_day_auto_buttons_and_visible_night_filter(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn('nightBtn.textContent="☾ Nuit réelle"', photo)
        self.assertIn('nightBtn.addEventListener("click",()=>setQuickMode("night"))', photo)
        self.assertIn('dayBtn.addEventListener("click",()=>setQuickMode("day"))', photo)
        self.assertIn('autoBtn.addEventListener("click",()=>setQuickMode("auto"))', photo)
        self.assertIn('section.classList.toggle("photo-night",night)', photo)
        self.assertIn('photo-night img{filter:brightness(', photo)
        self.assertIn('selectMode.value=mode', photo)
        self.assertIn('persist();update()', photo)

    def test_photo_moon_preview_and_right_hand_season_buttons(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        moon = (COMPONENT / "www" / "moon-effects.js").read_text(encoding="utf-8")
        html = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        self.assertIn('from "./moon-effects.js"', photo)
        self.assertIn("createMoonOverlay({container:section})", photo)
        self.assertIn("skyMoon.draw(", photo)
        self.assertIn('seasonalNav.id="maison3d-photo-seasons"', photo)
        self.assertIn("seasonButtons.set(key,btn)", photo)
        self.assertIn("state.season=key", photo)
        self.assertIn("moon_preview", photo)
        self.assertIn("testButtons.set(key,btn)", photo)
        self.assertIn('resetTest.textContent="◉ Revenir à la météo réelle"', photo)
        for phase in ("new_moon","waxing_crescent","first_quarter",
                      "waxing_gibbous","full_moon","waning_gibbous",
                      "last_quarter","waning_crescent"):
            self.assertIn(phase, moon)
        self.assertIn("canvas.className=\"maison3d-sky-moon\"", moon)
        self.assertIn("canvas.getContext", moon)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        for img in ("jour.jpg","nuageux.jpg","pluie.jpg","neige.jpg"):
            self.assertIn('src="custom_components/maison3d/www/images/'+img+'"', readme)

    def test_fixed_photo_is_default_and_weather_only_changes_overlays(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn('use_weather_photos:false', photo)
        self.assertIn('const path=state.use_weather_photos ?', photo)
        self.assertIn(') : DEFAULT;', photo)
        self.assertIn("tint.style.background=weatherTint", photo)
        self.assertIn('photoBtn.setAttribute("aria-pressed"', photo)
        self.assertNotIn('realBtn.setAttribute(', photo)
        self.assertIn('swapPhotos.addEventListener("change"', photo)
        self.assertIn('skyMoon.draw(', photo)
        self.assertIn('cinematics.frame(', photo)

    def test_2d_plan_accessible_from_photo_and_restores_mode(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        app = (COMPONENT / "www" / "index.html").read_text(encoding="utf-8")
        self.assertIn('planBtn.textContent="▤ Plan 2D"', photo)
        self.assertIn('nav.append(photoBtn,planBtn,modelBtn', photo)
        self.assertIn('planBtn.addEventListener("click",()=>setModelView("2d"))', photo)
        self.assertIn('modelBtn.addEventListener("click",()=>setModelView("3d"))', photo)
        self.assertIn('document.getElementById(view==="2d"?"topview":"tab3d")?.click()', photo)
        self.assertIn('planBtn.setAttribute("aria-pressed"', photo)
        self.assertIn('saved.model_view==="2d"', photo)
        self.assertIn('id="topview"', app)
        self.assertIn('id="tab3d"', app)
        self.assertIn('state.enabled=false;state.model_view=view', photo)

    def test_exact_approved_readme_image(self):
        self.assertTrue((ROOT / "assets" / "maison3d-reference.jpg").is_file())
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn('src="assets/maison3d-reference.jpg"', content)

if __name__ == "__main__":
    unittest.main()
