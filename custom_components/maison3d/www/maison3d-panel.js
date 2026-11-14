/** Home Assistant custom panel wrapper for the Maison 3D editor. */
class Maison3DPanel extends HTMLElement {
  constructor() {
    super();
    this._lastConditions = "";
    this._loaded = false;
  }

  set hass(value) {
    this._hass = value;
    this.sendCurrentConditions();
  }

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{display:block;height:100%;min-height:0}iframe{display:block;width:100%;height:calc(100dvh - 56px);min-height:480px;border:0;background:#101923}";
    const frame = document.createElement("iframe");
    frame.src = "/maison3d-assets/index.html";
    frame.title = "Maison 3D V2.0";
    frame.allow = "fullscreen";
    frame.addEventListener("load", () => {
      this._loaded = true;
      this.sendCurrentConditions(true);
    });
    frame.addEventListener("error", () => {
      this._loaded = false;
      console.error("Maison 3D: unable to load the editor frontend");
    });
    this._frame = frame;
    root.append(style, frame);
  }

  sendCurrentConditions(force = false) {
    if (!this._loaded || !this._hass || !this._frame?.contentWindow) return;

    const states = this._hass.states || {};
    // Prefer a known/available weather entity rather than an unknown one.
    const weather = Object.values(states).find(
      entity => entity.entity_id?.startsWith("weather.") &&
        entity.state !== "unknown" && entity.state !== "unavailable"
    );
    const sun = states["sun.sun"];
    const attributes = weather?.attributes || {};
    const payload = {
      type: "maison3d:conditions",
      weather: weather?.state ?? null,
      temperature: typeof attributes.temperature === "number" ? attributes.temperature : null,
      windSpeed: typeof attributes.wind_speed === "number" ? attributes.wind_speed : null,
      windSpeedUnit: attributes.wind_speed_unit ?? "",
      sun: sun?.state ?? null,
    };

    const next = JSON.stringify(payload);
    if (!force && next === this._lastConditions) return;
    this._lastConditions = next;
    this._frame.contentWindow.postMessage(payload, window.location.origin);
  }
}

if (!customElements.get("maison3d-panel")) {
  customElements.define("maison3d-panel", Maison3DPanel);
}
