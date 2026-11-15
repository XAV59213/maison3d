"""Maison 3D storage + websocket commands, with a minimal Home Assistant stub.

Runs without Home Assistant installed (only voluptuous). The same behaviour is
checked against a real Home Assistant in tests_ha/ (pytest-homeassistant-custom-component).
"""
from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path

try:
    import voluptuous as vol
except ImportError:  # pragma: no cover
    vol = None

COMPONENT = Path(__file__).resolve().parents[1] / "custom_components" / "maison3d"


def load_store_module():
    saved = {}

    def stub(name, **attrs):
        saved[name] = sys.modules.get(name)
        module = types.ModuleType(name)
        module.__dict__.update(attrs)
        sys.modules[name] = module
        return module

    class Store:
        files: dict = {}

        def __init__(self, hass, version, key):
            self.version, self.key = version, key

        async def async_load(self):
            return Store.files.get(self.key)

        async def async_save(self, data):
            Store.files[self.key] = data

    registered = []
    signals = []

    def websocket_command(schema):
        def wrap(func):
            func.schema = schema
            return func
        return wrap

    def require_admin(func):
        async def guarded(hass, connection, msg):
            if not connection.user.is_admin:
                connection.send_error(msg["id"], "unauthorized", "admin")
                return
            return await func(hass, connection, msg)
        guarded.admin = True
        guarded.schema = getattr(func, "schema", None)
        return guarded

    ws = types.SimpleNamespace(
        websocket_command=websocket_command,
        async_response=lambda func: func,
        require_admin=require_admin,
        ActiveConnection=object,
        async_register_command=lambda hass, handler: registered.append(handler),
    )
    stub("homeassistant")
    components = stub("homeassistant.components", websocket_api=ws)
    stub("homeassistant.components.websocket_api", **vars(ws))
    stub("homeassistant.core", HomeAssistant=object, callback=lambda func: func)
    stub("homeassistant.helpers")
    stub("homeassistant.helpers.dispatcher", async_dispatcher_send=lambda hass, signal, *args: signals.append(signal))
    stub("homeassistant.helpers.storage", Store=Store)
    package = types.ModuleType("maison3d_stub")
    package.__path__ = [str(COMPONENT)]
    sys.modules["maison3d_stub"] = package
    for name, path in (("maison3d_stub.const", "const.py"), ("maison3d_stub.store", "store.py")):
        spec = importlib.util.spec_from_file_location(name, COMPONENT / path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
    module = sys.modules["maison3d_stub.store"]
    for name, previous in saved.items():
        if previous is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = previous
    module.signals = signals
    return module, Store, registered, components


class Connection:
    def __init__(self, admin=True):
        self.user = types.SimpleNamespace(is_admin=admin)
        self.results, self.errors = [], []

    def send_result(self, msg_id, result):
        self.results.append((msg_id, result))

    def send_error(self, msg_id, code, message):
        self.errors.append((msg_id, code, message))


ITEM = {"id": "maison", "type": "building", "x": 0, "z": 0, "w": 10, "d": 8, "h": 6, "r": 0, "name": "Maison"}


@unittest.skipIf(vol is None, "voluptuous missing")
class StoreWebsocketTest(unittest.TestCase):
    def setUp(self):
        self.module, self.Store, self.registered, _ = load_store_module()
        self.Store.files.clear()
        self.hass = types.SimpleNamespace(data={})

    def run_ws(self, handler, msg, admin=True):
        connection = Connection(admin)
        asyncio.run(handler(self.hass, connection, {"id": 1, **msg}))
        return connection

    def test_storage_key_and_version(self):
        self.assertEqual(self.module.STORAGE_KEY, "maison3d.data")
        self.assertEqual(self.module.STORAGE_VERSION, 1)

    def test_register_once(self):
        self.module.async_register_websocket(self.hass)
        self.module.async_register_websocket(self.hass)
        self.assertEqual(len(self.registered), 2)
        self.assertEqual(self.module.ws_get.schema[next(iter(self.module.ws_get.schema))], "maison3d/get")

    def test_get_empty_then_save_and_reload(self):
        self.assertEqual(self.run_ws(self.module.ws_get, {"type": "maison3d/get"}).results, [(1, {"data": {}})])
        conn = self.run_ws(self.module.ws_save, {"type": "maison3d/save", "layout": [ITEM], "view": {"preset": "garden"}})
        self.assertEqual(conn.errors, [])
        saved = self.Store.files["maison3d.data"]
        self.assertEqual(saved["layout"][0]["id"], "maison")
        self.assertIn("updated_at", saved)
        # The diagnostic sensors are told after each successful save.
        self.assertEqual(self.module.signals, ["maison3d_project_saved"])
        # Partial save keeps the other sections.
        self.run_ws(self.module.ws_save, {"type": "maison3d/save", "photo_settings": {"season": "winter"}})
        self.hass.data.clear()  # new HA run: read back from the Store file
        data = self.run_ws(self.module.ws_get, {"type": "maison3d/get"}).results[0][1]["data"]
        self.assertEqual(data["view"], {"preset": "garden"})
        self.assertEqual(data["photo_settings"], {"season": "winter"})
        self.assertEqual(len(data["layout"]), 1)

    def test_save_requires_admin(self):
        self.assertTrue(self.module.ws_save.admin)
        conn = self.run_ws(self.module.ws_save, {"type": "maison3d/save", "layout": [ITEM]}, admin=False)
        self.assertEqual(conn.errors[0][1], "unauthorized")
        self.assertNotIn("maison3d.data", self.Store.files)
        self.assertEqual(self.module.signals, [])

    def test_invalid_layout_rejected(self):
        for bad in ([{"id": "x", "type": "spaceship", "x": 0, "z": 0, "w": 1, "d": 1, "h": 1, "r": 0}],
                    [{**ITEM, "w": 0}], [{**ITEM, "x": "1"}], [ITEM] * 501, ["nope"]):
            conn = self.run_ws(self.module.ws_save, {"type": "maison3d/save", "layout": bad})
            self.assertEqual(conn.errors[0][1], "invalid_format", bad if len(bad) < 3 else len(bad))
        self.assertNotIn("maison3d.data", self.Store.files)

    def test_layout_cleaned_and_size_limited(self):
        self.run_ws(self.module.ws_save, {"type": "maison3d/save", "layout": [{**ITEM, "extra": "x" * 50, "name": "n" * 500}]})
        item = self.Store.files["maison3d.data"]["layout"][0]
        self.assertNotIn("extra", item)
        self.assertEqual(len(item["name"]), 120)
        conn = self.run_ws(self.module.ws_save, {"type": "maison3d/save", "photo_settings": {"big": "x" * 300_000}})
        self.assertEqual(conn.errors[0][2], "too_large")

    def test_none_clears_section(self):
        self.run_ws(self.module.ws_save, {"type": "maison3d/save", "layout": [ITEM]})
        self.run_ws(self.module.ws_save, {"type": "maison3d/save", "layout": None})
        self.assertIsNone(self.Store.files["maison3d.data"]["layout"])


class StoreWiringTest(unittest.TestCase):
    def test_setup_registers_commands(self):
        init = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        self.assertIn("from .store import async_register_websocket", init)
        self.assertIn("async_register_websocket(hass)", init)
        store = (COMPONENT / "store.py").read_text(encoding="utf-8")
        self.assertIn("@websocket_api.require_admin", store.split("async def ws_save")[0].split("async def ws_get")[1])


if __name__ == "__main__":
    unittest.main()
