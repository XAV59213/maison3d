"""Project name option on a real Home Assistant core (neutral default)."""
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant

from custom_components.maison3d.const import DOMAIN


def _diagnostic(hass: HomeAssistant):
    return next(s for s in hass.states.async_all("sensor") if s.attributes.get("maison3d_config"))


async def test_project_name_default_and_option(hass: HomeAssistant, tmp_path) -> None:
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain=DOMAIN, unique_id="maison3d_local", title="Maison 3D")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert _diagnostic(hass).attributes["project_name"] == "Maison 3D"

    flow = await hass.config_entries.options.async_init(entry.entry_id)
    schema_keys = [str(key) for key in flow["data_schema"].schema]
    assert schema_keys[0] == "project_name"
    result = await hass.config_entries.options.async_configure(
        flow["flow_id"], {"project_name": "  Chez   nous\n ", "base_image_url": ""})
    assert result["type"] == "create_entry", result
    assert entry.options["project_name"] == "Chez nous"
    await hass.async_block_till_done()
    assert _diagnostic(hass).attributes["project_name"] == "Chez nous"

    flow = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(flow["flow_id"], {"project_name": ""})
    await hass.async_block_till_done()
    assert entry.options["project_name"] == "Maison 3D"
    assert _diagnostic(hass).attributes["project_name"] == "Maison 3D"
