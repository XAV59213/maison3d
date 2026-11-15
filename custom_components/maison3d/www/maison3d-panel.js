/** Home Assistant custom panel wrapper for the Maison 3D editor. */
// Cache-busting: the ?v=<version> of this module's URL is passed to its own imports.
const VERSION=new URL(import.meta.url).searchParams.get("v")||"";
const V=VERSION?"?v="+encodeURIComponent(VERSION):"";
const [{createStorageBridge},{createMediaResolver},{createHassTracker,isWeather},{readSensor,precipitation,sensorIssues,windKmh,menuChoice,effectiveEntities,entityOptions,ENTITY_KEYS},{createLightBridge,lightOptions}]=await Promise.all(["./storage-bridge.js", "./media-resolver.js", "./hass-tracker.js", "./sensor-values.js", "./lights.js"].map(m=>import(m+V)));
class Maison3DPanel extends HTMLElement {
  constructor() {
    super();
    this._lastConditions = "";
    this._loaded = false;
    this._tracker = createHassTracker();
    // Entities chosen in the ⚙ menu of the view ("" = inherit the integration).
    this._choices = Object.fromEntries(ENTITY_KEYS.map(key => [key, ""]));
    // Project (3D layout, photo settings, view) saved in Home Assistant for the iframe.
    this._storage = createStorageBridge({getFrame:()=>this._frame,getHass:()=>this._hass});
    this._onStorageMessage = event => this._storage.onMessage(event);
    this._media = createMediaResolver({getHass:()=>this._hass,onResolved:()=>this.sendCurrentConditions(true)});
    // Outdoor lights of the view: their states, and the optional click to toggle.
    this._lights = createLightBridge({getHass:()=>this._hass,getFrame:()=>this._frame,onChange:()=>this.sendCurrentConditions(true)});
    this._dirty = false;
    this._onBeforeUnload = event => {if(this._dirty){event.preventDefault();event.returnValue=""}};
    this._onFrameMessage = event => {
      if(event.origin!==window.location.origin || event.source!==this._frame?.contentWindow)return;
      // Unsaved changes in the view (draft): warn before leaving the page.
      if(event.data?.type==="maison3d:dirty"){this._dirty=event.data.dirty===true;return}
      if(event.data?.type==="maison3d:entity-options-request"){this._sendEntityOptions();return}
      if(this._lights.onMessage(event.data))return;
      if(event.data?.type!=="maison3d:entity-selection")return;
      for(const key of ENTITY_KEYS)this._choices[key]=menuChoice(key,event.data[key]);
      this.sendCurrentConditions(true);
    };
  }

  set hass(value) {
    this._hass = value;
    this.sendCurrentConditions();
  }

