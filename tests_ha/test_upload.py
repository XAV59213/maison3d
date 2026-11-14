"""POST /api/maison3d/upload against a real Home Assistant core."""
import io
from pathlib import Path

from aiohttp import FormData
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant

from custom_components.maison3d.const import DOMAIN

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 2000
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


async def _setup(hass: HomeAssistant, tmp_path):
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain=DOMAIN, unique_id="maison3d_local", title="Maison 3D")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def form(data, filename, content_type, name=""):
    f = FormData()
    f.add_field("name", name)
    f.add_field("file", io.BytesIO(data), filename=filename, content_type=content_type)
    return f


async def test_upload_saves_and_serves(hass: HomeAssistant, hass_client, tmp_path) -> None:
    await _setup(hass, tmp_path)
    client = await hass_client()
    resp = await client.post("/api/maison3d/upload", data=form(JPEG, "IMG 001.JPEG", "image/jpeg", "neige-nuit"))
    assert resp.status == 200, await resp.text()
    body = await resp.json()
    assert body["file"] == "neige-nuit.jpg" and body["url"].startswith("/maison3d-media/neige-nuit.jpg?v=")
    saved = Path(hass.config.path("www", "maison3d", "neige-nuit.jpg"))
    assert saved.read_bytes() == JPEG
    served = await client.get(body["url"])
    assert served.status == 200 and await served.read() == JPEG

    resp = await client.post("/api/maison3d/upload", data=form(PNG, "../../secrets.png", "image/png"))
    body = await resp.json()
    assert resp.status == 200 and body["file"] == "secrets.png"
    assert not Path(hass.config.path("secrets.png")).exists()
    resp = await client.post("/api/maison3d/upload", data=form(PNG, "x.png", "image/png", "../../../etc/passwd"))
    assert (await resp.json())["file"] == "passwd.png"


async def test_upload_rejections(hass: HomeAssistant, hass_client, hass_read_only_access_token, tmp_path) -> None:
    await _setup(hass, tmp_path)
    client = await hass_client()
    for data, filename, ctype, status in (
        (b"GIF89a....", "a.gif", "image/gif", 415),           # extension
        (b"<svg/>", "a.jpg", "image/jpeg", 415),               # not a JPEG
        (PNG, "a.jpg", "image/png", 415),                       # mime / extension mismatch
        (b"\xff\xd8\xff" + b"0" * (10 * 1024 * 1024), "big.jpg", "image/jpeg", 413),
    ):
        resp = await client.post("/api/maison3d/upload", data=form(data, filename, ctype))
        assert resp.status == status, (filename, resp.status, await resp.text())
    assert not any(Path(hass.config.path("www", "maison3d")).glob("*"))

    reader = await hass_client(access_token=hass_read_only_access_token)
    resp = await reader.post("/api/maison3d/upload", data=form(JPEG, "a.jpg", "image/jpeg"))
    assert resp.status == 401

    anonymous = await hass_client(access_token="invalid")
    resp = await anonymous.post("/api/maison3d/upload", data=form(JPEG, "a.jpg", "image/jpeg"))
    assert resp.status == 401
