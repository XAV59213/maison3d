DOMAIN = "maison3d"
PANEL_PATH = "maison3d"
ASSETS_URL = "/maison3d-assets"
CARD_URL = f"{ASSETS_URL}/maison3d-card.js"
DEFAULT_PROJECT_NAME = "Maison 3D"
PROJECT_NAME_MAX = 60


# Minutes after Home Assistant has started during which a late source
# (not_found, unavailable, unknown — typically Netatmo) does not degrade
# the diagnostic sensor. Configurable in the options flow (0–60).
DEFAULT_STARTUP_GRACE_MINUTES = 15
MIN_STARTUP_GRACE_MINUTES = 0
MAX_STARTUP_GRACE_MINUTES = 60


def startup_grace_minutes(options) -> int:
    """Configured grace duration in minutes, clamped to 0–60 (default 15)."""
    raw = DEFAULT_STARTUP_GRACE_MINUTES
    if isinstance(options, dict):
        raw = options.get("startup_grace_minutes", DEFAULT_STARTUP_GRACE_MINUTES)
    try:
        value = int(round(float(raw)))
    except (TypeError, ValueError):
        value = DEFAULT_STARTUP_GRACE_MINUTES
    return max(MIN_STARTUP_GRACE_MINUTES, min(MAX_STARTUP_GRACE_MINUTES, value))
