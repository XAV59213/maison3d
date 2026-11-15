/**
 * Maison 3D — project saved in Home Assistant (iframe side).
 * The iframe has no Home Assistant connection: it asks its parent (panel or
 * card), which calls the maison3d/get and maison3d/save websocket commands.
 * localStorage stays as an offline cache / fallback.
 *
 * Non-administrators cannot write to Home Assistant: « 💾 Enregistrer » keeps their
 * changes as « this browser's version » (localStorage, per section). That copy really
 * takes precedence over the Home Assistant data in this browser, until « ↺ Revenir à la
 * version Home Assistant » (useHaVersion). Administrators always get Home Assistant data.
 */
const inFrame=window.parent!==window;
const listeners=new Set(),savedListeners=new Set();
let haData=null,rawData=null,canSave=false,connected=false,answered=false,requested=false,uploadId=0,usingCopy=[];
const COPY_KEY="maison3d:browser-copy:v1";
const SECTIONS=["layout","photo_settings","view"];
const copyListeners=new Set();
function readCopy(){
  try{const v=JSON.parse(localStorage.getItem(COPY_KEY));return v&&typeof v==="object"&&v.sections&&typeof v.sections==="object"?v:null}catch{return null}
}
// Home Assistant data as this browser should see it (its own copy wins for a non-administrator).
function effectiveData(){
  usingCopy=[];
  if(!connected)return null;
  if(canSave)return rawData;
  const copy=readCopy();
  if(!copy)return rawData;
  const data={...rawData};
  for(const key of SECTIONS)if(key in copy.sections){data[key]=copy.sections[key];usingCopy.push(key)}
  return data;
}
const notifyCopy=()=>{for(const fn of copyListeners){try{fn([...usingCopy])}catch(err){console.error(err)}}};
function deliver(error=""){
  haData=effectiveData();
  for(const fn of listeners)fn(haData,{canSave,connected,error});
  notifyCopy();
}
const uploads=new Map();
window.addEventListener("message",event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin)return;
  const type=event.data?.type;
  if(type==="maison3d:storage"){
    connected=event.data.data!==null&&typeof event.data.data==="object";
    canSave=connected&&event.data.can_save===true;
    rawData=connected?event.data.data:null;answered=true;
    deliver(event.data.error||"");
  }else if(type==="maison3d:upload-result"){
    const done=uploads.get(event.data.id);uploads.delete(event.data.id);
    done?.({ok:event.data.ok===true,url:String(event.data.url||""),error:String(event.data.error||"")});
  }else if(type==="maison3d:storage-saved"){
    for(const fn of savedListeners)fn({ok:event.data.ok===true,error:String(event.data.error||"")});
  }
});
/**
 * Called with the Home Assistant data (or null when unavailable), once per load.
 * A listener added later (3D scene loaded on demand) gets the answer already received.
 */
export function onHaData(fn){
  listeners.add(fn);
  if(answered)fn(haData,{canSave,connected,error:""});
  if(!requested&&inFrame){requested=true;window.parent.postMessage({type:"maison3d:storage-load"},window.location.origin)}
}
export function onHaSaved(fn){savedListeners.add(fn)}
/** Save some sections ({layout}, {photo_settings}, {view}); the parent debounces. */
export function saveToHa(patch){
  if(!inFrame||!canSave)return false;
  window.parent.postMessage({type:"maison3d:storage-save",patch},window.location.origin);
  return true;
}
export const haStorageStatus=()=>({inFrame,connected,canSave});
/** Upload a photo through the parent (saved in /config/www/maison3d/); resolves {ok,url,error}. */
export function uploadToHa(file,name){
  if(!inFrame||!canSave)return Promise.resolve({ok:false,url:"",error:"administrateur Home Assistant requis"});
  const id=++uploadId;
  return new Promise(resolve=>{
    uploads.set(id,resolve);
    setTimeout(()=>{if(uploads.delete(id))resolve({ok:false,url:"",error:"délai dépassé"})},120000);
    window.parent.postMessage({type:"maison3d:upload",id,file,name},window.location.origin);
  });
}
/** Non-administrator « 💾 Enregistrer »: keep these sections as this browser's version. */
export function keepBrowserCopy(patch){
  if(!connected||canSave)return false;
  const copy=readCopy()||{sections:{}};
  for(const key of SECTIONS)if(patch&&key in patch)copy.sections[key]=patch[key];
  copy.at=new Date().toISOString();
  try{localStorage.setItem(COPY_KEY,JSON.stringify(copy))}catch{return false}
  usingCopy=SECTIONS.filter(key=>key in copy.sections);
  notifyCopy();
  return true;
}
/** Sections shown from this browser's version (empty: Home Assistant data). */
export const browserCopySections=()=>[...usingCopy];
export function onBrowserCopy(fn){copyListeners.add(fn);fn([...usingCopy]);return()=>copyListeners.delete(fn)}
/** Drop this browser's version: every listener gets the Home Assistant data again. */
export function useHaVersion(){
  try{localStorage.removeItem(COPY_KEY)}catch{}
  if(answered)deliver();else{usingCopy=[];notifyCopy()}
}
