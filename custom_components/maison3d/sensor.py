"""Diagnostic entity for configured Maison 3D Home Assistant sensors."""
from __future__ import annotations

import logging

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.start import async_at_started

from .config_flow import DEFAULT_ENTITIES
from .const import DEFAULT_PROJECT_NAME, DOMAIN

_LOGGER = logging.getLogger(__name__)

# Global state of the diagnostic sensor (translated in strings.json).
STATE_OK = "ok"
STATE_NOT_CONFIGURED = "not_configured"
STATE_DEGRADED = "degraded"
STATES = [STATE_OK, STATE_NOT_CONFIGURED, STATE_DEGRADED]

# Integrations that load after Maison 3D (e.g. Netatmo) create their entities a
# few seconds later: during this grace period after Home Assistant has started,
# a source that does not exist yet (« not_found ») does not make the sensor degraded.
STARTUP_GRACE_SECONDS = 30

# Older versions had one diagnostic sensor per source slot; their status
# is now in the « sensor_statuses » attribute of the single sensor.
LEGACY_SOURCE_SENSORS = tuple(DEFAULT_ENTITIES)


def remove_legacy_entities(hass: HomeAssistant, entry: ConfigEntry) -> int:
    """Delete the old per-source diagnostic entities from the entity registry."""
    registry = er.async_get(hass)
    removed = 0
    for key in LEGACY_SOURCE_SENSORS:
        entity_id = registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_{key}_status")
        if entity_id:
            registry.async_remove(entity_id)
            removed += 1
    if removed:
        _LOGGER.info("Maison 3D: %s old per-source diagnostic sensors removed", removed)
    return removed


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Create the diagnostic sensor, visible on the Maison 3D integration page."""
    remove_legacy_entities(hass, entry)
    async_add_entities([Maison3DConfigurationSensor(entry)])


class Maison3DConfigurationSensor(SensorEntity):
    """Health of every selected source entity, plus the integration options for the frontend."""

    _attr_has_entity_name = True
    _attr_translation_key = "sensors_status"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = STATES
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_should_poll = False
    # Large, rarely useful in the history: kept out of the recorder.
    _unrecorded_attributes = frozenset({"sensor_statuses", "entities"})

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_sensors_status"
        self._in_grace = True
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "maison3d_local")},
            name="Maison 3D",
            manufacturer="Maison 3D",
            model="Tableau de bord 3D",
        )

    def _configured(self) -> dict[str, str]:
        return {
            key: str(self._entry.options.get(key, default) or "")
            for key, default in DEFAULT_ENTITIES.items()
        }

    def _statuses(self) -> dict[str, dict]:
        statuses = {}
        for key, entity_id in self._configured().items():
            if not entity_id:
                statuses[key] = {"state": "not_configured", "entity_id": ""}
                continue
            entity = self.hass.states.get(entity_id)
            if entity is None:
                state = "not_found"
            elif entity.state in ("unknown", "unavailable"):
                state = entity.state
            else:
                state = "ok"
            statuses[key] = {
                "state": state,
                "entity_id": entity_id,
                "value": entity.state if entity else None,
            }
        return statuses

    @property
    def native_value(self) -> str:
        """Global state computed from actual linked entities."""
        statuses = [s for s in self._statuses().values() if s["state"] != "not_configured"]
        if not statuses:
            return STATE_NOT_CONFIGURED
        tolerated = {"ok", "not_found"} if self._in_grace else {"ok"}
        if any(s["state"] not in tolerated for s in statuses):
            return STATE_DEGRADED
        return STATE_OK

    @property
    def extra_state_attributes(self) -> dict:
        """Configured entity IDs, availability of each source and the options read by the card/panel."""
        selected = self._configured()
        statuses = self._statuses()
        return {
            "maison3d_config": True,
            "entities": selected,
            "project_name": str(self._entry.options.get("project_name", "") or DEFAULT_PROJECT_NAME),
            "base_image_url": str(self._entry.options.get("base_image_url", "") or ""),
            "effects_enabled": bool(self._entry.options.get("effects_enabled", True)),
            "frost_enabled": bool(self._entry.options.get("frost_enabled", True)),
            "weather_photos_enabled": bool(self._entry.options.get("weather_photos_enabled", False)),
            "sensor_statuses": statuses,
            "configured_count": sum(bool(v) for v in selected.values()),
            "available_count": sum(s["state"] == "ok" for s in statuses.values()),
            "startup_grace": self._in_grace,
        }

    async def async_added_to_hass(self) -> None:
        """Update immediately when any of the configured sources change."""
        # Grace period: until Home Assistant has started, then STARTUP_GRACE_SECONDS more.
        @callback
        def _end_grace(_now=None) -> None:
            self._in_grace = False
            self.async_write_ha_state()

        @callback
        def _started(_hass) -> None:
            self.async_on_remove(async_call_later(self.hass, STARTUP_GRACE_SECONDS, _end_grace))

        self.async_on_remove(async_at_started(self.hass, _started))
        entity_ids = [eid for eid in self._configured().values() if eid]
        if entity_ids:
            self.async_on_remove(
                async_track_state_change_event(
                    self.hass, entity_ids, self._async_source_updated
                )
            )

    @callback
    def _async_source_updated(self, event) -> None:
        self.async_write_ha_state()
