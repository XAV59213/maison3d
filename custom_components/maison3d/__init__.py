"""Maison 3D: register the local panel and its static resources."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import ASSETS_URL, DOMAIN, PANEL_PATH

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Make the Maison 3D panel available after adding the integration."""
    state = hass.data.setdefault(DOMAIN, {"static_registered": False, "panel_registered": False})

    if not state["static_registered"]:
        assets = Path(__file__).parent / "www"
        if not (assets / "index.html").is_file() or not (assets / "maison3d-panel.js").is_file():
            _LOGGER.error("Maison 3D frontend files are missing: %s", assets)
            return False
        await hass.http.async_register_static_paths(
            [StaticPathConfig(ASSETS_URL, str(assets), False)]
        )
        state["static_registered"] = True

    if not state["panel_registered"]:
        try:
            await panel_custom.async_register_panel(
                hass,
                webcomponent_name="maison3d-panel",
                frontend_url_path=PANEL_PATH,
                sidebar_title="Maison 3D",
                sidebar_icon="mdi:home-city-outline",
                module_url=f"{ASSETS_URL}/maison3d-panel.js",
                require_admin=False,
                embed_iframe=False,
                config={},
            )
        except ValueError:
            # Do not replace a panel already owned by another integration.
            _LOGGER.exception("Cannot register sidebar path /%s", PANEL_PATH)
            return False
        state["panel_registered"] = True
        _LOGGER.info("Maison 3D panel registered at /%s", PANEL_PATH)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove only the panel registered by this integration."""
    state = hass.data.get(DOMAIN)
    if state and state.get("panel_registered"):
        frontend.async_remove_panel(hass, PANEL_PATH)
        state["panel_registered"] = False

    # Keep the static route marked as registered across reloads: aiohttp
    # static routes cannot safely be re-registered on the same HA process.
    return True
