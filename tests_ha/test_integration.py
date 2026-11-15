"""Integration hygiene on a real Home Assistant core: one translated ENUM
diagnostic sensor, old entities removed, single config entry, unload order."""
from datetime import timedelta

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from homeassistant import config_entries
from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from custom_components.maison3d.const import DOMAIN

OLD_KEYS = ("weather_entity", "sun_entity", "moon_entity", "temperature_entity",
            "wind_entity", "rain_entity", "snow_entity", "cloud_entity")


async def _entry(hass: HomeAssistant, tmp_path, **kwargs) -> MockConfigEntry:
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain=DOMAIN, title="Maison 3D", **kwargs)
    entry.add_to_hass(hass)
    return entry


def _sensor(hass: HomeAssistant):
    registry = er.async_get(hass)
    entries = [e for e in registry.entities.values() if e.platform == DOMAIN]
    return registry, entries


async def test_single_translated_enum_sensor_and_cleanup(hass: HomeAssistant, tmp_path) -> None:
    # Entry created by an older version (fixed unique_id) with its 9 sensors.
    entry = await _entry(hass, tmp_path, unique_id="maison3d_local", options={"weather_entity": "weather.home"})
    registry = er.async_get(hass)
    registry.async_get_or_create("sensor", DOMAIN, f"{entry.entry_id}_sensors_status", config_entry=entry,
                                 suggested_object_id="maison_3d_etat_des_capteurs")
    for key in OLD_KEYS:
        registry.async_get_or_create("sensor", DOMAIN, f"{entry.entry_id}_{key}_status", config_entry=entry)
    assert len(_sensor(hass)[1]) == 9

    hass.states.async_set("weather.home", "sunny")
    hass.states.async_set("sun.sun", "above_horizon")
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    registry, entries = _sensor(hass)
    assert sorted(e.unique_id for e in entries) == sorted(
        f"{entry.entry_id}_{key}" for key in ("sensors_status", "season_mode", "season", "photo", "ambience", "day_night"))
    main = registry.async_get(registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_sensors_status"))
    assert main.entity_id == "sensor.maison_3d_etat_des_capteurs"  # existing entity id kept
    assert main.translation_key == "sensors_status"
    state = hass.states.get(main.entity_id)
    assert state.state == "ok"
    assert state.attributes["device_class"] == "enum"
    assert state.attributes["options"] == ["ok", "not_configured", "degraded"]
    assert state.attributes["friendly_name"] == "Maison 3D Sensors status"
    assert state.attributes["maison3d_config"] is True
    assert state.attributes["sensor_statuses"]["weather_entity"]["state"] == "ok"
    assert state.attributes["sensor_statuses"]["moon_entity"]["state"] == "not_configured"

    # An existing source that becomes unavailable is degraded at once (no grace).
    hass.states.async_set("weather.home", "unavailable")
    await hass.async_block_till_done()
    assert hass.states.get(main.entity_id).state == "degraded"

    assert entry.runtime_data.panel_registered is True
    assert entry.runtime_data.card_url.startswith("/maison3d-assets/maison3d-card.js?v=")


async def test_fresh_install_and_single_instance(hass: HomeAssistant, tmp_path) -> None:
    hass.config.config_dir = str(tmp_path)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] == FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert entry.state is ConfigEntryState.LOADED
    _, entries = _sensor(hass)
    assert len(entries) == 6  # « Sensors status » + the 5 view sensors
    entries = [e for e in entries if e.unique_id.endswith("_sensors_status")]
    state = hass.states.get(entries[0].entity_id)
    assert entries[0].entity_id == "sensor.maison_3d_sensors_status"
    # Only sun.sun is configured by default, and it does not exist in this test:
    # tolerated during the start-up grace period, degraded afterwards.
    assert state.state == "ok"
    assert state.attributes["startup_grace"] is True
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=31))
    await hass.async_block_till_done()
    state = hass.states.get(entries[0].entity_id)
    assert state.state == "degraded"
    assert state.attributes["startup_grace"] is False

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] == FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_unload_then_reload(hass: HomeAssistant, tmp_path) -> None:
    entry = await _entry(hass, tmp_path, unique_id="maison3d_local")
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    panels = hass.data[frontend.DATA_PANELS]
    assert "maison3d" in panels

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED
    assert "maison3d" not in hass.data[frontend.DATA_PANELS]
    _, entries = _sensor(hass)
    assert hass.states.get(entries[0].entity_id).state == "unavailable"  # platform unloaded

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    assert "maison3d" in hass.data[frontend.DATA_PANELS]


async def test_startup_grace_for_late_entities(hass: HomeAssistant, tmp_path) -> None:
    """Netatmo-like sources created a few seconds after Maison 3D: no degraded flash."""
    entry = await _entry(hass, tmp_path, options={"temperature_entity": "sensor.netatmo_temperature",
                                                 "wind_entity": "sensor.netatmo_wind", "sun_entity": ""})
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    _, entries = _sensor(hass)
    entity_id = entries[0].entity_id
    state = hass.states.get(entity_id)
    assert state.state == "ok"
    assert state.attributes["sensor_statuses"]["temperature_entity"]["state"] == "not_found"
    # The sources show up 5 s later: still ok, then they are really checked.
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=5))
    hass.states.async_set("sensor.netatmo_temperature", "4.5")
    hass.states.async_set("sensor.netatmo_wind", "12")
    await hass.async_block_till_done()
    assert hass.states.get(entity_id).state == "ok"
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=40))
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state.state == "ok"
    assert state.attributes["sensor_statuses"]["wind_entity"]["state"] == "ok"
    # After the grace period a missing source is reported.
    hass.states.async_remove("sensor.netatmo_wind")
    await hass.async_block_till_done()
    assert hass.states.get(entity_id).state == "degraded"


async def test_versioned_panel_url(hass: HomeAssistant, tmp_path) -> None:
    entry = await _entry(hass, tmp_path)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    panel = hass.data[frontend.DATA_PANELS]["maison3d"]
    module_url = panel.config["_panel_custom"]["module_url"]
    assert module_url.startswith("/maison3d-assets/maison3d-panel.js?v=")
    assert module_url.split("?v=")[1] == entry.runtime_data.card_url.split("?v=")[1]
