/** Shared safe image URL selection for Lovelace and the photo view. */
export const DEFAULT_MAIN_PHOTO="/maison3d-assets/maison3d-reference.webp";

/**
 * Bundled photos are WebP. Old configurations may still point to
 * /maison3d-assets/…/*.jpg, or to the retired unsuffixed files jour / nuageux /
 * pluie / neige: map them to the current WebP (clair-jour, nuageux-jour, …).
 * User photos (/local/, /maison3d-media/, HTTPS…) are never touched.
 */
const LEGACY_NAMES={jour:"clair-jour",nuageux:"nuageux-jour",pluie:"pluie-jour",neige:"neige-jour"};
const LEGACY_NAME=/^(\/maison3d-assets\/images\/)(jour|nuageux|pluie|neige)\.(?:jpe?g|webp)(\?.*)?$/;
const LEGACY_BUNDLED=/^(\/maison3d-assets\/(?:images\/[a-z-]+|maison3d-reference))\.jpe?g(\?.*)?$/;
export function bundledPhoto(value){
  if(typeof value!=="string")return value;
  const named=value.match(LEGACY_NAME);
  if(named)return named[1]+LEGACY_NAMES[named[2]]+".webp"+(named[3]||"");
  return value.replace(LEGACY_BUNDLED,"$1.webp$2");
}

/** Max wait for the first Home Assistant weather payload before loading the photo (ms). */
export const WEATHER_WAIT_MS=1500;
export function shouldDeferFirstPhoto(weatherReady){
  return weatherReady!==true;
}

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
  return bundledPhoto(options.find(allowedPhotoUrl))||DEFAULT_MAIN_PHOTO;
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
 * Photos shipped in www/images/, named <météo>-<jour|nuit>.webp (generated from
 * the reference photo by scripts/generate_variant_images.py, without any drawn
 * interface). The retired unsuffixed files (jour, nuageux, pluie, neige) are
 * no longer shipped; bundledPhoto() and a Python HTTP redirect map those URLs
 * to the current daytime photos.
 */
const IMG="/maison3d-assets/images/";
const FILES={day:"clair",cloudy:"nuageux",rain:"pluie",snow:"neige",wind:"vent",storm:"orage",fog:"brouillard"};
export const BUNDLED_IMAGES=Object.fromEntries(Object.entries(FILES).flatMap(([key,file])=>key==="day"
  ?[["day",IMG+file+"-jour.webp"],["night",IMG+file+"-nuit.webp"]]
  :[[key+"_day",IMG+file+"-jour.webp"],[key+"_night",IMG+file+"-nuit.webp"]]));

/**
 * Lighter copies of the bundled photos (same name + -640 / -960, WebP) for phones and
 * small cards: srcset of the bundled photos only. Custom images (user URLs) get none.
 */
export const RESPONSIVE_WIDTHS=[640,960];
const FULL_WIDTH={[DEFAULT_MAIN_PHOTO]:1286,...Object.fromEntries(Object.values(BUNDLED_IMAGES).map(path=>[path,1286])),
  "/maison3d-assets/images/grange-interieur.webp":1500};
export function responsiveSrcset(path){
  const full=FULL_WIDTH[path];if(!full)return "";
  const base=path.slice(0,-".webp".length);
  return [...RESPONSIVE_WIDTHS.map(w=>`${base}-${w}.webp ${w}w`),`${path} ${full}w`].join(", ");
}
/**
 * sizes for a photo shown with object-fit cover (or contain) in a box: rendered width
 * in CSS px. On 2× / 3× phones the density taken into account is capped at 1.5: the
 * photo stays sharp but a phone no longer downloads the full 1286 px file for a card.
 */
export function photoSizes({width,height,ratio,fit="cover",dpr=1}){
  const shown=fit==="cover"?Math.max(width,height*ratio):Math.min(width,height*ratio);
  return Math.max(1,Math.ceil(shown*Math.min(dpr,1.5)/Math.max(dpr,1)))+"px";
}

/**
 * Alternative photo for a weather kind and time of day. Order:
 * custom day/night slot → custom weather slot → bundled day/night →
 * custom (moon/season/)day or night → bundled clear day or night → main photo.
 * nightPhoto tells the view the picture is already a night shot (no extra darkening).
 */
export function pickWeatherPhoto({kind="day",night=false,season="",lunarKey="",images={},mainPhoto=DEFAULT_MAIN_PHOTO,bundled=BUNDLED_IMAGES}={}){
  const tod=night?"night":"day";
  // Bundled photos show the reference house: skip them when the user has set their own main photo.
  mainPhoto=bundledPhoto(mainPhoto);
  if(mainPhoto!==DEFAULT_MAIN_PHOTO)bundled={};
  const custom=key=>allowedPhotoUrl(images[key])?bundledPhoto(images[key]):"";
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
