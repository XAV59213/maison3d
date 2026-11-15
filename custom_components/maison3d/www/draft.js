/**
 * Maison 3D — draft of the changes (2D photo view and 3D editor).
 * Every change shows immediately on screen but is NOT saved: nothing is written
 * to this browser (localStorage) nor to Home Assistant (maison3d/save) until
 * « 💾 Enregistrer ». « ↶ Annuler » goes back to the last saved state.
 * Sections: layout (3D objects), photo_settings (2D view), view (3D camera preset).
 * A section may ignore navigation fields (current view…) when looking for changes.
 */
import {saveToHa,onHaSaved,haStorageStatus} from "./ha-storage.js";
const sections=new Map();
const listeners=new Set();
let status={kind:"idle",text:""},saving=false,clearTimer=null,waiter=null;
const json=value=>JSON.stringify(value??null);
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
/**
 * Register a section: get() = current value, compare(value) = part that counts as a
 * modification (default: everything), apply(value) = restore a saved value,
 * writeLocal(value) = this browser's copy. The current value becomes the saved state.
 */
export function registerSection(key,{get,compare=v=>v,apply=null,writeLocal=null}){
  sections.set(key,{get,compare,apply,writeLocal,saved:null,savedCompare:""});
  markSaved(key);
}
/** The current value of a section is the saved one (after loading Home Assistant data). */
export function markSaved(key){
  const s=sections.get(key);if(!s)return;
  s.saved=clone(s.get());s.savedCompare=json(s.compare(clone(s.saved)));
  changed();
}
const sectionDirty=s=>json(s.compare(clone(s.get())))!==s.savedCompare;
const sectionDiffers=s=>json(s.get())!==json(s.saved);
export const isDirty=()=>[...sections.values()].some(sectionDirty);
export const draftStatus=()=>({dirty:isDirty(),saving,...status});
let lastDirty=null;
function notify(){
  const snapshot=draftStatus();
  for(const fn of listeners){try{fn(snapshot)}catch(err){console.error(err)}}
  if(snapshot.dirty!==lastDirty){
    lastDirty=snapshot.dirty;
    // The panel / card also warns before leaving the Home Assistant page.
    if(window.parent!==window)window.parent.postMessage({type:"maison3d:dirty",dirty:snapshot.dirty},window.location.origin);
  }
}
function setStatus(kind,text){
  clearTimeout(clearTimer);status={kind,text};notify();
  if(kind==="saved")clearTimer=setTimeout(()=>{if(status.kind==="saved"){status={kind:"idle",text:""};notify()}},5000);
}
/** Call after every change shown on screen (never saves). */
export function changed(){
  if(isDirty()&&(status.kind==="saved"||status.kind==="idle"))status={kind:"dirty",text:""};
  if(!isDirty()&&status.kind==="dirty")status={kind:"idle",text:""};
  notify();
}
export function onDraft(fn){listeners.add(fn);fn(draftStatus());return()=>listeners.delete(fn)}
onHaSaved(result=>{if(waiter){const done=waiter;waiter=null;done(result)}});
/** Save every modified section (browser copy + Home Assistant when allowed). */
export async function saveDraft(){
  if(saving||!isDirty())return false;
  saving=true;setStatus("saving","Enregistrement…");
  const changedSections=[...sections.entries()].filter(([,s])=>sectionDiffers(s));
  const patch={};let local=true;
  for(const [key,s] of changedSections){
    const value=clone(s.get());patch[key]=value;
    try{s.writeLocal?.(value)}catch(err){local=false;console.warn("Maison 3D: storage unavailable",err)}
  }
  const finish=()=>{for(const [key,s] of changedSections){s.saved=clone(patch[key]);s.savedCompare=json(s.compare(clone(patch[key])))}};
  let result;
  if(saveToHa(patch)){
    let timeout=null;
    result=await new Promise(resolve=>{
      waiter=resolve;
      timeout=setTimeout(()=>{if(waiter===resolve){waiter=null;resolve({ok:false,error:"délai dépassé"})}},20000);
    });
    clearTimeout(timeout);
    saving=false;
    if(result.ok){finish();setStatus("saved","Enregistré ✓")}
    else setStatus("error","⚠ Non enregistré dans Home Assistant ("+(result.error==="admin_required"?"administrateur requis":result.error||"erreur")+")");
    return result.ok;
  }
  saving=false;
  const {connected}=haStorageStatus();
  if(!local){setStatus("error","⚠ Enregistrement impossible dans ce navigateur — exportez en JSON");return false}
  finish();
  setStatus("saved",connected?"Enregistré dans ce navigateur ✓ (administrateur requis pour Home Assistant)":"Enregistré dans ce navigateur ✓");
  return true;
}
/** Back to the last saved state of every modified section. */
export function discardDraft(){
  if(saving)return;
  for(const s of sections.values())if(sectionDiffers(s)&&s.apply)s.apply(clone(s.saved));
  setStatus("idle","");changed();
}
window.addEventListener("beforeunload",event=>{
  if(!isDirty())return;
  event.preventDefault();event.returnValue="";
});
/** « 💾 Enregistrer » + « ↶ Annuler » + status, kept in sync with the draft. */
export function createSaveControls({compact=false}={}){
  const group=document.createElement("span");
  group.className="maison3d-save"+(compact?" compact":"");
  group.setAttribute("role","group");group.setAttribute("aria-label","Enregistrer les modifications");
  const save=document.createElement("button");
  save.type="button";save.className="save-btn";save.textContent="💾 Enregistrer";
  const cancel=document.createElement("button");
  cancel.type="button";cancel.className="cancel-btn";cancel.textContent="↶ Annuler";
  cancel.title="Revenir au dernier état enregistré";
  const info=document.createElement("span");
  info.className="save-status";info.setAttribute("role","status");info.setAttribute("aria-live","polite");
  group.append(save,cancel,info);
  save.addEventListener("click",()=>saveDraft());
  cancel.addEventListener("click",()=>discardDraft());
  onDraft(({dirty,saving:busy,kind,text})=>{
    save.disabled=!dirty||busy;cancel.disabled=!dirty||busy;cancel.hidden=!dirty&&!busy;
    group.classList.toggle("dirty",dirty);
    save.title=dirty?"Modifications non enregistrées — cliquer pour enregistrer":"Aucune modification à enregistrer";
    save.setAttribute("aria-label",dirty?"Enregistrer (modifications non enregistrées)":"Enregistrer (aucune modification)");
    const shown=kind==="saving"||kind==="saved"||kind==="error"?text:dirty?"● Modifications non enregistrées":"";
    if(shown==="● Modifications non enregistrées"){
      // Short text on phones and in narrow cards.
      const long=document.createElement("span");long.className="long";long.textContent=shown;
      const short=document.createElement("span");short.className="short";short.textContent="● Non enregistré";
      info.replaceChildren(long,short);
    }else info.textContent=shown;
    info.hidden=!shown;info.dataset.kind=kind==="idle"&&dirty?"dirty":kind;
  });
  return group;
}
export const SAVE_STYLE=[
  ".maison3d-save{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}",
  ".maison3d-save button{cursor:pointer}",
  ".maison3d-save .save-btn{background:#1d6b3a!important;color:#fff;border:1px solid #ffffff30!important;font-weight:600}",
  ".maison3d-save .save-btn:disabled{background:#2b3a4c!important;color:#9fb0c2;cursor:default;font-weight:400}",
  ".maison3d-save.dirty .save-btn{background:#e07800!important;box-shadow:0 0 0 2px #ffb45a66}",
  ".maison3d-save .cancel-btn[hidden],.maison3d-save .save-status[hidden]{display:none!important}",
  ".maison3d-save .cancel-btn:disabled{opacity:.55;cursor:default}",
  ".maison3d-save .save-status{font:600 12px system-ui,sans-serif;color:#ffd08a;padding:0 4px;white-space:nowrap}",
  ".maison3d-save .save-status[data-kind=saved]{color:#7ee2a0}",
  ".maison3d-save .save-status[data-kind=error]{color:#ff9a9a;white-space:normal}",
  ".maison3d-save .save-status[data-kind=saving]{color:#cfe3ff}",
  ".maison3d-save .save-status .short{display:none}",
  "@media(max-width:600px){.maison3d-save .save-status .long{display:none}.maison3d-save .save-status .short{display:inline}}",
  "html.card-mode .maison3d-save .save-status .long{display:none}html.card-mode .maison3d-save .save-status .short{display:inline}"
].join("");
