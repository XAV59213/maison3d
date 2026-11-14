import "./maison3d-card-editor.js";
/**
 * Maison 3D interactive Lovelace card.
 * Load as a JavaScript module resource: /maison3d-assets/maison3d-card.js
 */
class Maison3DCard extends HTMLElement {
  setConfig(config) {
    if (!config || (config.type && config.type !== "custom:maison3d-card")) {
      throw new Error("Maison 3D: type must be custom:maison3d-card");
    }
    const height = Number(config.height ?? 440);
    if (!Number.isFinite(height) || height < 240 || height > 1400) {
      throw new Error("Maison 3D: height must be between 240 and 1400 pixels");
    }
    this._config = {
      title: String(config.title ?? "Maison 3D"),
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
      images: Object.fromEntries(Object.entries(config.images || {}).filter(([key,url])=>
        ["day","night","cloudy","rain","snow","wind","storm","spring","summer","autumn","winter",
         "moon_new_moon","moon_waxing_crescent","moon_first_quarter","moon_waxing_gibbous",
         "moon_full_moon","moon_waning_gibbous","moon_last_quarter","moon_waning_crescent"].includes(key) &&
        typeof url==="string" && url.length<500))
    };
    this._renderCard();
  }

  set hass(value) {
    this._hass = value;
    this._updateStates();
  }

  connectedCallback() {
    if (this._config) this._renderCard();
  }

  disconnectedCallback() {
    this._loaded = false;
  }

  _renderCard() {
    if (!this.isConnected || !this._config) return;
    if (!this.shadowRoot) this.attachShadow({mode:"open"});
    if (this._frame) {
      const title = this.shadowRoot.querySelector(".card-title");
      if (title) title.textContent = this._config.title;
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
    heading.textContent=this._config.title;
    const frame=document.createElement("iframe");
    frame.title="Maison 3D interactive";
    frame.loading="lazy";
    frame.src="/maison3d-assets/index.html?mode=card";
    frame.style.height=this._config.height+"px";
    frame.addEventListener("load",()=>{
      this._loaded=true;
      this._updateStates(true);
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
      base_image_url:this._config.base_image_url||diagnostic?.attributes?.base_image_url||"",
      effects_enabled:this._config.effects_enabled??(diagnostic?.attributes?.effects_enabled!==false),
      time_zone:this._hass.config?.time_zone??"UTC",
      weather:weather?.state??null,
      temperature,
      windSpeed,
      rain,
      snow,
      cloud,
      windSpeedUnit:attrs.wind_speed_unit??"",
      sun:sun?.state??null,
      moon:moon?.state??null,
      images:this._config.images
    };
    const serialized=JSON.stringify(payload);
    if (!force && serialized===this._lastState) return;
    this._lastState=serialized;
    this._frame.contentWindow.postMessage(payload,window.location.origin);
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
    return {type:"custom:maison3d-card",title:"Maison 3D",height:440};
  }
}
if (!customElements.get("maison3d-card")) customElements.define("maison3d-card",Maison3DCard);
window.customCards=window.customCards||[];
if (!window.customCards.some(card=>card.type==="maison3d-card")) {
  window.customCards.push({
    type:"maison3d-card",name:"Maison 3D",
    description:"Carte 3D interactive pour Home Assistant, avec météo et jour/nuit",
    preview:false
  });
}
