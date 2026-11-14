"""Maison 3D setup and sensor configuration flows."""
from __future__ import annotations

from urllib.parse import urlsplit

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DOMAIN

SENSOR_OPTIONS = {
    "weather_entity": ("weather",),
    "sun_entity": ("sun",),
    "moon_entity": ("sensor",),
    "temperature_entity": ("sensor",),
    "wind_entity": ("sensor",),
    "rain_entity": ("sensor", "binary_sensor"),
    "snow_entity": ("sensor", "binary_sensor"),
    "cloud_entity": ("sensor", "binary_sensor"),
}

def validate_image_url(value: str) -> str:
    """Accept trusted Home Assistant static paths and HTTPS image URLs only."""
    value = value.strip()
    if not value:
        return ""
    if len(value) > 500 or any(ord(char) < 32 for char in value):
        raise vol.Invalid("invalid_image_url")
    if value.startswith(("/local/", "/maison3d-assets/", "/api/")):
        if "\\" in value or value.startswith("//"):
            raise vol.Invalid("invalid_image_url")
        return value
    parsed = urlsplit(value)
    if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
        return value
    raise vol.Invalid("invalid_image_url")


DEFAULT_ENTITIES = {
    "weather_entity": "",
    "sun_entity": "sun.sun",
    "moon_entity": "",
    "temperature_entity": "",
    "wind_entity": "",
    "rain_entity": "",
    "snow_entity": "",
    "cloud_entity": "",
}


class Maison3DConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Allow one Maison 3D integration instance."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id("maison3d_local")
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Maison 3D", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Make the Configure button available on the integration page."""
        return Maison3DOptionsFlow()


class Maison3DOptionsFlow(config_entries.OptionsFlowWithReload):
    """Select weather, moon and optional sensors in Home Assistant."""

    async def async_step_init(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                base_image_url = validate_image_url(str(user_input.get("base_image_url", "")))
            except vol.Invalid:
                errors["base_image_url"] = "invalid_image_url"
            else:
                options = dict(DEFAULT_ENTITIES)
                options.update({k: v for k, v in user_input.items() if k in SENSOR_OPTIONS})
                options["base_image_url"] = base_image_url
                options["effects_enabled"] = bool(user_input.get("effects_enabled", True))
                return self.async_create_entry(data=options)

        schema = {}
        for key, domains in SENSOR_OPTIONS.items():
            default = self.config_entry.options.get(key, DEFAULT_ENTITIES[key])
            config = selector.EntitySelectorConfig(
                domain=list(domains), multiple=False,
            )
            marker = vol.Optional(key, description={"suggested_value": default}) 
            schema[marker] = selector.EntitySelector(config)
        schema[vol.Optional("base_image_url", description={
            "suggested_value": (
                user_input.get("base_image_url", "") if user_input is not None
                else self.config_entry.options.get("base_image_url", "")
            ),
        })] = selector.TextSelector(selector.TextSelectorConfig())
        schema[vol.Optional("effects_enabled", description={
            "suggested_value": (
                user_input.get("effects_enabled", True) if user_input is not None
                else self.config_entry.options.get("effects_enabled", True)
            ),
        })] = selector.BooleanSelector()
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(schema),
            errors=errors,
        )
