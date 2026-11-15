"""HTTP redirects for the four retired weather photos (jour, nuageux, pluie, neige)."""
from __future__ import annotations

from aiohttp.web import HTTPMovedPermanently, middleware

from .const import DOMAIN
from .state_logic import rewrite_legacy_photo_path


def register_legacy_photo_redirects(hass) -> None:
    """HTTP 301 from the old image URLs to the current photos (direct hits, not only JS)."""
    state = hass.data.setdefault(DOMAIN, {})
    if state.get("legacy_photos_registered"):
        return

    @middleware
    async def _redirect(request, handler):
        target = rewrite_legacy_photo_path(request.path)
        if target:
            if request.query_string:
                target = f"{target}?{request.query_string}"
            raise HTTPMovedPermanently(target)
        return await handler(request)

    hass.http.app.middlewares.append(_redirect)
    state["legacy_photos_registered"] = True
