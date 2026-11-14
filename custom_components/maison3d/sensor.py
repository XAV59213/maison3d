"""Diagnostic entity for configured Maison 3D Home Assistant sensors."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.event import async_track_state_change_event

from .config_flow import DEFAULT_ENTITIES
from .const import DOMAIN

FIELD_LABELS = {
    "weather_entity": "Météo",
    "sun_entity": "Soleil",
    "moon_entity": "Lune",
    "temperature_entity": "Température",
    "wind_entity": "Vent",
    "rain_entity": "Pluie",
    "snow_entity": "Neige",
    "cloud_entity": "Nuages",
}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Create a diagnostic sensor, visible on the Maison 3D integration page."""
    async_add_entities([Maison3DConfigurationSensor(entry), *[
        Maison3DSourceStatusSensor(entry, key, label)
        for key, label in FIELD_LABELS.items()
    ]])


class Maison3DConfigurationSensor(SensorEntity):
    """Show the health of each selected source entity."""

    _attr_has_entity_name = True
    _attr_name = "État des capteurs"
    _attr_icon = "mdi:weather-partly-cloudy"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_sensors_status"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "maison3d_local")},
            name="Maison 3D",
            manufacturer="Maison 3D",
            model="Tableau de bord 3D",
        )

    @property
    def native_value(self) -> str:
        """Global state computed from actual linked entities."""
        configured = {
            key: eid for key, eid in self._configured().items() if eid
        }
        if not configured:
            return "Non configuré"
        unavailable = [
            eid for eid in configured.values() if (
                (state := self.hass.states.get(eid)) is None
                or state.state in ("unavailable", "unknown")
            )
        ]
        if unavailable:
            return "Indisponible"
        return "OK"

    def _configured(self) -> dict[str, str]:
        return {
            key: str(self._entry.options.get(key, default) or "")
            for key, default in DEFAULT_ENTITIES.items()
        }

    @property
    def extra_state_attributes(self) -> dict:
        """Expose both configured entity IDs and accurate availability."""
        selected = self._configured()
        statuses = {}
        for key, entity_id in selected.items():
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
        return {
            "maison3d_config": True,
            "entities": selected,
            "base_image_url": str(self._entry.options.get("base_image_url", "") or ""),
            "sensor_statuses": statuses,
            "configured_count": sum(bool(v) for v in selected.values()),
            "available_count": sum(s["state"] == "ok" for s in statuses.values()),
        }

    async def async_added_to_hass(self) -> None:
        """Update immediately when any of the configured sources change."""
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


class Maison3DSourceStatusSensor(SensorEntity):
    """One visible diagnostic entity for every configurable sensor slot."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:check-network-outline"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, key: str, label: str) -> None:
        self._entry = entry
        self._key = key
        self._attr_name = f"{label} - état"
        self._attr_unique_id = f"{entry.entry_id}_{key}_status"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "maison3d_local")},
            name="Maison 3D",
            manufacturer="Maison 3D",
            model="Tableau de bord 3D",
        )

    @property
    def native_value(self) -> str:
        entity_id = str(self._entry.options.get(self._key, DEFAULT_ENTITIES[self._key]) or "")
        if not entity_id:
            return "Non configuré"
        entity = self.hass.states.get(entity_id)
        if entity is None:
            return "Introuvable"
        if entity.state in ("unavailable", "unknown"):
            return "Indisponible"
        return "OK"

    @property
    def extra_state_attributes(self) -> dict:
        entity_id = str(self._entry.options.get(self._key, DEFAULT_ENTITIES[self._key]) or "")
        entity = self.hass.states.get(entity_id) if entity_id else None
        return {
            "source_entity": entity_id,
            "source_state": entity.state if entity else None,
            "configured": bool(entity_id),
        }

    async def async_added_to_hass(self) -> None:
        entity_id = str(self._entry.options.get(self._key, DEFAULT_ENTITIES[self._key]) or "")
        if entity_id:
            self.async_on_remove(
                async_track_state_change_event(
                    self.hass, [entity_id], self._async_source_updated
                )
            )

    @callback
    def _async_source_updated(self, event) -> None:
        self.async_write_ha_state()
