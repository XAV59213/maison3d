// Cache-busting: the ?v=<version> of this module's URL is passed to its own imports.
const VERSION=new URL(import.meta.url).searchParams.get("v")||"";
const V=VERSION?"?v="+encodeURIComponent(VERSION):"";
const [,{IMAGE_KEYS},{createStorageBridge},{createMediaResolver},{createHassTracker,isWeather},{readSensor,precipitation,sensorIssues,windKmh,menuChoice,effectiveEntities,entityOptions,ENTITY_KEYS},{createLightBridge,lightOptions},{t,langOf}]=await Promise.all(["./maison3d-card-editor.js", "./photo-source.js", "./storage-bridge.js", "./media-resolver.js", "./hass-tracker.js", "./sensor-values.js", "./lights.js", "./i18n.js"].map(m=>import(m+V)));
/**
 * Maison 3D interactive Lovelace card.
 * Load as a JavaScript module resource: /maison3d-assets/maison3d-card.js
 */
class Maison3DCard extends HTMLElement {
  constructor() {
    super();
    this._tracker=createHassTracker();
    // Outdoor lights of the view: their states, and the optional click to toggle.
    this._lights=createLightBridge({getHass:()=>this._hass,getFrame:()=>this._frame,onChange:()=>this._updateStates(true)});
  }
  setConfig(config) {
    if (!config || (config.type && config.type !== "custom:maison3d-card")) {
      throw new Error("Maison 3D: type must be custom:maison3d-card");
    }
    const height = config.height === "" || config.height == null ? 440 : Number(config.height);
    if (!Number.isFinite(height) || height < 240 || height > 1400) {
      throw new Error("Maison 3D: height must be between 240 and 1400 pixels");
    }
    this._config = {
      title: String(config.title ?? "").slice(0,120),
      project_name: String(config.project_name ?? "").trim().slice(0,60),
      height,
      weather_entity: String(config.weather_entity ?? ""),
      sun_entity: String(config.sun_entity ?? ""),
      moon_entity: String(config.moon_entity ?? ""),
      temperature_entity: String(config.temperature_entity ?? ""),
      wind_entity: String(config.wind_entity ?? ""),
      rain_entity: String(config.rain_entity ?? ""),
      snow_entity: String(config.snow_entity ?? ""),
      cloud_entity: String(config.cloud_entity ?? ""),
      base_image_url: String(config.base_image_url ?? "").slice(0,500),
      effects_enabled: typeof config.effects_enabled === "boolean" ? config.effects_enabled : null,
      frost_enabled: typeof config.frost_enabled === "boolean" ? config.frost_enabled : null,
      weather_photos: typeof config.weather_photos === "boolean" ? config.weather_photos : null,
      images: Object.fromEntries(Object.entries(config.images || {}).filter(([key,url])=>
        IMAGE_KEYS.includes(key) &&
        typeof url==="string" && url.length<500))
    };
    this._renderCard();
    this._updateStates(true);
  }

  set hass(value) {
    this._hass = value;
    const title=this.shadowRoot?.querySelector(".card-title");
    if (title && title.textContent!==this._title()) title.textContent=this._title();
    this._updateStates();
  }

  connectedCallback() {
    if (!this._onBeforeUnload) this._onBeforeUnload=event=>{if(this._dirty){event.preventDefault();event.returnValue=""}};
    window.addEventListener("beforeunload",this._onBeforeUnload);
    // Shared project (3D layout, photo settings) saved in Home Assistant; card
    // overrides stay in the card configuration.
    if (!this._storage) {
      this._storage = createStorageBridge({getFrame:()=>this._frame,getHass:()=>this._hass});
      this._onStorageMessage = event => {
        this._storage.onMessage(event);
        this._onFrameMessage(event);
      };
      this._media = createMediaResolver({getHass:()=>this._hass,onResolved:()=>this._updateStates(true)});
    }
    window.addEventListener("message", this._onStorageMessage);
    if (this._config) this._renderCard();
    // Pause the iframe rendering loop while the card is scrolled off-screen.
    if (!this._observer && "IntersectionObserver" in window) {
      this._observer = new IntersectionObserver(entries => {
        this._visible = entries.some(entry => entry.isIntersecting);
        this._sendVisibility();
      });
      this._observer.observe(this);
    }
  }

