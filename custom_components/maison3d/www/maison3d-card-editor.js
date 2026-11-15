// Cache-busting: the ?v=<version> of this module's URL is passed to its own imports.
const VERSION=new URL(import.meta.url).searchParams.get("v")||"";
const V=VERSION?"?v="+encodeURIComponent(VERSION):"";
const [{allowedPhotoUrl,bundledPhoto,DEFAULT_MAIN_PHOTO,IMAGE_SLOTS,suggestedFileName},{uploadPhoto},{MEDIA_PREFIX},{sensorIssue,issueText,entityMatches,entityOptions,sourceLabel},{createHassTracker},{t,langOf,labelOf}]=await Promise.all(["./photo-source.js", "./storage-bridge.js", "./media-resolver.js", "./sensor-values.js", "./hass-tracker.js", "./i18n.js"].map(m=>import(m+V)));
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
  _language(){
    return langOf(this._hass?.locale?.language||this._hass?.language);
  }
  set hass(hass) {
    const firstStates=!this._hass?.states&&hass?.states;
    this._hass=hass;
    const lang=this._language();
    if(this._renderedLang&&this._renderedLang!==lang){this._render();return}
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
    const lang=this._language();
    const integration=this._tracker.diagnostic(states)?.attributes?.entities||{};
    this.shadowRoot.querySelectorAll(".entity-source").forEach(note=>{
      const key=note.dataset.key;
      const own=this._config[key];
      const id=own||integration[key]||"";
      note.textContent=own?"":id?t(lang,"ed_inherited",{id,source:sourceLabel("integration",lang)}):t(lang,"ed_empty_auto");
      note.hidden=Boolean(own);
    });
    this.shadowRoot.querySelectorAll(".sensor-warning").forEach(warn=>{
      const key=warn.dataset.key;
      const id=this._config[key]||integration[key]||"";
      const entity=id?states[id]:undefined;
      const issue=id?sensorIssue(key,entity):null;
      const text=issue?issueText({entity_id:id,issue,state:entity?String(entity.state).slice(0,40):null},key,lang):"";
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
    const lang=this._language();
    const tx=(key,vars)=>t(lang,key,vars);
    this._renderedLang=lang;
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
            input.setCustomValidity(tx("ed_height_invalid"));
            input.reportValidity();return;
          }
        }
        input.setCustomValidity("");this._changed(key,value);
      });
      parent.append(label,input);
    };
    const base=section(tx("ed_general"),tx("ed_general_help"));
    field(base,"project_name",tx("ed_project_name"),"Maison 3D");
    field(base,"title",tx("ed_title"),"Maison 3D");
    field(base,"height",tx("ed_height"),"440","number");
    const photoSection=section(tx("ed_photo_section"),tx("ed_photo_help"));
    const photoLabel=document.createElement("label");
    photoLabel.textContent=tx("ed_photo_url");
    const photoInput=document.createElement("input");
    photoInput.type="text";
    photoInput.placeholder="/local/maison3d/ma-maison.jpg";
    photoInput.value=this._config.base_image_url||"";
    const preview=document.createElement("img");
    preview.alt=tx("ed_photo_alt");
    preview.hidden=true;
    preview.style.cssText="display:block;max-width:100%;max-height:180px;object-fit:contain;border-radius:7px;margin-top:8px";
    const status=document.createElement("p");
    status.setAttribute("role","status");
    const button=document.createElement("button");
    button.type="button";button.textContent=tx("ed_check");
    const check=()=>{
      const value=photoInput.value.trim();
      if(value&&!editorUrl(value)){
        photoInput.setCustomValidity(tx("ed_url_invalid_detail"));
        photoInput.reportValidity();
        status.textContent=tx("ed_url_invalid");
        preview.hidden=true;return false;
      }
      photoInput.setCustomValidity("");
      return true;
    };
    photoInput.addEventListener("change",()=>{
      if(check()){this._changed("base_image_url",photoInput.value.trim());status.textContent=tx("ed_image_saved"); }
    });
    button.addEventListener("click",()=>{
      if(!check())return;
      const value=bundledPhoto(photoInput.value.trim())||DEFAULT_MAIN_PHOTO;
      if(value.startsWith(MEDIA_PREFIX)){status.textContent=tx("ed_media_preview");return}
      status.textContent=tx("ed_checking");preview.hidden=true;
      const probe=new Image();
      probe.onload=()=>{preview.src=value;preview.hidden=false;status.textContent=tx("ed_image_found");};
      probe.onerror=()=>{preview.hidden=true;status.textContent=tx("ed_image_missing");};
      probe.src=value;
    });
    photoSection.append(photoLabel,photoInput,button,status,preview);
    // Upload from this device or pick an image in « Médias » (no file copy needed).
    const setMain=value=>{photoInput.value=value;this._changed("base_image_url",value);status.textContent=tx("ed_image_saved");};
    photoSection.append(this._photoTools(value=>setMain(value),"ma-maison"));
    const effects=section(tx("ed_effects"),tx("ed_effects_help"));
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
    const inherit=tx("ed_inherit");
    toggle("effects_enabled",tx("ed_effects_toggle"),
      [["inherit",inherit],["on",tx("ed_effects_on")],["off",tx("ed_effects_off")]]);
    toggle("frost_enabled",tx("ed_frost_toggle"),
      [["inherit",inherit],["on",tx("ed_frost_on")],["off",tx("ed_frost_off")]]);
    toggle("weather_photos",tx("ed_photos_toggle"),
      [["inherit",inherit],["on",tx("ed_photos_on")],["off",tx("ed_photos_off")]]);


    const pickers=section(tx("ed_sensors"),tx("ed_sensors_help"));
    const entities=[
      ["weather_entity",tx("ed_weather"),["weather"]],
      ["sun_entity",tx("ed_sun"),["sun"]],
      ["moon_entity",tx("ed_moon"),["sensor"]],
      ["temperature_entity",tx("ed_temperature"),["sensor"]],
      ["wind_entity",tx("ed_wind"),["sensor"]],
      ["rain_entity",tx("ed_rain"),["sensor","binary_sensor"]],
      ["snow_entity",tx("ed_snow"),["sensor","binary_sensor"]],
      ["cloud_entity",tx("ed_cloud"),["sensor","binary_sensor"]]
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
        add("",tx("ed_inherit_picker"));
        for(const o of options[key])add(o.id,o.name===o.id?o.id:o.name+" — "+o.id);
        if(current&&!options[key].some(o=>o.id===current))add(current,tx("ed_not_found",{id:current}));
        add("__custom__",tx("ed_custom"));
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
    const images=section(tx("ed_images"),tx("ed_images_help"));
    const keys=IMAGE_SLOTS;
    const inputs=new Map();
    const slotLabel=document.createElement("label");slotLabel.textContent=tx("ed_send_for");
    const slot=document.createElement("select");
    for(const [key] of keys){const option=document.createElement("option");option.value=key;option.textContent=labelOf(lang,key);slot.append(option)}
    images.append(slotLabel,slot,this._photoTools(value=>{
      const input=inputs.get(slot.value);if(input)input.value=value;
      this._changed(slot.value,value,true);
    },()=>suggestedFileName(slot.value).replace(/\.jpg$/,"")));
    for(const [key] of keys){
      const label=document.createElement("label");label.textContent=labelOf(lang,key);
      const input=document.createElement("input");
      input.type="text";input.placeholder="/local/maison3d/"+suggestedFileName(key);
      input.value=this._config.images?.[key]||"";
      input.addEventListener("change",()=>{
        const value=input.value.trim();
        if(value&&!editorUrl(value)){input.setCustomValidity(tx("ed_url_invalid"));input.reportValidity();return}
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
  const lang=this._language();
  const upload=document.createElement("button");upload.type="button";upload.textContent=t(lang,"ed_upload");
  const info=document.createElement("span");info.className="help";info.setAttribute("role","status");
  const admin=this._hass?.user?.is_admin===true;
  upload.disabled=!admin;
  info.textContent=admin?t(lang,"ed_upload_admin"):t(lang,"ed_upload_need_admin");
  upload.addEventListener("click",()=>file.click());
  file.addEventListener("change",async()=>{
    const chosen=file.files?.[0];file.value="";if(!chosen)return;
    info.textContent=t(lang,"ed_uploading");upload.disabled=true;
    try{
      const result=await uploadPhoto(this._hass,chosen,typeof name==="function"?name():name);
      apply(result.url);info.textContent=t(lang,"ed_uploaded",{url:String(result.url).split("?")[0]});
    }catch(err){info.textContent=t(lang,"ed_upload_fail",{error:err?.message||err})}
    upload.disabled=false;
  });
  row.append(upload,file);
  // Home Assistant media picker, when the frontend provides it.
  if(customElements.get("ha-selector")){
    const picker=document.createElement("ha-selector");
    picker.hass=this._hass;picker.selector={media:{accept:["image/*"]}};picker.label=t(lang,"ed_pick_media");
    picker.addEventListener("value-changed",event=>{
      const id=event.detail?.value?.media_content_id;
      if(typeof id==="string"&&id.startsWith(MEDIA_PREFIX)){apply(id);info.textContent=t(lang,"ed_media_chosen");}
    });
    row.append(picker);
  }
  row.append(info);
  return row;
};
if(!customElements.get("maison3d-card-editor")) {
  customElements.define("maison3d-card-editor",Maison3DCardEditor);
}
