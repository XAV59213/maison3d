"""Real Home Assistant tests (pytest-homeassistant-custom-component).

    pip install pytest-homeassistant-custom-component
    pytest tests_ha
"""
import pytest

pytest_plugins = ["pytest_homeassistant_custom_component"]


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield
