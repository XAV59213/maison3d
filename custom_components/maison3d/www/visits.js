/**
 * Helpers for generic interior visits: which 3D objects can be visited,
 * when the bundled barn example applies, and the button labels.
 * Pure functions, no DOM and no three.js (unit-testable in Node).
 */
import {t} from "./i18n.js";
export const VISIT_TYPES=new Set(["building"]);
/** Default visits shown before the 3D project is loaded. */
export const DEFAULT_VISIT_BUILDINGS=[
  {id:"maison",name:"Maison principale",type:"building"},
  {id:"grange",name:"Grange / salle de jeux indépendante",type:"building",interior:"barn"}
];
/** Optional notice for schematic interiors (hidden by default). */
export const INTERIOR_DISCLAIMER=()=>t("interior_disclaimer");
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
  if(!item)return t("visit_interior");
  if(item.id==="maison")return t("visit_maison");
  if(item.id==="grange")return t("visit_grange");
  const name=shortBuildingName(item);
  return name?t("visit_named",{name}):t("visit_interior");
}

/** « 📷 Photo de la grange », or « Photo du bâtiment » with its name. */
export function photoButtonLabel(item,showingPhoto=false){
  if(showingPhoto)return t("visit_photo_3d");
  if(!item)return t("visit_photo_building");
  if(item.id==="grange"||/grange/i.test(String(item.name||"")))return t("visit_photo_barn");
  const name=shortBuildingName(item);
  return name?t("visit_photo_named",{name}):t("visit_photo_building");
}

export function photoButtonTitle(item){
  const name=shortBuildingName(item)||t("building_fallback");
  return t("visit_photo_title",{name});
}
