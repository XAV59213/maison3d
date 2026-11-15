"""Integration hygiene on a real Home Assistant core: one translated ENUM
diagnostic sensor, old entities removed, single config entry, unload order."""
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant import config_entries
from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import entity_registry as er

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
    assert [e.unique_id for e in entries] == [f"{entry.entry_id}_sensors_status"]
    main = entries[0]
    assert main.entity_id == "sensor.maison_3d_etat_des_capteurs"  # existing entity id kept
    assert main.translation_key == "sensors_status"
    state = hass.states.get(main.entity_id)
    assert state.state == "ok"
    assert state.attributes["device_class"] == "enum"
    assert state.attributes["options"] == ["ok", "not_configured", "unavailable"]
    assert state.attributes["friendly_name"] == "Maison 3D Sensors status"
    assert state.attributes["maison3d_config"] is True
    assert state.attributes["sensor_statuses"]["weather_entity"]["state"] == "ok"
    assert state.attributes["sensor_statuses"]["moon_entity"]["state"] == "not_configured"

    hass.states.async_set("weather.home", "unavailable")
    await hass.async_block_till_done()
    assert hass.states.get(main.entity_id).state == "unavailable"

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
    assert len(entries) == 1
    state = hass.states.get(entries[0].entity_id)
    assert entries[0].entity_id == "sensor.maison_3d_sensors_status"
    # Only sun.sun is configured by default, and it does not exist in this test.
    assert state.state == "unavailable"

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
