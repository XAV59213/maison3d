import "./maison3d-card-editor.js";
import {IMAGE_KEYS} from "./photo-source.js";
import {createStorageBridge} from "./storage-bridge.js";
import {createMediaResolver} from "./media-resolver.js";
/**
 * Maison 3D interactive Lovelace card.
 * Load as a JavaScript module resource: /maison3d-assets/maison3d-card.js
 */
class Maison3DCard extends HTMLElement {
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
    // Shared project (3D layout, photo settings) saved in Home Assistant; card
    // overrides stay in the card configuration.
    if (!this._storage) {
      this._storage = createStorageBridge({getFrame:()=>this._frame,getHass:()=>this._hass});
      this._onStorageMessage = event => this._storage.onMessage(event);
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

  disconnectedCallback() {
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

  _renderCard() {
    if (!this.isConnected || !this._config) return;
    if (!this.shadowRoot) this.attachShadow({mode:"open"});
    if (this._frame) {
      const title = this.shadowRoot.querySelector(".card-title");
      if (title) title.textContent = this._title();
      this._frame.style.height = this._config.height + "px";
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
    frame.title="Maison 3D interactive";
    frame.loading="lazy";
    frame.src="/maison3d-assets/index.html?mode=card";
    frame.style.height=this._config.height+"px";
    frame.addEventListener("load",()=>{
      this._loaded=true;
      this._updateStates(true);
      this._sendVisibility();
    });
    const footer=document.createElement("div");
    footer.className="footer";
    footer.textContent="Vue 3D interactive · Ouvrir le panneau Maison 3D pour modifier les objets";
    card.append(heading,frame,footer);
    this.shadowRoot.replaceChildren(style,card);
    this._frame=frame;
    this._loaded=false;
  }

  _updateStates(force=false) {
    if (!this._loaded || !this._frame?.contentWindow || !this._hass) return;
    const states=this._hass.states||{};
    const diagnostic = Object.values(states).find(e=>e.attributes?.maison3d_config===true);
    const integration = diagnostic?.attributes?.entities || {};
    const choice = key => this._config[key] || integration[key] || "";
    const weather=(choice("weather_entity") && states[choice("weather_entity")]) ||
      Object.values(states).find(s=>s.entity_id?.startsWith("weather.") &&
        s.state!=="unknown" && s.state!=="unavailable");
    const sun=states[choice("sun_entity") || "sun.sun"];
    const moon=states[choice("moon_entity")] || Object.values(states).find(s=>s.entity_id?.startsWith("sensor.") && s.entity_id.includes("moon") && s.state!=="unavailable");
    const attrs=weather?.attributes||{};
    const numeric=(entityId,fallback)=>{
      const entity=entityId&&states[entityId];
      if(!entity||["unknown","unavailable"].includes(entity.state))return fallback;
      const state=String(entity.state).toLowerCase();
      if(state==="on")return 1;
      if(state==="off")return 0;
      const value=Number(entity.state);
      return Number.isFinite(value)?value:fallback;
    };
    const temperature=numeric(choice("temperature_entity"),
      typeof attrs.temperature==="number"?attrs.temperature:null);
    const windSpeed=numeric(choice("wind_entity"),
      typeof attrs.wind_speed==="number"?attrs.wind_speed:null);
    const rain=numeric(choice("rain_entity"),null);
    const snow=numeric(choice("snow_entity"),null);
    const cloud=numeric(choice("cloud_entity"),null);
    const payload={
      type:"maison3d:conditions",
      project_name:this._projectName(),
      base_image_url:this._media.url(this._config.base_image_url||diagnostic?.attributes?.base_image_url||""),
      effects_enabled:this._config.effects_enabled??(diagnostic?.attributes?.effects_enabled!==false),
      frost_enabled:this._config.frost_enabled??(diagnostic?.attributes?.frost_enabled!==false),
      weather_photos:this._config.weather_photos??(diagnostic?.attributes?.weather_photos_enabled===true),
      time_zone:this._hass.config?.time_zone??"UTC",
      weather:weather?.state??null,
      temperature,
      temperatureUnit:states[choice("temperature_entity")]?.attributes?.unit_of_measurement??attrs.temperature_unit??"",
      windSpeed,
      rain,
      snow,
      cloud,
      windSpeedUnit:attrs.wind_speed_unit??"",
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
    const diagnostic=Object.values(this._hass?.states||{}).find(e=>e.attributes?.maison3d_config===true);
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
