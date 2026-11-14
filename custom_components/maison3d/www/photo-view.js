/**
 * Maison 3D photo-real view. Uses the owner's original screenshot as the
 * fixed original photo with dynamic weather, lunar and daylight overlays.
 * Other photographs are optional, never replacements by default.
 * This is a photo-based presentation, NOT a rotatable 3D reconstruction.
 */
import {createPhotoCinematics} from "./photo-cinematics.js";
import {createMoonOverlay} from "./moon-effects.js";
import {automaticSeason,SEASON_LABELS,createSeasonEffects} from "./season-effects.js";
import {DEFAULT_MAIN_PHOTO,allowedPhotoUrl,resolveMainPhoto} from "./photo-source.js";
export function createPhotoView() {
  const KEYS=["day","night","cloudy","rain","snow","wind","storm",
    "spring","summer","autumn","winter",
    "moon_new_moon","moon_waxing_crescent","moon_first_quarter","moon_waxing_gibbous",
    "moon_full_moon","moon_waning_gibbous","moon_last_quarter","moon_waning_crescent"];
  const LABELS={day:"Jour",night:"Nuit",cloudy:"Nuageux",rain:"Pluie",
    snow:"Neige",wind:"Vent",storm:"Orage",spring:"Printemps",
    summer:"Été",autumn:"Automne",winter:"Hiver",
    moon_new_moon:"Nouvelle lune",moon_waxing_crescent:"Premier croissant",
    moon_first_quarter:"Premier quartier",moon_waxing_gibbous:"Lune gibbeuse croissante",
    moon_full_moon:"Pleine lune",moon_waning_gibbous:"Lune gibbeuse décroissante",
    moon_last_quarter:"Dernier quartier",moon_waning_crescent:"Dernier croissant"};
  const DEFAULT=DEFAULT_MAIN_PHOTO;
  const BUNDLED={
    day:"/maison3d-assets/images/jour.jpg",
    cloudy:"/maison3d-assets/images/nuageux.jpg",
    rain:"/maison3d-assets/images/pluie.jpg",
    snow:"/maison3d-assets/images/neige.jpg"
  };
  const STORAGE="maison3d:photo-settings:v1";
  const allowedUrl=allowedPhotoUrl;
  const defaults=()=>Object.fromEntries(KEYS.map(k=>[k,""]));
  const state={
    images:defaults(),base_image_url:"",moon_entity:"sensor.moon_phase",
    weather_entity:"",sun_entity:"sun.sun",
    temperature_entity:"",wind_entity:"",rain_entity:"",snow_entity:"",cloud_entity:"",
    enabled:true,model_view:"3d",mode:"auto",effect:true,effect_override:null,season:"auto",effect_intensity:1,moon_preview:"auto",use_weather_photos:false
  };
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE));
    if(saved&&typeof saved==="object"){
      for(const k of KEYS){
        if(allowedUrl(saved.images?.[k]))state.images[k]=saved.images[k];
      }
      for(const key of ["moon_entity","weather_entity","sun_entity","temperature_entity","wind_entity","rain_entity","snow_entity","cloud_entity"]){
        if(typeof saved[key]==="string")state[key]=saved[key].slice(0,150);
      }
      if(allowedUrl(saved.base_image_url))state.base_image_url=saved.base_image_url;
      if(typeof saved.enabled==="boolean")state.enabled=saved.enabled;
      if(saved.model_view==="2d"||saved.model_view==="3d")state.model_view=saved.model_view;
      if(typeof saved.effect_override==="boolean")state.effect_override=saved.effect_override;
      if(typeof saved.use_weather_photos==="boolean")state.use_weather_photos=saved.use_weather_photos;
      if(Number.isFinite(saved.effect_intensity))state.effect_intensity=Math.min(2,Math.max(0,saved.effect_intensity));
      if(typeof saved.mode==="string"&&["auto",...KEYS].includes(saved.mode))state.mode=saved.mode;
      if(typeof saved.season==="string"&&["auto","spring","summer","autumn","winter"].includes(saved.season))state.season=saved.season;
      if(typeof saved.moon_preview==="string"&&["auto","new_moon","waxing_crescent","first_quarter","waxing_gibbous","full_moon","waning_gibbous","last_quarter","waning_crescent"].includes(saved.moon_preview))state.moon_preview=saved.moon_preview;
    }
  }catch{}
  const persist=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch{}};
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
  const status=document.createElement("div");
  status.id="maison3d-photo-status";
  status.setAttribute("role","status");
  const moon=document.createElement("div");
  moon.className="moon-phase";
  const error=document.createElement("div");
  error.className="photo-error";error.hidden=true;
  error.textContent="Image inaccessible : corrigez son URL dans les réglages Photo.";
  section.append(image,tint,cinematicCanvas,seasonalCanvas,canvas,status,moon,error);
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
  nav.append(photoBtn,planBtn,modelBtn,nightBtn,dayBtn,autoBtn,effectsBtn,optionsBtn);
  const seasonalNav=document.createElement("nav");
  seasonalNav.id="maison3d-photo-seasons";
  seasonalNav.setAttribute("aria-label","Tester les saisons de la vue photo");
  const seasonButtons=new Map();
  for(const [key,label] of [
    ["spring","🌸 Printemps"],["summer","☀ Été"],
    ["autumn","🍂 Automne"],["winter","❄ Hiver"],["auto","◉ Saisons auto"]
  ]){
    const btn=document.createElement("button");
    btn.type="button";btn.textContent=label;
    btn.title="Tester : "+label;
    btn.addEventListener("click",()=>{
      state.enabled=true;state.season=key;
      state.mode=key==="auto"?"auto":key;
      selectMode.value=state.mode;
      seasonSelect.value=key;
      persist();update();
    });
    seasonalNav.append(btn);seasonButtons.set(key,btn);
  }
  const settings=document.createElement("section");
  settings.id="maison3d-photo-settings";settings.hidden=true;
  const head=document.createElement("div");
  head.className="settings-head";
  const h=document.createElement("strong");h.textContent="Images et saisons personnalisées";
  const close=document.createElement("button");close.type="button";close.textContent="✕ Fermer";
  head.append(h,close);settings.append(head);
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
        input.setCustomValidity("Utilise /local/…, /maison3d-assets/…, /api/… ou HTTPS.");
        input.reportValidity();return;
      }
      input.setCustomValidity("");
      state.base_image_url=value;
      failedImages.delete(value);
      persist();update();
      imageCheck.textContent=value?"Image enregistrée · prévisualisation conseillée":"Image principale par défaut";
    },"/local/maison3d/ma-maison.jpg");
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
    const target=candidate||resolveMainPhoto({parent:parentBasePhoto,isCard:isCardView});
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
  makeField("Entité météo",state.weather_entity,v=>{state.weather_entity=v;persist();requestEntities()},
    "weather.ma_maison (vide = première disponible)");
  makeField("Entité soleil",state.sun_entity,v=>{state.sun_entity=v||"sun.sun";persist();requestEntities()},"sun.sun");
  makeField("Entité lune",state.moon_entity,v=>{state.moon_entity=v;persist();requestEntities()},"sensor.moon_phase");
  for(const [key,label] of [
    ["temperature_entity","Capteur température extérieure"],
    ["wind_entity","Capteur vitesse du vent"],
    ["rain_entity","Capteur pluie (valeur ou on/off)"],
    ["snow_entity","Capteur neige (valeur ou on/off)"],
    ["cloud_entity","Capteur nuages (pourcentage ou on/off)"]
  ]){
    makeField(label,state[key],v=>{state[key]=v;persist();requestEntities()},"sensor.exemple");
  }
  const selectMode=selectField("Ambiance",[
    ["auto","Automatique (Home Assistant)"],...KEYS.filter(k=>!k.startsWith("moon_")).map(k=>[k,LABELS[k]])
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
  const testGrid=document.createElement("div");testGrid.className="test-grid";
  const tests=[
    ["day","☀ Jour"],["night","☾ Nuit"],["cloudy","☁ Nuages"],
    ["rain","🌧 Pluie"],["snow","❄ Neige"],["wind","💨 Vent"],
    ["storm","⚡ Orage"],["spring","🌸 Printemps"],["summer","☀ Été"],
    ["autumn","🍂 Automne"],["winter","❄ Hiver"]
  ];
  const testButtons=new Map();
  for(const [key,label] of tests){
    const btn=document.createElement("button");
    btn.type="button";btn.textContent=label;
    btn.addEventListener("click",()=>{
      state.enabled=true;state.mode=key;
      if(["spring","summer","autumn","winter"].includes(key)){
        state.season=key;seasonSelect.value=key;
      }
      selectMode.value=key;persist();update();
    });
    testGrid.append(btn);testButtons.set(key,btn);
  }
  testSection.append(testGrid);
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
    state.mode="auto";state.season="auto";state.moon_preview="auto";
    state.enabled=true;selectMode.value="auto";seasonSelect.value="auto";
    moonPreview.value="auto";persist();update();
  });
  testSection.append(resetTest);settings.append(testSection);
  for(const key of KEYS){
    makeField("Image "+LABELS[key],state.images[key],(v,input)=>{
      if(v&&!allowedUrl(v)){input.setCustomValidity("Utilise /local/…, /maison3d-assets/…, /api/… ou HTTPS.");input.reportValidity();return}
      input.setCustomValidity("");state.images[key]=v;persist();update();
    },DEFAULT);
  }
  const swapLabel=document.createElement("label");swapLabel.className="checkbox";
  const swapPhotos=document.createElement("input");swapPhotos.type="checkbox";
  swapPhotos.checked=state.use_weather_photos;
  swapPhotos.addEventListener("change",()=>{
    state.use_weather_photos=swapPhotos.checked;persist();update();
  });
  swapLabel.append(swapPhotos,document.createTextNode(
    "Utiliser les images météo alternatives (facultatif)"
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
  const strengthLabel=document.createElement("label");
  strengthLabel.textContent="Intensité des animations (0 = aucune, 200 % = forte)";
  const strength=document.createElement("input");
  strength.type="range";strength.min="0";strength.max="2";strength.step="0.1";
  strength.value=String(state.effect_intensity);
  const strengthValue=document.createElement("span");
  strengthValue.textContent=Math.round(state.effect_intensity*100)+" %";
  strength.addEventListener("input",()=>{
    state.effect_intensity=Number(strength.value);
    strengthValue.textContent=Math.round(state.effect_intensity*100)+" %";
    persist();
  });
  strengthLabel.append(strength,strengthValue);settings.append(strengthLabel);
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
    "#maison3d-photo-view.photo-night:not(.effects-off) img{filter:brightness(.36) saturate(.70) contrast(1.09)}",
    "#maison3d-photo-view.photo-night .moon-phase{filter:drop-shadow(0 0 18px #cdd9ff)}",
    "#maison3d-photo-view.photo-night:not(.effects-off)::after{content:'';position:absolute;pointer-events:none;inset:0;",
    "background:radial-gradient(ellipse at 23% 10%,#d4def51c,transparent 35%),",
    "linear-gradient(180deg,#06102b29 0%,transparent 55%,#06102366 100%)}",
    "#maison3d-photo-view .photo-light{position:absolute;inset:0;pointer-events:none;transition:background 1s}",
    "#maison3d-photo-view canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
    "#maison3d-photo-status{position:absolute;top:78px;right:14px;max-width:70%;border-radius:10px;",
    "background:#101923df;padding:9px 13px;font:12px system-ui,sans-serif;color:#fff}",
    "#maison3d-photo-view .moon-phase{position:absolute;left:14px;top:85px;font-size:27px;text-shadow:0 2px 6px #000}",
    "#maison3d-photo-view .photo-error{position:absolute;top:45%;left:10%;width:80%;text-align:center;",
    "background:#972b30;color:white;border-radius:9px;padding:14px}",
    "#maison3d-photo-view .photo-error[hidden]{display:none}",
    "#maison3d-photo-settings .main-photo-preview{display:grid;gap:8px;margin:9px 0}",
    "#maison3d-photo-settings .main-photo-preview img{position:static;width:100%;height:auto;",
    "max-height:165px;object-fit:contain;border-radius:7px;background:#1d2e43}",
    "#maison3d-photo-settings .main-photo-preview img[hidden]{display:none}",
    "#maison3d-photo-seasons{position:fixed;right:12px;top:26%;z-index:9;",
    "display:grid;gap:5px;padding:7px;border-radius:12px;background:#101923ee;",
    "max-width:145px;max-height:45vh;overflow:auto}",
    "#maison3d-photo-seasons button{border:0;border-radius:7px;background:#29405b;",
    "color:white;text-align:left;padding:9px;cursor:pointer;font:12px system-ui}",
    "#maison3d-photo-seasons button[aria-pressed=true]{background:#1477dc}",
    "html:not(.photo-active) #maison3d-photo-seasons{display:none}",
    ".maison3d-test-states{border:1px solid #66778c;border-radius:8px;margin-top:12px}",
    ".maison3d-test-states legend{font-size:13px;font-weight:bold}",
    ".maison3d-test-states .test-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}",
    ".maison3d-test-states button{padding:8px;border-radius:6px}",
    ".maison3d-test-states button[aria-pressed=true]{background:#1579ea!important}",
    "@media(max-width:700px){#maison3d-photo-seasons{top:25%;right:5px;max-width:98px;",
    "padding:4px}#maison3d-photo-seasons button{padding:6px;font-size:10px}}",
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
    "#maison3d-photo-settings label input[type=text],#maison3d-photo-settings select{display:block;width:100%;",
    "box-sizing:border-box;margin-top:4px;padding:9px;color:white;background:#273c56;border:1px solid #72869a;border-radius:7px}",
    "#maison3d-photo-settings .checkbox{display:flex;align-items:center;gap:9px}",
    "html.card-mode #maison3d-photo-controls{top:auto;bottom:6px;left:6px;gap:3px}",
    "html.card-mode #maison3d-photo-controls button{padding:6px;font-size:11px}",
    "html.card-mode #maison3d-photo-status{top:8px;right:8px}",
    "html.photo-active #maison3d-presentation,html.photo-active #maison3d-weather-status{display:none!important}",
    "@media(max-width:700px){#maison3d-photo-controls{top:auto;bottom:8px;left:8px}",
    "#maison3d-photo-status{top:8px;right:8px;font-size:11px}}"
  ].join("");
  document.head.append(style);
  document.body.append(section,nav,seasonalNav,settings);
  let live={weather:null,sun:null,temperature:null,windSpeed:0,moon:null,rain:null,snow:null,cloud:null};
  let haTimeZone="UTC";
  let lastAutoSeason="";
  let currentSrc="",active="day",lastFrame=0;
  let missingBundled=new Set();
  const failedImages=new Set();
  const isCardView=new URLSearchParams(window.location.search).get("mode")==="card";
  let parentBasePhoto="";
  let particles=[];
  const seasonNow=()=>state.season!=="auto"?state.season:automaticSeason(haTimeZone);
  const nighttime=()=>{
    if(live.sun==="below_horizon")return true;
    if(live.sun==="above_horizon")return false;
    const hour=new Date().getHours();return hour<7||hour>=20;
  };
  function weatherKey(){
    if(state.mode!=="auto")return state.mode;
    const w=String(live.weather||"").toLowerCase();
    if(/lightning|storm|thunder/.test(w))return "storm";
    if(Number(live.snow)>0)return "snow";
    if(Number(live.rain)>0)return "rain";
    if(/snow|hail/.test(w))return "snow";
    if(/rain|pouring/.test(w))return "rain";
    if(/wind/.test(w))return "wind";
    if(/cloud|fog/.test(w))return "cloudy";
    if(Number(live.cloud)>=60)return "cloudy";
    if(Number(live.windSpeed)>=25)return "wind";
    if(nighttime())return "night";
    const s=seasonNow();return state.images[s]?s:"day";
  }
  const moonPhase=(value)=>{
    const raw=String(value||"").toLowerCase().trim();
    const v=raw.replace(/[\s-]+/g,"_");
    const mapping={
      new_moon:"new_moon",nouvelle_lune:"new_moon",
      waxing_crescent:"waxing_crescent",premier_croissant:"waxing_crescent",
      first_quarter:"first_quarter",premier_quartier:"first_quarter",
      waxing_gibbous:"waxing_gibbous",gibbeuse_croissante:"waxing_gibbous",
      full_moon:"full_moon",pleine_lune:"full_moon",
      waning_gibbous:"waning_gibbous",gibbeuse_decroissante:"waning_gibbous",
      last_quarter:"last_quarter",dernier_quartier:"last_quarter",
      waning_crescent:"waning_crescent",dernier_croissant:"waning_crescent"
    };
    return mapping[v]||null;
  };
  const moonSymbol=(value)=>({
    new_moon:"🌑",waxing_crescent:"🌒",first_quarter:"🌓",
    waxing_gibbous:"🌔",full_moon:"🌕",waning_gibbous:"🌖",
    last_quarter:"🌗",waning_crescent:"🌘"
  })[moonPhase(value)]||"🌙";
  function update(){
    const selected=weatherKey();
    active=selected;
    const night=state.mode==="night"||(state.mode==="auto"&&nighttime());
    const lunarKey=night&&moonPhase(live.moon)?"moon_"+moonPhase(live.moon):null;
    const bundled=(BUNDLED[selected]&&!missingBundled.has(selected))?BUNDLED[selected]:"";
    // The official photo is the default immutable scene. Explicit opt-in only
    // for alternative stills; manual weather previews remain dynamic overlays.
    const mainPhoto=resolveMainPhoto({
      parent:parentBasePhoto,local:state.base_image_url,isCard:isCardView
    });
    const candidate=state.use_weather_photos ? (
      state.images[selected]||bundled||
      (lunarKey && ["night","day"].includes(selected) ? state.images[lunarKey] : "")||
      (night?state.images.night:"")||
      (selected==="day"?state.images[seasonNow()]:"")||mainPhoto
    ) : mainPhoto;
    const path=failedImages.has(candidate)
      ?(failedImages.has(mainPhoto)?DEFAULT:mainPhoto):candidate;
    if(path!==currentSrc){currentSrc=path;image.src=path;error.hidden=true}
    const weatherTint=selected==="snow"||selected==="winter"?"linear-gradient(#e7f5ff18,#eaf7ff29)":
      selected==="storm"?"#101b3866":selected==="rain"?"#26344746":
      selected==="cloudy"?"#5b677523":"transparent";
    tint.style.background=state.effect?weatherTint:"transparent";
    tint.style.opacity=night?"1":"0.8";
    section.classList.toggle("photo-night",night);
    section.classList.toggle("effects-off",!state.effect);
    const currentMoon=state.moon_preview==="auto"?live.moon:state.moon_preview;
    const phaseName=skyMoon.normalize(currentMoon);
    skyMoon.draw(phaseName,night,state.effect&&Boolean(phaseName),state.effect_intensity);
    moon.textContent=""; // The phase is rendered on the sky, including daytime.
    for(const [key,btn] of seasonButtons)btn.setAttribute("aria-pressed",String(state.season===key));
    for(const [key,btn] of testButtons)btn.setAttribute("aria-pressed",String(state.mode===key));
    const effectLabel=LABELS[selected]||selected;
    const seasonLabel=SEASON_LABELS[seasonNow()]||seasonNow();
    status.textContent=(state.mode==="auto"?"Automatique":"Aperçu manuel")+" · "+effectLabel+" · "+seasonLabel+
      (typeof live.temperature==="number"?" · "+live.temperature+"°C":"")+
      (phaseName?" · Lune : "+String(currentMoon):"")+
      (state.moon_preview!=="auto"?" · Lune en test":"");
    nightBtn.setAttribute("aria-pressed",String(state.mode==="night"));
    dayBtn.setAttribute("aria-pressed",String(state.mode==="day"));
    autoBtn.setAttribute("aria-pressed",String(state.mode==="auto"));
    effectsBtn.textContent=state.effect?"✦ Effets ON":"○ Effets OFF";
    effectsBtn.setAttribute("aria-pressed",String(state.effect));
    photoBtn.setAttribute("aria-pressed",String(state.enabled));
    modelBtn.setAttribute("aria-pressed",String(!state.enabled && state.model_view==="3d"));
    planBtn.setAttribute("aria-pressed",String(!state.enabled && state.model_view==="2d"));
    section.hidden=!state.enabled;
    if(!state.enabled){section.style.display="none"}else{section.style.display="block"}
    document.documentElement.classList.toggle("photo-active",state.enabled);
  }
  photoBtn.addEventListener("click",()=>{state.enabled=true;persist();update()});
  const setQuickMode=mode=>{
    state.enabled=true;state.mode=mode;
    selectMode.value=mode;
    if(mode==="auto"){state.season="auto";state.moon_preview="auto";seasonSelect.value="auto";moonPreview.value="auto"}
    persist();update();
  };
  nightBtn.addEventListener("click",()=>setQuickMode("night"));
  dayBtn.addEventListener("click",()=>setQuickMode("day"));
  autoBtn.addEventListener("click",()=>setQuickMode("auto"));
  const setModelView=view=>{
    state.enabled=false;state.model_view=view;
    settings.hidden=true;
    persist();update();
    // Reuse the existing camera controls so the editor remains consistent.
    document.getElementById(view==="2d"?"topview":"tab3d")?.click();
  };
  planBtn.addEventListener("click",()=>setModelView("2d"));
  modelBtn.addEventListener("click",()=>setModelView("3d"));
  optionsBtn.addEventListener("click",()=>{settings.hidden=!settings.hidden});
  close.addEventListener("click",()=>{settings.hidden=true});
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
  function requestEntities(){
    // Explicit request; only this iframe's parent is allowed to receive it.
    if(window.parent===window)return;
    window.parent.postMessage({type:"maison3d:entity-selection",weather_entity:state.weather_entity,
      sun_entity:state.sun_entity,moon_entity:state.moon_entity,
      temperature_entity:state.temperature_entity,wind_entity:state.wind_entity,
      rain_entity:state.rain_entity,snow_entity:state.snow_entity,
      cloud_entity:state.cloud_entity},window.location.origin);
  }
  window.addEventListener("message",event=>{
    if(event.source!==window.parent||event.origin!==window.location.origin)return;
    if(event.data?.type!=="maison3d:conditions")return;
    const globalEffects=event.data.effects_enabled!==false;
    state.effect=typeof state.effect_override==="boolean"?state.effect_override:globalEffects;
    effect.checked=state.effect;
    const supplied=event.data.base_image_url;
    parentBasePhoto=allowedUrl(supplied)?supplied:"";
    if(event.data.images && typeof event.data.images==="object"){
      for(const k of KEYS){
        const path=event.data.images[k];
        if(allowedUrl(path))state.images[k]=path;
      }
    }
    if(typeof event.data.time_zone==="string"&&event.data.time_zone.length<100)haTimeZone=event.data.time_zone;
    live={
      weather:typeof event.data.weather==="string"?event.data.weather:null,
      sun:typeof event.data.sun==="string"?event.data.sun:null,
      temperature:Number.isFinite(event.data.temperature)?event.data.temperature:null,
      windSpeed:Number.isFinite(event.data.windSpeed)?event.data.windSpeed:0,
      moon:typeof event.data.moon==="string"?event.data.moon:null,
      rain:Number.isFinite(event.data.rain)?event.data.rain:null,
      snow:Number.isFinite(event.data.snow)?event.data.snow:null,
      cloud:Number.isFinite(event.data.cloud)?event.data.cloud:null
    };
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
      return;
    }
    const w=section.clientWidth,h=section.clientHeight;
    if(w<=0||h<=0)return;
    if(Math.abs(canvas.width-w*(Math.min(devicePixelRatio||1,2)))>2)resize();
    ctx.clearRect(0,0,w,h);
    const currentSeason=seasonNow();
    if(currentSeason!==lastAutoSeason){lastAutoSeason=currentSeason;update()}
    const kind=state.mode==="auto"?weatherKey():state.mode;
    const isNight=state.mode==="night"||(state.mode==="auto"&&nighttime());
    cinematics.frame(time,kind,seasonNow(),live.windSpeed,state.effect_intensity,isNight,true);
    seasonalEffects.frame(time,seasonNow(),state.effect_intensity,isNight,true);
    const count=kind==="snow"?180:
      kind==="rain"?190:kind==="storm"?235:
      kind==="wind"?100:0;
    const type=kind;
    const scaledCount=Math.floor(count*Math.min(state.effect_intensity,2));
    while(particles.length<scaledCount)particles.push(spawn(w,h));
    particles.length=scaledCount;
    const windy=type==="wind"||live.windSpeed>18;
    for(let i=0;i<scaledCount;i++){
      const p=particles[i];
      if(type==="snow"){
        ctx.fillStyle="#f7fbffdf";ctx.beginPath();ctx.arc(p.x,p.y,1.1+p.speed,0,Math.PI*2);ctx.fill();
        p.y+=p.speed*1.3;p.x+=Math.sin(time*.001+p.turn)*.75;
      }else if(type==="rain"||type==="storm"){
        ctx.strokeStyle="#b6dfffbd";ctx.lineWidth=1.1;
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-4,p.y+18);ctx.stroke();
        p.y+=p.speed*8;p.x+=1.2;
      }else{
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(time*.001+p.turn);
        if(type==="petals"){
          ctx.fillStyle=["#f9cadd","#ef9abf","#fff0f6"][i%3];
          ctx.beginPath();ctx.ellipse(0,0,4,2.5,.4,0,Math.PI*2);ctx.fill();
        }else{
          ctx.fillStyle=["#d39b31","#ad5f22","#c17832"][i%3];
          ctx.fillRect(-3,-5,6,10);
        }
        ctx.restore();
        p.y+=p.speed*(type==="wind"?.55:1.1);
        p.x+=(windy?3:1)+Math.sin(time*.001+p.turn);
      }
      if(p.y>h+12||p.x>w+15){p.x=Math.random()*w;p.y=-15}
    }
    if(type==="wind" || (state.mode==="auto" && live.windSpeed>=25)){
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
    if(type==="storm" && Math.random()<.015){
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
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){resize();cinematics.resize();seasonalEffects.resize();update()}});
  requestEntities();
  update();
  if(!state.enabled && state.model_view==="2d"){
    document.getElementById("topview")?.click();
  }
  return {frame,update,state};
}
