"""HTTP 301 for the four retired weather photos (jour, nuageux, pluie, neige).

Exact routes are registered *before* the /maison3d-assets static path so they
are reached. Middleware cannot be used: after Home Assistant has started, the
aiohttp middleware list is frozen.
"""
from __future__ import annotations

import logging

from aiohttp.web import HTTPMovedPermanently, HTTPNotFound, Request, StreamResponse

from homeassistant.components.http import HomeAssistantView

from .const import DOMAIN
from .state_logic import LEGACY_PHOTO_FILES, rewrite_legacy_photo_path

_LOGGER = logging.getLogger(__name__)

# Exact paths only (jpg / jpeg / webp) — not a prefix under /maison3d-assets.
LEGACY_PHOTO_URLS: tuple[str, ...] = tuple(
    f"/maison3d-assets/images/{name}.{ext}"
    for name in LEGACY_PHOTO_FILES
    for ext in ("jpg", "jpeg", "webp")
)


class Maison3DLegacyPhotoView(HomeAssistantView):
    """Unauthenticated 301 from a retired bundled photo URL to the current file."""

    url = LEGACY_PHOTO_URLS[0]
    extra_urls = list(LEGACY_PHOTO_URLS[1:])
    name = "maison3d:legacy_photo"
    requires_auth = False

    async def get(self, request: Request) -> StreamResponse:
        target = rewrite_legacy_photo_path(request.path)
        if not target:
            raise HTTPNotFound()
        if request.query_string:
            target = f"{target}?{request.query_string}"
        raise HTTPMovedPermanently(target)


def register_legacy_photo_redirects(hass) -> None:
    """Register the 301 views once. Never raises: a failure is only a warning."""
    state = hass.data.setdefault(DOMAIN, {})
    if state.get("legacy_photos_registered"):
        return
    try:
        http = getattr(hass, "http", None)
        if http is None:
            _LOGGER.warning(
                "Maison 3D: HTTP is not loaded, skipping legacy photo redirects"
            )
            return
        http.register_view(Maison3DLegacyPhotoView())
    except Exception:  # noqa: BLE001 — setup must not fail because of redirects
        _LOGGER.warning(
            "Maison 3D: could not register legacy photo redirects",
            exc_info=True,
        )
        return
    state["legacy_photos_registered"] = True
