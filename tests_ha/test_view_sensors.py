"""Diagnostic sensors of what the photo view shows (season, photo, ambience, day / night)."""
from datetime import datetime, timedelta

from freezegun.api import FrozenDateTimeFactory
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity import EntityCategory
from homeassistant.util import dt as dt_util

from homeassistant.helpers.dispatcher import async_dispatcher_send

from custom_components.maison3d.const import DOMAIN
from custom_components.maison3d.store import SIGNAL_SAVED

KEYS = ("season_mode", "season", "photo", "ambience", "day_night")


async def _setup(hass: HomeAssistant, tmp_path, options=None) -> MockConfigEntry:
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain=DOMAIN, unique_id="maison3d_local", title="Maison 3D", options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _value(hass, key):
    return hass.states.get(f"sensor.maison3d_{key}")


async def test_entities_unique_ids_category_translations(hass: HomeAssistant, tmp_path, freezer: FrozenDateTimeFactory) -> None:
    await hass.config.async_set_time_zone("Europe/Paris")
    freezer.move_to(datetime(2026, 11, 15, 14, 0, tzinfo=dt_util.get_time_zone("Europe/Paris")))
    hass.states.async_set("sun.sun", "above_horizon")
    entry = await _setup(hass, tmp_path)
    registry = er.async_get(hass)
    for key in KEYS:
        entity = registry.async_get(f"sensor.maison3d_{key}")
        assert entity is not None, key
        assert entity.unique_id == f"{entry.entry_id}_{key}"
        assert entity.entity_category is EntityCategory.DIAGNOSTIC
        assert entity.translation_key == key
        assert entity.device_id is not None
    # Same device as « Sensors status ».
    devices = {e.device_id for e in registry.entities.values() if e.platform == DOMAIN}
    assert len(devices) == 1
    assert _value(hass, "season_mode").state == "auto"
    assert _value(hass, "season_mode").attributes["options"] == ["auto", "fixed"]
    assert _value(hass, "season_mode").attributes["friendly_name"] == "Maison 3D Season mode"
    assert _value(hass, "season").state == "autumn"
    assert _value(hass, "day_night").state == "day"
    assert _value(hass, "day_night").attributes["source"] == "sun"
    assert _value(hass, "ambience").state == "day"
    photo = _value(hass, "photo")
    assert photo.state == "maison3d-reference.webp"
    assert photo.attributes["url"] == "/maison3d-assets/maison3d-reference.webp"
    assert photo.attributes["source"] == "main"


async def test_updates_on_save_and_state_changes(hass: HomeAssistant, tmp_path, hass_ws_client, freezer) -> None:
    await hass.config.async_set_time_zone("Europe/Paris")
    hass.states.async_set("sun.sun", "above_horizon")
    hass.states.async_set("weather.maison", "sunny")
    hass.states.async_set("sensor.pluie", "0", {"friendly_name": "Pluie"})
    await _setup(hass, tmp_path, {"rain_entity": "sensor.pluie", "weather_photos_enabled": True})
    client = await hass_ws_client(hass)  # authenticated before moving the clock
    freezer.move_to(datetime(2026, 7, 10, 15, 0, tzinfo=dt_util.get_time_zone("Europe/Paris")))
    async_dispatcher_send(hass, SIGNAL_SAVED)
    await hass.async_block_till_done()
    assert _value(hass, "season").state == "summer"
    assert _value(hass, "ambience").state == "day"
    assert _value(hass, "photo").state == "clair-jour.webp"
    assert _value(hass, "ambience").attributes["entities"]["weather_entity"] == "weather.maison"

    # Rain sensor (configured in the integration) → rain ambience and photo.
    hass.states.async_set("sensor.pluie", "2.5")
    await hass.async_block_till_done()
    assert _value(hass, "ambience").state == "rain"
    assert _value(hass, "ambience").attributes["weather_kind"] == "rain"
    assert _value(hass, "photo").state == "pluie-jour.webp"
    assert _value(hass, "photo").attributes["source"] == "bundled:rain_day"

    # Sunset.
    hass.states.async_set("sun.sun", "below_horizon")
    await hass.async_block_till_done()
    assert _value(hass, "day_night").state == "night"
    assert _value(hass, "photo").state == "pluie-nuit.webp"

    # « 💾 Enregistrer »: fixed season + fixed ambience + own main photo (long URL).
    url = "/local/maison3d/" + "x" * 300 + ".jpg"
    await client.send_json_auto_id({"type": "maison3d/save", "photo_settings": {
        "season": "winter", "mode": "snow", "base_image_url": url, "weather_photos_override": False}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    mode = _value(hass, "season_mode")
    assert mode.state == "fixed" and mode.attributes["fixed_season"] == "winter"
    assert _value(hass, "season").state == "winter"
    assert _value(hass, "ambience").state == "snow"
    assert _value(hass, "ambience").attributes["ambience_mode"] == "fixed"
    assert _value(hass, "day_night").state == "day"  # fixed ambience « snow » is a day view
    assert _value(hass, "day_night").attributes["source"] == "fixed_ambience"
    photo = _value(hass, "photo")
    assert len(photo.state) <= 255 and photo.state.endswith("…")
    assert photo.attributes["url"] == url

    # Back to automatic: season from the Home Assistant calendar.
    await client.send_json_auto_id({"type": "maison3d/save", "photo_settings": {"season": "auto"}})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert _value(hass, "season_mode").state == "auto"
    assert _value(hass, "season_mode").attributes["fixed_season"] is None
    assert _value(hass, "season").state == "summer"
    assert _value(hass, "day_night").state == "night"


async def test_clock_without_sun_and_recorder_exclusions(hass: HomeAssistant, tmp_path, freezer) -> None:
    await hass.config.async_set_time_zone("Europe/Paris")
    freezer.move_to(datetime(2026, 1, 5, 21, 30, tzinfo=dt_util.get_time_zone("Europe/Paris")))
    await _setup(hass, tmp_path)
    night = _value(hass, "day_night")
    assert night.state == "night" and night.attributes["source"] == "clock"
    assert _value(hass, "season").state == "winter"
    # Clock-based values follow the time (refresh every 5 minutes).
    freezer.move_to(datetime(2026, 1, 6, 9, 0, tzinfo=dt_util.get_time_zone("Europe/Paris")))
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(minutes=6))
    await hass.async_block_till_done()
    assert _value(hass, "day_night").state == "day"
    from custom_components.maison3d.sensor import Maison3DAmbienceSensor, Maison3DPhotoSensor
    assert "url" in Maison3DPhotoSensor._unrecorded_attributes
    assert "entities" in Maison3DAmbienceSensor._unrecorded_attributes
