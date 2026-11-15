/**
 * Maison 3D photo-real view. Uses the owner's original screenshot as the
 * fixed original photo with dynamic weather, lunar and daylight overlays.
 * Other photographs are optional, never replacements by default.
 * This is a photo-based presentation, NOT a rotatable 3D reconstruction.
 */
import {createPhotoCinematics} from "./photo-cinematics.js";
import {createMoonOverlay} from "./moon-effects.js";
import {automaticSeason,haHour,SEASON_LABELS,createSeasonEffects} from "./season-effects.js";
import {DEFAULT_MAIN_PHOTO,allowedPhotoUrl,bundledPhoto,resolveMainPhoto,IMAGE_SLOTS,IMAGE_KEYS,pickWeatherPhoto,suggestedFileName,responsiveSrcset,photoSizes} from "./photo-source.js";
import {createFrostEffects,frostLevel,toCelsius} from "./frost-effects.js";
import {onHaData,saveToHa,uploadToHa} from "./ha-storage.js";
import {registerSection,markSaved,changed,createSaveControls,SAVE_STYLE} from "./draft.js";
import {MOTION_MODES,motionLevel,motionCount,motionMode,setMotionMode,systemReduced,onMotionChange,motionLocale} from "./motion-level.js";
import {cleanLights,cleanToggle,toggleAllowed,coverPercent,createLightOverlay,isLightEntity,langOf,say,DEFAULT_COLOR,MAX_LIGHTS,TOGGLE_MODES,LIGHT_STYLE} from "./lights.js";
import {moonPhase,weatherKind,issueText,toKmh,menuChoice,SOURCE_LABELS,ENTITY_KEYS as SENSOR_KEYS} from "./sensor-values.js";
export function createPhotoView({ensureScene=null}={}) {
  // ensureScene(): loads the 3D scene (three.js) on demand; the photo never needs it.
  const withScene=fn=>Promise.resolve(ensureScene?.()).then(fn,()=>{});
  const KEYS=IMAGE_KEYS;
  const LABELS={...Object.fromEntries(IMAGE_SLOTS),fog:"Brouillard",clear:"Clair",frost:"Gel"};
  // Weather/season ambiences selectable as a fixed (saved) ambience.
  const AMBIANCES=["day","night","cloudy","rain","snow","wind","storm","fog","spring","summer","autumn","winter"];
  const DEFAULT=DEFAULT_MAIN_PHOTO;
  const STORAGE="maison3d:photo-settings:v1";
  const allowedUrl=allowedPhotoUrl;
  const defaults=()=>Object.fromEntries(KEYS.map(k=>[k,""]));
  const state={
    images:defaults(),base_image_url:"",moon_entity:"",
    weather_entity:"",sun_entity:"",
    temperature_entity:"",wind_entity:"",rain_entity:"",snow_entity:"",cloud_entity:"",
    enabled:true,model_view:"3d",mode:"auto",effect:true,effect_override:null,frost:true,frost_override:null,frost_preview:false,season:"auto",effect_intensity:1,motion:"auto",moon_preview:"auto",use_weather_photos:false,weather_photos_override:null,
    // Outdoor lights (lights.js): [{entity_id,name,x,y,color,intensity}] + click to toggle (off by default).
    lights:[],light_toggle:"off"
  };
  // Apply saved settings (Home Assistant or this browser), keeping only valid values.
  const ENTITY_KEYS=["moon_entity","weather_entity","sun_entity","temperature_entity","wind_entity","rain_entity","snow_entity","cloud_entity"];
  function applySaved(saved){
    if(!saved||typeof saved!=="object")return;
    state.images=defaults();
      for(const k of KEYS){
        if(allowedUrl(saved.images?.[k]))state.images[k]=saved.images[k];
      }
      for(const key of ENTITY_KEYS){
        // "" = inherit; old placeholders (sensor.moon_phase, sun.sun) are not real choices.
        if(key in saved)state[key]=menuChoice(key,saved[key]);
      }
      if(allowedUrl(saved.base_image_url))state.base_image_url=saved.base_image_url;
      if(typeof saved.enabled==="boolean")state.enabled=saved.enabled;
      if(saved.model_view==="2d"||saved.model_view==="3d")state.model_view=saved.model_view;
      if(typeof saved.effect_override==="boolean")state.effect_override=saved.effect_override;
      if(typeof saved.frost_override==="boolean")state.frost_override=saved.frost_override;
      if(typeof saved.weather_photos_override==="boolean")state.weather_photos_override=saved.weather_photos_override;
      else if(!("weather_photos_override" in saved)&&saved.use_weather_photos===true)state.weather_photos_override=true; // before v2.3.9
      if(typeof state.weather_photos_override==="boolean")state.use_weather_photos=state.weather_photos_override;
      if(Number.isFinite(saved.effect_intensity))state.effect_intensity=Math.min(2,Math.max(0,saved.effect_intensity));
      if(typeof saved.motion==="string"&&MOTION_MODES.includes(saved.motion))state.motion=saved.motion;
      setMotionMode(state.motion);
      if(typeof saved.mode==="string"&&["auto",...AMBIANCES].includes(saved.mode))state.mode=saved.mode;
      if(typeof saved.season==="string"&&["auto","spring","summer","autumn","winter"].includes(saved.season))state.season=saved.season;
      state.lights=cleanLights(saved.lights);state.light_toggle=cleanToggle(saved.light_toggle);
      if(typeof saved.moon_preview==="string"&&["auto","new_moon","waxing_crescent","first_quarter","waxing_gibbous","full_moon","waning_gibbous","last_quarter","waning_crescent"].includes(saved.moon_preview))state.moon_preview=saved.moon_preview;
  }
  try{applySaved(JSON.parse(localStorage.getItem(STORAGE)))}catch{}
  setMotionMode(state.motion);
  // Saved in Home Assistant (shared) when possible; this browser keeps a cache / offline copy.
  const saveable=()=>{const copy={...state,images:{...state.images},lights:state.lights.map(l=>({...l}))};delete copy.frost_preview;delete copy.effect;delete copy.frost;return copy};
  // Draft: a change is shown immediately but only saved by « 💾 Enregistrer » (draft.js).
  const persist=()=>changed();
  const refreshers=[];
  const bind=(el,get,prop="value")=>{refreshers.push(()=>{el[prop]=get()});return el};
  const section=document.createElement("section");
  section.id="maison3d-photo-view";
  section.setAttribute("aria-label","Vue photographique de la propriété");
  const image=document.createElement("img");
  image.alt="Vue photographique validée de la propriété";
  image.decoding="async";
  const tint=document.createElement("div");
  tint.className="photo-light";
  const cinematicCanvas=document.createElement("canvas");
  cinematicCanvas.className="photo-cinematics";
  cinematicCanvas.setAttribute("aria-hidden","true");
  const seasonalCanvas=document.createElement("canvas");
  seasonalCanvas.className="season-overlay";
  seasonalCanvas.setAttribute("aria-hidden","true");
  const canvas=document.createElement("canvas");
  canvas.setAttribute("aria-hidden","true");
  const ctx=canvas.getContext("2d");
  const frostCanvas=document.createElement("canvas");
  frostCanvas.className="frost-overlay";
  frostCanvas.setAttribute("aria-hidden","true");
  const status=document.createElement("div");
  status.id="maison3d-photo-status";
  status.setAttribute("role","status");
  const moon=document.createElement("div");
  moon.className="moon-phase";
  const error=document.createElement("div");
  error.className="photo-error";error.hidden=true;
  error.textContent="Image inaccessible : corrigez son URL dans les réglages Photo.";
  section.append(image,tint,cinematicCanvas,seasonalCanvas,canvas,frostCanvas,status,moon,error);
  // Outdoor lights: halos (night, entity on) over the photo and its night / weather layers.
  const lightOverlay=createLightOverlay({container:section,image,after:frostCanvas,onToggle:id=>requestToggle(id)});
  const placingBanner=document.createElement("div");
  placingBanner.className="light-placing";placingBanner.hidden=true;placingBanner.setAttribute("role","status");
  section.append(placingBanner);
  const frost=createFrostEffects(frostCanvas);
  const seasonalEffects=createSeasonEffects(seasonalCanvas);
  const skyMoon=createMoonOverlay({container:section});
  const cinematics=createPhotoCinematics(cinematicCanvas);
  const nav=document.createElement("nav");
  nav.id="maison3d-photo-controls";
  const photoBtn=document.createElement("button");
  photoBtn.type="button";photoBtn.textContent="▣ Photo réelle";
  const modelBtn=document.createElement("button");
  modelBtn.type="button";modelBtn.textContent="⬡ 3D éditable";
  const planBtn=document.createElement("button");
  planBtn.type="button";planBtn.textContent="▤ Plan 2D";
  planBtn.title="Afficher le plan de dessus du modèle, revenir à la photo à tout moment";
  const optionsBtn=document.createElement("button");
  optionsBtn.type="button";optionsBtn.textContent="⚙ Images / météo";
  const nightBtn=document.createElement("button");
  nightBtn.type="button";nightBtn.textContent="☾ Nuit réelle";
  nightBtn.title="Prévisualiser immédiatement la nuit sur la photo";
  const dayBtn=document.createElement("button");
  dayBtn.type="button";dayBtn.textContent="☀ Jour";
  dayBtn.title="Prévisualiser immédiatement le jour sur la photo";
  const autoBtn=document.createElement("button");
  autoBtn.type="button";autoBtn.textContent="◉ Auto";
  autoBtn.title="Utiliser le soleil et la météo réels de Home Assistant";
  const effectsBtn=document.createElement("button");
  effectsBtn.type="button";effectsBtn.title="Activer ou désactiver les effets animés";
  // « 💾 Enregistrer / ↶ Annuler » in the bar shared by the photo, the 2D plan and the 3D view.
  const saveControls=createSaveControls();
  nav.append(photoBtn,planBtn,modelBtn,nightBtn,dayBtn,autoBtn,effectsBtn,optionsBtn,saveControls);
  // Lovelace card: the bottom bar folds into one « ☰ Menu » button (folded by default on a
  // narrow card or a phone). Display state only: never a change for « 💾 Enregistrer »;
  // the choice is remembered in this browser like the other navigation states.
  const BAR_KEY="maison3d:card-bar:v1";
  const barToggle=document.createElement("button");
  barToggle.type="button";barToggle.className="bar-toggle";
  barToggle.setAttribute("aria-controls","maison3d-photo-controls");
  const narrowCard=()=>innerWidth<=600||(Math.min(screen.width,screen.height)<=600&&matchMedia("(pointer:coarse)").matches);
  let barChoice=null;
  try{const v=localStorage.getItem(BAR_KEY);if(v==="collapsed"||v==="expanded")barChoice=v}catch{}
  const setBar=collapsed=>{
    nav.classList.toggle("collapsed",collapsed);
    barToggle.textContent=collapsed?"☰ Menu":"▾ Réduire";
    barToggle.title=collapsed?"Afficher la barre de commandes":"Réduire la barre de commandes";
    barToggle.setAttribute("aria-expanded",String(!collapsed));
  };
  setBar(barChoice?barChoice==="collapsed":narrowCard());
  // Until the user chooses, follow the card width (Lovelace may resize it after loading).
  addEventListener("resize",()=>{if(!barChoice)setBar(narrowCard())});
  barToggle.addEventListener("click",()=>{
    const collapsed=!nav.classList.contains("collapsed");setBar(collapsed);
    barChoice=collapsed?"collapsed":"expanded";
    try{localStorage.setItem(BAR_KEY,barChoice)}catch{}
  });
  nav.prepend(barToggle);
  // Seasons live in the bottom/bar controls (no column on the photo): buttons on
  // a row of their own when there is room, a compact « Saison » selector otherwise.
  const seasonalNav=document.createElement("div");
  seasonalNav.id="maison3d-photo-seasons";
  seasonalNav.setAttribute("role","group");
  seasonalNav.setAttribute("aria-label","Tester les saisons de la vue photo");
  const seasonButtons=new Map();
  const SEASON_CHOICES=[
    ["spring","🌸 Printemps"],["summer","☀ Été"],
    ["autumn","🍂 Automne"],["winter","❄ Hiver"],["auto","◉ Saisons auto"]
  ];
  const chooseSeason=key=>{
    state.enabled=true;state.season=key;
    state.mode=key==="auto"?"auto":key;
    selectMode.value=state.mode;
    seasonSelect.value=key;
    persist();update();
  };
  for(const [key,label] of SEASON_CHOICES){
    const btn=document.createElement("button");
    btn.type="button";btn.textContent=label;
    btn.title="Tester : "+label;
    btn.addEventListener("click",()=>chooseSeason(key));
    seasonalNav.append(btn);seasonButtons.set(key,btn);
  }
  const seasonPickLabel=document.createElement("label");
  seasonPickLabel.className="season-select";
  const seasonPick=document.createElement("select");
  seasonPick.setAttribute("aria-label","Saison");
  for(const [key,label] of SEASON_CHOICES){
    const option=document.createElement("option");option.value=key;option.textContent=label;seasonPick.append(option);
  }
  seasonPick.addEventListener("change",()=>chooseSeason(seasonPick.value));
  seasonPickLabel.append(seasonPick);
  seasonalNav.append(seasonPickLabel);
  const seasonBreak=document.createElement("span");
  seasonBreak.className="row-break";seasonBreak.setAttribute("aria-hidden","true");
  nav.append(seasonBreak,seasonalNav);
  const TEST_WEATHERS=[["clear","☀ Clair"],["cloudy","☁ Nuageux"],["rain","🌧 Pluie"],
    ["storm","⚡ Orage (éclairs)"],["snow","❄ Neige"],["wind","💨 Vent"],["fog","🌫 Brouillard"],["frost","🧊 Gel"]];
  const test={weather:"auto",time:"auto"};
  const testing=()=>test.weather!=="auto"||test.time!=="auto";
  function setTest(change){
    Object.assign(test,change);state.enabled=true;
    testWeatherSelect.value=test.weather;testTimeSelect.value=test.time;
    update();
  }
  const settings=document.createElement("section");
  settings.id="maison3d-photo-settings";settings.hidden=true;
  const head=document.createElement("div");
  head.className="settings-head";
  const h=document.createElement("strong");h.textContent="Images et saisons personnalisées";
  const close=document.createElement("button");close.type="button";close.textContent="✕ Fermer";
  head.append(h,createSaveControls({compact:true}),close);settings.append(head);
  const note=document.createElement("p");note.textContent=
    "Image principale personnalisable : une photo de votre maison. Les effets météo, lune et saisons se dessinent sur cette photo. Laissez vide pour la configuration Home Assistant ou la photo officielle.";
  settings.append(note);
  const makeField=(title,value,onChange,placeholder="")=>{
    const label=document.createElement("label");
    label.textContent=title;
    const input=document.createElement("input");
    input.type="text";input.value=value;input.placeholder=placeholder;
    input.addEventListener("change",()=>onChange(input.value.trim(),input));
    label.appendChild(input);settings.append(label);return input;
  };
  const selectField=(title,options,value,fn)=>{
    const label=document.createElement("label");label.textContent=title;
    const sel=document.createElement("select");
    for(const [key,name] of options){
      const option=document.createElement("option");option.value=key;option.textContent=name;sel.append(option);
    }
    sel.value=value;sel.addEventListener("change",()=>fn(sel.value));label.append(sel);
    settings.append(label);return sel;
  };
  const mainPhotoInput=makeField("Image principale personnalisée (facultatif)",
    state.base_image_url,(value,input)=>{
      if(value&&!allowedUrl(value)){
        input.setCustomValidity("Utilise /local/…, /maison3d-media/…, /maison3d-assets/…, /api/… ou HTTPS.");
        input.reportValidity();return;
      }
      input.setCustomValidity("");
      state.base_image_url=value;
      failedImages.delete(value);
      persist();update();
      imageCheck.textContent=value?"Image modifiée · prévisualisation conseillée · 💾 Enregistrer pour la garder":"Image principale par défaut";
    },"/local/maison3d/ma-maison.jpg");
  bind(mainPhotoInput,()=>state.base_image_url);
  const previewRow=document.createElement("div");
  previewRow.className="main-photo-preview";
  const previewBtn=document.createElement("button");
  previewBtn.type="button";previewBtn.textContent="Vérifier et prévisualiser";
  const imageCheck=document.createElement("span");
  imageCheck.setAttribute("role","status");
  imageCheck.textContent="Vérifiez l'image pour contrôler son accès.";
  const previewThumbnail=document.createElement("img");
  previewThumbnail.alt="Aperçu de l'image principale";
  previewThumbnail.hidden=true;
  previewBtn.addEventListener("click",()=>{
    const candidate=mainPhotoInput.value.trim();
    if(candidate&&!allowedUrl(candidate)){
      imageCheck.textContent="URL invalide";previewThumbnail.hidden=true;return;
    }
    const target=bundledPhoto(candidate)||resolveMainPhoto({parent:parentBasePhoto,isCard:isCardView});
    imageCheck.textContent="Vérification en cours…";
    previewThumbnail.hidden=true;
    const probe=new Image();
    probe.onload=()=>{
      imageCheck.textContent="Image trouvée";
      previewThumbnail.src=target;previewThumbnail.hidden=false;
      failedImages.delete(target);
    };
    probe.onerror=()=>{
      imageCheck.textContent="Image inaccessible — photo officielle utilisée";
      previewThumbnail.hidden=true;
      failedImages.add(target);
      update();
    };
    probe.src=target;
  });
  previewRow.append(previewBtn,imageCheck,previewThumbnail);
  settings.append(previewRow);
  // Upload a photo from this device into /config/www/maison3d/ (administrators).
  const uploadBox=document.createElement("fieldset");uploadBox.className="maison3d-upload";
  const uploadLegend=document.createElement("legend");uploadLegend.textContent="📤 Envoyer une photo depuis cet appareil";
  const uploadSlot=document.createElement("select");uploadSlot.setAttribute("aria-label","Photo à remplacer");
  for(const [key,name] of [["main","Image principale"],...IMAGE_SLOTS]){
    const option=document.createElement("option");option.value=key;option.textContent=name;uploadSlot.append(option);
  }
  const uploadFile=document.createElement("input");uploadFile.type="file";uploadFile.accept="image/jpeg,image/png,image/webp";uploadFile.hidden=true;
  const uploadBtn=document.createElement("button");uploadBtn.type="button";uploadBtn.textContent="Choisir et envoyer…";uploadBtn.disabled=true;
  const uploadStatus=document.createElement("span");uploadStatus.setAttribute("role","status");
  uploadStatus.textContent="Disponible dans Home Assistant pour les administrateurs.";
  uploadBtn.addEventListener("click",()=>uploadFile.click());
  uploadFile.addEventListener("change",async()=>{
    const file=uploadFile.files?.[0];uploadFile.value="";
    if(!file)return;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){uploadStatus.textContent="Format refusé : jpg, png ou webp.";return}
    if(file.size>10*1024*1024){uploadStatus.textContent="Fichier trop gros (10 Mo max).";return}
    const slot=uploadSlot.value;
    uploadStatus.textContent="Envoi de "+file.name+"…";uploadBtn.disabled=true;
    const result=await uploadToHa(file,slot==="main"?"ma-maison":suggestedFileName(slot).replace(/\.jpg$/,""));
    uploadBtn.disabled=false;
    if(!result.ok||!allowedUrl(result.url)){uploadStatus.textContent="Échec de l'envoi : "+(result.error||"réponse invalide");return}
    if(slot==="main"){state.base_image_url=result.url;failedImages.delete(result.url)}
    else{state.images[slot]=result.url;state.use_weather_photos=true;state.weather_photos_override=true;swapPhotos.checked=true}
    for(const refresh of refreshers)refresh();
    persist();update();
    // The file is on the server (explicit upload); using it is part of the draft.
    uploadStatus.textContent="Photo envoyée : "+result.url.split("?")[0]+" · 💾 Enregistrer pour l'utiliser";
  });
  uploadBox.append(uploadLegend,uploadSlot,uploadBtn,uploadFile,uploadStatus);
  settings.append(uploadBox);
  onHaData((ha,{canSave})=>{
    uploadBtn.disabled=!canSave;
    uploadStatus.textContent=canSave?"La photo est enregistrée dans /config/www/maison3d/ (jpg, png, webp · 10 Mo max).":
      "Envoi de photos : administrateur Home Assistant requis.";
  });
  // Discreet warning under a sensor field (unknown value, unavailable…); never on the photo.
  const sensorWarnings=new Map();
  const warnable=(key,input)=>{
    const warn=document.createElement("small");
    warn.className="sensor-warning";warn.dataset.key=key;warn.hidden=true;warn.setAttribute("role","status");
    input.parentElement.append(warn);sensorWarnings.set(key,warn);return input;
  };
  // Entity selectors: candidates sent by the card / panel (filtered per field),
  // « Automatique » = effective value (card → menu → integration → detection),
  // free typing as a fallback. The source of the value in use is always shown.
  const entityFields=new Map();
  let entityOptions=null,effective={};
  const CUSTOM="__custom__";
  function entityField(key,title,placeholder){
    const label=document.createElement("label");
    label.className="entity-field";label.dataset.key=key;
    label.append(document.createTextNode(title));
    const used=document.createElement("small");used.className="entity-source";
    const search=document.createElement("input");
    search.type="search";search.className="entity-search";search.placeholder="🔍 Rechercher (nom ou entity_id)";search.hidden=true;
    const select=document.createElement("select");select.className="entity-select";
    const input=document.createElement("input");
    input.type="text";input.className="entity-free";input.placeholder=placeholder;input.value=state[key];input.hidden=true;
    label.append(used,search,select,input);settings.append(label);
    const field={label,used,search,select,input,signature:""};
    const choose=value=>{state[key]=menuChoice(key,value);persist();requestEntities();renderEntityField(key,true)};
    select.addEventListener("change",()=>{
      if(select.value===CUSTOM){input.hidden=false;input.focus();return}
      input.value=select.value;choose(select.value);
    });
    input.addEventListener("change",()=>choose(input.value));
    search.addEventListener("input",()=>renderEntityField(key,true));
    entityFields.set(key,field);
    warnable(key,input);
    bind(input,()=>state[key]);
    renderEntityField(key,true);
  }
  const describe=item=>{
    if(!item?.entity_id)return "aucune entité";
    const found=entityOptions?.[item.key]?.find(o=>o.id===item.entity_id);
    return (found&&found.name!==item.entity_id?found.name+" · ":"")+item.entity_id;
  };
  function renderEntityField(key,force=false){
    const field=entityFields.get(key);if(!field)return;
    const item={...(effective[key]||{entity_id:"",source:"none"}),key};
    const options=entityOptions?.[key]||[];
    const term=field.search.value.trim().toLowerCase();
    const signature=JSON.stringify([item,state[key],options.length,term,entityOptions?1:0]);
    if(!force&&signature===field.signature)return;
    field.signature=signature;
    const byCard=item.source==="card";
    field.used.textContent=item.entity_id
      ?"Utilisée : "+describe(item)+" — "+(SOURCE_LABELS[item.source]||item.source)
      :"Aucune entité utilisée";
    const opts=[];
    const add=(value,text)=>{const o=document.createElement("option");o.value=value;o.textContent=text;opts.push(o)};
    const inherited=state[key]?null:item;
    // Short label (the full name, entity_id and source are written just above).
    const SHORT={integration:"intégration",auto:"détection auto",default:"défaut"};
    const shortName=it=>entityOptions?.[key]?.find(o=>o.id===it.entity_id)?.name||it.entity_id;
    add("","Automatique"+(inherited?.entity_id&&!byCard?" · "+shortName(inherited)+" ("+(SHORT[inherited.source]||inherited.source)+")":
      byCard?" (valeur de la carte)":""));
    const shown=options.filter(o=>!term||o.name.toLowerCase().includes(term)||o.id.includes(term));
    for(const o of shown)add(o.id,o.name===o.id?o.id:o.name+" — "+o.id);
    if(state[key]&&!options.some(o=>o.id===state[key]))add(state[key],state[key]+(entityOptions?" (introuvable)":""));
    add(CUSTOM,"✎ Autre (saisie libre)…");
    field.select.replaceChildren(...opts);
    field.select.value=state[key]||"";
    field.select.disabled=byCard;
    field.select.title=byCard?"Imposée par la carte : la modifier dans l'éditeur de la carte":"";
    field.search.hidden=options.length<=8;
    // Free typing only as a fallback: no candidate, or a value outside the list.
    if(document.activeElement!==field.input)
      field.input.hidden=Boolean(entityOptions)&&options.length>0&&(!state[key]||options.some(o=>o.id===state[key]));
    field.input.value=state[key];
  }
  function requestEntityOptions(){
    if(window.parent!==window)window.parent.postMessage({type:"maison3d:entity-options-request"},window.location.origin);
  }
  entityField("weather_entity","Entité météo","weather.ma_maison");
  entityField("sun_entity","Entité soleil","sun.sun");
  entityField("moon_entity","Entité lune","sensor.phase_de_la_lune");
  entityField("temperature_entity","Capteur température extérieure","sensor.temperature_exterieure");
  entityField("wind_entity","Capteur vitesse du vent","sensor.vent");
  entityField("rain_entity","Capteur pluie (valeur, on/off ou vigilance)","sensor.alerte_pluie_inondation");
  entityField("snow_entity","Capteur neige (valeur, on/off ou vigilance)","sensor.alerte_neige_verglas");
  entityField("cloud_entity","Capteur nuages (pourcentage ou on/off)","sensor.nuages");
  const selectMode=selectField("Ambiance",[
    ["auto","Automatique (Home Assistant)"],...AMBIANCES.map(k=>[k,LABELS[k]])
  ],state.mode,v=>{state.mode=v;persist();update();});
  const seasonSelect=selectField("Saison",[
    ["auto","Automatique (calendrier)"],
    ["spring","Printemps"],["summer","Été"],["autumn","Automne"],["winter","Hiver"]
  ],state.season,v=>{
    state.season=v;
    state.enabled=true;
    if(v!=="auto"){state.mode=v;selectMode.value=v}
    else{state.mode="auto";selectMode.value="auto"}
    persist();update();
  });
  const testSection=document.createElement("fieldset");
  testSection.className="maison3d-test-states";
  const legend=document.createElement("legend");
  legend.textContent="Tester chaque état (sans changer les capteurs)";
  testSection.append(legend);
  // Test mode: forces a weather and/or day/night over the real Home Assistant data.
  // (The season « Tester » buttons below change the saved season: part of the draft.)
  // Kept in memory only (never saved): a reload or « Revenir à la météo réelle » ends it.
  const testWeatherSelect=selectField("Météo forcée",[["auto","Météo réelle (Home Assistant)"],
    ...TEST_WEATHERS.map(([key,label])=>[key,label])],test.weather,v=>setTest({weather:v}));
  const testTimeSelect=selectField("Moment forcé",[["auto","Heure réelle (soleil Home Assistant)"],
    ["day","☀ Jour"],["night","☾ Nuit"]],test.time,v=>setTest({time:v}));
  testSection.append(testWeatherSelect.parentElement,testTimeSelect.parentElement);
  const testGrid=document.createElement("div");testGrid.className="test-grid";
  const testButtons=new Map(),timeButtons=new Map();
  for(const [key,label] of TEST_WEATHERS){
    const btn=document.createElement("button");
    btn.type="button";btn.textContent=label;btn.dataset.testWeather=key;
    btn.addEventListener("click",()=>setTest({weather:test.weather===key?"auto":key}));
    testGrid.append(btn);testButtons.set(key,btn);
  }
  for(const [key,label] of [["day","☀ Forcer le jour"],["night","☾ Forcer la nuit"]]){
    const btn=document.createElement("button");
    btn.type="button";btn.textContent=label;btn.dataset.testTime=key;
    btn.addEventListener("click",()=>setTest({time:test.time===key?"auto":key}));
    testGrid.append(btn);timeButtons.set(key,btn);
  }
  const seasonTests=new Map();
  for(const [key,label] of [["spring","🌸 Printemps"],["summer","☀ Été"],["autumn","🍂 Automne"],["winter","❄ Hiver"]]){
    const btn=document.createElement("button");
    btn.type="button";btn.textContent=label;
    btn.addEventListener("click",()=>{
      state.enabled=true;state.season=key;seasonSelect.value=key;persist();update();
    });
    testGrid.append(btn);seasonTests.set(key,btn);
  }
  testSection.append(testGrid);
  // Frost can also be added on top of any other test weather.
  const frostTest=document.createElement("button");
  frostTest.type="button";frostTest.textContent="🧊 Ajouter le gel";
  frostTest.addEventListener("click",()=>{
    state.enabled=true;state.frost_preview=!state.frost_preview;update();
  });
  testGrid.append(frostTest);
  const moonPreview=selectField("Tester la phase de lune (jour ou nuit)",[
    ["auto","Depuis le capteur Home Assistant"],
    ["new_moon","Nouvelle lune"],["waxing_crescent","Premier croissant"],
    ["first_quarter","Premier quartier"],["waxing_gibbous","Gibbeuse croissante"],
    ["full_moon","Pleine lune"],["waning_gibbous","Gibbeuse décroissante"],
    ["last_quarter","Dernier quartier"],["waning_crescent","Dernier croissant"]
  ],state.moon_preview,v=>{state.moon_preview=v;persist();update();});
  // Move the lunar selector below the test controls in the settings panel.
  const moonLabel=moonPreview.parentElement;
  testSection.append(moonLabel);
  const resetTest=document.createElement("button");
  resetTest.type="button";resetTest.textContent="◉ Revenir à la météo réelle";
  resetTest.addEventListener("click",()=>{
    state.mode="auto";state.season="auto";state.moon_preview="auto";state.frost_preview=false;
    test.weather="auto";test.time="auto";testWeatherSelect.value="auto";testTimeSelect.value="auto";
    state.enabled=true;selectMode.value="auto";seasonSelect.value="auto";
    moonPreview.value="auto";persist();update();
  });
  testSection.append(resetTest);settings.append(testSection);
  // 💡 Outdoor lights: add / remove light.* or switch.*, name, halo colour, intensity,
  // position by a click on the photo, optional click to toggle. Everything is a draft change.
  let lang="fr",lightCandidates=null,lightLive={},userIsAdmin=false,placing=null,lightNotice="";
  const lightsBox=document.createElement("fieldset");lightsBox.className="maison3d-lights-settings";
  const lightsLegend=document.createElement("legend");
  const lightsNote=document.createElement("p");
  const lightAdd=document.createElement("div");lightAdd.className="light-add";
  const lightPick=document.createElement("select");lightPick.className="light-pick";
  const lightAddBtn=document.createElement("button");lightAddBtn.type="button";lightAddBtn.className="light-add-btn";
  lightAdd.append(lightPick,lightAddBtn);
  const lightList=document.createElement("div");lightList.className="light-list";
  const toggleLabel=document.createElement("label");
  const toggleText=document.createTextNode("");
  const toggleSelect=document.createElement("select");toggleSelect.className="light-toggle";
  toggleLabel.append(toggleText,toggleSelect);
  const lightStatus=document.createElement("small");lightStatus.className="light-status";lightStatus.setAttribute("role","status");
  lightsBox.append(lightsLegend,lightsNote,lightAdd,lightList,toggleLabel,lightStatus);
  settings.append(lightsBox);
  const lightChanged=()=>{persist();watchLights();renderLightSettings();renderLights()};
  lightAddBtn.addEventListener("click",()=>{
    const id=lightPick.value;
    if(!isLightEntity(id)||state.lights.some(l=>l.entity_id===id))return;
    if(state.lights.length>=MAX_LIGHTS){lightNotice=say(lang,"full");renderLightSettings();return}
    const name=lightCandidates?.find(o=>o.id===id)?.name;
    state.lights=cleanLights([...state.lights,{entity_id:id,name:name&&name!==id?name:"",x:50,y:50,color:DEFAULT_COLOR,intensity:1}]);
    lightChanged();
    startPlacing(id);
  });
  toggleSelect.addEventListener("change",()=>{state.light_toggle=cleanToggle(toggleSelect.value);lightChanged()});
  function renderLightSettings(){
    lightsLegend.textContent=say(lang,"legend");lightsNote.textContent=say(lang,"note");
    lightAddBtn.textContent=say(lang,"add");toggleText.textContent=say(lang,"toggle");
    const used=new Set(state.lights.map(l=>l.entity_id));
    const free=(lightCandidates||[]).filter(o=>!used.has(o.id));
    const first=document.createElement("option");first.value="";first.textContent=say(lang,"choose");
    lightPick.replaceChildren(first,...free.map(o=>{const opt=document.createElement("option");opt.value=o.id;opt.textContent=o.name===o.id?o.id:o.name+" — "+o.id;return opt}));
    lightAddBtn.disabled=!free.length||state.lights.length>=MAX_LIGHTS;
    toggleSelect.replaceChildren(...TOGGLE_MODES.map(mode=>{const opt=document.createElement("option");opt.value=mode;
      opt.textContent=say(lang,{off:"toggleOff",admins:"toggleAdmins",users:"toggleUsers"}[mode]);return opt}));
    toggleSelect.value=state.light_toggle;
    lightStatus.textContent=lightNotice;lightStatus.hidden=!lightNotice;
    const focused=document.activeElement;
    if(focused&&lightList.contains(focused)&&focused.type==="text")return; // typing a name
    if(!state.lights.length){const empty=document.createElement("small");empty.textContent=say(lang,"none");lightList.replaceChildren(empty);return}
    lightList.replaceChildren(...state.lights.map(light=>{
      const row=document.createElement("div");row.className="light-row";row.dataset.entity=light.entity_id;
      const live=lightLive[light.entity_id];
      const id=document.createElement("span");id.className="light-id";
      id.textContent=light.entity_id+" · "+say(lang,live?.state==="on"?"on":live?.state==="off"?"off":live?.state==="missing"||!live?"missing":"unavailable")+
        " · "+say(lang,"position")+" "+light.x+" % / "+light.y+" %";
      const nameLabel=document.createElement("label");nameLabel.textContent=say(lang,"name");
      const name=document.createElement("input");name.type="text";name.className="light-name";name.maxLength=60;
      name.value=light.name;name.placeholder=live?.name||light.entity_id;
      name.addEventListener("change",()=>{light.name=name.value.trim().slice(0,60);persist();renderLights()});
      nameLabel.append(name);
      const colorLabel=document.createElement("label");colorLabel.textContent=say(lang,"color")+" ";
      const color=document.createElement("input");color.type="color";color.className="light-color";color.value=light.color;
      color.addEventListener("input",()=>{light.color=color.value.toLowerCase();persist();renderLights()});
      colorLabel.append(color);
      const intensityLabel=document.createElement("label");intensityLabel.textContent=say(lang,"intensity")+" ";
      const intensity=document.createElement("input");intensity.type="range";intensity.className="light-intensity";
      intensity.min="0.2";intensity.max="2";intensity.step="0.1";intensity.value=String(light.intensity);
      const pct=document.createElement("span");pct.textContent=Math.round(light.intensity*100)+" %";
      intensity.addEventListener("input",()=>{light.intensity=Number(intensity.value);pct.textContent=Math.round(light.intensity*100)+" %";persist();renderLights()});
      intensityLabel.append(intensity,pct);
      const actions=document.createElement("div");actions.className="light-actions";
      const place=document.createElement("button");place.type="button";place.className="light-place";place.textContent=say(lang,"place");
      place.addEventListener("click",()=>startPlacing(light.entity_id));
      const remove=document.createElement("button");remove.type="button";remove.className="light-remove";remove.textContent=say(lang,"remove");
      remove.addEventListener("click",()=>{state.lights=state.lights.filter(l=>l.entity_id!==light.entity_id);if(placing===light.entity_id)stopPlacing();lightChanged()});
      actions.append(place,remove);
      row.append(id,nameLabel,colorLabel,intensityLabel,actions);
      return row;
    }));
  }
  // Placement: the settings close, the next click / tap on the photo sets x / y (in % of the photo).
  function startPlacing(id){
    const light=state.lights.find(l=>l.entity_id===id);if(!light)return;
    placing=id;settings.hidden=true;
    placingBanner.textContent=say(lang,"placing",{name:light.name||lightLive[id]?.name||id});
    placingBanner.hidden=false;section.classList.add("placing-light");
    document.documentElement.classList.add("placing-light");renderLights();
  }
  function stopPlacing(reopen=true){
    if(!placing)return;
    placing=null;placingBanner.hidden=true;section.classList.remove("placing-light");
    document.documentElement.classList.remove("placing-light");
    if(reopen)settings.hidden=false;
    renderLights();
  }
  section.addEventListener("click",event=>{
    if(!placing)return;
    const r=section.getBoundingClientRect();
    const point=coverPercent(event.clientX-r.left,event.clientY-r.top,{naturalWidth:image.naturalWidth||1286,
      naturalHeight:image.naturalHeight||914,width:r.width,height:r.height});
    const light=state.lights.find(l=>l.entity_id===placing);
    if(light){light.x=point.x;light.y=point.y;persist()}
    stopPlacing();renderLightSettings();
  });
  addEventListener("keydown",event=>{if(event.key==="Escape"&&placing)stopPlacing()});
  function renderLights(){
    const clickable=!placing&&state.enabled&&toggleAllowed(state.light_toggle,userIsAdmin)&&window.parent!==window;
    lightOverlay.render({lights:state.lights,live:lightLive,night:isNight(),markers:Boolean(placing)||!settings.hidden,clickable,lang});
  }
  // The card / panel sends the state of these entities (light_states) with the conditions.
  let lastWatch="";
  function watchLights(force=false){
    if(window.parent===window)return;
    const message={type:"maison3d:lights-watch",entity_ids:state.lights.map(l=>l.entity_id),toggle:state.light_toggle};
    const key=JSON.stringify(message);
    if(!force&&key===lastWatch)return;
    lastWatch=key;
    window.parent.postMessage(message,window.location.origin);
  }
  function requestToggle(id){
    if(!toggleAllowed(state.light_toggle,userIsAdmin)||window.parent===window)return;
    window.parent.postMessage({type:"maison3d:light-toggle",entity_id:id},window.location.origin);
  }
  renderLightSettings();
  for(const key of KEYS){
    bind(makeField("Image "+LABELS[key],state.images[key],(v,input)=>{
      if(v&&!allowedUrl(v)){input.setCustomValidity("Utilise /local/…, /maison3d-media/…, /maison3d-assets/…, /api/… ou HTTPS.");input.reportValidity();return}
      input.setCustomValidity("");state.images[key]=v;persist();update();
    },"/local/maison3d/"+suggestedFileName(key)),()=>state.images[key]);
  }
  const swapLabel=document.createElement("label");swapLabel.className="checkbox";
  const swapPhotos=document.createElement("input");swapPhotos.type="checkbox";
  swapPhotos.checked=state.use_weather_photos;
  swapPhotos.addEventListener("change",()=>{
    state.use_weather_photos=swapPhotos.checked;state.weather_photos_override=swapPhotos.checked;persist();update();
  });
  swapLabel.append(swapPhotos,document.createTextNode(
    "Utiliser les photos météo jour/nuit (sinon : photo principale + animations)"
  ));
  settings.append(swapLabel);
  const baseNotice=document.createElement("p");
  baseNotice.textContent="Par défaut, la photographie officielle reste fixe : seule l'ambiance météo, l'éclairage et la lune changent.";
  settings.append(baseNotice);
  const checkbox=document.createElement("label");checkbox.className="checkbox";
  const effect=document.createElement("input");effect.type="checkbox";effect.checked=state.effect;
  const setEffects=value=>{
    state.effect=Boolean(value);
    state.effect_override=state.effect;
    effect.checked=state.effect;
    effectsBtn.textContent=state.effect?"✦ Effets ON":"○ Effets OFF";
    persist();update();
  };
  effect.addEventListener("change",()=>setEffects(effect.checked));
  effectsBtn.addEventListener("click",()=>setEffects(!state.effect));
  checkbox.append(effect,document.createTextNode("Activer les effets météo, lumineux et saisonniers"));settings.append(checkbox);
  const frostLabel=document.createElement("label");frostLabel.className="checkbox";
  const frostInput=document.createElement("input");frostInput.type="checkbox";frostInput.checked=state.frost;
  const setFrost=value=>{
    state.frost=Boolean(value);
    state.frost_override=state.frost;
    frostInput.checked=state.frost;
    persist();update();
  };
  frostInput.addEventListener("change",()=>setFrost(frostInput.checked));
  frostLabel.append(frostInput,document.createTextNode("Effet gel quand la température est ≤ 0 °C"));settings.append(frostLabel);
  const strengthLabel=document.createElement("label");
  strengthLabel.textContent="Intensité des animations (0 = aucune, 200 % = forte)";
  const strength=document.createElement("input");
  strength.type="range";strength.min="0";strength.max="2";strength.step="0.1";
  strength.value=String(state.effect_intensity);
  bind(strength,()=>String(state.effect_intensity));
  const strengthValue=document.createElement("span");
  strengthValue.textContent=Math.round(state.effect_intensity*100)+" %";
  strength.addEventListener("input",()=>{
    state.effect_intensity=Number(strength.value);
    strengthValue.textContent=Math.round(state.effect_intensity*100)+" %";
    persist();
  });
  strengthLabel.append(strength,strengthValue);settings.append(strengthLabel);
  const motionText=motionLocale();
  const motionLabel=document.createElement("label");
  motionLabel.id="maison3d-motion-option";
  const motionTitle=document.createElement("span");motionTitle.textContent=motionText.title;
  const motionSelect=document.createElement("select");
  motionSelect.setAttribute("aria-label",motionText.title);
  for(const key of MOTION_MODES){
    const option=document.createElement("option");option.value=key;option.textContent=motionText[key];motionSelect.append(option);
  }
  motionSelect.value=state.motion;
  const motionHint=document.createElement("span");motionHint.className="motion-hint";motionHint.textContent=motionText.hint;
  const motionReduced=document.createElement("span");
  motionReduced.className="motion-reduced";motionReduced.setAttribute("role","status");
  motionReduced.textContent=motionText.reduced;
  const refreshMotionHint=()=>{
    motionSelect.value=motionMode();
    motionReduced.hidden=!(motionMode()==="auto"&&systemReduced());
  };
  motionSelect.addEventListener("change",()=>{
    state.motion=MOTION_MODES.includes(motionSelect.value)?motionSelect.value:"auto";
    setMotionMode(state.motion);persist();refreshMotionHint();
  });
  motionLabel.append(motionTitle,motionSelect,motionHint,motionReduced);
  settings.append(motionLabel);
  refreshers.push(()=>{motionSelect.value=state.motion;refreshMotionHint()});
  onMotionChange(refreshMotionHint);refreshMotionHint();
  const reset=document.createElement("button");reset.type="button";reset.textContent="Réinitialiser les images";
  reset.addEventListener("click",()=>{
    if(!confirm("Réinitialiser toutes les URLs personnalisées ?"))return;
    state.images=defaults();state.mode="auto";state.season="auto";persist();
    settings.querySelectorAll("label").forEach(l=>{
      const input=l.querySelector('input[type="text"]');
      if(!input)return;
      const text=l.firstChild?.textContent||"";
      if(text.startsWith("Image "))input.value="";
    });
    selectMode.value="auto";seasonSelect.value="auto";state.moon_preview="auto";moonPreview.value="auto";update();
  });settings.append(reset);
  const style=document.createElement("style");
  style.textContent=[
    "#maison3d-photo-view{position:fixed;inset:0;z-index:5;overflow:hidden;background:#111c2d}",
    "#maison3d-photo-view img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:filter 1.3s ease}",
    "#maison3d-photo-view.photo-night:not(.effects-off):not(.night-photo) img{filter:brightness(.36) saturate(.70) contrast(1.09)}",
    "#maison3d-photo-view.photo-night .moon-phase{filter:drop-shadow(0 0 18px #cdd9ff)}",
    "#maison3d-photo-view.photo-night:not(.effects-off)::after{content:'';position:absolute;pointer-events:none;inset:0;",
    "background:radial-gradient(ellipse at 23% 10%,#d4def51c,transparent 35%),",
    "linear-gradient(180deg,#06102b29 0%,transparent 55%,#06102366 100%)}",
    "#maison3d-photo-view .photo-light{position:absolute;inset:0;pointer-events:none;transition:background 1s}",
    "#maison3d-photo-view canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
    "#maison3d-photo-status{position:absolute;top:78px;right:14px;max-width:70%;border-radius:10px;",
    "background:#101923df;padding:9px 13px;font:12px system-ui,sans-serif;color:#fff}",
    "#maison3d-photo-status.testing{background:#b35a00ee;font-weight:600}",
    "#maison3d-photo-view .moon-phase{position:absolute;left:14px;top:85px;font-size:27px;text-shadow:0 2px 6px #000}",
    "#maison3d-photo-view .photo-error{position:absolute;top:45%;left:10%;width:80%;text-align:center;",
    "background:#972b30;color:white;border-radius:9px;padding:14px}",
    "#maison3d-photo-view .photo-error[hidden]{display:none}",
    "#maison3d-photo-settings .main-photo-preview{display:grid;gap:8px;margin:9px 0}",
    "#maison3d-photo-settings .main-photo-preview img{position:static;width:100%;height:auto;",
    "max-height:165px;object-fit:contain;border-radius:7px;background:#1d2e43}",
    "#maison3d-photo-settings .main-photo-preview img[hidden]{display:none}",
    "#maison3d-photo-controls .row-break{flex-basis:100%;height:0}",
    "#maison3d-photo-seasons{display:flex;flex-wrap:wrap;align-items:center;gap:inherit}",
    "#maison3d-photo-controls #maison3d-photo-seasons button{background:#29405b}",
    "#maison3d-photo-controls #maison3d-photo-seasons button[aria-pressed=true]{background:#1477dc}",
    "#maison3d-photo-seasons .season-select{display:none;margin:0}",
    "#maison3d-photo-seasons select{border:0;border-radius:8px;background:#29405b;color:#fff;padding:9px 6px;font:13px system-ui;cursor:pointer;max-width:150px}",
    "html.card-mode #maison3d-photo-seasons select{padding:6px 4px;font-size:11px}",
    "@media(max-height:500px){html.photo-active #maison3d-photo-controls{gap:4px;padding:5px}html.photo-active #maison3d-photo-controls button{padding:6px 8px;font-size:12px}#maison3d-photo-seasons select{padding:6px 4px;font-size:12px}}",
    "html:not(.photo-active) #maison3d-photo-seasons,html:not(.photo-active) #maison3d-photo-controls .row-break{display:none}",
    // Compact screens (phones, narrow cards, short landscape): one « Saison » selector.
    "@media(max-width:899px),(max-height:500px){#maison3d-photo-controls .row-break,#maison3d-photo-seasons button{display:none}",
    "#maison3d-photo-seasons .season-select{display:flex}}",
    // Wide screens: the bar keeps its width, the seasons take a second row under it.
    "@media(min-width:900px) and (min-height:501px){html.photo-active #maison3d-photo-controls{display:grid;",
    "grid-template-columns:repeat(8,auto);justify-content:start}",
    "html.photo-active #maison3d-photo-controls .row-break{display:none}",
    "html.photo-active #maison3d-photo-seasons{grid-column:1/-1}}",
    ".maison3d-test-states{border:1px solid #66778c;border-radius:8px;margin-top:12px}",
    ".maison3d-upload{border:1px solid #66778c;border-radius:8px;margin-top:12px;display:grid;gap:6px}",
    ".maison3d-upload legend{font-size:13px;font-weight:bold}.maison3d-upload span{font-size:12px;opacity:.85}",
    ".maison3d-test-states legend{font-size:13px;font-weight:bold}",
    ".maison3d-test-states .test-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}",
    ".maison3d-test-states button{padding:8px;border-radius:6px}",
    ".maison3d-test-states button[aria-pressed=true]{background:#1579ea!important}",
    "#maison3d-photo-controls{position:fixed;top:10px;left:10px;z-index:8;display:flex;gap:6px;background:#101923e5;",
    "padding:7px;border-radius:13px;max-width:calc(100vw - 20px);flex-wrap:wrap}",
    "#maison3d-photo-controls button,#maison3d-photo-settings button{border:0;border-radius:8px;",
    "background:#34465d;color:#fff;padding:9px 10px;cursor:pointer}",
    "#maison3d-photo-controls button[aria-pressed=true]{background:#1579ea}",
    "#maison3d-photo-settings{position:fixed;z-index:12;right:10px;top:65px;max-width:390px;width:calc(100% - 20px);",
    "height:min(80vh,720px);overflow:auto;background:#112235f5;color:white;border-radius:15px;",
    "border:1px solid #ffffff3d;padding:14px;box-shadow:0 14px 44px #0009}",
    "#maison3d-photo-settings[hidden]{display:none}",
    "#maison3d-photo-settings .settings-head{display:flex;justify-content:space-between;align-items:center;gap:10px}",
    "#maison3d-photo-settings p{font:12px system-ui;line-height:1.4;color:#d8e0e8}",
    "#maison3d-photo-settings label{display:block;font:12px system-ui;margin:10px 0;color:#dbe6f0}",
    "#maison3d-photo-settings .sensor-warning{display:block;margin-top:3px;font-size:11px;color:#f3c77a}",
    "#maison3d-photo-settings .sensor-warning[hidden]{display:none}",
    "#maison3d-photo-settings .entity-source{display:block;margin:3px 0 2px;font-size:11px;color:#a9c4de;overflow-wrap:anywhere}",
    "#maison3d-photo-settings .entity-field input[hidden]{display:none!important}",
    "#maison3d-photo-settings .entity-field input[type=search]{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:8px;",
    "color:white;background:#1d2e43;border:1px solid #72869a;border-radius:7px}",
    "#maison3d-photo-settings select:disabled{opacity:.7}",
    "#maison3d-photo-settings label input[type=text],#maison3d-photo-settings select{display:block;width:100%;",
    "box-sizing:border-box;margin-top:4px;padding:9px;color:white;background:#273c56;border:1px solid #72869a;border-radius:7px}",
    "#maison3d-photo-settings .checkbox{display:flex;align-items:center;gap:9px}",
    "#maison3d-photo-settings .motion-hint{display:block;margin-top:4px;font-size:11px;color:#a9c4de;line-height:1.35}",
    "#maison3d-photo-settings .motion-reduced{display:block;margin-top:4px;font-size:11px;color:#f3c77a}",
    "#maison3d-photo-settings .motion-reduced[hidden]{display:none}",
    // Photo view: the settings bar sits at the bottom on every screen; only the
    // information bubble (and the moon) stay over the photo at the top.
    "html.photo-active #maison3d-photo-controls{top:auto;bottom:10px}",
    "html.card-mode #maison3d-photo-controls{top:auto;bottom:6px;left:6px;gap:3px}",
    "html.card-mode #maison3d-photo-controls button{padding:6px;font-size:11px}",
    "html.card-mode #maison3d-photo-status{top:8px;right:8px}",
    "#maison3d-photo-controls .bar-toggle{display:none}",
    "html.card-mode #maison3d-photo-controls .bar-toggle{display:inline-block;background:#31445d}",
    // Folded: only « ☰ Menu », plus « 💾 Enregistrer » while there are unsaved changes.
    "html.card-mode #maison3d-photo-controls.collapsed{padding:4px}",
    "html.card-mode #maison3d-photo-controls.collapsed>:not(.bar-toggle):not(.maison3d-save.dirty){display:none!important}",
    "html.photo-active #maison3d-presentation,html.photo-active #maison3d-weather-status{display:none!important}",
    "@media(max-width:700px){#maison3d-photo-controls{top:auto;bottom:8px;left:8px}",
    "#maison3d-photo-status{top:8px;right:8px;font-size:11px}}"
  ].join("");
  style.textContent+=SAVE_STYLE+LIGHT_STYLE+
    "#maison3d-photo-controls .maison3d-save button{padding:9px 11px}"+
    "#maison3d-photo-settings .settings-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}"+
    "#maison3d-photo-settings .settings-head strong{flex:1 1 auto}"+
    "#maison3d-photo-settings .maison3d-save button{padding:6px 9px;font-size:12px}"+
    "@media(max-width:899px),(max-height:500px){#maison3d-photo-controls .maison3d-save .save-status{max-width:46vw;overflow:hidden;text-overflow:ellipsis}}"+
    "html.card-mode #maison3d-photo-controls .maison3d-save button{padding:6px;font-size:11px}"+
    "html.card-mode #maison3d-photo-controls .maison3d-save .save-status{font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis}";
  document.head.append(style);
  document.body.append(section,nav,settings);
  let live={weather:null,sun:null,temperature:null,temperatureUnit:"",windSpeed:0,moon:null,rain:null,snow:null,cloud:null,storm_alert:false,ice_alert:false};
  // Ambience from Home Assistant only (null = no weather signal); see sensor-values.js.
  const liveKind=()=>weatherKind({...live,stormAlert:live.storm_alert,iceAlert:live.ice_alert,
    celsius:toCelsius(live.temperature,live.temperatureUnit),frostEnabled:state.effect&&state.frost});
  // 0..1 frost strength: forced by the test button, otherwise from the temperature.
  const frostTarget=()=>{
    if(!state.effect||!state.frost)return 0;
    // Ice vigilance (verglas) at ≤ 0 °C: full frost, as with the test button.
    const iceFrost=test.weather==="auto"&&state.mode==="auto"&&liveKind()==="frost";
    const level=state.frost_preview||test.weather==="frost"||iceFrost?1:frostLevel(toCelsius(live.temperature,live.temperatureUnit));
    return level*Math.min(1,state.effect_intensity);
  };
  let haTimeZone="UTC";
  let lastAutoSeason="";
  let currentSrc="",active="day",lastFrame=0;
  const imageSizes=()=>photoSizes({width:innerWidth,height:innerHeight,ratio:(image.naturalWidth/image.naturalHeight)||1286/914,dpr:devicePixelRatio||1});
  addEventListener("resize",()=>{if(image.hasAttribute("srcset"))image.sizes=imageSizes()});
  let missingBundled=new Set();
  const failedImages=new Set();
  const isCardView=new URLSearchParams(window.location.search).get("mode")==="card";
  let parentBasePhoto="";
  let parentImages={};
  const images=()=>({...state.images,...parentImages});
  let particles=[];
  const seasonNow=()=>state.season!=="auto"?state.season:automaticSeason(haTimeZone);
  const nighttime=()=>{
    if(test.time!=="auto")return test.time==="night";
    if(live.sun==="below_horizon")return true;
    if(live.sun==="above_horizon")return false;
    // No sun entity: clock of the Home Assistant time zone, not of this device.
    const hour=haHour(haTimeZone);return hour<7||hour>=20;
  };
  // Night for the current view: test mode first, then the saved ambience, then Home Assistant.
  const isNight=()=>test.time!=="auto"?test.time==="night":
    state.mode==="night"||(state.mode==="auto"&&nighttime());
  function weatherKey(){
    if(test.weather!=="auto")return ["clear","frost"].includes(test.weather)?(isNight()?"night":"day"):test.weather;
    if(state.mode!=="auto")return state.mode;
    // Shared rules (numbers, on/off, Météo-France vigilance): sensor-values.js.
    const kind=liveKind();
    if(kind&&kind!=="frost")return kind;
    if(nighttime())return "night";
    const s=seasonNow();return images()[s]?s:"day";
  }
  // moonPhase(): shared parser (English/French, accents, case) from sensor-values.js.
  const moonSymbol=(value)=>({
    new_moon:"🌑",waxing_crescent:"🌒",first_quarter:"🌓",
    waxing_gibbous:"🌔",full_moon:"🌕",waning_gibbous:"🌖",
    last_quarter:"🌗",waning_crescent:"🌘"
  })[moonPhase(value)]||"🌙";
  function update(){
    const selected=weatherKey();
    active=selected;
    const night=isNight();
    const lunarKey=night&&moonPhase(live.moon)?"moon_"+moonPhase(live.moon):null;
    // The official photo is the default immutable scene. Explicit opt-in only
    // for alternative stills; manual weather previews remain dynamic overlays.
    const mainPhoto=resolveMainPhoto({
      parent:parentBasePhoto,local:state.base_image_url,isCard:isCardView
    });
    const seasonal=["spring","summer","autumn","winter"].includes(selected);
    const picked=state.use_weather_photos?pickWeatherPhoto({
      kind:seasonal?"day":selected,night,season:seasonal?selected:seasonNow(),
      lunarKey,images:images(),mainPhoto
    }):{path:mainPhoto,nightPhoto:false};
    const candidate=picked.path;
    section.classList.toggle("night-photo",picked.nightPhoto&&!failedImages.has(candidate));
    const path=failedImages.has(candidate)
      ?(failedImages.has(mainPhoto)?DEFAULT:mainPhoto):candidate;
    if(path!==currentSrc){
      currentSrc=path;
      // Bundled photos: 640 / 960 px copies (srcset); custom images stay as they are.
      const srcset=responsiveSrcset(path);
      if(srcset){image.sizes=imageSizes();image.srcset=srcset}else{image.removeAttribute("srcset");image.removeAttribute("sizes")}
      image.src=path;error.hidden=true;
    }
    const weatherTint=selected==="snow"||selected==="winter"?"linear-gradient(#e7f5ff18,#eaf7ff29)":
      selected==="storm"?"#101b3866":selected==="rain"?"#26344746":
      selected==="cloudy"?"#5b677523":selected==="fog"?"#c6ced62e":"transparent";
    tint.style.background=state.effect?weatherTint:"transparent";
    tint.style.opacity=night?"1":"0.8";
    section.classList.toggle("photo-night",night);
    section.classList.toggle("effects-off",!state.effect);
    const currentMoon=state.moon_preview==="auto"?live.moon:state.moon_preview;
    const phaseName=skyMoon.normalize(currentMoon);
    skyMoon.draw(phaseName,night,state.effect&&Boolean(phaseName),state.effect_intensity);
    moon.textContent=""; // The phase is rendered on the sky, including daytime.
    for(const [key,btn] of seasonButtons)btn.setAttribute("aria-pressed",String(state.season===key));
    seasonPick.value=state.season;
    for(const [key,btn] of testButtons)btn.setAttribute("aria-pressed",String(test.weather===key));
    for(const [key,btn] of timeButtons)btn.setAttribute("aria-pressed",String(test.time===key));
    for(const [key,btn] of seasonTests)btn.setAttribute("aria-pressed",String(state.season===key));
    const effectLabel=LABELS[selected]||selected;
    const seasonLabel=SEASON_LABELS[seasonNow()]||seasonNow();
    const testLabel=testing()?"🧪 Mode test · "+(test.weather!=="auto"?LABELS[test.weather]:effectLabel)+" · "+(night?"Nuit":"Jour"):"";
    status.classList.toggle("testing",testing());
    // Same word twice in a row (« Été · Été », « Nuit · Nuit ») is shown once.
    const head=(testLabel||((state.mode==="auto"?"Automatique":"Aperçu manuel")+" · "+effectLabel)).split(" · ");
    if(!head.includes(seasonLabel))head.push(seasonLabel);
    status.textContent=head.filter((w,i)=>w!==head[i-1]).join(" · ")+
      (typeof live.temperature==="number"?" · "+live.temperature+(live.temperatureUnit||"°C"):"")+
      (phaseName?" · Lune : "+String(currentMoon):"")+
      (state.moon_preview!=="auto"?" · Lune en test":"")+
      (frostTarget()>0?(state.frost_preview||test.weather==="frost"?" · Gel en test":" · Gel"):"");
    frostInput.checked=state.frost;
    frostTest.setAttribute("aria-pressed",String(state.frost_preview));
    nightBtn.setAttribute("aria-pressed",String(test.time==="night"));
    dayBtn.setAttribute("aria-pressed",String(test.time==="day"));
    autoBtn.setAttribute("aria-pressed",String(state.mode==="auto"&&!testing()));
    effectsBtn.textContent=state.effect?"✦ Effets ON":"○ Effets OFF";
    effectsBtn.setAttribute("aria-pressed",String(state.effect));
    photoBtn.setAttribute("aria-pressed",String(state.enabled));
    modelBtn.setAttribute("aria-pressed",String(!state.enabled && state.model_view==="3d"));
    planBtn.setAttribute("aria-pressed",String(!state.enabled && state.model_view==="2d"));
    section.hidden=!state.enabled;
    if(!state.enabled){section.style.display="none"}else{section.style.display="block"}
    document.documentElement.classList.toggle("photo-active",state.enabled);
    if(!state.enabled)withScene(()=>{});
    renderLights();
  }
  photoBtn.addEventListener("click",()=>{state.enabled=true;persist();update()});
  // ☾ / ☀ preview night or day immediately (test mode, not saved); ◉ Auto returns to real data.
  nightBtn.addEventListener("click",()=>setTest({time:"night"}));
  dayBtn.addEventListener("click",()=>setTest({time:"day"}));
  autoBtn.addEventListener("click",()=>resetTest.click());
  const setModelView=view=>{
    state.enabled=false;state.model_view=view;
    settings.hidden=true;
    persist();update();
    // Reuse the existing camera controls so the editor remains consistent.
    withScene(()=>document.getElementById(view==="2d"?"topview":"tab3d")?.click());
  };
  planBtn.addEventListener("click",()=>setModelView("2d"));
  modelBtn.addEventListener("click",()=>setModelView("3d"));
  optionsBtn.addEventListener("click",()=>{stopPlacing(false);settings.hidden=!settings.hidden;if(!settings.hidden)requestEntityOptions();renderLights()});
  close.addEventListener("click",()=>{settings.hidden=true;renderLights()});
  image.addEventListener("error",()=>{
    if(currentSrc!==DEFAULT){
      failedImages.add(currentSrc);
      imageCheck.textContent="Image inaccessible — retour à la photo officielle";
      update();
      return;
    }
    error.hidden=false;
  });
  image.addEventListener("load",()=>{error.hidden=true});
  function showSensorWarnings(issues){
    const safe=issues&&typeof issues==="object"?issues:{};
    for(const [key,warn] of sensorWarnings){
      const item=safe[key];
      const text=item&&typeof item==="object"&&typeof item.entity_id==="string"?issueText({
        entity_id:item.entity_id.slice(0,120),issue:String(item.issue),
        state:typeof item.state==="string"?item.state.slice(0,40):null},key):"";
      warn.textContent=text;warn.hidden=!text;
    }
  }
  function requestEntities(){
    // Explicit request; only this iframe's parent is allowed to receive it.
    if(window.parent===window)return;
    window.parent.postMessage({type:"maison3d:entity-selection",weather_entity:state.weather_entity,
      sun_entity:state.sun_entity,moon_entity:state.moon_entity,
      temperature_entity:state.temperature_entity,wind_entity:state.wind_entity,
      rain_entity:state.rain_entity,snow_entity:state.snow_entity,
      cloud_entity:state.cloud_entity},window.location.origin);
  }
  // Integration/card values, unless this view saved its own choice (override).
  let globals={effects:true,frost:true,weather_photos:false};
  function applyOverrides(){
    state.effect=typeof state.effect_override==="boolean"?state.effect_override:globals.effects;
    state.frost=typeof state.frost_override==="boolean"?state.frost_override:globals.frost;
    state.use_weather_photos=typeof state.weather_photos_override==="boolean"?state.weather_photos_override:globals.weather_photos;
    effect.checked=state.effect;swapPhotos.checked=state.use_weather_photos;
  }
  // Settings saved in Home Assistant win over this browser's copy; the first
  // time, this browser's settings are copied to Home Assistant.
  onHaData((ha,{connected,canSave})=>{
    if(!connected)return;
    const saved=ha.photo_settings;
    if(saved&&typeof saved==="object"){
      applySaved(saved);applyOverrides();
      try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch{}
      for(const refresh of refreshers)refresh();
      selectMode.value=state.mode;seasonSelect.value=state.season;moonPreview.value=state.moon_preview;
      strengthValue.textContent=Math.round(state.effect_intensity*100)+" %";
      for(const key of SENSOR_KEYS)renderEntityField(key,true);
      requestEntities();watchLights();renderLightSettings();
      update();
      markSaved("photo_settings");
    }else if(canSave&&localStorage.getItem(STORAGE)){
      // One-time migration of settings already saved in this browser (not a new change).
      saveToHa({photo_settings:saveable()});
    }
  });
  window.addEventListener("message",event=>{
    if(event.source!==window.parent||event.origin!==window.location.origin)return;
    if(event.data?.type==="maison3d:entity-options"){
      const list=event.data.options&&typeof event.data.options==="object"?event.data.options:{};
      entityOptions=Object.fromEntries(SENSOR_KEYS.map(key=>[key,(Array.isArray(list[key])?list[key]:[])
        .filter(o=>o&&typeof o.id==="string"&&o.id.length<150).slice(0,300)
        .map(o=>({id:o.id,name:typeof o.name==="string"&&o.name?o.name.slice(0,80):o.id}))]));
      for(const key of SENSOR_KEYS)renderEntityField(key,true);
      lightCandidates=(Array.isArray(list.lights)?list.lights:[]).filter(o=>o&&isLightEntity(o.id)).slice(0,300)
        .map(o=>({id:o.id,name:typeof o.name==="string"&&o.name?o.name.slice(0,80):o.id}));
      renderLightSettings();
      return;
    }
    if(event.data?.type==="maison3d:light-toggle-result"){
      lightNotice=event.data.ok===true?"":say(lang,"denied")+(typeof event.data.error==="string"?" ("+event.data.error.slice(0,80)+")":"");
      renderLightSettings();
      if(!event.data.ok){status.textContent="💡 "+lightNotice}
      return;
    }
    if(event.data?.type!=="maison3d:conditions")return;
    if(typeof event.data.language==="string"&&event.data.language&&langOf(event.data.language)!==lang){lang=langOf(event.data.language);renderLightSettings()}
    userIsAdmin=event.data.user_is_admin===true;
    const lightStates=event.data.light_states&&typeof event.data.light_states==="object"?event.data.light_states:{};
    lightLive={};
    for(const light of state.lights){
      const item=lightStates[light.entity_id];
      if(!item||typeof item!=="object")continue;
      lightLive[light.entity_id]={state:typeof item.state==="string"?item.state.slice(0,20):"",
        rgb:Array.isArray(item.rgb)&&item.rgb.length===3&&item.rgb.every(Number.isFinite)?item.rgb:null,
        brightness:Number.isFinite(item.brightness)?item.brightness:null,
        name:typeof item.name==="string"?item.name.slice(0,60):""};
    }
    if(!settings.hidden)renderLightSettings();
    globals={effects:event.data.effects_enabled!==false,frost:event.data.frost_enabled!==false,
      weather_photos:event.data.weather_photos===true};
    applyOverrides();
    const supplied=event.data.base_image_url;
    parentBasePhoto=allowedUrl(supplied)?supplied:"";
    // Card/panel images apply on top of the menu ones but are never saved in this browser.
    parentImages={};
    if(event.data.images && typeof event.data.images==="object"){
      for(const k of KEYS){
        const path=event.data.images[k];
        if(path&&allowedUrl(path))parentImages[k]=path;
      }
    }
    if(typeof event.data.time_zone==="string"&&event.data.time_zone.length<100)haTimeZone=event.data.time_zone;
    live={
      weather:typeof event.data.weather==="string"?event.data.weather:null,
      sun:typeof event.data.sun==="string"?event.data.sun:null,
      temperature:Number.isFinite(event.data.temperature)?event.data.temperature:null,
      temperatureUnit:typeof event.data.temperatureUnit==="string"?event.data.temperatureUnit.slice(0,10):"",
      // km/h (the card / panel convert; an older sender's unit is converted here).
      windSpeed:Number.isFinite(event.data.windSpeed)?toKmh(event.data.windSpeed,typeof event.data.windSpeedUnit==="string"?event.data.windSpeedUnit:"")??0:0,
      moon:typeof event.data.moon==="string"?event.data.moon:null,
      rain:Number.isFinite(event.data.rain)?event.data.rain:null,
      snow:Number.isFinite(event.data.snow)?event.data.snow:null,
      cloud:Number.isFinite(event.data.cloud)?event.data.cloud:null,
      storm_alert:event.data.storm_alert===true,
      ice_alert:event.data.ice_alert===true
    };
    showSensorWarnings(event.data.sensor_issues);
    const eff=event.data.entities_effective;
    effective={};
    if(eff&&typeof eff==="object")for(const key of SENSOR_KEYS){
      const item=eff[key];
      if(item&&typeof item.entity_id==="string"&&typeof item.source==="string")
        effective[key]={entity_id:item.entity_id.slice(0,150),source:item.source.slice(0,20)};
    }
    for(const key of SENSOR_KEYS)renderEntityField(key);
    update();
  });
  let actual=0;
  function resize(){
    const r=section.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr));
    canvas.height=Math.max(1,Math.round(r.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize",resize);
  resize();
  const spawn=(w,h)=>({x:Math.random()*w,y:Math.random()*h,
    speed:.6+Math.random()*1.7,turn:Math.random()*7});
  function frame(time){
    if(time-lastFrame<33)return;
    lastFrame=time;
    if(!state.enabled||!state.effect||state.effect_intensity<=0){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      cinematics.frame(time,"none",seasonNow(),0,0,false,false);
      seasonalEffects.frame(time,seasonNow(),0,false,false);
      frost.frame(time,0);
      return;
    }
    const w=section.clientWidth,h=section.clientHeight;
    if(w<=0||h<=0)return;
    if(Math.abs(canvas.width-w*(Math.min(devicePixelRatio||1,2)))>2)resize();
    ctx.clearRect(0,0,w,h);
    const currentSeason=seasonNow();
    if(currentSeason!==lastAutoSeason){lastAutoSeason=currentSeason;update()}
    const kind=weatherKey();
    const night=isNight();
    cinematics.frame(time,kind,seasonNow(),live.windSpeed,state.effect_intensity,night,true);
    seasonalEffects.frame(time,seasonNow(),state.effect_intensity,night,true);
    frost.frame(time,frostTarget());
    const count=kind==="snow"?180:
      kind==="rain"?190:kind==="storm"?235:
      kind==="wind"?100:0;
    const type=kind;
    const level=motionLevel();
    const scaledCount=motionCount(Math.floor(count*Math.min(state.effect_intensity,2)));
    while(particles.length<scaledCount)particles.push(spawn(w,h));
    particles.length=scaledCount;
    const windy=type==="wind"||live.windSpeed>18; // km/h
    for(let i=0;i<scaledCount;i++){
      const p=particles[i];
      if(type==="snow"){
        ctx.fillStyle="#f7fbffdf";ctx.beginPath();ctx.arc(p.x,p.y,1.1+p.speed,0,Math.PI*2);ctx.fill();
        p.y+=p.speed*1.3*level;p.x+=Math.sin(time*.001+p.turn)*.75*level;
      }else if(type==="rain"||type==="storm"){
        ctx.strokeStyle="#b6dfffbd";ctx.lineWidth=1.1;
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-4,p.y+18);ctx.stroke();
        p.y+=p.speed*8*level;p.x+=1.2*level;
      }else{
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(time*.001*level+p.turn);
        if(type==="petals"){
          ctx.fillStyle=["#f9cadd","#ef9abf","#fff0f6"][i%3];
          ctx.beginPath();ctx.ellipse(0,0,4,2.5,.4,0,Math.PI*2);ctx.fill();
        }else{
          ctx.fillStyle=["#d39b31","#ad5f22","#c17832"][i%3];
          ctx.fillRect(-3,-5,6,10);
        }
        ctx.restore();
        p.y+=p.speed*(type==="wind"?.55:1.1)*level;
        p.x+=((windy?3:1)+Math.sin(time*.001+p.turn))*level;
      }
      if(p.y>h+12||p.x>w+15){p.x=Math.random()*w;p.y=-15}
    }
    if(level>0&&(type==="wind" || (state.mode==="auto" && test.weather==="auto" && live.windSpeed>=25))){ // km/h
      // Transparent gust streaks make strong wind visually distinct.
      ctx.save();
      const gustAlpha=Math.min(.34,.08+.06*state.effect_intensity);
      ctx.strokeStyle="rgba(229,238,245,"+gustAlpha+")";
      ctx.lineWidth=1.2;
      const phase=(time*.12)%Math.max(1,w+100);
      for(let n=0;n<15;n++){
        const yy=(n*.137*h+Math.sin(time*.001+n)*13)%h;
        const xx=(phase+n*173)%(w+100)-50;
        ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+38+n%4*12,yy-6);
        ctx.stroke();
      }
      ctx.restore();
    }
    if(type==="storm" && level>=1 && Math.random()<.015){
      // Draw a jagged lightning bolt from cloud level, not just a white flash.
      const startX=w*(.15+Math.random()*.7);
      let x=startX,y=0;
      ctx.save();
      ctx.lineCap="round";
      ctx.shadowColor="#b8ddff";
      ctx.shadowBlur=28;
      ctx.strokeStyle="#f5faff";
      ctx.lineWidth=3.4;
      ctx.beginPath();ctx.moveTo(x,y);
      for(let k=0;k<7;k++){
        y+=h*(.035+Math.random()*.045);
        x+=(Math.random()-.5)*w*.05;
        ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.lineWidth=1.2;ctx.strokeStyle="#a9d9ff";
      ctx.stroke();ctx.restore();
      ctx.fillStyle="#e4eeff26";ctx.fillRect(0,0,w,h);
    }
    actual++;
  }
  // Existing WebGL loop invokes this callback every frame.
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){resize();cinematics.resize();seasonalEffects.resize();frost.resize();update()}});
  // Draft section: the current view (photo / plan / 3D) is navigation, not a change,
  // but it is remembered by the next « Enregistrer ».
  function restoreSaved(saved){
    const keep={enabled:state.enabled,model_view:state.model_view};
    Object.assign(state,saved,keep);
    state.images={...defaults(),...saved.images};
    applyOverrides();
    for(const refresh of refreshers)refresh();
    selectMode.value=state.mode;seasonSelect.value=state.season;seasonPick.value=state.season;
    moonPreview.value=state.moon_preview;frostInput.checked=state.frost;
    strengthValue.textContent=Math.round(state.effect_intensity*100)+" %";
    if(!MOTION_MODES.includes(state.motion))state.motion="auto";
    setMotionMode(state.motion);
    state.lights=cleanLights(saved.lights);state.light_toggle=cleanToggle(saved.light_toggle);
    for(const key of SENSOR_KEYS)renderEntityField(key,true);
    requestEntities();watchLights();renderLightSettings();update();
  }
  registerSection("photo_settings",{
    get:saveable,
    compare:v=>{delete v.enabled;delete v.model_view;delete v.use_weather_photos;return v},
    apply:restoreSaved,
    writeLocal:v=>localStorage.setItem(STORAGE,JSON.stringify(v))
  });
  requestEntities();watchLights(true);
  update();
  if(!state.enabled && state.model_view==="2d"){
    withScene(()=>document.getElementById("topview")?.click());
  }
  return {frame,update,state};
}
