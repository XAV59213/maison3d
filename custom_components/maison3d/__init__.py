"""Editable Maison 3D property view for Home Assistant."""
from pathlib import Path
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from .const import DOMAIN, PANEL_PATH, ASSETS_URL


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if not hass.data.get(DOMAIN):
        path = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths([StaticPathConfig(ASSETS_URL, str(path), False)])
        hass.data[DOMAIN] = True
    if PANEL_PATH not in hass.data.get("frontend_panels", {}):
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="maison3d-panel",
            frontend_url_path=PANEL_PATH,
            sidebar_title="Maison 3D",
            sidebar_icon="mdi:home-city-outline",
            module_url=f"{ASSETS_URL}/maison3d-panel.js",
            require_admin=False,
            config={},
        )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if PANEL_PATH in hass.data.get("frontend_panels", {}):
        frontend.async_remove_panel(hass, PANEL_PATH)
    return True
