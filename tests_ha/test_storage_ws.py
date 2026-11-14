"""maison3d/get + maison3d/save against a real Home Assistant core."""
from pytest_homeassistant_custom_component.common import MockConfigEntry, flush_store

from homeassistant.core import HomeAssistant

from custom_components.maison3d.const import DOMAIN
from custom_components.maison3d.store import STORAGE_KEY

ITEM = {"id": "maison", "type": "building", "x": 0, "z": 0, "w": 10, "d": 8, "h": 6, "r": 0}


async def _setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, unique_id="maison3d_local", title="Maison 3D")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_save_get_and_persist(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "maison3d/get"})
    msg = await client.receive_json()
    assert msg["success"] and msg["result"] == {"data": {}}

    await client.send_json_auto_id({"type": "maison3d/save", "layout": [ITEM], "view": {"preset": "garden"}})
    msg = await client.receive_json()
    assert msg["success"], msg
    await client.send_json_auto_id({"type": "maison3d/save", "photo_settings": {"season": "winter"}})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "maison3d/get"})
    data = (await client.receive_json())["result"]["data"]
    assert data["layout"][0]["id"] == "maison" and data["view"] == {"preset": "garden"}
    assert data["photo_settings"] == {"season": "winter"}

    await flush_store(hass.data[DOMAIN]["store"]._store)
    assert hass_storage[STORAGE_KEY]["version"] == 1
    assert hass_storage[STORAGE_KEY]["data"]["layout"][0]["type"] == "building"


async def test_invalid_and_non_admin(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "maison3d/save", "layout": [{**ITEM, "type": "spaceship"}]})
    msg = await client.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "invalid_format"

    reader = await hass_ws_client(hass, hass_read_only_access_token)
    await reader.send_json_auto_id({"type": "maison3d/save", "layout": [ITEM]})
    msg = await reader.receive_json()
    assert not msg["success"] and msg["error"]["code"] == "unauthorized"
    await reader.send_json_auto_id({"type": "maison3d/get"})
    assert (await reader.receive_json())["success"]


async def test_reload_keeps_commands(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "maison3d/get"})
    assert (await client.receive_json())["success"]
