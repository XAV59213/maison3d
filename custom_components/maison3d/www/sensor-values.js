/**
 * Maison 3D — reading the Home Assistant sensors chosen for the weather.
 * Shared by the card, the panel (payload sent to the view) and photo-view.js
 * (ambience choice and warnings in the ⚙ menu).
 *
 * Accepted values for rain / snow / cloud sensors:
 *  - numbers (intensity, mm/h, %…): unchanged behaviour;
 *  - on / off (binary_sensor): 1 / 0;
 *  - Météo-France vigilance colours « Vert / Jaune / Orange / Rouge »
 *    (also green / yellow / orange / red, any case, « Vigilance jaune »…).
 */
export const VIGILANCE_LEVELS={vert:0,green:0,jaune:1,yellow:1,orange:2,rouge:3,red:3};
const BINARY={on:1,off:0};
export const fold=value=>String(value??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

/** 0 green, 1 yellow, 2 orange, 3 red; null when the text is not a vigilance colour. */
export function vigilanceLevel(state){
  const text=fold(state);
  if(text in VIGILANCE_LEVELS)return VIGILANCE_LEVELS[text];
  const match=text.match(/(?:^|[^a-z])(vert|green|jaune|yellow|orange|rouge|red)(?:[^a-z]|$)/);
  return match?VIGILANCE_LEVELS[match[1]]:null;
}

const MOON_PHASES={
  new_moon:"new_moon",nouvelle_lune:"new_moon",
  waxing_crescent:"waxing_crescent",premier_croissant:"waxing_crescent",
  first_quarter:"first_quarter",premier_quartier:"first_quarter",
  waxing_gibbous:"waxing_gibbous",gibbeuse_croissante:"waxing_gibbous",lune_gibbeuse_croissante:"waxing_gibbous",
  full_moon:"full_moon",pleine_lune:"full_moon",
  waning_gibbous:"waning_gibbous",gibbeuse_decroissante:"waning_gibbous",lune_gibbeuse_decroissante:"waning_gibbous",
  last_quarter:"last_quarter",dernier_quartier:"last_quarter",
  waning_crescent:"waning_crescent",dernier_croissant:"waning_crescent"
};
/** Moon phase slug (English or French, any case/accents) → new_moon … waning_crescent, else null. */
export function moonPhase(value){
  if(typeof value!=="string")return null;
  return MOON_PHASES[fold(value).replace(/[\s-]+/g,"_")]||null;
}

/**
 * Moon sensor (automatic detection and ⚙ selector): a sensor whose state is a
 * known phase (French or English). The id alone is not enough: « phase_lune_anecdote »
 * or an illumination % are not phases. rank prefers an English slug.
 */
export function isMoon(entity){
  const id=entity?.entity_id;
  if(typeof id!=="string"||!id.startsWith("sensor."))return false;
  return moonPhase(entity.state)!==null;
}
export function moonRank(entity){
  const id=String(entity?.entity_id||"");
  return (/moon/.test(id)?4:/lune/.test(id)?2:0)+(moonPhase(entity?.state)?1:0);
}

/** Ice in the entity id or name: « verglas », « ice » (as a word), « icy », « black_ice ». */
export const mentionsIce=entity=>{
  const text=fold(entity?.entity_id)+" "+fold(entity?.attributes?.friendly_name);
  return /verglas|(?:^|[^a-z])(?:ice|icy|icing)(?:[^a-z]|$)/.test(text);
};

/**
 * Read one sensor. Returns {value, vigilance, issue}:
 *  value: number (numeric state, on → 1, off → 0, vigilance level) or null;
 *  vigilance: 0..3 when the state is a vigilance colour, else null;
 *  issue: null | "missing" | "unavailable" | "unknown" | "unrecognized".
 */
export function readSensor(entity,{allowVigilance=true}={}){
  if(!entity)return {value:null,vigilance:null,issue:"missing"};
  const raw=entity.state;
  const text=fold(raw);
  if(text==="unavailable"||text==="unknown"||text==="")return {value:null,vigilance:null,issue:text||"unknown"};
  if(text in BINARY)return {value:BINARY[text],vigilance:null,issue:null};
  const number=Number(raw);
  if(Number.isFinite(number))return {value:number,vigilance:null,issue:null};
  const level=allowVigilance?vigilanceLevel(raw):null;
  if(level!==null)return {value:level,vigilance:level,issue:null};
  return {value:null,vigilance:null,issue:"unrecognized"};
}

/**
 * Payload fields for the photo view from the chosen rain / snow / cloud sensors.
 * rain: Orange → rain, Rouge → storm (storm_alert), Jaune → only if the weather is rainy. snow: Jaune+ → snow;
 * ice_alert when the snow sensor talks about ice (verglas) and is at Jaune+.
 */
export function precipitation(rainEntity,snowEntity){
  const rain=readSensor(rainEntity),snow=readSensor(snowEntity);
  return {
    // A yellow rain vigilance alone does not force rain (the weather decides);
    // orange and red always do.
    rain:rain.vigilance===1?0:rain.value,
    snow:snow.value,
    storm_alert:rain.vigilance!==null&&rain.vigilance>=3,
    ice_alert:snow.vigilance!==null&&snow.vigilance>=1&&mentionsIce(snowEntity)
  };
}

/** Sensors with a problem, for the discreet warnings in the settings. */
const KINDS={weather_entity:"state",sun_entity:"sun",moon_entity:"moon",temperature_entity:"number",
  wind_entity:"number",rain_entity:"level",snow_entity:"level",cloud_entity:"onoff"};
export function sensorIssue(key,entity){
  if(!entity)return "missing";
  const text=fold(entity.state);
  if(text==="unavailable"||text==="unknown")return text;
  const kind=KINDS[key];
  if(kind==="moon")return moonPhase(entity.state)?null:"unrecognized";
  if(kind==="sun")return ["above_horizon","below_horizon"].includes(text)?null:"unrecognized";
  if(kind==="number")return Number.isFinite(Number(entity.state))&&text!==""?null:"unrecognized";
  if(kind==="level")return readSensor(entity).issue;
  if(kind==="onoff")return readSensor(entity,{allowVigilance:false}).issue;
  return null;
}
/** {key: {entity_id, issue, state}} for every chosen entity that has a problem. */
export function sensorIssues(choices,states){
  const issues={};
  for(const key of Object.keys(KINDS)){
    const id=choices[key];
    if(!id)continue;
    const entity=states?.[id];
    const issue=sensorIssue(key,entity);
    if(issue)issues[key]={entity_id:id,issue,state:entity?String(entity.state).slice(0,40):null};
  }
  return issues;
}
const EXPECTED={moon_entity:"phase de lune attendue",sun_entity:"above_horizon / below_horizon attendu",
  temperature_entity:"nombre attendu",wind_entity:"nombre attendu",cloud_entity:"pourcentage ou on/off attendu",
  rain_entity:"nombre, on/off ou vigilance Vert/Jaune/Orange/Rouge attendu",
  snow_entity:"nombre, on/off ou vigilance Vert/Jaune/Orange/Rouge attendu"};
/** Short French warning for the settings (empty when there is nothing to say). */
export function issueText(item,key=""){
  if(!item)return "";
  const shown=item.state?" « "+item.state+" »":"";
  return {missing:"⚠ "+item.entity_id+" introuvable",
    unavailable:"⚠ "+item.entity_id+" indisponible",
    unknown:"⚠ "+item.entity_id+" : valeur inconnue",
    unrecognized:"⚠ Valeur non reconnue"+shown+(EXPECTED[key]?" ("+EXPECTED[key]+")":"")}[item.issue]||"";
}

/**
 * Ambience from the live data (null = no weather signal, keep night/season).
 * Order: storm text → red rain vigilance → snow (ice + ≤ 0 °C → frost) → rain → text…
 */
export function weatherKind({weather,rain,snow,cloud,windSpeed,stormAlert=false,iceAlert=false,celsius=null,frostEnabled=true}){
  const w=String(weather||"").toLowerCase();
  if(/lightning|storm|thunder/.test(w)||stormAlert)return "storm";
  if(Number(snow)>0){
    if(iceAlert&&frostEnabled&&Number.isFinite(celsius)&&celsius<=0)return "frost";
    return "snow";
  }
  if(Number(rain)>0)return "rain";
  if(/snow|hail/.test(w))return "snow";
  if(/rain|pouring/.test(w))return "rain";
  if(/wind/.test(w))return "wind";
  if(/fog|mist|brouillard/.test(w))return "fog";
  if(/cloud/.test(w))return "cloudy";
  if(Number(cloud)>=60)return "cloudy";
  if(Number(windSpeed)>=25)return "wind";
  return null;
}

/* ---------- Entity choice: effective value, where it comes from, candidates ---------- */
export const ENTITY_KEYS=["weather_entity","sun_entity","moon_entity","temperature_entity",
  "wind_entity","rain_entity","snow_entity","cloud_entity"];
// Placeholders saved by the ⚙ menu before v2.5.2: never real choices.
export const LEGACY_MENU_DEFAULTS={moon_entity:"sensor.moon_phase",sun_entity:"sun.sun"};
const ENTITY_ID=/^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
/** A choice made in the ⚙ menu: "" (inherit) unless it is a real entity id. */
export function menuChoice(key,value){
  if(typeof value!=="string")return "";
  const id=value.trim().slice(0,150);
  if(!id||LEGACY_MENU_DEFAULTS[key]===id)return "";
  return id;
}
export const SOURCE_LABELS={card:"configuration de la carte",menu:"choisie dans ce menu",
  integration:"configuration de l'intégration",auto:"détection automatique",default:"valeur par défaut",none:"aucune"};
/**
 * layers: [[source, {key: entity_id}], …] by priority; detected: {key: entity_id} found
 * automatically (weather / moon) or by default (sun.sun). → {key: {entity_id, source}}.
 */
export function effectiveEntities(layers,detected={}){
  const out={};
  for(const key of ENTITY_KEYS){
    let pick=null;
    for(const [source,values] of layers){
      const id=values?.[key];
      if(typeof id==="string"&&id.trim()){pick={entity_id:id.trim().slice(0,150),source};break}
    }
    if(!pick&&detected[key]?.entity_id)pick={entity_id:detected[key].entity_id,source:detected[key].source||"auto"};
    out[key]=pick||{entity_id:"",source:"none"};
  }
  return out;
}

const TEMP_UNITS=new Set(["°c","°f","k","c","f"]);
const WIND_UNITS=new Set(["km/h","m/s","mph","kn","kt","knots","ft/s","bft","beaufort"]);
const word=(text,re)=>re.test(fold(text));
const deviceClass=entity=>fold(entity?.attributes?.device_class);
const unit=entity=>fold(entity?.attributes?.unit_of_measurement);
const domain=entity=>String(entity?.entity_id||"").split(".")[0];
const label=entity=>String(entity?.entity_id||"")+" "+(entity?.attributes?.friendly_name||"");
// Words at the start of a token only: « bermerain » (a place name) is not « rain ».
const at=words=>new RegExp("(?:^|[^a-z])(?:"+words+")");
const rainWords=at("rain|pluie|pluvio|inond|flood|precip");
const snowWords=at("snow|neige|verglas|ice|icy");
const cloudWords=at("cloud|nuage|nebulosit|couverture");
const notCloud=at("humid|disk|disque|battery|batterie");
const notWind=at("pace|allure");
/** Does this entity fit the field? (filters of the ⚙ menu and of the card editor) */
export function entityMatches(key,entity){
  const id=String(entity?.entity_id||"");
  if(!ENTITY_ID.test(id))return false;
  const d=domain(entity),dc=deviceClass(entity),u=unit(entity);
  switch(key){
    case "weather_entity":return d==="weather";
    case "sun_entity":return d==="sun";
    case "moon_entity":return isMoon(entity);
    case "temperature_entity":return d==="sensor"&&(dc==="temperature"||(!dc&&TEMP_UNITS.has(u)));
    // device_class wind_speed first; a speed unit alone is accepted, but never a pace (allure).
    case "wind_entity":return d==="sensor"&&!word(label(entity),notWind)&&(dc==="wind_speed"||(!dc&&WIND_UNITS.has(u)));
    // A cloud word AND a percentage (or on/off), never humidity, disk or battery.
    case "cloud_entity":
      if(d!=="sensor"&&d!=="binary_sensor")return false;
      if(dc==="humidity"||dc==="battery"||word(label(entity),notCloud))return false;
      return word(label(entity),cloudWords)&&(d==="binary_sensor"||u==="%");
    // Rain: a rain / flood word or a precipitation device_class (never a leak / moisture
    // detector, « alerte_canicule » or « Bermerain »).
    case "rain_entity":
      if(d==="binary_sensor")return word(label(entity),rainWords);
      return d==="sensor"&&(dc==="precipitation"||dc==="precipitation_intensity"||word(label(entity),rainWords));
    // Snow: a snow / ice word only.
    case "snow_entity":
      return (d==="sensor"||d==="binary_sensor")&&word(label(entity),snowWords);
    default:return false;
  }
}
// Best candidates first (the field's own words, the right device_class), then by name.
function preference(key,entity){
  const text=fold(label(entity));
  if(key==="rain_entity")return /(?:^|[^a-z])(?:rain|pluie|pluvio|inond|flood)/.test(text)?0:1;
  if(key==="snow_entity")return /(?:^|[^a-z])(?:snow|neige|verglas)/.test(text)?0:1;
  if(key==="wind_entity")return deviceClass(entity)==="wind_speed"?0:1;
  if(key==="moon_entity")return -moonRank(entity);
  return 0;
}

/* ---------- Wind speed in km/h (thresholds of the view are in km/h) ---------- */
const BEAUFORT_KMH=[0,3,9,16,24,34,45,56,68,81,95,110,120];
/** Convert a wind speed to km/h from its unit (km/h, m/s, mph, kn, ft/s, Beaufort). Unknown unit = km/h. */
export function toKmh(value,unitText=""){
  const v=Number(value);
  if(!Number.isFinite(v))return null;
  const u=fold(unitText).replace(/\s+/g,"");
  if(u==="m/s"||u==="ms")return v*3.6;
  if(u==="mph"||u==="mi/h")return v*1.609344;
  if(u==="kn"||u==="kt"||u==="kts"||u==="knot"||u==="knots"||u==="noeuds"||u==="nd")return v*1.852;
  if(u==="ft/s"||u==="fps")return v*1.09728;
  if(u==="bft"||u==="beaufort"||u==="bf"){const b=Math.max(0,Math.min(12,Math.round(v)));return BEAUFORT_KMH[b]}
  return v;
}
/** {key: [{id, name}]} for every field; one pass over the states, on request only. */
export function entityOptions(states,limit=300){
  const out=Object.fromEntries(ENTITY_KEYS.map(key=>[key,[]]));
  for(const id in states||{}){
    const entity=states[id];
    for(const key of ENTITY_KEYS)if(entityMatches(key,entity))out[key].push(entity);
  }
  for(const key of ENTITY_KEYS){
    out[key]=out[key]
      .sort((a,b)=>preference(key,a)-preference(key,b)||entityName(a).localeCompare(entityName(b),"fr"))
      .slice(0,limit)
      .map(entity=>({id:entity.entity_id,name:entityName(entity)}));
  }
  return out;
}
export const entityName=entity=>{
  const name=entity?.attributes?.friendly_name;
  return typeof name==="string"&&name.trim()?name.trim().slice(0,80):String(entity?.entity_id||"");
};
/**
 * Wind for the view, always in km/h: the wind sensor (its own unit_of_measurement)
 * when it has a number, otherwise the weather entity (its wind_speed_unit).
 */
export function windKmh(windEntity,weatherAttributes={}){
  const own=windEntity?readSensor(windEntity,{allowVigilance:false}).value:null;
  if(own!==null)return toKmh(own,windEntity.attributes?.unit_of_measurement||"");
  const speed=weatherAttributes?.wind_speed;
  return typeof speed==="number"?toKmh(speed,weatherAttributes.wind_speed_unit||""):null;
}