  // ⚙ menu of the view: entity choices and the list of candidates for its selectors.
  _onFrameMessage(event) {
    if (event.origin!==window.location.origin || !this._frame || event.source!==this._frame.contentWindow) return;
    // Unsaved changes in the view (draft): warn before leaving the page.
    if (event.data?.type==="maison3d:dirty") {this._dirty=event.data.dirty===true;return}
    if (event.data?.type==="maison3d:entity-options-request") {
      if (this._hass) this._frame.contentWindow.postMessage({type:"maison3d:entity-options",options:{...entityOptions(this._hass.states||{}),lights:lightOptions(this._hass.states||{})}},window.location.origin);
      return;
    }
    if (this._lights.onMessage(event.data)) return;
    if (event.data?.type!=="maison3d:entity-selection") return;
    this._menu=Object.fromEntries(ENTITY_KEYS.map(key=>[key,menuChoice(key,event.data[key])]));
    this._updateStates(true);
  }

  disconnectedCallback() {
    window.removeEventListener("beforeunload",this._onBeforeUnload);
    this._loaded = false;
    window.removeEventListener("message", this._onStorageMessage);
    this._storage?.flush();
    this._observer?.disconnect();
    this._observer = null;
  }

  _sendVisibility() {
    if (!this._loaded || !this._frame?.contentWindow) return;
    this._frame.contentWindow.postMessage(
      {type:"maison3d:visibility", visible:this._visible !== false},
      window.location.origin
    );
  }

  _lang(){
    return langOf(this._hass?.locale?.language||this._hass?.language);
  }

  _renderCard() {
    if (!this.isConnected || !this._config) return;
    if (!this.shadowRoot) this.attachShadow({mode:"open"});
    if (this._frame) {
      const title = this.shadowRoot.querySelector(".card-title");
      if (title) title.textContent = this._title();
      this._frame.style.height = this._config.height + "px";
      const footer=this.shadowRoot.querySelector(".footer");
      if(footer)footer.textContent=t(this._lang(),"card_footer");
      this._frame.title=t(this._lang(),"card_iframe_title");
      return;
    }
    const style = document.createElement("style");
    style.textContent = `
      :host{display:block;min-width:0}
      ha-card{display:block;overflow:hidden}
      .card-title{padding:14px 16px 8px;font-size:18px;font-weight:500}
      iframe{display:block;width:100%;border:0;background:#111c2d}
      .footer{font-size:11px;color:var(--secondary-text-color,#889);
        padding:7px 13px;text-align:right}
    `;
    const card = document.createElement("ha-card");
    const heading = document.createElement("div");
    heading.className="card-title";
    heading.textContent=this._title();
    const frame=document.createElement("iframe");
    frame.title=t(this._lang(),"card_iframe_title");
    frame.loading="lazy";
    frame.src="/maison3d-assets/index.html?mode=card"+(VERSION?"&v="+encodeURIComponent(VERSION):"");
    frame.style.height=this._config.height+"px";
    frame.addEventListener("load",()=>{
      this._loaded=true;
      this._updateStates(true);
      this._sendVisibility();
    });
    const footer=document.createElement("div");
    footer.className="footer";
    footer.textContent=t(this._lang(),"card_footer");
    card.append(heading,frame,footer);
    this.shadowRoot.replaceChildren(style,card);
    this._frame=frame;
    this._loaded=false;
  }

