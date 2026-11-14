/**
 * Visual configuration editor for the custom Maison 3D Lovelace card.
 * Lets users choose their actual Home Assistant entities without knowing IDs.
 */
class Maison3DCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this.attachShadow({mode:"open"});
  }
  setConfig(config) {
    this._config = {...config, images:{...(config.images||{})}};
    this._render();
  }
  set hass(hass) {
    this._hass=hass;
    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach(picker => picker.hass=hass);
  }
  connectedCallback() {
    if(this._config)this._render();
  }
  _changed(key,value,image=false) {
    const next={...this._config,images:{...(this._config.images||{})}};
    if(image) {
      if(value)next.images[key]=value;
      else delete next.images[key];
    }else if(value==="" && !["title","height"].includes(key)){
      delete next[key];
    }else{
      next[key]=value;
    }
    this._config=next;
    this.dispatchEvent(new CustomEvent("config-changed",{
      detail:{config:next},bubbles:true,composed:true
    }));
  }
  _render() {
    const root=this.shadowRoot;
    if(!root)return;
    const css=document.createElement("style");
    css.textContent=[
      ":host{display:block;font-family:var(--primary-font-family,system-ui);color:var(--primary-text-color)}",
      "section{padding:12px 0;border-bottom:1px solid var(--divider-color,#7773)}",
      "h3{font-size:15px;font-weight:600;margin:7px 0 12px}",
      "label{display:block;font-size:13px;margin:12px 0 5px}",
      "input,select,ha-entity-picker{display:block;width:100%;box-sizing:border-box;min-height:38px}",
      "input,select{background:var(--card-background-color,white);color:var(--primary-text-color);",
      "border:1px solid var(--divider-color,#999);border-radius:7px;padding:8px}",
      "p{color:var(--secondary-text-color,#777);font-size:12px;line-height:1.5}",
      ".help{font-size:11px;color:var(--secondary-text-color)}",
      ".row{display:flex;align-items:center;gap:10px}",
      ".row input{width:auto;min-height:auto}"
    ].join("");
    root.replaceChildren(css);
    const section=(heading,help)=>{
      const s=document.createElement("section");
      const h=document.createElement("h3");h.textContent=heading;s.append(h);
      if(help){const p=document.createElement("p");p.textContent=help;s.append(p);}
      root.append(s);return s;
    };
    const field=(parent,key,labelText,placeholder="",type="text")=>{
      const label=document.createElement("label");label.textContent=labelText;
      const input=document.createElement("input");
      input.type=type;input.placeholder=placeholder;
      input.value=String(this._config[key]??(key==="height"?500:""));
      input.addEventListener("change",()=>{
        let value=input.value.trim();
        if(type==="number"){
          value=Number(value);
          if(!Number.isFinite(value)||value<240||value>1400){
            input.setCustomValidity("Hauteur entre 240 et 1400 pixels");
            input.reportValidity();return;
          }
        }
        input.setCustomValidity("");this._changed(key,value);
      });
      parent.append(label,input);
    };
    const base=section("Général","La carte utilise la photo officielle par défaut, sans configuration complexe.");
    field(base,"title","Titre","Maison 3D");
    field(base,"height","Hauteur de la carte (px)","500","number");

    const pickers=section("Capteurs Home Assistant",
      "Choisis tes propres entités. Laisse les champs complémentaires vides pour utiliser automatiquement les données de weather.*.");
    const entities=[
      ["weather_entity","Météo actuelle",["weather"]],
      ["sun_entity","Soleil / jour et nuit",["sun"]],
      ["moon_entity","Phase de lune (ton module)",["sensor"]],
      ["temperature_entity","Température extérieure",["sensor"]],
      ["wind_entity","Vent / vitesse",["sensor"]],
      ["rain_entity","Pluie (intensité ou présence)",["sensor","binary_sensor"]],
      ["snow_entity","Neige (intensité ou présence)",["sensor","binary_sensor"]],
      ["cloud_entity","Nuages (pourcentage ou présence)",["sensor","binary_sensor"]]
    ];
    for(const [key,labelText,domains] of entities){
      const label=document.createElement("label");label.textContent=labelText;
      const picker=document.createElement("ha-entity-picker");
      picker.hass=this._hass;
      picker.includeDomains=domains;
      picker.allowCustomEntity=true;
      picker.value=this._config[key]??(key==="sun_entity"?"sun.sun":"");
      picker.addEventListener("value-changed",event=>{
        this._changed(key,event.detail?.value||"");
      });
      pickers.append(label,picker);
    }
    const images=section("Images personnalisées",
      "Chaque URL est modifiable. Place les photos dans /config/www/maison3d/ puis renseigne /local/maison3d/jour.jpg, etc. Sans URL : la photo officielle est utilisée.");
    const keys=[
      ["day","Jour"],["night","Nuit"],["cloudy","Nuageux"],["rain","Pluie"],
      ["snow","Neige"],["wind","Vent"],["storm","Orage"],
      ["spring","Printemps"],["summer","Été"],["autumn","Automne"],["winter","Hiver"]
    ];
    for(const [key,name] of keys){
      const label=document.createElement("label");label.textContent=name;
      const input=document.createElement("input");
      input.type="text";input.placeholder="/local/maison3d/"+key+".jpg";
      input.value=this._config.images?.[key]||"";
      input.addEventListener("change",()=>this._changed(key,input.value.trim(),true));
      images.append(label,input);
    }
  }
}
if(!customElements.get("maison3d-card-editor")) {
  customElements.define("maison3d-card-editor",Maison3DCardEditor);
}
