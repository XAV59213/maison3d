class Maison3DPanel extends HTMLElement {
  constructor() {
    super();
    this._lastWeather = "";
  }
  set hass(value) {
    this._hass = value;
    this.sendCurrentConditions();
  }
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:"open"});
    const style = document.createElement("style");
    style.textContent = ":host{display:block;height:100%}iframe{width:100%;height:calc(100vh - 56px);min-height:500px;border:0;background:#101923}";
    const frame = document.createElement("iframe");
    frame.src = "/maison3d-assets/index.html";
    frame.title = "Maison 3D V2.0";
    frame.allow = "fullscreen";
    frame.addEventListener("load", () => this.sendCurrentConditions(true));
    this._frame = frame;
    root.append(style, frame);
  }
  sendCurrentConditions(force = false) {
    if (!this._hass || !this._frame?.contentWindow) return;
    const states = this._hass.states || {};
    const weather = Object.values(states).find(entity => entity.entity_id?.startsWith("weather."));
    const sun = states["sun.sun"];
    const payload = {
      type: "maison3d:conditions",
      weather: weather?.state ?? null,
      temperature: weather?.attributes?.temperature ?? null,
      windSpeed: weather?.attributes?.wind_speed ?? null,
      windSpeedUnit: weather?.attributes?.wind_speed_unit ?? "",
      sun: sun?.state ?? null,
      updatedAt: new Date().toISOString()
    };
    const next = JSON.stringify(payload);
    if (!force && next === this._lastWeather) return;
    this._lastWeather = next;
    this._frame.contentWindow.postMessage(payload, window.location.origin);
  }
}
if (!customElements.get("maison3d-panel")) customElements.define("maison3d-panel", Maison3DPanel);
