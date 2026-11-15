"""Review point 3: the options flow tells which ⚙ menu settings replace its options."""
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant

from custom_components.maison3d.const import DOMAIN


async def _setup(hass: HomeAssistant, tmp_path):
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain=DOMAIN, unique_id="maison3d_local", title="Maison 3D",
                            options={"effects_enabled": False})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_options_flow_lists_menu_overrides(hass: HomeAssistant, tmp_path, hass_ws_client) -> None:
    entry = await _setup(hass, tmp_path)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    assert "No setting of the view" in flow["description_placeholders"]["overrides"]

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "maison3d/save", "photo_settings": {
        "effect_override": True, "weather_entity": "weather.other"}})
    assert (await client.receive_json())["success"]
    hass.config.language = "fr"
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    text = flow["description_placeholders"]["overrides"]
    assert "`effects_enabled` : activé (≠ désactivé)" in text
    assert "`weather_entity` : weather.other (≠ vide)" in text
    assert "Revenir à l'intégration" in text
