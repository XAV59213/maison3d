"""What the Maison 3D photo view shows, computed on the Home Assistant side.

Pure functions (no Home Assistant import, unit-testable alone) that mirror the
JavaScript of the view: sensor-values.js (weatherKind, precipitation, readSensor,
windKmh), photo-source.js (resolveMainPhoto, pickWeatherPhoto), season-effects.js
(automaticSeason) and photo-view.js (seasonNow, nighttime, isNight, weatherKey).

Input: the saved project section « photo_settings » (maison3d/save), the
integration options and the Home Assistant states. Output: the saved / live view
of the panel. Not included, on purpose (only known in one browser): the test
buttons (☾ / ☀ / weather and season tests, never saved), the per-card overrides
of a Lovelace card (its own photo / images / entities), and an image that fails
to load in the browser (the view then falls back to the official photo).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Callable

SEASONS = ("spring", "summer", "autumn", "winter")
AMBIANCES = ("day", "night", "cloudy", "rain", "snow", "wind", "storm", "fog", *SEASONS)
DAY_NIGHT = ("day", "night")
SEASON_MODES = ("auto", "fixed")
WEATHER_VARIANTS = ("cloudy", "rain", "snow", "wind", "storm", "fog")
DEFAULT_MAIN_PHOTO = "/maison3d-assets/maison3d-reference.webp"
IMG = "/maison3d-assets/images/"
_FILES = {"day": "clair", "cloudy": "nuageux", "rain": "pluie", "snow": "neige",
          "wind": "vent", "storm": "orage", "fog": "brouillard"}
BUNDLED_IMAGES: dict[str, str] = {}
for _key, _file in _FILES.items():
    if _key == "day":
        BUNDLED_IMAGES["day"] = f"{IMG}{_file}-jour.webp"
        BUNDLED_IMAGES["night"] = f"{IMG}{_file}-nuit.webp"
    else:
        BUNDLED_IMAGES[f"{_key}_day"] = f"{IMG}{_file}-jour.webp"
        BUNDLED_IMAGES[f"{_key}_night"] = f"{IMG}{_file}-nuit.webp"

ENTITY_KEYS = ("weather_entity", "sun_entity", "moon_entity", "temperature_entity",
               "wind_entity", "rain_entity", "snow_entity", "cloud_entity")
LEGACY_MENU_DEFAULTS = {"moon_entity": "sensor.moon_phase", "sun_entity": "sun.sun"}
VIGILANCE_LEVELS = {"vert": 0, "green": 0, "jaune": 1, "yellow": 1, "orange": 2, "rouge": 3, "red": 3}
BEAUFORT_KMH = (0, 3, 9, 16, 24, 34, 45, 56, 68, 81, 95, 110, 120)
MOON_PHASES = {
    "new_moon": "new_moon", "nouvelle_lune": "new_moon",
    "waxing_crescent": "waxing_crescent", "premier_croissant": "waxing_crescent",
    "first_quarter": "first_quarter", "premier_quartier": "first_quarter",
    "waxing_gibbous": "waxing_gibbous", "gibbeuse_croissante": "waxing_gibbous",
    "lune_gibbeuse_croissante": "waxing_gibbous",
    "full_moon": "full_moon", "pleine_lune": "full_moon",
    "waning_gibbous": "waning_gibbous", "gibbeuse_decroissante": "waning_gibbous",
    "lune_gibbeuse_decroissante": "waning_gibbous",
    "last_quarter": "last_quarter", "dernier_quartier": "last_quarter",
    "waning_crescent": "waning_crescent", "dernier_croissant": "waning_crescent",
}
IMAGE_KEYS = (
    "day", "night", *[k for w in WEATHER_VARIANTS for k in (w, f"{w}_day", f"{w}_night")],
    *SEASONS, *[f"moon_{p}" for p in dict.fromkeys(MOON_PHASES.values())],
)

# A state as given by Home Assistant (object with .state / .attributes) or None.
StateGetter = Callable[[str], Any]


def fold(value: Any) -> str:
    text = unicodedata.normalize("NFD", str("" if value is None else value).strip().lower())
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def _state(entity: Any) -> Any:
    return getattr(entity, "state", None) if entity is not None else None


def _attrs(entity: Any) -> dict:
    attributes = getattr(entity, "attributes", None) if entity is not None else None
    return attributes if isinstance(attributes, dict) or hasattr(attributes, "get") else {}


def _entity_id(entity: Any) -> str:
    return str(getattr(entity, "entity_id", "") or "")


def vigilance_level(state: Any) -> int | None:
    text = fold(state)
    if text in VIGILANCE_LEVELS:
        return VIGILANCE_LEVELS[text]
    match = re.search(r"(?:^|[^a-z])(vert|green|jaune|yellow|orange|rouge|red)(?:[^a-z]|$)", text)
    return VIGILANCE_LEVELS[match.group(1)] if match else None


def _number(raw: Any) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value and value not in (float("inf"), float("-inf")) else None


def read_sensor(entity: Any, allow_vigilance: bool = True) -> tuple[float | None, int | None]:
    """(value, vigilance) like readSensor(): number, on/off → 1/0, vigilance colour → 0..3."""
    if entity is None:
        return None, None
    raw = _state(entity)
    text = fold(raw)
    if text in ("unavailable", "unknown", ""):
        return None, None
    if text in ("on", "off"):
        return (1.0 if text == "on" else 0.0), None
    number = _number(raw)
    if number is not None:
        return number, None
    level = vigilance_level(raw) if allow_vigilance else None
    if level is not None:
        return float(level), level
    return None, None


def mentions_ice(entity: Any) -> bool:
    text = fold(_entity_id(entity)) + " " + fold(_attrs(entity).get("friendly_name"))
    return bool(re.search(r"verglas|(?:^|[^a-z])(?:ice|icy|icing)(?:[^a-z]|$)", text))


def precipitation(rain_entity: Any, snow_entity: Any) -> dict[str, Any]:
    rain, rain_vigilance = read_sensor(rain_entity)
    snow, snow_vigilance = read_sensor(snow_entity)
    return {
        "rain": 0.0 if rain_vigilance == 1 else rain,
        "snow": snow,
        "storm_alert": rain_vigilance is not None and rain_vigilance >= 3,
        "ice_alert": snow_vigilance is not None and snow_vigilance >= 1 and mentions_ice(snow_entity),
    }


def to_kmh(value: Any, unit: str = "") -> float | None:
    number = _number(value)
    if number is None:
        return None
    u = re.sub(r"\s+", "", fold(unit))
    if u in ("m/s", "ms"):
        return number * 3.6
    if u in ("mph", "mi/h"):
        return number * 1.609344
    if u in ("kn", "kt", "kts", "knot", "knots", "noeuds", "nd"):
        return number * 1.852
    if u in ("ft/s", "fps"):
        return number * 1.09728
    if u in ("bft", "beaufort", "bf"):
        return float(BEAUFORT_KMH[max(0, min(12, round(number)))])
    return number


def wind_kmh(wind_entity: Any, weather_attributes: dict) -> float | None:
    own = read_sensor(wind_entity, allow_vigilance=False)[0] if wind_entity is not None else None
    if own is not None:
        return to_kmh(own, str(_attrs(wind_entity).get("unit_of_measurement") or ""))
    speed = weather_attributes.get("wind_speed")
    if isinstance(speed, (int, float)) and not isinstance(speed, bool):
        return to_kmh(speed, str(weather_attributes.get("wind_speed_unit") or ""))
    return None


def to_celsius(value: Any, unit: str = "") -> float | None:
    number = _number(value)
    if number is None:
        return None
    return (number - 32) * 5 / 9 if "f" in str(unit).lower() else number


def weather_kind(*, weather: Any, rain: Any, snow: Any, cloud: Any, wind_speed: Any,
                 storm_alert: bool = False, ice_alert: bool = False,
                 celsius: float | None = None, frost_enabled: bool = True) -> str | None:
    """Same order as weatherKind() (sensor-values.js); None = no weather signal."""
    w = str(weather or "").lower()
    num = lambda v: _number(v) or 0.0  # noqa: E731
    if re.search(r"lightning|storm|thunder", w) or storm_alert:
        return "storm"
    if num(snow) > 0:
        if ice_alert and frost_enabled and celsius is not None and celsius <= 0:
            return "frost"
        return "snow"
    if num(rain) > 0:
        return "rain"
    if re.search(r"snow|hail", w):
        return "snow"
    if re.search(r"rain|pouring", w):
        return "rain"
    if "wind" in w:
        return "wind"
    if re.search(r"fog|mist|brouillard", w):
        return "fog"
    if "cloud" in w:
        return "cloudy"
    if num(cloud) >= 60:
        return "cloudy"
    if num(wind_speed) >= 25:
        return "wind"
    return None


def moon_phase(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    return MOON_PHASES.get(re.sub(r"[\s-]+", "_", fold(value)))


def automatic_season(month: int) -> str:
    return ("spring" if 3 <= month <= 5 else "summer" if 6 <= month <= 8
            else "autumn" if 9 <= month <= 11 else "winter")


def allowed_photo_url(value: Any) -> bool:
    if not isinstance(value, str) or len(value) > 500 or re.search(r"[\x00-\x1f]", value):
        return False
    if any(value.startswith(p) for p in ("/local/", "/maison3d-assets/", "/maison3d-media/", "/media/", "/api/")):
        return "\\" not in value and not value.startswith("//")
    return bool(re.match(r"^https://[^/@\s]+(/|$)", value))


# Retired unsuffixed photos (jour, nuageux, pluie, neige) → current daytime files.
LEGACY_PHOTO_FILES = {
    "jour": "clair-jour.webp",
    "nuageux": "nuageux-jour.webp",
    "pluie": "pluie-jour.webp",
    "neige": "neige-jour.webp",
}
_LEGACY_NAME = re.compile(
    r"^(/maison3d-assets/images/)(jour|nuageux|pluie|neige)\.(?:jpe?g|webp)(\?.*)?$"
)
_LEGACY_JPEG = re.compile(
    r"^(/maison3d-assets/(?:images/[a-z-]+|maison3d-reference))\.jpe?g(\?.*)?$"
)


def bundled_photo(value: str) -> str:
    """Map retired or JPEG bundled URLs to the current WebP file. User URLs are unchanged."""
    if not isinstance(value, str):
        return value
    match = _LEGACY_NAME.match(value)
    if match:
        return f"{match.group(1)}{LEGACY_PHOTO_FILES[match.group(2)]}{match.group(3) or ''}"
    return _LEGACY_JPEG.sub(r"\1.webp\2", value)


def rewrite_legacy_photo_path(path: str) -> str | None:
    """Current asset path for a retired photo URL (no query string), else None."""
    if not isinstance(path, str):
        return None
    match = _LEGACY_NAME.match(path)
    if not match:
        return None
    return f"{match.group(1)}{LEGACY_PHOTO_FILES[match.group(2)]}"



def main_photo(local: Any, integration: Any) -> str:
    """resolveMainPhoto() of the panel: this project's photo, then the integration option.

    A media-source:// option is resolved to a signed URL by the browser; it is
    reported as configured (the source of the photo stays the same).
    """
    if allowed_photo_url(local):
        return bundled_photo(local)
    if allowed_photo_url(integration) or (isinstance(integration, str) and integration.startswith("media-source://")
                                          and len(integration) <= 500):
        return bundled_photo(integration)
    return DEFAULT_MAIN_PHOTO


def pick_weather_photo(*, kind: str, night: bool, season: str, lunar_key: str | None,
                       images: dict[str, str], main: str) -> tuple[str, str]:
    """(path, source) like pickWeatherPhoto(); source names the slot that won."""
    bundled = BUNDLED_IMAGES if main == DEFAULT_MAIN_PHOTO else {}
    custom = lambda key: bundled_photo(images[key]) if allowed_photo_url(images.get(key)) else ""  # noqa: E731
    tod = "night" if night else "day"
    chain: list[tuple[str, str]] = []
    if kind in WEATHER_VARIANTS:
        chain += [(custom(f"{kind}_{tod}"), f"custom:{kind}_{tod}"), (custom(kind), f"custom:{kind}"),
                  (bundled.get(f"{kind}_{tod}", ""), f"bundled:{kind}_{tod}")]
    if night:
        chain += [(custom(lunar_key) if lunar_key else "", f"custom:{lunar_key}"),
                  (custom("night"), "custom:night"), (bundled.get("night", ""), "bundled:night")]
    else:
        chain += [(custom(season) if season else "", f"custom:{season}"),
                  (custom("day"), "custom:day"), (bundled.get("day", ""), "bundled:day")]
    for path, source in chain:
        if path:
            return path, source
    return main, "main"


def menu_choice(key: str, value: Any) -> str:
    if not isinstance(value, str):
        return ""
    ident = value.strip()[:150]
    return "" if not ident or LEGACY_MENU_DEFAULTS.get(key) == ident else ident


def compute_view(photo_settings: Any, options: dict, get: StateGetter, *, month: int, hour: int,
                 detected_weather: Any = None, detected_moon: Any = None) -> dict[str, Any]:
    """The view of the panel for the saved settings and the current Home Assistant states."""
    saved = photo_settings if isinstance(photo_settings, dict) else {}
    mode = saved.get("mode") if saved.get("mode") in ("auto", *AMBIANCES) else "auto"
    fixed_season = saved.get("season") if saved.get("season") in SEASONS else None
    raw_images = saved.get("images") if isinstance(saved.get("images"), dict) else {}
    images = {k: raw_images[k] for k in IMAGE_KEYS if allowed_photo_url(raw_images.get(k))}
    override = lambda key, default: saved[key] if isinstance(saved.get(key), bool) else default  # noqa: E731
    effect = override("effect_override", bool(options.get("effects_enabled", True)))
    frost = override("frost_override", bool(options.get("frost_enabled", True)))
    weather_photos = saved.get("weather_photos_override")
    if not isinstance(weather_photos, bool):
        weather_photos = True if ("weather_photos_override" not in saved and saved.get("use_weather_photos") is True) \
            else bool(options.get("weather_photos_enabled", False))

    # ⚙ menu choice → integration option → automatic detection / default.
    choice = lambda key: menu_choice(key, saved.get(key)) or str(options.get(key) or "")  # noqa: E731
    entities: dict[str, str] = {}
    weather = get(choice("weather_entity")) if choice("weather_entity") else None
    if weather is None:
        weather = detected_weather
    entities["weather_entity"] = _entity_id(weather) or choice("weather_entity")
    sun_id = choice("sun_entity") or "sun.sun"
    sun = get(sun_id)
    entities["sun_entity"] = sun_id
    moon = (get(choice("moon_entity")) if choice("moon_entity") else None) or detected_moon
    entities["moon_entity"] = _entity_id(moon) or choice("moon_entity")
    for key in ("temperature_entity", "wind_entity", "rain_entity", "snow_entity", "cloud_entity"):
        entities[key] = choice(key)
    sensor = lambda key: get(entities[key]) if entities[key] else None  # noqa: E731
    attributes = _attrs(weather)
    temperature_entity = sensor("temperature_entity")
    temperature = read_sensor(temperature_entity, allow_vigilance=False)[0] if entities["temperature_entity"] else None
    if temperature is None and isinstance(attributes.get("temperature"), (int, float)):
        temperature = attributes.get("temperature")
    unit = (_attrs(temperature_entity).get("unit_of_measurement") if temperature_entity is not None else None) \
        or attributes.get("temperature_unit") or ""
    wet = precipitation(sensor("rain_entity"), sensor("snow_entity"))
    cloud = read_sensor(sensor("cloud_entity"), allow_vigilance=False)[0] if entities["cloud_entity"] else None
    kind = weather_kind(
        weather=_state(weather), rain=wet["rain"], snow=wet["snow"], cloud=cloud,
        wind_speed=wind_kmh(sensor("wind_entity"), attributes),
        storm_alert=wet["storm_alert"], ice_alert=wet["ice_alert"],
        celsius=to_celsius(temperature, str(unit)), frost_enabled=effect and frost,
    )

    sun_state = _state(sun)
    if sun_state == "below_horizon":
        night_live, night_source = True, "sun"
    elif sun_state == "above_horizon":
        night_live, night_source = False, "sun"
    else:
        night_live, night_source = (hour < 7 or hour >= 20), "clock"
    night = mode == "night" or (mode == "auto" and night_live)
    if mode != "auto":
        night_source = "fixed_ambience"

    season = fixed_season or automatic_season(month)
    if mode != "auto":
        ambience = mode
    elif kind and kind != "frost":
        ambience = kind
    elif night_live:
        ambience = "night"
    else:
        ambience = season if images.get(season) else "day"

    main = main_photo(saved.get("base_image_url"), options.get("base_image_url"))
    if weather_photos:
        seasonal = ambience in SEASONS
        phase = moon_phase(_state(moon))
        photo, photo_source = pick_weather_photo(
            kind="day" if seasonal else ambience, night=night, season=ambience if seasonal else season,
            lunar_key=f"moon_{phase}" if night and phase else None, images=images, main=main,
        )
    else:
        photo, photo_source = main, "main"
    return {
        "season_mode": "fixed" if fixed_season else "auto",
        "fixed_season": fixed_season,
        "season": season,
        "ambience": ambience,
        "ambience_mode": "auto" if mode == "auto" else "fixed",
        "weather_kind": kind,
        "frost": kind == "frost",
        "day_night": "night" if night else "day",
        "night_source": night_source,
        "photo": photo,
        "photo_source": photo_source,
        "weather_photos": weather_photos,
        "effects": effect,
        "entities": entities,
    }


def photo_name(url: str, limit: int = 255) -> str:
    """File name of a photo URL (without query), shortened for a sensor state."""
    base = str(url or "").split("?", 1)[0].split("#", 1)[0].rstrip("/")
    name = base.rsplit("/", 1)[-1] or base
    return name if len(name) <= limit else name[: limit - 1] + "…"


def is_moon(entity: Any) -> bool:
    return _entity_id(entity).startswith("sensor.") and moon_phase(_state(entity)) is not None


def moon_rank(entity: Any) -> int:
    ident = _entity_id(entity)
    return (4 if "moon" in ident else 2 if "lune" in ident else 0) + (1 if moon_phase(_state(entity)) else 0)


OVERRIDE_FLAGS = (
    ("effect_override", "effects_enabled", True),
    ("frost_override", "frost_enabled", True),
    ("weather_photos_override", "weather_photos_enabled", False),
)


def menu_overrides(photo_settings: Any, options: dict) -> list[dict[str, Any]]:
    """Settings of the ⚙ menu (saved in .storage) that replace an integration option.

    [{"key": option key, "menu": value of the menu, "integration": option value}, …]
    (Lovelace card options are not known here: each card may impose its own.)
    """
    saved = photo_settings if isinstance(photo_settings, dict) else {}
    out: list[dict[str, Any]] = []
    for flag, option, default in OVERRIDE_FLAGS:
        if isinstance(saved.get(flag), bool):
            out.append({"key": option, "menu": saved[flag], "integration": bool(options.get(option, default))})
    if allowed_photo_url(saved.get("base_image_url")):
        out.append({"key": "base_image_url", "menu": saved["base_image_url"],
                    "integration": str(options.get("base_image_url") or "")})
    for key in ENTITY_KEYS:
        choice = menu_choice(key, saved.get(key))
        if choice:
            out.append({"key": key, "menu": choice, "integration": str(options.get(key) or "")})
    return out


_OVERRIDE_TEXT = {
    "fr": {"none": "Aucun réglage du menu ⚙ de la vue ne remplace ces options.",
           "head": "⚠ Réglages du menu ⚙ de la vue qui remplacent ces options (à remettre sur « Revenir à l'intégration » dans ⚙ pour que l'option ci-dessous s'applique) :",
           "on": "activé", "off": "désactivé", "empty": "vide",
           "card": "Les cartes Lovelace peuvent aussi imposer leurs propres valeurs."},
    "en": {"none": "No setting of the view's ⚙ menu replaces these options.",
           "head": "⚠ Settings of the view's ⚙ menu that replace these options (use « Back to the integration » in ⚙ so that the option below applies):",
           "on": "on", "off": "off", "empty": "empty",
           "card": "Lovelace cards may also impose their own values."},
}


def overrides_text(items: list[dict[str, Any]], language: str | None) -> str:
    """Help text of the options flow listing the active menu overrides."""
    text = _OVERRIDE_TEXT["fr" if str(language or "").lower().startswith("fr") else "en"]
    if not items:
        return text["none"] + " " + text["card"]
    show = lambda v: text["on" if v else "off"] if isinstance(v, bool) else (str(v) or text["empty"])  # noqa: E731
    lines = [text["head"]]
    lines += [f"- `{item['key']}` : {show(item['menu'])} (≠ {show(item['integration'])})" for item in items]
    lines.append(text["card"])
    return "\n".join(lines)
