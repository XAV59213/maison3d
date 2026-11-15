/**
 * Helpers for generic interior visits: which 3D objects can be visited,
 * when the bundled barn example applies, and the button labels.
 * Pure functions, no DOM and no three.js (unit-testable in Node).
 */
export const VISIT_TYPES=new Set(["building"]);
/** Default visits shown before the 3D project is loaded. */
export const DEFAULT_VISIT_BUILDINGS=[
  {id:"maison",name:"Maison principale",type:"building"},
  {id:"grange",name:"Grange / salle de jeux indépendante",type:"building",interior:"barn"}
];
/** Optional notice for schematic interiors (hidden by default). */
export const INTERIOR_DISCLAIMER="Volumes intérieurs provisoires — plans à confirmer";
/** Compact 3D chrome: iPhone 390 px portrait or landscape, and other small windows. */
export const COMPACT_WIDTH=700,COMPACT_HEIGHT=500;
export function isCompactView(width,height){
  return Number(width)<=COMPACT_WIDTH||Number(height)<=COMPACT_HEIGHT;
}

export function isVisitBuilding(item){
  return Boolean(item&&VISIT_TYPES.has(item.type)&&typeof item.id==="string"&&item.id);
}

/**
 * The realistic barn fit-out is an example project: on by default for the
 * shipped « grange » object, off when the user disables it (interior:"off"),
 * and available for any building that opts in (interior:"barn").
 */
export function isBarnInterior(item){
  if(!isVisitBuilding(item))return false;
  if(item.interior==="off"||item.interior===false)return false;
  if(item.interior==="barn")return true;
  // Existing projects saved before this flag: the default barn stays on.
  return item.id==="grange"&&(item.interior==null||item.interior==="");
}

export function canOfferBarnExample(item){
  return isVisitBuilding(item);
}

export function hasInteriorPhoto(item){
  if(!item)return false;
  if(typeof item.interior_photo==="string"&&item.interior_photo)return true;
  return isBarnInterior(item);
}

export function visitBuildings(items){
  const list=Array.isArray(items)?items.filter(isVisitBuilding):[];
  return list.length?list:DEFAULT_VISIT_BUILDINGS.map(item=>({...item}));
}

export function shortBuildingName(item){
  const raw=String(item?.name||item?.id||"").split("/")[0].trim();
  return raw.replace(/^(la |le |l')/i,"").slice(0,32);
}

export function visitButtonLabel(item){
  if(!item)return "🚪 Intérieur";
  if(item.id==="maison")return "🚪 Intérieur maison";
  if(item.id==="grange")return "🏚 Intérieur grange";
  const name=shortBuildingName(item);
  return name?`🚪 Intérieur ${name}`:"🚪 Intérieur";
}

/** « 📷 Photo de la grange », or « Photo du bâtiment » with its name. */
export function photoButtonLabel(item,showingPhoto=false){
  if(showingPhoto)return "⬡ Vue 3D";
  if(!item)return "📷 Photo du bâtiment";
  if(item.id==="grange"||/grange/i.test(String(item.name||"")))return "📷 Photo de la grange";
  const name=shortBuildingName(item);
  return name?`📷 Photo de ${name}`:"📷 Photo du bâtiment";
}

export function photoButtonTitle(item){
  const name=shortBuildingName(item)||"bâtiment";
  return `Afficher la photo de l'intérieur de ${name}`;
}
