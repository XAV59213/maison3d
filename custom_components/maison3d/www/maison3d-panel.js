/** Home Assistant custom panel wrapper for the Maison 3D editor. */
class Maison3DPanel extends HTMLElement {
  constructor() {
    super();
    this._lastConditions = "";
    this._loaded = false;
    this._choices = {weather_entity:"",sun_entity:"sun.sun",moon_entity:"sensor.moon_phase"};
    this._onFrameMessage = event => {
      if(event.origin!==window.location.origin || event.source!==this._frame?.contentWindow)return;
      if(event.data?.type!=="maison3d:entity-selection")return;
      for(const key of ["weather_entity","sun_entity","moon_entity"]){
        if(typeof event.data[key]==="string" && event.data[key].length<150)this._choices[key]=event.data[key];
      }
      this.sendCurrentConditions(true);
    };
  }

  set hass(value) {
    this._hass = value;
    this.sendCurrentConditions();
  }

  connectedCallback() {
    window.addEventListener("message",this._onFrameMessage);
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

  disconnectedCallback() {
    window.removeEventListener("message",this._onFrameMessage);
    this._loaded=false;
  }

  sendCurrentConditions(force = false) {
    if (!this._loaded || !this._hass || !this._frame?.contentWindow) return;

    const states = this._hass.states || {};
    // Prefer a known/available weather entity rather than an unknown one.
    const requested = this._choices.weather_entity && states[this._choices.weather_entity];
    const weather = requested || Object.values(states).find(
      entity => entity.entity_id?.startsWith("weather.") &&
        entity.state !== "unknown" && entity.state !== "unavailable"
    );
    const sun = states[this._choices.sun_entity || "sun.sun"];
    const moonState = states[this._choices.moon_entity] ||
      Object.values(states).find(entity=>entity.entity_id?.startsWith("sensor.") &&
        entity.entity_id.includes("moon") && entity.state!=="unavailable");
    const attributes = weather?.attributes || {};
    const payload = {
      type: "maison3d:conditions",
      weather: weather?.state ?? null,
      temperature: typeof attributes.temperature === "number" ? attributes.temperature : null,
      windSpeed: typeof attributes.wind_speed === "number" ? attributes.wind_speed : null,
      windSpeedUnit: attributes.wind_speed_unit ?? "",
      sun: sun?.state ?? null,
      moon: moonState?.state ?? null,
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
