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

/** Moon sensor for automatic detection; rank prefers an English slug. */
export function isMoon(entity){
  const id=entity?.entity_id;
  if(typeof id!=="string"||!id.startsWith("sensor.")||["unavailable","unknown"].includes(entity.state))return false;
  return /moon|lune/.test(id)||moonPhase(entity.state)!==null;
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
 * rain: Jaune/Orange → rain, Rouge → storm (storm_alert). snow: Jaune+ → snow;
 * ice_alert when the snow sensor talks about ice (verglas) and is at Jaune+.
 */
export function precipitation(rainEntity,snowEntity){
  const rain=readSensor(rainEntity),snow=readSensor(snowEntity);
  return {
    rain:rain.value,
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
