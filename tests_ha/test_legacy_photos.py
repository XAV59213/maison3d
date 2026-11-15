"""Setup, reload and unload with HTTP already started (middlewares frozen),
and 301 from the retired photo URLs to the current daytime files."""
from pathlib import Path

from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.maison3d.const import DOMAIN
from custom_components.maison3d.state_logic import LEGACY_PHOTO_FILES

WWW = Path(__file__).resolve().parents[1] / "custom_components" / "maison3d" / "www"
CASES = {
    f"/maison3d-assets/images/{name}.{ext}": f"/maison3d-assets/images/{target}"
    for name, target in LEGACY_PHOTO_FILES.items()
    for ext in ("jpg", "jpeg", "webp")
}


async def _start_http(hass: HomeAssistant, hass_client_no_auth):
    """Start HTTP like production: middlewares are frozen, the router is not.

    Home Assistant itself disables ``router.freeze`` in ``HomeAssistantHTTP.start``
    so integrations can still ``register_view`` after boot. The middleware list
    stays frozen — that is what broke the previous ``middlewares.append``.
    """
    assert await async_setup_component(hass, "http", {})
    hass.http.app._router.freeze = lambda: None
    client = await hass_client_no_auth()
    assert hass.http.app.middlewares.frozen is True
    return client


async def _setup_entry(hass: HomeAssistant, tmp_path) -> MockConfigEntry:
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain=DOMAIN, unique_id="maison3d_local", title="Maison 3D")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


async def test_setup_reload_unload_with_frozen_middlewares(
    hass: HomeAssistant, hass_client_no_auth, tmp_path
) -> None:
    await _start_http(hass, hass_client_no_auth)
    entry = await _setup_entry(hass, tmp_path)
    assert hass.data[DOMAIN]["legacy_photos_registered"] is True

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    assert hass.data[DOMAIN]["legacy_photos_registered"] is True

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED


async def test_legacy_photo_urls_return_301(
    hass: HomeAssistant, hass_client_no_auth, tmp_path
) -> None:
    client = await _start_http(hass, hass_client_no_auth)
    await _setup_entry(hass, tmp_path)

    current = "/maison3d-assets/images/clair-jour.webp"
    live = await client.get(current)
    assert live.status == 200
    assert (WWW / "images" / "clair-jour.webp").is_file()

    source = "/maison3d-assets/images/jour.webp?v=2"
    redirected = await client.get(source, allow_redirects=False)
    assert redirected.status == 301, await redirected.text()
    assert redirected.headers["Location"] == "/maison3d-assets/images/clair-jour.webp?v=2"

    followed = await client.get(source)
    assert followed.status == 200
    assert await followed.read() == (WWW / "images" / "clair-jour.webp").read_bytes()

    for url, target in CASES.items():
        resp = await client.get(url, allow_redirects=False)
        assert resp.status == 301, (url, resp.status, await resp.text())
        assert resp.headers["Location"] == target
