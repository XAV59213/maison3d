/**
 * Maison 3D photo-real view. Uses the owner's original screenshot as the
 * default photo; conditions/seasons are distinct configurable image URL slots.
 * This is a photo-based presentation, NOT a rotatable 3D reconstruction.
 */
import {createPhotoCinematics} from "./photo-cinematics.js";
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
  const DEFAULT="/maison3d-assets/maison3d-reference.jpg";
  const BUNDLED={
    day:"/maison3d-assets/images/jour.jpg",
    cloudy:"/maison3d-assets/images/nuageux.jpg",
    rain:"/maison3d-assets/images/pluie.jpg",
    snow:"/maison3d-assets/images/neige.jpg"
  };
  const STORAGE="maison3d:photo-settings:v1";
  const allowedUrl=(url)=>typeof url==="string" && (
    url.startsWith("/local/") || url.startsWith("/maison3d-assets/") ||
    url.startsWith("/api/") || /^https:\/\//i.test(url)
  );
  const defaults=()=>Object.fromEntries(KEYS.map(k=>[k,""]));
  const state={
    images:defaults(),moon_entity:"sensor.moon_phase",
    weather_entity:"",sun_entity:"sun.sun",
    temperature_entity:"",wind_entity:"",rain_entity:"",snow_entity:"",cloud_entity:"",
    enabled:true,mode:"auto",effect:true,season:"auto",effect_intensity:1
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
      if(typeof saved.enabled==="boolean")state.enabled=saved.enabled;
      if(typeof saved.effect==="boolean")state.effect=saved.effect;
      if(Number.isFinite(saved.effect_intensity))state.effect_intensity=Math.min(2,Math.max(0,saved.effect_intensity));
      if(typeof saved.mode==="string"&&["auto",...KEYS].includes(saved.mode))state.mode=saved.mode;
      if(typeof saved.season==="string"&&["auto","spring","summer","autumn","winter"].includes(saved.season))state.season=saved.season;
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
  section.append(image,tint,cinematicCanvas,canvas,status,moon,error);
  const cinematics=createPhotoCinematics(cinematicCanvas);
  const nav=document.createElement("nav");
  nav.id="maison3d-photo-controls";
  const photoBtn=document.createElement("button");
  photoBtn.type="button";photoBtn.textContent="▣ Photo réelle";
  const modelBtn=document.createElement("button");
  modelBtn.type="button";modelBtn.textContent="⬡ 3D éditable";
  const optionsBtn=document.createElement("button");
  optionsBtn.type="button";optionsBtn.textContent="⚙ Images / météo";
  nav.append(photoBtn,modelBtn,optionsBtn);
  const settings=document.createElement("section");
  settings.id="maison3d-photo-settings";settings.hidden=true;
  const head=document.createElement("div");
  head.className="settings-head";
  const h=document.createElement("strong");h.textContent="Images et saisons personnalisées";
  const close=document.createElement("button");close.type="button";close.textContent="✕ Fermer";
  head.append(h,close);settings.append(head);
  const note=document.createElement("p");note.textContent=
    "Chaque image doit représenter la même propriété et la même perspective. Laissez une URL vide pour utiliser la photo officielle. URL /local/… ou https://… ; les images restent sur Home Assistant ou votre hébergeur.";
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
    ["auto","Automatique (Home Assistant)"],...KEYS.map(k=>[k,LABELS[k]])
  ],state.mode,v=>{state.mode=v;persist();update();});
  selectField("Saison",[
    ["auto","Automatique (calendrier)"],
    ["spring","Printemps"],["summer","Été"],["autumn","Automne"],["winter","Hiver"]
  ],state.season,v=>{state.season=v;persist();update();});
  for(const key of KEYS){
    makeField("Image "+LABELS[key],state.images[key],(v,input)=>{
      if(v&&!allowedUrl(v)){input.setCustomValidity("Utilise /local/…, /maison3d-assets/…, /api/… ou HTTPS.");input.reportValidity();return}
      input.setCustomValidity("");state.images[key]=v;persist();update();
    },DEFAULT);
  }
  const checkbox=document.createElement("label");checkbox.className="checkbox";
  const effect=document.createElement("input");effect.type="checkbox";effect.checked=state.effect;
  effect.addEventListener("change",()=>{state.effect=effect.checked;persist();update()});
  checkbox.append(effect,document.createTextNode("Animations météo"));settings.append(checkbox);
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
    selectMode.value="auto";update();
  });settings.append(reset);
  const style=document.createElement("style");
  style.textContent=[
    "#maison3d-photo-view{position:fixed;inset:0;z-index:5;overflow:hidden;background:#111c2d}",
    "#maison3d-photo-view img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
    "#maison3d-photo-view .photo-light{position:absolute;inset:0;pointer-events:none;transition:background 1s}",
    "#maison3d-photo-view canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
    "#maison3d-photo-status{position:absolute;top:78px;right:14px;max-width:70%;border-radius:10px;",
    "background:#101923df;padding:9px 13px;font:12px system-ui,sans-serif;color:#fff}",
    "#maison3d-photo-view .moon-phase{position:absolute;left:14px;top:85px;font-size:27px;text-shadow:0 2px 6px #000}",
    "#maison3d-photo-view .photo-error{position:absolute;top:45%;left:10%;width:80%;text-align:center;",
    "background:#972b30;color:white;border-radius:9px;padding:14px}",
    "#maison3d-photo-view .photo-error[hidden]{display:none}",
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
  document.body.append(section,nav,settings);
  let live={weather:null,sun:null,temperature:null,windSpeed:0,moon:null,rain:null,snow:null,cloud:null};
  let currentSrc="",active="day",lastFrame=0;
  let missingBundled=new Set();
  let particles=[];
  const seasonNow=()=>{
    if(state.season!=="auto")return state.season;
    const month=new Date().getMonth();
    return month>=2&&month<=4?"spring":month>=5&&month<=7?"summer":
      month>=8&&month<=10?"autumn":"winter";
  };
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
    const path=state.images[selected]||bundled||
      (lunarKey && ["night","day"].includes(selected) ? state.images[lunarKey] : "")||
      (night?state.images.night:"")||
      (selected==="day"?state.images[seasonNow()]:"")||DEFAULT;
    if(path!==currentSrc){image.src=path;currentSrc=path;error.hidden=true}
    tint.style.background=selected==="snow"?"linear-gradient(#f6fcff15,#f0f8ff25)":
      selected==="storm"?"#101b3866":selected==="rain"?"#26344746":
      selected==="cloudy"?"#5b677523":night?"#03132685":"transparent";
    moon.textContent=night?moonSymbol(live.moon):"";
    const effectLabel=LABELS[selected]||selected;
    status.textContent=(state.mode==="auto"?"Automatique":"Aperçu manuel")+" · "+effectLabel+
      (typeof live.temperature==="number"?" · "+live.temperature+"°C":"")+
      (live.moon&&night?" · Lune : "+String(live.moon):"");
    realBtn.setAttribute("aria-pressed",String(state.enabled));
    modelBtn.setAttribute("aria-pressed",String(!state.enabled));
    section.hidden=!state.enabled;
    if(!state.enabled){section.style.display="none"}else{section.style.display="block"}
    document.documentElement.classList.toggle("photo-active",state.enabled);
  }
  photoBtn.addEventListener("click",()=>{state.enabled=true;persist();update()});
  modelBtn.addEventListener("click",()=>{state.enabled=false;persist();settings.hidden=true;update()});
  optionsBtn.addEventListener("click",()=>{settings.hidden=!settings.hidden});
  close.addEventListener("click",()=>{settings.hidden=true});
  image.addEventListener("error",()=>{
    const bundledKey=Object.keys(BUNDLED).find(k=>BUNDLED[k]===currentSrc);
    if(bundledKey) {
      missingBundled.add(bundledKey);
      currentSrc=DEFAULT;
      image.src=DEFAULT;
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
    if(event.data.images && typeof event.data.images==="object"){
      for(const k of KEYS){
        const path=event.data.images[k];
        if(allowedUrl(path))state.images[k]=path;
      }
    }
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
      return;
    }
    const w=section.clientWidth,h=section.clientHeight;
    if(w<=0||h<=0)return;
    if(Math.abs(canvas.width-w*(Math.min(devicePixelRatio||1,2)))>2)resize();
    ctx.clearRect(0,0,w,h);
    const kind=state.mode==="auto"?weatherKey():state.mode;
    const isNight=state.mode==="night"||(state.mode==="auto"&&nighttime());
    cinematics.frame(time,kind,seasonNow(),live.windSpeed,state.effect_intensity,isNight,true);
    const count=kind==="snow"?110:kind==="rain"?170:kind==="storm"?210:
      kind==="wind"?75:seasonNow()==="autumn"?42:0;
    const type=count && !["snow","rain","storm","wind"].includes(kind)?"leaves":kind;
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
        ctx.fillStyle=["#d39b31","#ad5f22","#c17832"][i%3];
        ctx.fillRect(-3,-5,6,10);ctx.restore();
        p.y+=p.speed*(type==="wind"?.55:1.1);
        p.x+=(windy?3:1)+Math.sin(time*.001+p.turn);
      }
      if(p.y>h+12||p.x>w+15){p.x=Math.random()*w;p.y=-15}
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
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){resize();cinematics.resize()}});
  requestEntities();
  update();
  return {frame,update,state};
}
