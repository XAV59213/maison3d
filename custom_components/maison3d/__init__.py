"""Maison 3D: register the local panel and its static resources."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import ASSETS_URL, CARD_URL, DOMAIN, PANEL_PATH
from .store import async_register_websocket
from .legacy_photos import register_legacy_photo_redirects
from .upload import async_register_upload

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]


@dataclass
class Maison3DRuntimeData:
    """What this config entry registered (removed again on unload)."""

    panel_registered: bool = False
    card_url: str | None = None


type Maison3DConfigEntry = ConfigEntry[Maison3DRuntimeData]


async def async_setup_entry(hass: HomeAssistant, entry: Maison3DConfigEntry) -> bool:
    """Make the Maison 3D panel available after adding the integration."""
    # Process-wide flags stay in hass.data: static routes and websocket
    # commands cannot be registered twice, even after a reload.
    state = hass.data.setdefault(DOMAIN, {})
    state.setdefault("static_registered", False)
    runtime = entry.runtime_data = Maison3DRuntimeData()
    async_register_websocket(hass)
    # Version from the manifest (already loaded by Home Assistant, no file I/O
    # here): « ?v= » on every URL refreshes browser caches after an update.
    integration = await async_get_integration(hass, DOMAIN)
    version = str(integration.version or "0")

    if not state["static_registered"]:
        assets = Path(__file__).parent / "www"

        def _frontend_present() -> bool:
            return (assets / "index.html").is_file() and (assets / "maison3d-panel.js").is_file()

        if not await hass.async_add_executor_job(_frontend_present):
            _LOGGER.error("Maison 3D frontend files are missing: %s", assets)
            return False
        # Exact 301 routes must be registered *before* the /maison3d-assets
        # static path, otherwise the prefix would swallow the old photo URLs.
        # Failures here are logged and ignored: they must not block setup.
        register_legacy_photo_redirects(hass)
        await hass.http.async_register_static_paths(
            [StaticPathConfig(ASSETS_URL, str(assets), False)]
        )
        await async_register_upload(hass)
        state["static_registered"] = True

    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="maison3d-panel",
            frontend_url_path=PANEL_PATH,
            sidebar_title="Maison 3D",
            sidebar_icon="mdi:home-city-outline",
            module_url=f"{ASSETS_URL}/maison3d-panel.js?v={version}",
            require_admin=False,
            embed_iframe=False,
            config={},
        )
    except ValueError:
        # Do not replace a panel already owned by another integration.
        _LOGGER.exception("Cannot register sidebar path /%s", PANEL_PATH)
        return False
    runtime.panel_registered = True
    _LOGGER.info("Maison 3D panel registered at /%s", PANEL_PATH)

    if runtime.card_url is None:
        # Load the Lovelace card on every dashboard so it shows up in
        # « Ajouter une carte » without a manual resource. The version query
        # refreshes browser caches after an update.
        card_url = f"{CARD_URL}?v={version}"
        frontend.add_extra_js_url(hass, card_url)
        runtime.card_url = card_url

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: Maison3DConfigEntry) -> bool:
    """Unload the sensor first, then remove only what this entry registered."""
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    runtime = entry.runtime_data
    if runtime.panel_registered:
        frontend.async_remove_panel(hass, PANEL_PATH)
        runtime.panel_registered = False
    if runtime.card_url:
        remove = getattr(frontend, "remove_extra_js_url", None)
        if remove is not None:
            remove(hass, runtime.card_url)
        runtime.card_url = None
    # The static routes stay registered (flag in hass.data): aiohttp routes
    # cannot safely be re-registered on the same Home Assistant process.
    return True
