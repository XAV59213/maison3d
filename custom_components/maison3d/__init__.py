"""Maison 3D: register the local panel and its static resources."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import ASSETS_URL, CARD_URL, DOMAIN, PANEL_PATH
from .store import async_register_websocket

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Make the Maison 3D panel available after adding the integration."""
    state = hass.data.setdefault(DOMAIN, {"static_registered": False, "panel_registered": False})
    state.setdefault("static_registered", False)
    state.setdefault("panel_registered", False)
    state.setdefault("card_url", None)
    async_register_websocket(hass)

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

    if not state["card_url"]:
        # Load the Lovelace card on every dashboard so it shows up in
        # « Ajouter une carte » without a manual resource. The version query
        # refreshes browser caches after an update.
        integration = await async_get_integration(hass, DOMAIN)
        card_url = f"{CARD_URL}?v={integration.version}"
        frontend.add_extra_js_url(hass, card_url)
        state["card_url"] = card_url

    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove only the panel registered by this integration."""
    state = hass.data.get(DOMAIN)
    if state and state.get("panel_registered"):
        frontend.async_remove_panel(hass, PANEL_PATH)
        state["panel_registered"] = False
    if state and state.get("card_url"):
        remove = getattr(frontend, "remove_extra_js_url", None)
        if remove is not None:
            remove(hass, state["card_url"])
        state["card_url"] = None

    # Keep the static route marked as registered across reloads: aiohttp
    # static routes cannot safely be re-registered on the same HA process.
    return await hass.config_entries.async_unload_platforms(entry, ["sensor"])
