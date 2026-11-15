import {allowedPhotoUrl,bundledPhoto,DEFAULT_MAIN_PHOTO,IMAGE_SLOTS,suggestedFileName} from "./photo-source.js";
import {uploadPhoto} from "./storage-bridge.js";
import {MEDIA_PREFIX} from "./media-resolver.js";
import {sensorIssue,issueText,entityMatches,entityOptions,SOURCE_LABELS} from "./sensor-values.js";
import {createHassTracker} from "./hass-tracker.js";
const editorUrl=value=>allowedPhotoUrl(value)||(typeof value==="string"&&value.startsWith(MEDIA_PREFIX)&&value.length<500&&!/[\u0000-\u001f]/.test(value));
/**
 * Visual configuration editor for the custom Maison 3D Lovelace card.
 * Lets users choose their actual Home Assistant entities without knowing IDs.
 */
class Maison3DCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._tracker = createHassTracker();
    this.attachShadow({mode:"open"});
  }
  setConfig(config) {
    this._config = {...config, images:{...(config.images||{})}};
    this._render();
  }
  set hass(hass) {
    const firstStates=!this._hass?.states&&hass?.states;
    this._hass=hass;
    // Native selectors are filled from the states: build them again once they arrive.
    if(firstStates&&this._fallbackPickers){this._render();return}
    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach(picker => picker.hass=hass);
    this.shadowRoot.querySelectorAll(".tools ha-selector").forEach(picker => picker.hass=hass);
    this.shadowRoot.querySelectorAll(".tools > button").forEach(button => {button.disabled=hass?.user?.is_admin!==true});
    this._showSensorWarnings();
  }
  // Discreet warning under a chosen sensor: unknown value, unavailable, not found.
  _showSensorWarnings() {
    const states=this._hass?.states;
    if(!states||!this.shadowRoot)return;
    const integration=this._tracker.diagnostic(states)?.attributes?.entities||{};
    this.shadowRoot.querySelectorAll(".entity-source").forEach(note=>{
      const key=note.dataset.key;
      const own=this._config[key];
      const id=own||integration[key]||"";
      note.textContent=own?"":id?"Hérité : "+id+" — "+SOURCE_LABELS.integration:"Vide : détection automatique";
      note.hidden=Boolean(own);
    });
    this.shadowRoot.querySelectorAll(".sensor-warning").forEach(warn=>{
      const key=warn.dataset.key;
      const id=this._config[key]||integration[key]||"";
      const entity=id?states[id]:undefined;
      const issue=id?sensorIssue(key,entity):null;
      const text=issue?issueText({entity_id:id,issue,state:entity?String(entity.state).slice(0,40):null},key):"";
      warn.textContent=text;warn.hidden=!text;
    });
  }
  connectedCallback() {
    if(this._config)this._render();
  }
  _changed(key,value,image=false) {
    const next={...this._config,images:{...(this._config.images||{})}};
    if(image) {
      if(value)next.images[key]=value;
      else delete next.images[key];
    }else if(value===""||value===null){
      // Every option is optional: an empty field means « inherit » (integration or default).
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
      ".entity-source{display:block;margin-top:4px;font-size:11px;color:var(--secondary-text-color)}.entity-source[hidden]{display:none}",
      ".entity-fallback input[hidden]{display:none}.entity-fallback input{margin-top:6px}",
      ".sensor-warning{display:block;margin-top:4px;font-size:11px;color:var(--warning-color,#b26a00)}.sensor-warning[hidden]{display:none}",
      ".row{display:flex;align-items:center;gap:10px}",
      ".row input{width:auto;min-height:auto}",
      ".tools{flex-wrap:wrap;margin-top:8px}.tools button{padding:7px 10px;border-radius:7px;cursor:pointer}"
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
      input.value=String(this._config[key]??"");
      input.addEventListener("change",()=>{
        let value=input.value.trim();
        if(type==="number"&&value!==""){
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
    const base=section("Général","Tout est facultatif : une carte sans réglage reprend la configuration de l'intégration (Paramètres → Appareils et services → Maison 3D → Configurer). Un champ vide = hériter.");
    field(base,"project_name","Nom du projet (vide = celui de l’intégration, sinon « Maison 3D »)","Maison 3D");
    field(base,"title","Titre de la carte (vide = nom du projet)","Maison 3D");
    field(base,"height","Hauteur de la carte en px (vide = 440)","440","number");
    const photoSection=section("Image principale de la propriété",
      "Facultatif : cette photo reste fixe et reçoit les animations météo. Laissez vide pour hériter de l'image configurée dans l'intégration ou de la photo officielle.");
    const photoLabel=document.createElement("label");
    photoLabel.textContent="URL de l'image principale (surcharge de la carte)";
    const photoInput=document.createElement("input");
    photoInput.type="text";
    photoInput.placeholder="/local/maison3d/ma-maison.jpg";
    photoInput.value=this._config.base_image_url||"";
    const preview=document.createElement("img");
    preview.alt="Aperçu de l'image principale de la propriété";
    preview.hidden=true;
    preview.style.cssText="display:block;max-width:100%;max-height:180px;object-fit:contain;border-radius:7px;margin-top:8px";
    const status=document.createElement("p");
    status.setAttribute("role","status");
    const button=document.createElement("button");
    button.type="button";button.textContent="Vérifier et prévisualiser";
    const check=()=>{
      const value=photoInput.value.trim();
      if(value&&!editorUrl(value)){
        photoInput.setCustomValidity("URL invalide : /local/, /maison3d-assets/, /api/ ou HTTPS.");
        photoInput.reportValidity();
        status.textContent="URL invalide";
        preview.hidden=true;return false;
      }
      photoInput.setCustomValidity("");
      return true;
    };
    photoInput.addEventListener("change",()=>{
      if(check()){this._changed("base_image_url",photoInput.value.trim());status.textContent="Image enregistrée"; }
    });
    button.addEventListener("click",()=>{
      if(!check())return;
      const value=bundledPhoto(photoInput.value.trim())||DEFAULT_MAIN_PHOTO;
      if(value.startsWith(MEDIA_PREFIX)){status.textContent="Média Home Assistant : aperçu dans la carte";return}
      status.textContent="Vérification…";preview.hidden=true;
      const probe=new Image();
      probe.onload=()=>{preview.src=value;preview.hidden=false;status.textContent="Image trouvée";};
      probe.onerror=()=>{preview.hidden=true;status.textContent="Image inaccessible — image officielle utilisée en secours";};
      probe.src=value;
    });
    photoSection.append(photoLabel,photoInput,button,status,preview);
    // Upload from this device or pick an image in « Médias » (no file copy needed).
    const setMain=value=>{photoInput.value=value;this._changed("base_image_url",value);status.textContent="Image enregistrée";};
    photoSection.append(this._photoTools(value=>setMain(value),"ma-maison"));
    const effects=section("Animations et effets",
      "Laissez le réglage hérité de l’intégration, ou forcez les effets pour cette carte.");
    // Same three-state choice (inherit / on / off) for every effect toggle.
    const toggle=(key,labelText,choices)=>{
      const label=document.createElement("label");
      label.textContent=labelText;
      const select=document.createElement("select");
      for(const [value,text] of choices){
        const option=document.createElement("option");option.value=value;option.textContent=text;
        select.append(option);
      }
      select.value=this._config[key]===true?"on":this._config[key]===false?"off":"inherit";
      select.addEventListener("change",()=>{
        const value=select.value;
        const next={...this._config,images:{...(this._config.images||{})}};
        if(value==="inherit")delete next[key];
        else next[key]=value==="on";
        this._config=next;
        this.dispatchEvent(new CustomEvent("config-changed",{
          detail:{config:next},bubbles:true,composed:true
        }));
      });
      effects.append(label,select);
    };
    toggle("effects_enabled","Effets météo, saisons, lune et éclairages",
      [["inherit","Hériter de l’intégration"],["on","Activer les effets"],["off","Désactiver les effets"]]);
    toggle("frost_enabled","Effet gel (température ≤ 0 °C)",
      [["inherit","Hériter de l’intégration"],["on","Activer le gel"],["off","Désactiver le gel"]]);
    toggle("weather_photos","Photos météo jour/nuit",
      [["inherit","Hériter de l’intégration"],["on","Utiliser les photos météo"],["off","Photo principale + animations"]]);


    const pickers=section("Capteurs Home Assistant",
      "Facultatif : vide = entités choisies dans l'intégration, puis détection automatique (première entité weather.*, sun.sun, capteur de lune : id avec moon ou lune, ou phase reconnue).");
    const entities=[
      ["weather_entity","Météo actuelle",["weather"]],
      ["sun_entity","Soleil / jour et nuit",["sun"]],
      ["moon_entity","Phase de lune (ton module)",["sensor"]],
      ["temperature_entity","Température extérieure",["sensor"]],
      ["wind_entity","Vent / vitesse",["sensor"]],
      ["rain_entity","Pluie (intensité, présence ou vigilance Météo-France)",["sensor","binary_sensor"]],
      ["snow_entity","Neige (intensité, présence ou vigilance Météo-France)",["sensor","binary_sensor"]],
      ["cloud_entity","Nuages (pourcentage ou présence)",["sensor","binary_sensor"]]
    ];
    // Home Assistant's own picker (with search) when the frontend provides it,
    // filtered per field; otherwise a native selector + free typing.
    const nativePicker=customElements.get("ha-entity-picker");
    const options=nativePicker?null:entityOptions(this._hass?.states||{});
    this._fallbackPickers=!nativePicker;
    for(const [key,labelText,domains] of entities){
      const label=document.createElement("label");label.textContent=labelText;
      const inherited=document.createElement("small");
      inherited.className="entity-source";inherited.dataset.key=key;
      let control;
      if(nativePicker){
        control=document.createElement("ha-entity-picker");
        control.hass=this._hass;
        control.includeDomains=domains;
        control.entityFilter=entity=>entityMatches(key,entity);
        control.allowCustomEntity=true;
        control.value=this._config[key]??"";
        control.addEventListener("value-changed",event=>{
          this._changed(key,event.detail?.value||"");
          this._showSensorWarnings();
        });
      }else{
        control=document.createElement("div");control.className="entity-fallback";
        const select=document.createElement("select");
        const free=document.createElement("input");free.type="text";free.placeholder="sensor.exemple";
        const current=this._config[key]??"";
        const add=(value,text)=>{const o=document.createElement("option");o.value=value;o.textContent=text;select.append(o)};
        add("","Hériter de l'intégration / détection automatique");
        for(const o of options[key])add(o.id,o.name===o.id?o.id:o.name+" — "+o.id);
        if(current&&!options[key].some(o=>o.id===current))add(current,current+" (introuvable)");
        add("__custom__","✎ Autre (saisie libre)…");
        select.value=current;free.value=current;free.hidden=options[key].length>0;
        select.addEventListener("change",()=>{
          if(select.value==="__custom__"){free.hidden=false;free.focus();return}
          free.value=select.value;this._changed(key,select.value);this._showSensorWarnings();
        });
        free.addEventListener("change",()=>{this._changed(key,free.value.trim());this._showSensorWarnings()});
        control.append(select,free);
      }
      const warn=document.createElement("small");
      warn.className="sensor-warning";warn.dataset.key=key;warn.hidden=true;warn.setAttribute("role","status");
      pickers.append(label,control,inherited,warn);
    }
    this._showSensorWarnings();
    const images=section("Images personnalisées (facultatif)",
      "Utilisées quand les photos météo jour/nuit sont activées. Chaque URL est modifiable. Place les photos dans /config/www/maison3d/ puis renseigne par exemple /local/maison3d/neige-nuit.jpg. Ordre : image jour/nuit de la météo → image de la météo → image Jour ou Nuit → photo principale.");
    const keys=IMAGE_SLOTS;
    const inputs=new Map();
    const slotLabel=document.createElement("label");slotLabel.textContent="Envoyer ou choisir une image pour :";
    const slot=document.createElement("select");
    for(const [key,name] of keys){const option=document.createElement("option");option.value=key;option.textContent=name;slot.append(option)}
    images.append(slotLabel,slot,this._photoTools(value=>{
      const input=inputs.get(slot.value);if(input)input.value=value;
      this._changed(slot.value,value,true);
    },()=>suggestedFileName(slot.value).replace(/\.jpg$/,"")));
    for(const [key,name] of keys){
      const label=document.createElement("label");label.textContent=name;
      const input=document.createElement("input");
      input.type="text";input.placeholder="/local/maison3d/"+suggestedFileName(key);
      input.value=this._config.images?.[key]||"";
      input.addEventListener("change",()=>{
        const value=input.value.trim();
        if(value&&!editorUrl(value)){input.setCustomValidity("URL invalide");input.reportValidity();return}
        input.setCustomValidity("");this._changed(key,value,true);
      });
      inputs.set(key,input);
      images.append(label,input);
    }
  }
}
Maison3DCardEditor.prototype._photoTools=function(apply,name){
  const row=document.createElement("div");row.className="row tools";
  const file=document.createElement("input");file.type="file";file.accept="image/jpeg,image/png,image/webp";file.hidden=true;
  const upload=document.createElement("button");upload.type="button";upload.textContent="📤 Envoyer une photo…";
  const info=document.createElement("span");info.className="help";info.setAttribute("role","status");
  const admin=this._hass?.user?.is_admin===true;
  upload.disabled=!admin;
  info.textContent=admin?"Enregistrée dans /config/www/maison3d/":"Envoi : administrateur requis";
  upload.addEventListener("click",()=>file.click());
  file.addEventListener("change",async()=>{
    const chosen=file.files?.[0];file.value="";if(!chosen)return;
    info.textContent="Envoi…";upload.disabled=true;
    try{
      const result=await uploadPhoto(this._hass,chosen,typeof name==="function"?name():name);
      apply(result.url);info.textContent="Envoyée : "+String(result.url).split("?")[0];
    }catch(err){info.textContent="Échec : "+(err?.message||err)}
    upload.disabled=false;
  });
  row.append(upload,file);
  // Home Assistant media picker, when the frontend provides it.
  if(customElements.get("ha-selector")){
    const picker=document.createElement("ha-selector");
    picker.hass=this._hass;picker.selector={media:{accept:["image/*"]}};picker.label="Choisir dans Médias";
    picker.addEventListener("value-changed",event=>{
      const id=event.detail?.value?.media_content_id;
      if(typeof id==="string"&&id.startsWith(MEDIA_PREFIX)){apply(id);info.textContent="Média choisi";}
    });
    row.append(picker);
  }
  row.append(info);
  return row;
};
if(!customElements.get("maison3d-card-editor")) {
  customElements.define("maison3d-card-editor",Maison3DCardEditor);
}
