"""Maison 3D setup flow."""
import voluptuous as vol
from homeassistant import config_entries
from .const import DOMAIN


class Maison3DConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id("maison3d_local")
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Maison 3D", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
