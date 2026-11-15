"""Maison 3D setup and sensor configuration flows."""
from __future__ import annotations

from urllib.parse import urlsplit

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    DEFAULT_PROJECT_NAME,
    DEFAULT_STARTUP_GRACE_MINUTES,
    DOMAIN,
    MAX_STARTUP_GRACE_MINUTES,
    MIN_STARTUP_GRACE_MINUTES,
    PROJECT_NAME_MAX,
    startup_grace_minutes,
)

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
    if value.startswith("media-source://"):
        # Image chosen in Home Assistant « Médias », resolved to a signed URL by the panel/card.
        return value
    if value.startswith(("/local/", "/maison3d-assets/", "/maison3d-media/", "/api/")):
        if "\\" in value or value.startswith("//"):
            raise vol.Invalid("invalid_image_url")
        return value
    parsed = urlsplit(value)
    if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
        return value
    raise vol.Invalid("invalid_image_url")


def clean_project_name(value: str) -> str:
    """Project name shown in the panel; empty means the neutral default."""
    value = " ".join("".join(char for char in str(value) if ord(char) >= 32).split())
    return value[:PROJECT_NAME_MAX] or DEFAULT_PROJECT_NAME


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
        # Only one instance: enforced by « single_config_entry » in manifest.json.
        # Entries created by older versions keep their unique_id and work as before.
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
                options["project_name"] = clean_project_name(user_input.get("project_name", ""))
                options["base_image_url"] = base_image_url
                options["effects_enabled"] = bool(user_input.get("effects_enabled", True))
                options["frost_enabled"] = bool(user_input.get("frost_enabled", True))
                options["weather_photos_enabled"] = bool(user_input.get("weather_photos_enabled", False))
                options["startup_grace_minutes"] = startup_grace_minutes(
                    {"startup_grace_minutes": user_input.get(
                        "startup_grace_minutes", DEFAULT_STARTUP_GRACE_MINUTES
                    )}
                )
                return self.async_create_entry(data=options)

        schema = {}
        schema[vol.Optional("project_name", description={
            "suggested_value": (
                user_input.get("project_name", "") if user_input is not None
                else self.config_entry.options.get("project_name", DEFAULT_PROJECT_NAME)
            ),
        })] = selector.TextSelector(selector.TextSelectorConfig())
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
        schema[vol.Optional("frost_enabled", description={
            "suggested_value": (
                user_input.get("frost_enabled", True) if user_input is not None
                else self.config_entry.options.get("frost_enabled", True)
            ),
        })] = selector.BooleanSelector()
        schema[vol.Optional("weather_photos_enabled", description={
            "suggested_value": (
                user_input.get("weather_photos_enabled", False) if user_input is not None
                else self.config_entry.options.get("weather_photos_enabled", False)
            ),
        })] = selector.BooleanSelector()
        schema[vol.Optional("startup_grace_minutes", description={
            "suggested_value": (
                user_input.get("startup_grace_minutes", DEFAULT_STARTUP_GRACE_MINUTES)
                if user_input is not None
                else self.config_entry.options.get(
                    "startup_grace_minutes", DEFAULT_STARTUP_GRACE_MINUTES
                )
            ),
        })] = selector.NumberSelector(selector.NumberSelectorConfig(
            min=MIN_STARTUP_GRACE_MINUTES,
            max=MAX_STARTUP_GRACE_MINUTES,
            step=1,
            mode=selector.NumberSelectorMode.BOX,
            unit_of_measurement="min",
        ))
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(schema),
            errors=errors,
        )
