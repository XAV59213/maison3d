"""Maison 3D data saved in Home Assistant (.storage/maison3d.data).

The 3D layout, the photo/view settings and the chosen camera view used to live
only in the browser (localStorage). They are now stored by Home Assistant so
every device sees the same project. The iframe has no Home Assistant
connection: the panel/card relays two websocket commands for it.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_KEY = f"{DOMAIN}.data"
STORAGE_VERSION = 1
SECTIONS = ("layout", "photo_settings", "view")
MAX_ITEMS = 500
MAX_BYTES = 256_000
ITEM_TYPES = {
    "building", "garage", "ramp", "shed", "terrace", "wall", "gate", "pool",
    "swing", "tree", "furniture", "steps", "road",
}


def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value and abs(value) < 1e6


def clean_layout(items: Any) -> list[dict[str, Any]]:
    """Keep only valid 3D objects (same rules as the JSON import)."""
    if not isinstance(items, list) or len(items) > MAX_ITEMS:
        raise vol.Invalid("invalid_layout")
    result = []
    for item in items:
        if not isinstance(item, dict):
            raise vol.Invalid("invalid_layout")
        ident, kind = item.get("id"), item.get("type")
        if not isinstance(ident, str) or not 0 < len(ident) <= 80 or kind not in ITEM_TYPES:
            raise vol.Invalid("invalid_layout")
        if not all(_number(item.get(key)) for key in ("x", "z", "w", "d", "h", "r")):
            raise vol.Invalid("invalid_layout")
        if min(item["w"], item["d"], item["h"]) <= 0:
            raise vol.Invalid("invalid_layout")
        clean = {key: item[key] for key in ("id", "type", "x", "z", "w", "d", "h", "r")}
        clean["name"] = str(item.get("name") or ident)[:120]
        result.append(clean)
    return result


def clean_section(name: str, value: Any) -> Any:
    """Validate one section of a save request; None clears it."""
    if value is None:
        return None
    if name == "layout":
        return clean_layout(value)
    if not isinstance(value, dict):
        raise vol.Invalid(f"invalid_{name}")
    return value


class Maison3DStore:
    """Load once, merge partial saves, write through the HA Store helper."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data: dict[str, Any] = {}
        self._loaded = False

    async def async_load(self) -> dict[str, Any]:
        if not self._loaded:
            stored = await self._store.async_load()
            self.data = stored if isinstance(stored, dict) else {}
            self._loaded = True
        return self.data

    async def async_save(self, patch: dict[str, Any]) -> dict[str, Any]:
        await self.async_load()
        merged = dict(self.data)
        for name in SECTIONS:
            if name in patch:
                merged[name] = clean_section(name, patch[name])
        if len(json.dumps(merged, separators=(",", ":"))) > MAX_BYTES:
            raise vol.Invalid("too_large")
        merged["updated_at"] = datetime.now(timezone.utc).isoformat()
        await self._store.async_save(merged)
        self.data = merged
        return merged


def _store(hass: HomeAssistant) -> Maison3DStore:
    domain = hass.data.setdefault(DOMAIN, {})
    if "store" not in domain:
        domain["store"] = Maison3DStore(hass)
    return domain["store"]


@websocket_api.websocket_command({vol.Required("type"): "maison3d/get"})
@websocket_api.async_response
async def ws_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Return the saved project (any logged-in user may read it)."""
    data = await _store(hass).async_load()
    connection.send_result(msg["id"], {"data": data})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "maison3d/save",
        vol.Optional("layout"): vol.Any(None, list),
        vol.Optional("photo_settings"): vol.Any(None, dict),
        vol.Optional("view"): vol.Any(None, dict),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Merge the given sections into the saved project (administrators only)."""
    patch = {name: msg[name] for name in SECTIONS if name in msg}
    try:
        data = await _store(hass).async_save(patch)
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], {"updated_at": data["updated_at"]})


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    """Register the websocket commands once per Home Assistant run."""
    domain = hass.data.setdefault(DOMAIN, {})
    if domain.get("ws_registered"):
        return
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_save)
    domain["ws_registered"] = True
