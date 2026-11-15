"""Small no-dependency checks for the published Home Assistant integration."""
from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "maison3d"

def app_page():
    """index.html + scene3d.js: the editable 3D scene is a module loaded on demand."""
    www = COMPONENT / "www"
    return (www / "index.html").read_text(encoding="utf-8") + "\n" + (www / "scene3d.js").read_text(encoding="utf-8")


class TestMaison3D(unittest.TestCase):
    def test_house_barn_interior_explorer(self):
        page=app_page()
        module=(COMPONENT/"www"/"interior-view.js").read_text(encoding="utf-8")
        self.assertIn('from "./interior-view.js"',page)
        self.assertIn('"interior-view.js"',page)
        self.assertIn("createInteriorExplorer({photoView,ensureScene})",page)
        self.assertIn("interior.attach({THREE,scene,camera,controls",page)
        self.assertIn('interior?.refresh()',page)
        for marker in (
            'add("outside",t("visit_outside"))',
            'visitBuildings',
            'isBarnInterior',
            'syncVisitButtons',
            'getItems().find(item=>item.id===key&&item.type==="building")',
            'if(photoView.state.enabled){photoView.state.enabled=false;photoView.update()}',
            'exterior.visible=false',
            'hidden.clear();clear();',
            'cameraBefore.position.copy(beforePosition)',
            'presentation.cancel()',
            'INTERIOR_DISCLAIMER',
            'in-menu',
        ):
            self.assertIn(marker,module)
        visits=(COMPONENT/"www"/"visits.js").read_text(encoding="utf-8")
        i18n=(COMPONENT/"www"/"i18n.js").read_text(encoding="utf-8")
        self.assertIn("Volumes intérieurs provisoires",i18n)
        self.assertIn('interior_disclaimer',visits)
        self.assertIn('visitButtonLabel',visits)

    def test_realistic_barn_interior(self):
        www=COMPONENT/"www"
        page=app_page()
        module=(www/"interior-view.js").read_text(encoding="utf-8")
        barn=(www/"barn-interior.js").read_text(encoding="utf-8")
        self.assertIn('"barn-interior.js"',page)
        self.assertIn('from "./barn-interior.js"',module)
        room=re.search(r"BARN_ROOM=\{width:([\d.]+),depth:([\d.]+),height:([\d.]+)\}",barn)
        self.assertIsNotNone(room)
        width,depth,height=map(float,room.groups())
        self.assertAlmostEqual(depth/width,3,delta=.3)
        self.assertAlmostEqual(height,2.5,delta=.1)
        self.assertIn('BARN_PHOTO="./images/grange-interieur.webp"',barn)
        photo=www/"images"/"grange-interieur.webp"
        self.assertTrue(photo.is_file())
        self.assertEqual(photo.read_bytes()[8:12],b"WEBP")
        self.assertLess(photo.stat().st_size,400_000)
        for marker in ("rack","bureau","table","canapé","écran de projection","bar","moto","volière","armoires","arcade"):
            self.assertIn(marker,barn.lower())
        catalog=module+(www/"i18n.js").read_text(encoding="utf-8")
        for marker in ("📷 Photo de la grange","⬡ Vue 3D","maison3d-interior-photo","drawBarn(building)",
                       "camera.layers.set(BARN_LAYER)","camera.layers.mask=layersBefore","interior-barn",
                       "isBarnInterior(building)","hasInteriorPhoto"):
            self.assertIn(marker,catalog)
        self.assertIn('interior:"barn"', (www/"scene3d.js").read_text(encoding="utf-8"))
        self.assertIn("Aménagement réaliste (projet exemple)", (www/"i18n.js").read_text(encoding="utf-8"))

    def test_three_loaded_on_demand(self):
        """The photo and the Lovelace card never load three.js: only the 3D view / plan / interior visits do."""
        www = COMPONENT / "www"
        page = (www / "index.html").read_text(encoding="utf-8")
        main = re.search(r'<script type="module">(.*?)</script>', page, re.S).group(1)
        self.assertNotIn('from "three"', main)
        self.assertNotIn("three/addons", main)
        self.assertIn('import("./scene3d.js")', main)
        self.assertIn('id="maison3d-scene-loading"', page)
        self.assertIn("Chargement de la 3D…", page)
        scene = (www / "scene3d.js").read_text(encoding="utf-8")
        self.assertIn('import * as THREE from "three";', scene)
        self.assertIn("export function startScene(", scene)
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn("export function createPhotoView({ensureScene=null}={})", photo)
        # Late listeners (3D loaded on demand) still get the Home Assistant answer.
        storage = (www / "ha-storage.js").read_text(encoding="utf-8")
        self.assertIn("if(answered)fn(haData,{canSave,connected,error:\"\"});", storage)
        # One-time layout migration from this browser still happens without opening the 3D.
        self.assertIn("if(connected&&canSave&&local&&!valid)ensureScene()", main)
        for name in ("photo-view.js", "interior-view.js", "barn-interior.js", "draft.js", "ha-storage.js"):
            self.assertNotRegex((www / name).read_text(encoding="utf-8"), r'from\s+"three', name)

    def test_photo_srcset(self):
        """Bundled photos get srcset/sizes (640 / 960 px copies); custom images do not."""
        www = COMPONENT / "www"
        source = (www / "photo-source.js").read_text(encoding="utf-8")
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        interior = (www / "interior-view.js").read_text(encoding="utf-8")
        self.assertIn("export const RESPONSIVE_WIDTHS=[640,960];", source)
        self.assertIn("export function responsiveSrcset(path)", source)
        self.assertIn("export function photoSizes(", source)
        self.assertIn('"/maison3d-assets/images/grange-interieur.webp":1500', source)
        self.assertIn("if(srcset){image.sizes=imageSizes();image.srcset=srcset}else{image.removeAttribute(\"srcset\");image.removeAttribute(\"sizes\")}", photo)
        self.assertIn("realImg.srcset=responsiveSrcset(", interior)
        self.assertIn('fit:"contain"', interior)
        self.assertTrue((ROOT / "scripts" / "generate_responsive_images.py").is_file())

    def test_card_bottom_bar_folds(self):
        """Lovelace card: « ☰ Menu » / « ▾ Réduire » folds the bar; display state, never a draft change."""
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        start = photo.index('const BAR_KEY="maison3d:card-bar:v1";')
        block = photo[start:photo.index("nav.prepend(barToggle);", start)]
        for marker in ('t(lang,"menu_show")', 't(lang,"menu_hide")',
                       "setBar(barChoice?barChoice===\"collapsed\":narrowCard())",
                       "innerWidth<=600", 'localStorage.setItem(BAR_KEY,barChoice)'):
            self.assertIn(marker, block)
        i18n = (COMPONENT / "www" / "i18n.js").read_text(encoding="utf-8")
        self.assertIn('menu_show:"☰ Menu"', i18n)
        self.assertIn('menu_hide:"▾ Réduire"', i18n)
        self.assertNotIn("changed()", block)
        self.assertNotIn("persist()", block)
        self.assertIn("html.card-mode #maison3d-photo-controls.collapsed>:not(.bar-toggle):not(.maison3d-save.dirty){display:none!important}", photo)
        self.assertIn("#maison3d-photo-controls .bar-toggle{display:none}", photo)
        page = app_page()
        self.assertIn("#maison3d-photo-controls .bar-toggle{display:inline-block!important", page)
        self.assertIn("#maison3d-photo-controls.collapsed>:not(.bar-toggle):not(.maison3d-save.dirty){display:none!important}", page)
        self.assertIn("chrome-photo", photo)
        self.assertIn("html:not(.photo-active).compact-scene #maison3d-photo-controls .chrome-photo{display:none!important}", page)

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
        page = app_page()
        effects = (COMPONENT / "www" / "weather-effects.js").read_text(encoding="utf-8")
        self.assertIn('id="maison3d-importmap"', page)
        self.assertIn('el.type="importmap"', page)
        self.assertIn('from "./weather-effects.js"', page)
        self.assertIn("maison3d:conditions", effects)
        self.assertIn('weather==="snow"', effects)
        self.assertIn('weather==="rain"', effects)
        self.assertIn('weather==="leaves"', effects)
        self.assertIn("setInterval(update,60000)", effects)

    def test_three_is_bundled_locally(self):
        """Three.js and its addons must load from vendor/, never from a CDN."""
        www = COMPONENT / "www"
        page = app_page()
        for name in ("jsdelivr", "unpkg", "cdn."):
            self.assertNotIn(name, page)
        importmap = json.loads(re.search(r'<script type="application/json" id="maison3d-importmap">(.*?)</script>', page, re.S).group(1))
        imports = importmap["imports"]
        self.assertEqual(imports["three"], "./vendor/three/three.module.min.js")
        self.assertTrue((www / imports["three"]).is_file())
        self.assertTrue((www / "vendor" / "three" / "LICENSE").is_file())
        addons = imports["three/addons/"]
        for spec in re.findall(r'from "three/addons/([^"]+)"', page):
            self.assertTrue((www / addons / spec).is_file(), spec)
        for module in www.glob("*.js"):
            text = module.read_text(encoding="utf-8")
            self.assertNotIn("cdn.jsdelivr.net", text, module.name)

    def test_webgl_memory_and_render_pause(self):
        """Removed 3D groups free GPU memory; rendering pauses when not visible."""
        www = COMPONENT / "www"
        page = app_page()
        card = (www / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertIn("function disposeUnused(groups)", page)
        self.assertIn("o.geometry.dispose()", page)
        self.assertIn("if(!used.has(m))m.dispose()", page)
        self.assertIn("disposeUnused(old)", page)
        self.assertIn("if(document.hidden||isOffscreen())return", page)
        self.assertIn("if(!document.hidden&&!offscreen)photoView.frame(time)", page)
        self.assertIn('classList.contains("photo-active")', page)
        self.assertIn('e.data?.type==="maison3d:visibility"', page)
        self.assertIn("e.source!==window.parent||e.origin!==location.origin", page)
        self.assertIn("new IntersectionObserver", card)
        self.assertIn('type:"maison3d:visibility"', card)
        self.assertIn("this._observer?.disconnect()", card)

    def test_frost_effect_wiring(self):
        """Frost overlay: option flow, diagnostics, card/panel bridge and photo toggle."""
        www = COMPONENT / "www"
        config = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        sensor = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        card = (www / "maison3d-card.js").read_text(encoding="utf-8")
        panel = (www / "maison3d-panel.js").read_text(encoding="utf-8")
        editor = (www / "maison3d-card-editor.js").read_text(encoding="utf-8")
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        frost = (www / "frost-effects.js").read_text(encoding="utf-8")
        self.assertIn('vol.Optional("frost_enabled"', config)
        self.assertIn('"frost_enabled":', sensor)
        self.assertIn("frost_enabled:this._config.frost_enabled??", card)
        self.assertIn("frost_enabled: diagnostic?.attributes?.frost_enabled !== false", panel)
        self.assertIn('toggle("frost_enabled"', editor)
        self.assertIn('from "./frost-effects.js"', photo)
        # Frost is controlled from the settings menu only: no extra button on the photo.
        self.assertIn('frostInput.addEventListener("change"', photo)
        self.assertNotIn("frostBtn", photo)
        self.assertIn("nav.append(photoBtn,planBtn,modelBtn,nightBtn,dayBtn,autoBtn,effectsBtn,optionsBtn,saveControls)", photo)
        self.assertIn("frost.frame(time,frostTarget())", photo)
        self.assertIn("frost.frame(time,0)", photo)
        self.assertIn('from "./motion-level.js"', frost)
        # Every sensor key is accepted from the ⚙ menu ("" = inherit).
        self.assertIn('this._choices = Object.fromEntries(ENTITY_KEYS.map(key => [key, ""]));', panel)
        self.assertIn("for(const key of ENTITY_KEYS)this._choices[key]=menuChoice(key,event.data[key]);", panel)
        for language in ("fr", "en"):
            tr = json.loads((COMPONENT / "translations" / f"{language}.json").read_text(encoding="utf-8"))
            self.assertIn("frost_enabled", tr["options"]["step"]["init"]["data"])
        strings = json.loads((COMPONENT / "strings.json").read_text(encoding="utf-8"))
        self.assertIn("frost_enabled", strings["options"]["step"]["init"]["data"])


    def test_animation_motion_option(self):
        """Animations Auto / Always / Never: shared motionLevel, ⚙ menu, draft, all effect modules."""
        www = COMPONENT / "www"
        motion = (www / "motion-level.js").read_text(encoding="utf-8")
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        i18n = (www / "i18n.js").read_text(encoding="utf-8")
        self.assertIn('export const MOTION_MODES=["auto","always","never"];', motion)
        self.assertIn("export function motionLevel(){", motion)
        self.assertIn('MOTION_QUERY="(prefers-reduced-motion: reduce)"', motion)
        self.assertIn("MOTION_REDUCED=.2", motion)
        self.assertIn("animations réduites par le système", i18n)
        self.assertIn("animations reduced by the system", i18n)
        self.assertIn("motion_reduced", motion)
        for name in ("season-effects.js", "photo-cinematics.js", "frost-effects.js",
                     "weather-effects.js", "world-ambience.js", "photo-view.js"):
            source = (www / name).read_text(encoding="utf-8")
            self.assertIn('from "./motion-level.js"', source, name)
        for name in ("season-effects.js", "photo-cinematics.js", "frost-effects.js",
                     "weather-effects.js", "world-ambience.js"):
            self.assertNotIn("prefers-reduced-motion", (www / name).read_text(encoding="utf-8"), name)
        self.assertIn('motion:"auto"', photo)
        self.assertIn('id="maison3d-motion-option"', photo)
        self.assertIn("setMotionMode(state.motion)", photo)
        self.assertIn('motionReduced.hidden=!(motionMode()==="auto"&&systemReduced())', photo)
        self.assertIn('registerSection("photo_settings"', photo)

    def test_weather_test_mode(self):
        """Forced weather + day/night, kept in memory only, reset by « Revenir à la météo réelle »."""
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        for key in ("clear", "cloudy", "rain", "storm", "snow", "wind", "fog", "frost"):
            self.assertIn('["' + key + '",', photo)
        self.assertIn('const test={weather:"auto",time:"auto",season:"auto",moon:"auto"};', photo)
        self.assertIn('if(test.time!=="auto")return test.time==="night";', photo)
        self.assertIn('test.weather="auto";test.time="auto";', photo)
        self.assertIn('status.classList.toggle("testing",testing()||previewing())', photo)
        self.assertNotIn("test:", photo.split("const persist=")[0].split("const state={")[1])

    def test_clean_photos_and_right_menu_layout(self):
        """Bundled photos carry no drawn interface; the seasons menu never covers the status or bottom bar."""
        def webp_size(path):
            data = path.read_bytes()
            assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", path.name
            kind = data[12:16]
            if kind == b"VP8 ":
                return (int.from_bytes(data[26:28], "little") & 0x3FFF,
                        int.from_bytes(data[28:30], "little") & 0x3FFF)
            if kind == b"VP8L":
                bits = int.from_bytes(data[21:25], "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            if kind == b"VP8X":
                return (int.from_bytes(data[24:27], "little") + 1,
                        int.from_bytes(data[27:30], "little") + 1)
            raise AssertionError(path.name)

        www = COMPONENT / "www"
        # Exterior (house) photos share one frame; the real barn interior photo is separate.
        interior = www / "images" / "grange-interieur.webp"
        photos = [www / "maison3d-reference.webp",
                  *sorted(p for p in (www / "images").glob("*.webp")
                          if p != interior and not re.search(r"-(640|960)\.webp$", p.name))]
        self.assertEqual(len(photos), 15)
        for path in photos:
            self.assertEqual(webp_size(path), (1286, 914), path.name)
        self.assertEqual(webp_size(interior), (1500, 845))
        # Lighter copies (srcset) of the main photo, the day/night photos and the barn photo.
        for full in [www / "maison3d-reference.webp", interior,
                     *sorted((www / "images").glob("*-jour.webp")), *sorted((www / "images").glob("*-nuit.webp"))]:
            width, height = webp_size(full)
            for w in (640, 960):
                copy = full.with_name(f"{full.stem}-{w}.webp")
                self.assertEqual(webp_size(copy), (w, round(height * w / width)), copy.name)
                self.assertLess(copy.stat().st_size, full.stat().st_size, copy.name)
        # Bundled photos are WebP only (no JPEG copies left behind).
        self.assertEqual(sorted(p.name for p in www.rglob("*.jpg")), [])
        self.assertFalse((ROOT / "assets" / "maison3d-reference.jpg").exists())
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        # Seasons are part of the bottom settings bar (no column over the photo).
        self.assertNotIn("function placeSeasons(){", photo)
        self.assertIn("nav.append(seasonBreak,seasonalNav);", photo)
        self.assertIn("document.body.append(section,nav,settings);", photo)
        self.assertIn('"html.photo-active #maison3d-photo-controls{top:auto;bottom:10px}"', photo)
        self.assertIn('seasonPick.addEventListener("change",()=>seasonPick.value==="auto"?endPreview():chooseSeason(seasonPick.value));', photo)
        panel = (www / "maison3d-panel.js").read_text(encoding="utf-8")
        self.assertIn("min-height:240px", panel)

    def test_clean_home_assistant_integration(self):
        """One translated ENUM diagnostic sensor, single config entry, runtime_data, unload order."""
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        self.assertIs(manifest["single_config_entry"], True)
        keys = list(manifest)
        self.assertEqual(keys[:2], ["domain", "name"])
        self.assertEqual(keys[2:], sorted(keys[2:]))
        flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertNotIn("async_set_unique_id", flow)
        sensors = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        self.assertIn('_attr_translation_key = "sensors_status"', sensors)
        self.assertIn("SensorDeviceClass.ENUM", sensors)
        self.assertIn("registry.async_remove(entity_id)", sensors)
        self.assertNotIn("_attr_name", sensors)
        self.assertEqual(sensors.count("(SensorEntity)"), 2)  # status + base of the view sensors
        for key in ("season_mode", "season", "photo", "ambience", "day_night"):
            self.assertIn(f'key = "{key}"', sensors)
        self.assertIn("EntityCategory.DIAGNOSTIC", sensors)
        self.assertIn('self.entity_id = f"sensor.maison3d_{self.key}"', sensors)
        self.assertIn('self._attr_unique_id = f"{entry.entry_id}_{self.key}"', sensors)
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn("entry.runtime_data = Maison3DRuntimeData()", init)
        unload = init.split("async def async_unload_entry")[1]
        self.assertLess(unload.index("async_unload_platforms"), unload.index("async_remove_panel"))
        icons = json.loads((COMPONENT / "icons.json").read_text(encoding="utf-8"))
        self.assertIn("sensors_status", icons["entity"]["sensor"])
        views = ("season_mode", "season", "photo", "ambience", "day_night")
        for key in views:
            self.assertIn(key, icons["entity"]["sensor"])
        for name in ("strings.json", "translations/en.json", "translations/fr.json"):
            data = json.loads((COMPONENT / name).read_text(encoding="utf-8"))
            for key in views:
                self.assertTrue(data["entity"]["sensor"][key]["name"], (name, key))
            sensor = data["entity"]["sensor"]["sensors_status"]
            self.assertEqual(set(sensor["state"]), {"ok", "not_configured", "degraded"}, name)
            self.assertIn("single_instance_allowed", data["config"]["abort"], name)
        fr = json.loads((COMPONENT / "translations" / "fr.json").read_text(encoding="utf-8"))
        self.assertEqual(fr["entity"]["sensor"]["sensors_status"]["name"], "État des capteurs")

    def test_review_points(self):
        """Review v2.10.0, points 1–4 (previews, recovery, overrides, this browser's version)."""
        www = COMPONENT / "www"
        draft = (www / "draft.js").read_text(encoding="utf-8")
        storage = (www / "ha-storage.js").read_text(encoding="utf-8")
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        panel = (www / "maison3d-panel.js").read_text(encoding="utf-8")
        card = (www / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertIn('RECOVERY_KEY="maison3d:draft:v1:"+instance', draft)
        self.assertIn("sessionStorage", draft)
        self.assertIn('frame.name = "maison3d-panel";', panel)
        self.assertIn('frame.name="maison3d-card:"+cardInstance(location.pathname,this._config);', card)
        self.assertIn('addEventListener("maison3d:section-needed"', app_page())
        self.assertIn('const COPY_KEY="maison3d:browser-copy:v1";', storage)
        self.assertIn("export function useHaVersion()", storage)
        self.assertIn("if(connected)keepBrowserCopy(patch);", draft)
        for source in (panel, card):
            self.assertIn("integration_options", source)
        self.assertIn("card_options", card)
        for key in ("effect_override", "frost_override", "weather_photos_override", "base_image_url"):
            self.assertIn(f'overrideNote(', photo)
            self.assertIn(f'key:"{key}"', photo)
        flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertIn('"overrides": state_logic.overrides_text(', flow)
        for name in ("strings.json", "translations/en.json", "translations/fr.json"):
            data = json.loads((COMPONENT / name).read_text(encoding="utf-8"))
            self.assertIn("{overrides}", data["options"]["step"]["init"]["description"], name)

    def test_outdoor_lights(self):
        """Lights are photo settings (draft), toggle off by default, parents check the toggle."""
        www = COMPONENT / "www"
        lights = (www / "lights.js").read_text(encoding="utf-8")
        self.assertIn('export const DEFAULT_TOGGLE="off";', lights)
        self.assertIn('export const LIGHT_DOMAINS=["light","switch"];', lights)
        self.assertNotIn("three", lights.split("*/", 1)[1])
        view = (www / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn('lights:[],light_toggle:"off"', view)
        self.assertIn("state.lights=cleanLights(saved.lights)", view)
        self.assertIn("lights:state.lights.map(l=>({...l}))", view)
        for name in ("maison3d-card.js", "maison3d-panel.js"):
            source = (www / name).read_text(encoding="utf-8")
            self.assertIn("createLightBridge", source, name)
            self.assertIn("light_states:", source.replace("light_states: ", "light_states:"), name)
            self.assertIn("lights:", source.replace("lights: ", "lights:"), name)
        workflow = (ROOT / ".github" / "workflows" / "validate.yml").read_text(encoding="utf-8")
        self.assertIn("node tests/test_lights.mjs", workflow)
        self.assertIn("node --check custom_components/maison3d/www/lights.js", workflow)

    def test_set_hass_is_cheap(self):
        """Card and panel memoise the tracked entities and skip unrelated updates."""
        www = COMPONENT / "www"
        tracker = (www / "hass-tracker.js").read_text(encoding="utf-8")
        self.assertIn("export function createHassTracker(", tracker)
        for name in ("maison3d-card.js", "maison3d-panel.js"):
            source = (www / name).read_text(encoding="utf-8")
            self.assertIn("createHassTracker", source, name)
            self.assertIn("if (!force && !dirty) return;", source, name)
            self.assertNotIn("Object.values(states)", source, name)
            self.assertNotIn("Object.values(this._hass", source, name)

    def test_scene_bars_never_overlap(self):
        """Edit-mode floating bars are laid out by scene-layout.js (brand no longer hidden)."""
        www = COMPONENT / "www"
        page = app_page()
        self.assertIn('import {createSceneLayout} from "./scene-layout.js";', page)
        self.assertIn("createSceneLayout();", page)
        self.assertIn("html.compact-scene", page)
        layout = (www / "scene-layout.js").read_text(encoding="utf-8")
        self.assertIn('[".brand","top","left"]', layout)
        self.assertIn("export function place(", layout)

    def test_neutral_project_name(self):
        """No personal project name in the sources; configurable name, default « Maison 3D »."""
        for path in ROOT.rglob("*"):
            if ".git" in path.parts or "__pycache__" in path.parts or not path.is_file():
                continue
            if path.suffix in {".jpg", ".png", ".webp", ".zip", ".pyc"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            self.assertNotIn("Mar" + "ly", text, str(path))
        const = (COMPONENT / "const.py").read_text(encoding="utf-8")
        self.assertIn('DEFAULT_PROJECT_NAME = "Maison 3D"', const)
        flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertIn('vol.Optional("project_name"', flow)
        self.assertIn('"project_name":', (COMPONENT / "sensor.py").read_text(encoding="utf-8"))
        www = COMPONENT / "www"
        page = app_page()
        self.assertEqual(page.count('<span class="project-name">Maison 3D</span>'), 2)
        self.assertIn("project_name:", (www / "maison3d-panel.js").read_text(encoding="utf-8"))
        card = (www / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertIn("project_name:this._projectName()", card)
        self.assertIn('field(base,"project_name"', (www / "maison3d-card-editor.js").read_text(encoding="utf-8"))
        for name in ("strings.json", "translations/fr.json", "translations/en.json"):
            data = json.loads((COMPONENT / name).read_text(encoding="utf-8"))
            self.assertIn("project_name", data["options"]["step"]["init"]["data"], name)

    def test_photo_upload_from_home_assistant(self):
        """Photos sent from the HA UI: admin-only view, own static folder, media-source ids."""
        www = COMPONENT / "www"
        upload = (COMPONENT / "upload.py").read_text(encoding="utf-8")
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn('UPLOAD_URL = "/api/maison3d/upload"', upload)
        self.assertIn('MEDIA_URL = "/maison3d-media"', upload)
        self.assertIn("MAX_BYTES = 10 * 1024 * 1024", upload)
        self.assertIn("await async_register_upload(hass)", init)
        bridge = (www / "storage-bridge.js").read_text(encoding="utf-8")
        self.assertIn('type==="maison3d:upload"', bridge)
        self.assertIn("fetchWithAuth", bridge)
        view = (www / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn("uploadToHa(file", view)
        self.assertIn("maison3d-upload", view)
        editor = (www / "maison3d-card-editor.js").read_text(encoding="utf-8")
        self.assertIn("uploadPhoto(this._hass", editor)
        self.assertIn('customElements.get("ha-selector")', editor)
        for name in ("maison3d-card.js", "maison3d-panel.js"):
            self.assertIn("createMediaResolver", (www / name).read_text(encoding="utf-8"))
        source = (www / "photo-source.js").read_text(encoding="utf-8")
        self.assertIn("/maison3d-media/", source)
        flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertIn("media-source://", flow)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("## 📤 Envoyer ses photos depuis Home Assistant", readme)

    def test_project_saved_in_home_assistant(self):
        """3D layout, photo settings and view saved in HA through the parent bridge."""
        www = COMPONENT / "www"
        page = app_page()
        self.assertIn('import {onHaData,saveToHa,browserCopySections} from "./ha-storage.js";', page)
        self.assertIn('registerSection("layout",', page)
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn('registerSection("photo_settings",', photo)
        self.assertIn("onHaData((ha,{connected,canSave})=>{", photo)
        presentation = (www / "presentation.js").read_text(encoding="utf-8")
        self.assertIn('registerSection("view",', presentation)
        draft = (www / "draft.js").read_text(encoding="utf-8")
        self.assertIn("if(saveToHa(patch)){", draft)
        for name in ("maison3d-panel.js", "maison3d-card.js"):
            source = (www / name).read_text(encoding="utf-8")
            self.assertIn("createStorageBridge({getFrame:()=>this._frame,getHass:()=>this._hass})", source)
        bridge = (www / "storage-bridge.js").read_text(encoding="utf-8")
        self.assertIn('hass.callWS({type:"maison3d/save",...patch})', bridge)
        self.assertIn("event.source!==frame.contentWindow||event.origin!==window.location.origin", bridge)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("## 💾 Sauvegarde dans Home Assistant", readme)

    def test_panel_bridge(self):
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        self.assertIn("postMessage", panel)
        tracker = (COMPONENT / "www" / "hass-tracker.js").read_text(encoding="utf-8")
        self.assertIn("isWeather", panel)
        self.assertIn('"weather."', tracker)
        self.assertIn("sun.sun", panel)

    def test_interactive_lovelace_card(self):
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        page = app_page()
        self.assertIn('customElements.define("maison3d-card"', card)
        self.assertIn("custom:maison3d-card", card)
        self.assertIn("maison3d:conditions", card)
        self.assertIn("mode=card", card)
        self.assertIn('get("mode")==="card"', page)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("maison3d-assets/maison3d-card.js", readme)

    def test_card_auto_loaded_in_card_picker(self):
        """The card is loaded on every dashboard and listed in « Ajouter une carte »."""
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        const = (COMPONENT / "const.py").read_text(encoding="utf-8")
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn("frontend", manifest["dependencies"])
        self.assertIn('CARD_URL = f"{ASSETS_URL}/maison3d-card.js"', const)
        self.assertIn('card_url = f"{CARD_URL}?v={version}"', init)
        self.assertIn("frontend.add_extra_js_url(hass, card_url)", init)
        self.assertIn('getattr(frontend, "remove_extra_js_url", None)', init)
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertIn('if (!customElements.get("maison3d-card"))', card)
        self.assertIn('window.customCards.some(card=>card.type==="maison3d-card")', card)
        for text in ('type:"maison3d-card",name:"Maison 3D"', "preview:true", "documentationURL:"):
            self.assertIn(text, card)
        self.assertIn("return {};", card.split("static getStubConfig()")[1][:200])
        editor = (COMPONENT / "www" / "maison3d-card-editor.js").read_text(encoding="utf-8")
        self.assertIn('if(!customElements.get("maison3d-card-editor"))', editor)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("chargée automatiquement", readme)

    def test_architecture_module(self):
        architecture = (COMPONENT / "www" / "architecture.js").read_text(encoding="utf-8")
        page = app_page()
        self.assertIn("createArchitectureKit", architecture)
        for expected in ("gableRoof", "masonryTexture", "window(", "house(", "terrace(", "wall(", "ramp(", "landscape("):
            self.assertIn(expected, architecture)
        self.assertIn('from "./architecture.js"', page)
        self.assertIn("architecture.build(g,o)", page)
        self.assertIn("architecture.landscape(scene)", page)

    def test_realistic_views_and_live_3d_weather(self):
        page = app_page()
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
        html = app_page()
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertTrue((COMPONENT / "www" / "maison3d-reference.webp").is_file())
        for key in ("day","night","cloudy","rain","snow","wind","storm","spring","summer","autumn","winter"):
            self.assertIn('"' + key + '"', photo)
        self.assertIn('from "./photo-view.js"', html)
        self.assertIn("photoView.frame(time)", html)
        self.assertIn("maison3d:entity-selection", photo)
        self.assertIn("moon_entity", photo)
        self.assertIn("moon_entity", panel)
        self.assertIn("images:this._media.images(this._config.images)", card)
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
            self.assertIn(key, editor)
        # The diagnostic sensor covers every option slot (and the legacy entities to remove).
        self.assertIn("from .config_flow import DEFAULT_ENTITIES", sensors)
        self.assertIn("LEGACY_SOURCE_SENSORS = tuple(DEFAULT_ENTITIES)", sensors)
        self.assertIn("OptionsFlowWithReload",flow)
        self.assertIn("async_get_options_flow",flow)
        self.assertIn('PLATFORMS = ["sensor"]', setup)
        self.assertIn('async_forward_entry_setups(entry, PLATFORMS)', setup)
        self.assertIn("maison3d_config",sensors)
        self.assertNotIn("Maison3DSourceStatusSensor",sensors)
        self.assertIn("config-changed",editor)
        self.assertIn("static getConfigElement()",card)
        tracker = (COMPONENT / "www" / "hass-tracker.js").read_text(encoding="utf-8")
        self.assertIn("maison3d_config",tracker)
        self.assertIn("this._tracker.diagnostic(states)",panel)
        self.assertIn("this._tracker.diagnostic(states)",card)
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
        source = (COMPONENT / "www" / "photo-source.js").read_text(encoding="utf-8")
        for phase in phases:
            self.assertIn('"moon_' + phase + '"', source)
        # The image slots are shared from photo-source.js by the photo view, card and editor.
        self.assertIn("IMAGE_KEYS", photo)
        self.assertIn("IMAGE_KEYS.includes(key)", card)
        self.assertIn("IMAGE_SLOTS", editor)
        self.assertIn("ctx.shadowBlur=28", photo)
        self.assertIn("ctx.lineTo(x,y)", photo)
        self.assertIn("moonPhase(live.moon)", photo)

    def test_bundled_weather_assets_in_release(self):
        from pathlib import Path
        from hashlib import sha256
        images = COMPONENT / "www" / "images"
        source = (COMPONENT / "www" / "photo-source.js").read_text(encoding="utf-8")
        generated = [f"{w}-{t}.webp" for w in ("clair", "nuageux", "pluie", "neige", "vent", "orage", "brouillard")
                     for t in ("jour", "nuit")]
        for name in generated:
            path = images / name
            self.assertTrue(path.is_file(), f"Missing bundled photo: {name}")
            data = path.read_bytes()
            self.assertGreater(len(data), 20000)
            self.assertLess(len(data), 400000)
            self.assertEqual(data[:4], b"RIFF")
            self.assertEqual(data[8:12], b"WEBP")
            self.assertEqual(int.from_bytes(data[4:8], "little") + 8, len(data))
        for retired in ("jour.webp", "nuageux.webp", "pluie.webp", "neige.webp"):
            self.assertFalse((images / retired).exists(), retired)
        for word in ("clair", "nuageux", "pluie", "neige", "vent", "orage", "brouillard"):
            self.assertIn(f'"{word}"', source)
        self.assertIn('"-jour.webp"', source)
        self.assertIn('"-nuit.webp"', source)
        self.assertIn("export function bundledPhoto(", source)
        readme = (images / "README.md").read_text(encoding="utf-8")
        for name in generated:
            self.assertIn(name, readme)
        self.assertEqual(len({sha256((images / n).read_bytes()).hexdigest()
            for n in ("clair-jour.webp", "nuageux-jour.webp", "pluie-jour.webp", "neige-jour.webp")}), 4)

    def test_photo_weather_cinematics_and_import(self):
        module = (COMPONENT / "www" / "photo-cinematics.js").read_text(encoding="utf-8")
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn("createPhotoCinematics", module)
        self.assertIn('from "./photo-cinematics.js"', photo)
        self.assertIn("cinematics.frame(time", photo)
        for feature in ("clouds(", "sunshine(", "drizzleShine(",
                        "snowAccumulation(", "autumnHaze(", "nightHaze("):
            self.assertIn(feature, module)
        self.assertIn('type="range"', photo)
        self.assertIn("effect_intensity", photo)
        self.assertIn("fogBanks(", module)
        self.assertFalse((ROOT / "scripts" / "import_weather_images.py").exists())

    def test_photo_night_day_auto_buttons_and_visible_night_filter(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn('nightBtn.textContent=t("night")', photo)
        self.assertIn("☾ Nuit réelle", (COMPONENT/"www"/"i18n.js").read_text(encoding="utf-8"))
        self.assertIn('nightBtn.addEventListener("click",()=>setTest({time:"night"}))', photo)
        self.assertIn('dayBtn.addEventListener("click",()=>setTest({time:"day"}))', photo)
        self.assertIn('autoBtn.addEventListener("click",()=>resetTest.click())', photo)
        self.assertIn('section.classList.toggle("photo-night",night)', photo)
        self.assertIn('photo-night:not(.effects-off):not(.night-photo) img{filter:brightness(', photo)
        self.assertIn('persist();update()', photo)

    def test_photo_moon_preview_and_right_hand_season_buttons(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        moon = (COMPONENT / "www" / "moon-effects.js").read_text(encoding="utf-8")
        html = app_page()
        self.assertIn('from "./moon-effects.js"', photo)
        self.assertIn("createMoonOverlay({container:section})", photo)
        self.assertIn("skyMoon.draw(", photo)
        self.assertIn('seasonalNav.id="maison3d-photo-seasons"', photo)
        self.assertIn("seasonButtons.set(key,btn)", photo)
        # Season bubbles and moon phase: temporary previews (never saved, no draft change).
        self.assertIn("test.season=key===\"auto\"?\"auto\":key;", photo)
        self.assertIn("test.moon=v;state.enabled=true;armPreview();update();", photo)
        self.assertIn("delete copy.moon_preview", photo)
        self.assertNotIn("state.moon_preview", photo)
        chooser = photo.split("const chooseSeason=key=>{", 1)[1].split("};", 1)[0]
        self.assertNotIn("persist()", chooser)
        self.assertIn("const PREVIEW_MS=Number(globalThis.__maison3dPreviewMs)||120000;", photo)
        self.assertIn("testButtons.set(key,btn)", photo)
        self.assertIn('resetTest.textContent=t("reset_test")', photo)
        self.assertIn("◉ Revenir à la météo réelle", (COMPONENT / "www" / "i18n.js").read_text(encoding="utf-8"))
        for phase in ("new_moon","waxing_crescent","first_quarter",
                      "waxing_gibbous","full_moon","waning_gibbous",
                      "last_quarter","waning_crescent"):
            self.assertIn(phase, moon)
        self.assertIn("canvas.className=\"maison3d-sky-moon\"", moon)
        self.assertIn("canvas.getContext", moon)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        for img in ("clair-jour.webp","nuageux-jour.webp","pluie-jour.webp","neige-jour.webp"):
            self.assertIn('src="custom_components/maison3d/www/images/'+img+'"', readme)
        for retired in ("jour.webp","nuageux.webp","pluie.webp","neige.webp"):
            self.assertNotIn('src="custom_components/maison3d/www/images/'+retired+'"', readme)

    def test_fixed_photo_is_default_and_weather_only_changes_overlays(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn('use_weather_photos:false', photo)
        self.assertIn('const picked=state.use_weather_photos?pickWeatherPhoto({', photo)
        self.assertIn('}):{path:mainPhoto,nightPhoto:false};', photo)
        self.assertIn('tint.style.background=state.effect?weatherTint:"transparent"', photo)
        self.assertIn('photoBtn.setAttribute("aria-pressed"', photo)
        self.assertNotIn('realBtn.setAttribute(', photo)
        self.assertIn('swapPhotos.addEventListener("change"', photo)
        self.assertIn('skyMoon.draw(', photo)
        self.assertIn('cinematics.frame(', photo)

    def test_2d_plan_accessible_from_photo_and_restores_mode(self):
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        app = app_page()
        self.assertIn('planBtn.textContent=t("view_plan")', photo)
        self.assertIn("▤ Plan 2D", (COMPONENT/"www"/"i18n.js").read_text(encoding="utf-8"))
        self.assertIn('nav.append(photoBtn,planBtn,modelBtn', photo)
        self.assertIn('planBtn.addEventListener("click",()=>setModelView("2d"))', photo)
        self.assertIn('modelBtn.addEventListener("click",()=>setModelView("3d"))', photo)
        self.assertIn('document.getElementById(view==="2d"?"topview":"tab3d")?.click()', photo)
        self.assertIn('planBtn.setAttribute("aria-pressed"', photo)
        self.assertIn('saved.model_view==="2d"', photo)
        self.assertIn('id="topview"', app)
        self.assertIn('id="tab3d"', app)
        self.assertIn('state.enabled=false;state.model_view=view', photo)

    def test_automatic_seasons_follow_home_assistant_time_zone(self):
        season = (COMPONENT / "www" / "season-effects.js").read_text(encoding="utf-8")
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        self.assertIn('Intl.DateTimeFormat("en-GB"', season)
        self.assertIn("timeZone:zone", season)
        self.assertIn('month>=3&&month<=5?"spring"', season)
        self.assertIn('month>=6&&month<=8?"summer"', season)
        self.assertIn('month>=9&&month<=11?"autumn":"winter"', season)
        self.assertIn('automaticSeason(haTimeZone)', photo)
        self.assertIn('seasonalEffects.frame(time,seasonNow()', photo)
        self.assertIn('lastAutoSeason=currentSeason;update()', photo)
        self.assertIn('time_zone: this._hass.config?.time_zone', panel)
        self.assertIn('time_zone:this._hass.config?.time_zone', card)
        # « Saison fixe » (saved, draft): only the season, not the ambience.
        self.assertIn("state.season=v;state.enabled=true;\n    persist();update();", photo)
        self.assertIn('seasonalCanvas.className="season-overlay"', photo)

    def test_configurable_main_photo_and_effect_switches(self):
        config = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        sensor = (COMPONENT / "sensor.py").read_text(encoding="utf-8")
        card = (COMPONENT / "www" / "maison3d-card.js").read_text(encoding="utf-8")
        panel = (COMPONENT / "www" / "maison3d-panel.js").read_text(encoding="utf-8")
        editor = (COMPONENT / "www" / "maison3d-card-editor.js").read_text(encoding="utf-8")
        photo = (COMPONENT / "www" / "photo-view.js").read_text(encoding="utf-8")
        source = (COMPONENT / "www" / "photo-source.js").read_text(encoding="utf-8")
        self.assertIn("validate_image_url", config)
        self.assertIn('vol.Optional("base_image_url"', config)
        self.assertIn('vol.Optional("effects_enabled"', config)
        self.assertIn('"base_image_url":', sensor)
        self.assertIn('"effects_enabled":', sensor)
        self.assertIn("base_image_url:this._media.url(this._config.base_image_url||", card)
        self.assertIn("effects_enabled:this._config.effects_enabled??", card)
        self.assertIn('this._updateStates(true)', card)
        self.assertIn('base_image_url: this._media.url(typeof diagnostic?.attributes?.base_image_url', panel)
        self.assertIn('effects_enabled: diagnostic?.attributes?.effects_enabled !== false', panel)
        self.assertIn('this._changed("base_image_url"', editor)
        self.assertIn('select.addEventListener("change"', editor)
        self.assertIn('toggle("effects_enabled"', editor)
        self.assertIn("resolveMainPhoto({", photo)
        self.assertIn("previewBtn.addEventListener", photo)
        self.assertIn('effectsBtn.addEventListener("click"', photo)
        self.assertIn('section.classList.toggle("effects-off",!state.effect)', photo)
        self.assertIn('state.effect&&Boolean(phaseName)', photo)
        self.assertIn("const failedImages=new Set()", photo)
        self.assertIn("DEFAULT_MAIN_PHOTO", source)
        for language in ("fr", "en"):
            tr = json.loads((COMPONENT / "translations" / f"{language}.json").read_text(encoding="utf-8"))
            self.assertIn("base_image_url", tr["options"]["step"]["init"]["data"])
            self.assertIn("effects_enabled", tr["options"]["step"]["init"]["data"])

    def test_exact_approved_readme_image(self):
        """The README shows the bundled reference photo itself (no duplicate copy in assets/)."""
        self.assertTrue((COMPONENT / "www" / "maison3d-reference.webp").is_file())
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn('src="custom_components/maison3d/www/maison3d-reference.webp"', content)
    def test_sensor_values_shared_module(self):
        www = COMPONENT / "www"
        values = (www / "sensor-values.js").read_text(encoding="utf-8")
        for word in ("vert", "jaune", "orange", "rouge", "green", "yellow", "red", "verglas"):
            self.assertIn(word, values)
        for name in ("maison3d-card.js", "maison3d-panel.js", "photo-view.js", "maison3d-card-editor.js"):
            src = (www / name).read_text(encoding="utf-8")
            self.assertTrue('from "./sensor-values.js"' in src or '"./sensor-values.js"' in src, name)
        for name in ("maison3d-card.js", "maison3d-panel.js"):
            src = (www / name).read_text(encoding="utf-8")
            self.assertIn("precipitation(", src, name)
            self.assertIn("sensor_issues", src, name)
            self.assertIn("this._tracker.moon(states)", src, name)
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        self.assertIn("weatherKind(", photo)
        self.assertIn("sensor-warning", photo)
        self.assertNotIn("premier_croissant", photo)
        self.assertIn("sensor-warning", (www / "maison3d-card-editor.js").read_text(encoding="utf-8"))
        tracker = (www / "hass-tracker.js").read_text(encoding="utf-8")
        self.assertIn("moonRank", tracker)
        self.assertIn("node tests/test_sensor_values.mjs", (ROOT / ".github/workflows/validate.yml").read_text(encoding="utf-8"))
    def test_entity_selectors_and_effective_values(self):
        www = COMPONENT / "www"
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        panel = (www / "maison3d-panel.js").read_text(encoding="utf-8")
        card = (www / "maison3d-card.js").read_text(encoding="utf-8")
        editor = (www / "maison3d-card-editor.js").read_text(encoding="utf-8")
        values = (www / "sensor-values.js").read_text(encoding="utf-8")
        # No fictitious defaults in the ⚙ menu: "" = inherit, old placeholders cleaned.
        self.assertNotIn('moon_entity:"sensor.moon_phase"', photo)
        self.assertNotIn('sun_entity:"sun.sun"', photo)
        self.assertNotIn('moon_entity:"sensor.moon_phase"', panel)
        self.assertIn('LEGACY_MENU_DEFAULTS={moon_entity:"sensor.moon_phase",sun_entity:"sun.sun"}', values)
        self.assertIn("state[key]=menuChoice(key,saved[key])", photo)
        # Selectors filled by the parent, effective value and its source shown.
        self.assertIn('"maison3d:entity-options-request"', photo)
        self.assertIn('"maison3d:entity-options"', photo)
        self.assertIn("entities_effective", photo)
        for src, name in ((panel, "panel"), (card, "card")):
            self.assertIn('"maison3d:entity-options-request"', src, name)
            self.assertIn("entityOptions(", src, name)
            self.assertIn("entities_effective", src, name)
        self.assertIn('[["card",this._config],["menu",menu],["integration",integration]]', card)
        self.assertIn('[["menu", this._choices], ["integration", configured]]', panel)
        self.assertIn("const choice = key => this._choices[key] || configured[key] || \"\";", panel)
        # Lovelace editor: HA picker filtered per field, native fallback.
        self.assertIn("control.entityFilter=entity=>entityMatches(key,entity);", editor)
        self.assertIn('customElements.get("ha-entity-picker")', editor)

    def test_explicit_save_button(self):
        """Nothing is saved automatically: draft + « 💾 Enregistrer » / « ↶ Annuler » (2D and 3D)."""
        www = COMPONENT / "www"
        photo = (www / "photo-view.js").read_text(encoding="utf-8")
        page = app_page()
        presentation = (www / "presentation.js").read_text(encoding="utf-8")
        draft = (www / "draft.js").read_text(encoding="utf-8")
        i18n = (www / "i18n.js").read_text(encoding="utf-8")
        self.assertIn("const persist=()=>changed();", photo)
        self.assertIn("function save(){changed()}", page)
        # The only direct writes left: draft.js (on click), the one-time migration and the HA cache.
        self.assertEqual(photo.count("saveToHa("), 1)
        self.assertEqual(page.count("saveToHa("), 1)
        self.assertNotIn("saveToHa(", presentation)
        # + the folded / unfolded card bar (display state, not a setting).
        self.assertEqual(photo.count("localStorage.setItem("), 3)
        self.assertEqual(photo.count("localStorage.setItem(BAR_KEY,"), 1)
        self.assertIn('textContent=t("save_btn")', draft)
        self.assertIn('cancel.textContent=t("undo_btn")', draft)
        self.assertIn("💾 Enregistrer", i18n)
        self.assertIn("↶ Annuler", i18n)
        self.assertIn("● Modifications non enregistrées", i18n)
        self.assertIn("Enregistré ✓", i18n)
        self.assertIn('window.addEventListener("beforeunload"', draft)
        self.assertIn('type:"maison3d:dirty"', draft)
        for name in ("maison3d-panel.js", "maison3d-card.js"):
            src = (www / name).read_text(encoding="utf-8")
            self.assertIn('"maison3d:dirty"', src, name)
            self.assertIn('addEventListener("beforeunload",this._onBeforeUnload)', src, name)

    def test_cache_busting_version(self):
        """?v=<manifest version> on the panel, the card, their imports and the iframe."""
        www = COMPONENT / "www"
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn('module_url=f"{ASSETS_URL}/maison3d-panel.js?v={version}"', init)
        self.assertIn("async_get_integration(hass, DOMAIN)", init)
        self.assertIn("async_add_executor_job(_frontend_present)", init)
        self.assertNotIn(").is_file():", init.split("def _frontend_present")[0])
        for name in ("maison3d-card.js", "maison3d-panel.js", "maison3d-card-editor.js", "hass-tracker.js"):
            src = (www / name).read_text(encoding="utf-8")
            self.assertIn('new URL(import.meta.url).searchParams.get("v")', src, name)
            self.assertIsNone(re.search(r'^import .* from "\./', src, re.M), name)
        card = (www / "maison3d-card.js").read_text(encoding="utf-8")
        panel = (www / "maison3d-panel.js").read_text(encoding="utf-8")
        self.assertIn('"/maison3d-assets/index.html?mode=card"+(VERSION?"&v="', card)
        self.assertIn('frame.src = "/maison3d-assets/index.html" + V;', panel)
        self.assertIn('frame.title = "Maison 3D";', panel)
        self.assertNotIn("V2.0", panel)
        page = app_page()
        self.assertNotIn("V2.0", page)
        modules = json.loads(re.search(r"const MODULES=(\[[^\]]*\])", page).group(1))
        self.assertEqual(set(modules), {path.name for path in www.glob("*.js")})
        self.assertLess(page.index('id="maison3d-importmap"'), page.index('<script type="module">'))


if __name__ == "__main__":
    unittest.main()
