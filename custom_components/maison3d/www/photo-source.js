/** Shared safe image URL selection for Lovelace and the photo view. */
export const DEFAULT_MAIN_PHOTO="/maison3d-assets/maison3d-reference.jpg";

export function allowedPhotoUrl(value){
  if(typeof value!=="string"||value.length>500||/[\u0000-\u001f]/.test(value))return false;
  // /maison3d-media/ = photos uploaded from Home Assistant, /media/ = signed URL of a HA media.
  if(["/local/","/maison3d-assets/","/maison3d-media/","/media/","/api/"].some(prefix=>value.startsWith(prefix))){
    return !value.includes("\\")&&!value.startsWith("//");
  }
  if(!value.startsWith("https://"))return false;
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&Boolean(url.hostname)&&!url.username&&!url.password;
  }catch{return false}
}

/**
 * Panel: an explicitly set local override takes priority over integration options.
 * Lovelace: the parent supplies card > integration and ignores iframe-local storage.
 */
export function resolveMainPhoto({parent="",local="",isCard=false}={}){
  const options=isCard?[parent]:[local,parent];
  return options.find(allowedPhotoUrl)||DEFAULT_MAIN_PHOTO;
}

/** Weather keys that have a day and a night photo slot. */
export const WEATHER_VARIANTS=["cloudy","rain","snow","wind","storm","fog"];
const WEATHER_LABELS={cloudy:"Nuageux",rain:"Pluie",snow:"Neige",wind:"Vent",storm:"Orage",fog:"Brouillard"};

/** Every custom image slot (key → label), shared by the photo view and the card editor. */
export const IMAGE_SLOTS=[
  ["day","Jour"],["night","Nuit"],
  ...WEATHER_VARIANTS.flatMap(k=>[[k,WEATHER_LABELS[k]],[k+"_day",WEATHER_LABELS[k]+" jour"],[k+"_night",WEATHER_LABELS[k]+" nuit"]]),
  ["spring","Printemps"],["summer","Été"],["autumn","Automne"],["winter","Hiver"],
  ["moon_new_moon","Nouvelle lune"],["moon_waxing_crescent","Premier croissant"],
  ["moon_first_quarter","Premier quartier"],["moon_waxing_gibbous","Lune gibbeuse croissante"],
  ["moon_full_moon","Pleine lune"],["moon_waning_gibbous","Lune gibbeuse décroissante"],
  ["moon_last_quarter","Dernier quartier"],["moon_waning_crescent","Dernier croissant"]
];
export const IMAGE_KEYS=IMAGE_SLOTS.map(([key])=>key);

/**
 * Photos shipped in www/images/, named <météo>-<jour|nuit>.jpg (generated from
 * the reference photo by scripts/generate_variant_images.py, without any drawn
 * interface). jour.jpg, nuageux.jpg, pluie.jpg and neige.jpg stay available for
 * existing configurations but are no longer picked automatically.
 */
const IMG="/maison3d-assets/images/";
const FILES={day:"clair",cloudy:"nuageux",rain:"pluie",snow:"neige",wind:"vent",storm:"orage",fog:"brouillard"};
export const BUNDLED_IMAGES=Object.fromEntries(Object.entries(FILES).flatMap(([key,file])=>key==="day"
  ?[["day",IMG+file+"-jour.jpg"],["night",IMG+file+"-nuit.jpg"]]
  :[[key+"_day",IMG+file+"-jour.jpg"],[key+"_night",IMG+file+"-nuit.jpg"]]));

/**
 * Alternative photo for a weather kind and time of day. Order:
 * custom day/night slot → custom weather slot → bundled day/night →
 * custom (moon/season/)day or night → bundled clear day or night → main photo.
 * nightPhoto tells the view the picture is already a night shot (no extra darkening).
 */
export function pickWeatherPhoto({kind="day",night=false,season="",lunarKey="",images={},mainPhoto=DEFAULT_MAIN_PHOTO,bundled=BUNDLED_IMAGES}={}){
  const tod=night?"night":"day";
  // Bundled photos show the reference house: skip them when the user has set their own main photo.
  if(mainPhoto!==DEFAULT_MAIN_PHOTO)bundled={};
  const custom=key=>allowedPhotoUrl(images[key])?images[key]:"";
  const chain=[];
  if(WEATHER_VARIANTS.includes(kind)){
    chain.push([custom(kind+"_"+tod),night],[custom(kind),false],
      [bundled[kind+"_"+tod]||"",night]);
  }
  if(night)chain.push([lunarKey?custom(lunarKey):"",true],[custom("night"),true],[bundled.night||"",true]);
  else chain.push([season?custom(season):"",false],[custom("day"),false],[bundled.day||"",false]);
  const hit=chain.find(([path])=>path);
  return hit?{path:hit[0],nightPhoto:hit[1]}:{path:mainPhoto,nightPhoto:false};
}

/** Suggested file name in /config/www/maison3d/ for a custom image slot (documented in the README). */
const FR_NAMES={day:"jour",night:"nuit",cloudy:"nuageux",rain:"pluie",snow:"neige",wind:"vent",storm:"orage",fog:"brouillard",
  spring:"printemps",summer:"ete",autumn:"automne",winter:"hiver"};
export function suggestedFileName(key){
  const [base,variant]=String(key).split(/_(?=day$|night$)/);
  if(key.startsWith("moon_"))return "lune-"+key.slice(5).replace(/_/g,"-")+".jpg";
  return (FR_NAMES[base]||base)+(variant?"-"+(variant==="day"?"jour":"nuit"):"")+".jpg";
}
