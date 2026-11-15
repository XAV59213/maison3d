"""Diagnostic entity for configured Maison 3D Home Assistant sensors."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import EntityCategory
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from . import state_logic
from .config_flow import DEFAULT_ENTITIES
from .const import DEFAULT_PROJECT_NAME, DOMAIN
from .store import SIGNAL_SAVED, get_store

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


DEVICE = DeviceInfo(
    identifiers={(DOMAIN, "maison3d_local")},
    name="Maison 3D",
    manufacturer="Maison 3D",
    model="Tableau de bord 3D",
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Create the diagnostic sensors, visible on the Maison 3D integration page."""
    remove_legacy_entities(hass, entry)
    await get_store(hass).async_load()
    view = Maison3DViewState(hass, entry)
    async_add_entities([
        Maison3DConfigurationSensor(entry),
        *(cls(entry, view) for cls in VIEW_SENSORS),
    ])


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
        self._attr_device_info = DEVICE

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


# ---------------------------------------------------------------------------
# What the photo view shows (saved project + Home Assistant states).
# ---------------------------------------------------------------------------
# Computed here, not reported by a browser: it is known even when no panel or
# card is open, every device agrees, and nothing depends on which browser spoke
# last. See state_logic.py for what is deliberately left out (test buttons,
# per-card overrides, an image failing to load in one browser).
REFRESH_INTERVAL = timedelta(minutes=5)  # clock-based night / season without a sun entity
DETECTION_SECONDS = 60  # automatic weather / moon detection is rescanned at most every minute


class Maison3DViewState:
    """One computation shared by the view sensors; updates on save, states and time."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.value: dict = {}
        self._listeners: list = []
        self._unsubs: list = []
        self._tracked: tuple[str, ...] = ()
        self._untrack = None
        self._detected: tuple[float, str, str] | None = None

    def _detect(self) -> tuple[str, str]:
        """First available weather entity and best moon sensor (like the card / panel)."""
        now = dt_util.utcnow().timestamp()
        if self._detected and now - self._detected[0] < DETECTION_SECONDS:
            return self._detected[1], self._detected[2]
        weather = next((s.entity_id for s in self.hass.states.async_all("weather")
                        if s.state not in ("unknown", "unavailable")), "")
        moons = [s for s in self.hass.states.async_all("sensor") if state_logic.is_moon(s)]
        moon = max(moons, key=state_logic.moon_rank).entity_id if moons else ""
        self._detected = (now, weather, moon)
        return weather, moon

    @callback
    def compute(self) -> dict:
        weather, moon = self._detect()
        now = dt_util.now()
        saved = get_store(self.hass).data.get("photo_settings")
        self.value = state_logic.compute_view(
            saved, dict(self.entry.options), self.hass.states.get, month=now.month, hour=now.hour,
            detected_weather=self.hass.states.get(weather) if weather else None,
            detected_moon=self.hass.states.get(moon) if moon else None,
        )
        self._retrack()
        return self.value

    @callback
    def _retrack(self) -> None:
        """Follow exactly the entities the view reads (they change with the settings)."""
        wanted = tuple(sorted({e for e in self.value.get("entities", {}).values() if e}))
        if wanted == self._tracked:
            return
        if self._untrack:
            self._untrack()
            self._untrack = None
        self._tracked = wanted
        if wanted:
            self._untrack = async_track_state_change_event(self.hass, list(wanted), self._changed)

    @callback
    def _changed(self, *_args) -> None:
        self.compute()
        for listener in list(self._listeners):
            listener()

    @callback
    def add_listener(self, listener) -> callable:
        if not self._listeners:
            self._unsubs = [
                async_dispatcher_connect(self.hass, SIGNAL_SAVED, self._changed),
                async_track_time_interval(self.hass, self._changed, REFRESH_INTERVAL),
            ]
            self.compute()
        self._listeners.append(listener)

        @callback
        def _remove() -> None:
            self._listeners.remove(listener)
            if not self._listeners:
                for unsub in self._unsubs:
                    unsub()
                self._unsubs = []
                if self._untrack:
                    self._untrack()
                    self._untrack = None
                self._tracked = ()

        return _remove


class Maison3DViewSensor(SensorEntity):
    """Base of the view sensors: diagnostic, translated, fixed entity id."""

    _attr_has_entity_name = True
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_should_poll = False
    key = ""

    def __init__(self, entry: ConfigEntry, view: Maison3DViewState) -> None:
        self._view = view
        self._attr_translation_key = self.key
        self._attr_unique_id = f"{entry.entry_id}_{self.key}"
        # Same entity id whatever the language of Home Assistant.
        self.entity_id = f"sensor.maison3d_{self.key}"
        self._attr_device_info = DEVICE

    @property
    def data(self) -> dict:
        return self._view.value

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._view.add_listener(self.async_write_ha_state))


class Maison3DSeasonModeSensor(Maison3DViewSensor):
    """Automatic seasons or a season fixed in the ⚙ menu."""

    key = "season_mode"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(state_logic.SEASON_MODES)

    @property
    def native_value(self) -> str:
        return self.data.get("season_mode", "auto")

    @property
    def extra_state_attributes(self) -> dict:
        return {"fixed_season": self.data.get("fixed_season")}


class Maison3DSeasonSensor(Maison3DViewSensor):
    """Season shown now (fixed one, else from the Home Assistant calendar)."""

    key = "season"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(state_logic.SEASONS)

    @property
    def native_value(self) -> str:
        return self.data.get("season", "spring")


class Maison3DPhotoSensor(Maison3DViewSensor):
    """Photo shown by the panel: file name as state, full URL in an attribute."""

    key = "photo"
    _unrecorded_attributes = frozenset({"url"})

    @property
    def native_value(self) -> str:
        return state_logic.photo_name(self.data.get("photo", ""))

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "url": self.data.get("photo", ""),
            "source": self.data.get("photo_source", "main"),
            "weather_photos": self.data.get("weather_photos", False),
        }


class Maison3DAmbienceSensor(Maison3DViewSensor):
    """Weather / season ambience chosen for the photo (live or fixed in the ⚙ menu)."""

    key = "ambience"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(state_logic.AMBIANCES)
    _unrecorded_attributes = frozenset({"entities"})

    @property
    def native_value(self) -> str:
        return self.data.get("ambience", "day")

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "ambience_mode": self.data.get("ambience_mode", "auto"),
            "weather_kind": self.data.get("weather_kind"),
            "frost": self.data.get("frost", False),
            "effects": self.data.get("effects", True),
            "entities": self.data.get("entities", {}),
        }


class Maison3DDayNightSensor(Maison3DViewSensor):
    """Day or night for the view (sun entity, else the Home Assistant clock)."""

    key = "day_night"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(state_logic.DAY_NIGHT)

    @property
    def native_value(self) -> str:
        return self.data.get("day_night", "day")

    @property
    def extra_state_attributes(self) -> dict:
        return {"source": self.data.get("night_source", "clock")}


VIEW_SENSORS = (
    Maison3DSeasonModeSensor,
    Maison3DSeasonSensor,
    Maison3DPhotoSensor,
    Maison3DAmbienceSensor,
    Maison3DDayNightSensor,
)
