/**
 * Maison 3D — project saved in Home Assistant (iframe side).
 * The iframe has no Home Assistant connection: it asks its parent (panel or
 * card), which calls the maison3d/get and maison3d/save websocket commands.
 * localStorage stays as an offline cache / fallback.
 */
const inFrame=window.parent!==window;
const listeners=new Set(),savedListeners=new Set();
let haData=null,canSave=false,connected=false,requested=false,uploadId=0;
const uploads=new Map();
window.addEventListener("message",event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin)return;
  const type=event.data?.type;
  if(type==="maison3d:storage"){
    connected=event.data.data!==null&&typeof event.data.data==="object";
    canSave=connected&&event.data.can_save===true;
    haData=connected?event.data.data:null;
    for(const fn of listeners)fn(haData,{canSave,connected,error:event.data.error||""});
  }else if(type==="maison3d:upload-result"){
    const done=uploads.get(event.data.id);uploads.delete(event.data.id);
    done?.({ok:event.data.ok===true,url:String(event.data.url||""),error:String(event.data.error||"")});
  }else if(type==="maison3d:storage-saved"){
    for(const fn of savedListeners)fn({ok:event.data.ok===true,error:String(event.data.error||"")});
  }
});
/** Called with the Home Assistant data (or null when unavailable), once per load. */
export function onHaData(fn){
  listeners.add(fn);
  if(haData||connected)fn(haData,{canSave,connected,error:""});
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
