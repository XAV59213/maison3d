"""Python port (state_logic.py) used by the diagnostic sensors = same results as the JS view.

state_logic.py has no Home Assistant import, so it is loaded straight from its file.
Parity cases are evaluated by node on the real www/*.js modules when node is available.
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "maison3d"
spec = importlib.util.spec_from_file_location("maison3d_state_logic", COMPONENT / "state_logic.py")
logic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(logic)


def st(entity_id, state, **attributes):
    return types.SimpleNamespace(entity_id=entity_id, state=state, attributes=attributes)


def getter(*states):
    table = {s.entity_id: s for s in states}
    return table.get


IMG = "/maison3d-assets/images/"


class ComputeViewTest(unittest.TestCase):
    def view(self, saved=None, options=None, *states, month=11, hour=14, **kw):
        return logic.compute_view(saved or {}, options or {}, getter(*states), month=month, hour=hour, **kw)

    def test_defaults_follow_sun_and_calendar(self):
        v = self.view(None, None, st("sun.sun", "above_horizon"))
        self.assertEqual((v["season_mode"], v["season"], v["ambience"], v["day_night"]), ("auto", "autumn", "day", "day"))
        self.assertEqual((v["photo"], v["photo_source"]), (logic.DEFAULT_MAIN_PHOTO, "main"))
        v = self.view(None, None, st("sun.sun", "below_horizon"))
        self.assertEqual((v["ambience"], v["day_night"], v["night_source"]), ("night", "night", "sun"))

    def test_clock_fallback_without_sun(self):
        self.assertEqual(self.view(hour=21)["day_night"], "night")
        self.assertEqual(self.view(hour=6)["night_source"], "clock")
        self.assertEqual(self.view(hour=12)["day_night"], "day")

    def test_weather_photos_and_kinds(self):
        sun = st("sun.sun", "below_horizon")
        weather = st("weather.home", "rainy")
        v = self.view({"weather_photos_override": True}, {}, sun, weather, detected_weather=weather)
        self.assertEqual((v["ambience"], v["weather_kind"]), ("rain", "rain"))
        self.assertEqual((v["photo"], v["photo_source"]), (IMG + "pluie-nuit.webp", "bundled:rain_night"))
        self.assertEqual(v["entities"]["weather_entity"], "weather.home")
        # Integration option off and no project override → main photo.
        self.assertEqual(self.view({}, {}, sun, weather, detected_weather=weather)["photo_source"], "main")
        # Own main photo: no photo of the reference house.
        own = self.view({"weather_photos_override": True, "base_image_url": "/local/home.jpg"}, {}, sun, weather,
                        detected_weather=weather)
        self.assertEqual(own["photo"], "/local/home.jpg")

    def test_frost_and_effects(self):
        options = {"snow_entity": "sensor.snow", "temperature_entity": "sensor.t"}
        states = (st("sensor.snow", "2", friendly_name="Neige verglas"), st("sensor.t", "-3", unit_of_measurement="°C"))
        v = self.view({}, options, *states)
        self.assertIn(v["weather_kind"], ("frost", "snow"))
        if v["weather_kind"] == "frost":
            self.assertTrue(v["frost"])
            self.assertNotEqual(v["ambience"], "frost")
        off = self.view({"frost_override": False}, options, *states)
        self.assertEqual(off["weather_kind"], "snow")

    def test_fixed_season_and_ambience(self):
        v = self.view({"season": "winter", "mode": "storm"}, {}, st("sun.sun", "below_horizon"), month=7)
        self.assertEqual((v["season_mode"], v["fixed_season"], v["season"]), ("fixed", "winter", "winter"))
        self.assertEqual((v["ambience"], v["ambience_mode"], v["day_night"], v["night_source"]),
                         ("storm", "fixed", "day", "fixed_ambience"))
        self.assertEqual(self.view({"mode": "night"})["day_night"], "night")
        # Invalid values are ignored like the panel does.
        v = self.view({"season": "monsoon", "mode": "lava"}, month=4)
        self.assertEqual((v["season_mode"], v["season"], v["ambience_mode"]), ("auto", "spring", "auto"))

    def test_seasonal_photo_only_when_configured(self):
        saved = {"weather_photos_override": True, "images": {"winter": "/local/w.jpg"}}
        v = self.view(saved, {}, st("sun.sun", "above_horizon"), month=1)
        self.assertEqual((v["ambience"], v["photo"], v["photo_source"]), ("winter", "/local/w.jpg", "custom:winter"))
        self.assertEqual(self.view(saved, {}, st("sun.sun", "above_horizon"), month=7)["ambience"], "day")

    def test_moon_photo_at_night(self):
        saved = {"weather_photos_override": True, "images": {"moon_full_moon": "/local/m.jpg"}}
        moon = st("sensor.moon_phase", "full_moon")
        v = self.view(saved, {}, st("sun.sun", "below_horizon"), moon, detected_moon=moon)
        self.assertEqual((v["photo"], v["photo_source"]), ("/local/m.jpg", "custom:moon_full_moon"))

    def test_photo_name(self):
        self.assertEqual(logic.photo_name("/local/a/b.jpg?v=2"), "b.jpg")
        long = logic.photo_name("/local/" + "x" * 400 + ".jpg")
        self.assertEqual(len(long), 255)
        self.assertTrue(long.endswith("…"))

    def test_enum_options(self):
        self.assertEqual(logic.SEASON_MODES, ("auto", "fixed"))
        self.assertEqual(logic.DAY_NIGHT, ("day", "night"))
        self.assertEqual(len(set(logic.AMBIANCES)), 12)


@unittest.skipIf(shutil.which("node") is None, "node missing")
class ParityWithJavaScriptTest(unittest.TestCase):
    """Same inputs through the JS modules of the panel and the Python port."""

    def node(self, script):
        out = subprocess.run(["node", "--input-type=module"], input=script, cwd=ROOT, capture_output=True,
                             text=True, check=True)
        return json.loads(out.stdout)

    def test_tables(self):
        data = self.node("""
          const www=new URL('./custom_components/maison3d/www/', 'file://'+process.cwd()+'/');
          const p=await import(new URL('photo-source.js',www));
          console.log(JSON.stringify({keys:p.IMAGE_KEYS,bundled:p.BUNDLED_IMAGES,main:p.DEFAULT_MAIN_PHOTO}));""")
        self.assertEqual(list(logic.IMAGE_KEYS), data["keys"])
        self.assertEqual(logic.BUNDLED_IMAGES, data["bundled"])
        self.assertEqual(logic.DEFAULT_MAIN_PHOTO, data["main"])

    def test_pick_and_kind(self):
        images = {"rain_night": "/local/a.jpg", "rain": "/local/b.jpg", "night": "/local/n.jpg",
                  "moon_full_moon": "/local/m.jpg", "winter": "/local/w.jpg", "day": "/local/d.jpg"}
        picks = [dict(kind=k, night=n, season=s, lunarKey=l, images=i, mainPhoto=m)
                 for k in ("day", "night", "rain", "snow", "storm", "fog", "wind", "cloudy")
                 for n in (False, True) for s in ("", "winter") for l in ("", "moon_full_moon")
                 for i in ({}, images) for m in (logic.DEFAULT_MAIN_PHOTO, "/local/home.jpg")]
        kinds = [dict(weather=w, rain=r, snow=sn, cloud=c, windSpeed=ws, stormAlert=sa, iceAlert=ia, celsius=ce)
                 for w in ("", "sunny", "rainy", "snowy", "lightning-rainy", "fog", "windy", "cloudy", "partlycloudy")
                 for r in (0, 1.5) for sn in (0, 2) for c in (None, 80) for ws in (None, 30)
                 for sa in (False, True) for ia in (False, True) for ce in (None, -2)]
        data = self.node(f"""
          const www=new URL('./custom_components/maison3d/www/', 'file://'+process.cwd()+'/');
          const p=await import(new URL('photo-source.js',www));
          const s=await import(new URL('sensor-values.js',www));
          const picks={json.dumps(picks)}, kinds={json.dumps(kinds)};
          console.log(JSON.stringify({{picks:picks.map(a=>p.pickWeatherPhoto(a).path),
                                      kinds:kinds.map(a=>s.weatherKind(a)??null)}}));""")
        for args, expected in zip(picks, data["picks"]):
            got, _ = logic.pick_weather_photo(kind=args["kind"], night=args["night"], season=args["season"],
                                              lunar_key=args["lunarKey"] or None, images=args["images"],
                                              main=args["mainPhoto"])
            self.assertEqual(got, expected, args)
        for args, expected in zip(kinds, data["kinds"]):
            got = logic.weather_kind(weather=args["weather"], rain=args["rain"], snow=args["snow"], cloud=args["cloud"],
                                     wind_speed=args["windSpeed"], storm_alert=args["stormAlert"],
                                     ice_alert=args["iceAlert"], celsius=args["celsius"])
            self.assertEqual(got, expected, args)