  _updateStates(force=false) {
    if (!this._loaded || !this._frame?.contentWindow || !this._hass) return;
    const states=this._hass.states||{};
    // Memoised lookups: no scan of every entity on each Home Assistant update.
    const diagnostic=this._tracker.diagnostic(states);
    const integration = diagnostic?.attributes?.entities || {};
    // Card option → ⚙ menu choice (shared view settings) → integration option → detection.
    const menu=this._menu||{};
    const choice = key => this._config[key] || menu[key] || integration[key] || "";
    const weather=(choice("weather_entity") && states[choice("weather_entity")]) || this._tracker.find("weather",states,isWeather);
    const sun=states[choice("sun_entity") || "sun.sun"];
    const moon=states[choice("moon_entity")] || this._tracker.moon(states);
    // Only the tracked entities matter: same state objects = nothing to recompute or post.
    const keys=["temperature_entity","wind_entity","rain_entity","snow_entity","cloud_entity","weather_entity","sun_entity","moon_entity"];
    const dirty=this._tracker.changed([
      ["config",this._hass.config],["diagnostic",diagnostic],["weather",weather],["sun",sun],["moon",moon],
      ["user",this._hass.user],...this._lights.entries(states),
      ...keys.map(key=>[key,states[choice(key)]])
    ]);
    if (!force && !dirty) return;
    const attrs=weather?.attributes||{};
    // Numbers, on/off and Météo-France vigilance colours (see sensor-values.js).
    const numeric=(entityId,fallback)=>{
      if(!entityId)return fallback;
      const value=readSensor(states[entityId],{allowVigilance:false}).value;
      return value===null?fallback:value;
    };
    const temperature=numeric(choice("temperature_entity"),
      typeof attrs.temperature==="number"?attrs.temperature:null);
    // km/h whatever the unit of the wind sensor or of the weather entity.
    const windSpeed=windKmh(choice("wind_entity")?states[choice("wind_entity")]:null,attrs);
    const wet=precipitation(states[choice("rain_entity")],states[choice("snow_entity")]);
    const cloud=numeric(choice("cloud_entity"),null);
    const sensor_issues=sensorIssues({...Object.fromEntries(keys.map(key=>[key,choice(key)])),
      weather_entity:weather?.entity_id||choice("weather_entity"),sun_entity:choice("sun_entity")||"sun.sun",
      moon_entity:moon?.entity_id||""},states);
    const payload={
      type:"maison3d:conditions",
      project_name:this._projectName(),
      base_image_url:this._media.url(this._config.base_image_url||diagnostic?.attributes?.base_image_url||""),
      effects_enabled:this._config.effects_enabled??(diagnostic?.attributes?.effects_enabled!==false),
      frost_enabled:this._config.frost_enabled??(diagnostic?.attributes?.frost_enabled!==false),
      weather_photos:this._config.weather_photos??(diagnostic?.attributes?.weather_photos_enabled===true),
      time_zone:this._hass.config?.time_zone??"UTC",
      language:this._hass.locale?.language||this._hass.language||"",
      user_is_admin:this._hass.user?.is_admin===true,
      light_states:this._lights.states(states),
      weather:weather?.state??null,
      temperature,
      temperatureUnit:states[choice("temperature_entity")]?.attributes?.unit_of_measurement??attrs.temperature_unit??"",
      windSpeed,
      rain:wet.rain,
      snow:wet.snow,
      storm_alert:wet.storm_alert,
      ice_alert:wet.ice_alert,
      cloud,
      sensor_issues,
      entities_effective:effectiveEntities([["card",this._config],["menu",menu],["integration",integration]],{
        weather_entity:{entity_id:weather?.entity_id||"",source:"auto"},
        moon_entity:{entity_id:moon?.entity_id||"",source:"auto"},
        sun_entity:{entity_id:sun?"sun.sun":"",source:"default"}
      }),
      windSpeedUnit:"km/h",
      sun:sun?.state??null,
      moon:moon?.state??null,
      images:this._media.images(this._config.images)
    };
    const serialized=JSON.stringify(payload);
    if (!force && serialized===this._lastState) return;
    this._lastState=serialized;
    this._frame.contentWindow.postMessage(payload,window.location.origin);
  }

  // Card option → integration option → neutral default.
  _projectName() {
    const diagnostic=this._hass?.states?this._tracker.diagnostic(this._hass.states):undefined;
    const attribute=diagnostic?.attributes?.project_name;
    return this._config?.project_name||(typeof attribute==="string"?attribute.trim().slice(0,60):"")||"Maison 3D";
  }
  _title() {
    return this._config?.title||this._projectName();
  }

  getCardSize() {
    return Math.max(4,Math.ceil((this._config?.height??440)/50)+1);
  }
  getGridOptions() {
    return {columns:12, rows:Math.max(5,Math.ceil((this._config?.height??440)/56)),min_columns:4};
  }
  static getConfigElement() {
    return document.createElement("maison3d-card-editor");
  }
  static getStubConfig() {
    // Zero configuration: Home Assistant adds the type, everything else is
    // inherited from the integration options.
    return {};
  }
}
if (!customElements.get("maison3d-card")) customElements.define("maison3d-card",Maison3DCard);
window.customCards=window.customCards||[];
if (!window.customCards.some(card=>card.type==="maison3d-card")) {
  window.customCards.push({
    type:"maison3d-card",name:"Maison 3D",
    description:"Photo de la maison animée par la météo réelle (pluie, neige, orage, gel, jour/nuit), plan 2D et vue 3D. Aucun réglage nécessaire : tout vient de l’intégration Maison 3D.",
    preview:true,
    documentationURL:"https://github.com/XAV59213/maison3d#-carte-lovelace-prête-à-lemploi"
  });
}