  connectedCallback() {
    window.addEventListener("message",this._onFrameMessage);
    window.addEventListener("beforeunload",this._onBeforeUnload);
    window.addEventListener("message",this._onStorageMessage);
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{display:block;height:100%;min-height:0}iframe{display:block;width:100%;height:calc(100dvh - 56px);min-height:240px;border:0;background:#101923}";
    const frame = document.createElement("iframe");
    frame.src = "/maison3d-assets/index.html" + V;
    frame.title = "Maison 3D";
    // Instance name: the view keeps its unsaved changes per instance (sessionStorage).
    frame.name = "maison3d-panel";
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
    window.removeEventListener("beforeunload",this._onBeforeUnload);
    window.removeEventListener("message",this._onStorageMessage);
    this._storage.flush();
    this._loaded=false;
  }

  // Candidates for the entity selectors of the ⚙ menu (one scan, on request only).
  _sendEntityOptions() {
    if (!this._hass || !this._frame?.contentWindow) return;
    this._frame.contentWindow.postMessage({type: "maison3d:entity-options", options: {...entityOptions(this._hass.states || {}), lights: lightOptions(this._hass.states || {})}}, window.location.origin);
  }

  sendCurrentConditions(force = false) {
    if (!this._loaded || !this._hass || !this._frame?.contentWindow) return;

    const states = this._hass.states || {};
    // Memoised lookups: no scan of every entity on each Home Assistant update.
    const diagnostic = this._tracker.diagnostic(states);
    const configured = diagnostic?.attributes?.entities || {};
    // ⚙ menu choice → integration option → automatic detection / default.
    const choice = key => this._choices[key] || configured[key] || "";
    // Prefer a known/available weather entity rather than an unknown one.
    const requested = choice("weather_entity") && states[choice("weather_entity")];
    const weather = requested || this._tracker.find("weather", states, isWeather);
    const sun = states[choice("sun_entity") || "sun.sun"];
    const moonState = states[choice("moon_entity")] || this._tracker.moon(states);
    // Only the tracked entities matter: same state objects = nothing to send.
    const keys = ["temperature_entity","wind_entity","rain_entity","snow_entity","cloud_entity","weather_entity","sun_entity","moon_entity"];
    const dirty = this._tracker.changed([
      ["config", this._hass.config], ["diagnostic", diagnostic], ["weather", weather], ["sun", sun], ["moon", moonState],
      ["user", this._hass.user], ...this._lights.entries(states),
      ...keys.map(key => [key, states[choice(key)]])
    ]);
    if (!force && !dirty) return;
    const attributes = weather?.attributes || {};
    // Numbers, on/off and Météo-France vigilance colours (see sensor-values.js).
    const numeric = (key, fallback) => {
      if (!choice(key)) return fallback;
      const value = readSensor(states[choice(key)], {allowVigilance: false}).value;
      return value === null ? fallback : value;
    };
    const wet = precipitation(states[choice("rain_entity")], states[choice("snow_entity")]);
    const sensor_issues = sensorIssues({...Object.fromEntries(keys.map(key => [key, choice(key)])),
      weather_entity: weather?.entity_id || choice("weather_entity"), sun_entity: choice("sun_entity") || "sun.sun",
      moon_entity: moonState?.entity_id || ""}, states);
    const payload = {
      type: "maison3d:conditions",
      project_name: typeof diagnostic?.attributes?.project_name === "string" ? diagnostic.attributes.project_name : "",
      base_image_url: this._media.url(typeof diagnostic?.attributes?.base_image_url === "string" ? diagnostic.attributes.base_image_url : ""),
      effects_enabled: diagnostic?.attributes?.effects_enabled !== false,
      frost_enabled: diagnostic?.attributes?.frost_enabled !== false,
      weather_photos: diagnostic?.attributes?.weather_photos_enabled === true,
      time_zone: this._hass.config?.time_zone ?? "UTC",
      language: this._hass.locale?.language || this._hass.language || "",
      // Options of the integration (for « remplace l'option de l'intégration » in the ⚙ menu).
      integration_options: {
        effects_enabled: diagnostic?.attributes?.effects_enabled !== false,
        frost_enabled: diagnostic?.attributes?.frost_enabled !== false,
        weather_photos: diagnostic?.attributes?.weather_photos_enabled === true,
        base_image_url: typeof diagnostic?.attributes?.base_image_url === "string" ? diagnostic.attributes.base_image_url : "",
        entities: configured,
      },
      user_is_admin: this._hass.user?.is_admin === true,
      light_states: this._lights.states(states),
      weather: weather?.state ?? null,
      temperature: numeric("temperature_entity", typeof attributes.temperature === "number" ? attributes.temperature : null),
      temperatureUnit: states[choice("temperature_entity")]?.attributes?.unit_of_measurement ?? attributes.temperature_unit ?? "",
      // km/h whatever the unit of the wind sensor or of the weather entity.
      windSpeed: windKmh(choice("wind_entity") ? states[choice("wind_entity")] : null, attributes),
      rain: wet.rain,
      snow: wet.snow,
      storm_alert: wet.storm_alert,
      ice_alert: wet.ice_alert,
      cloud: numeric("cloud_entity", null),
      sensor_issues,
      entities_effective: effectiveEntities([["menu", this._choices], ["integration", configured]], {
        weather_entity: {entity_id: weather?.entity_id || "", source: "auto"},
        moon_entity: {entity_id: moonState?.entity_id || "", source: "auto"},
        sun_entity: {entity_id: sun ? "sun.sun" : "", source: "default"}
      }),
      windSpeedUnit: "km/h",
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
