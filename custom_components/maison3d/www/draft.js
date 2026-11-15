/**
 * Maison 3D — draft of the changes (2D photo view and 3D editor).
 * Every change shows immediately on screen but is NOT saved: nothing is written
 * to this browser (localStorage) nor to Home Assistant (maison3d/save) until
 * « 💾 Enregistrer ». « ↶ Annuler » goes back to the last saved state.
 * Sections: layout (3D objects), photo_settings (2D view), view (3D camera preset).
 * A section may ignore navigation fields (current view…) when looking for changes.
 *
 * Recovery: while there are unsaved changes, a copy is kept in sessionStorage (one per
 * panel / card instance: the iframe name set by its parent). A navigation inside Home
 * Assistant destroys the iframe without « beforeunload »; when the view comes back, it
 * asks « Restaurer les modifications non enregistrées ? » (Restaurer / Ignorer).
 */
import {saveToHa,onHaSaved,haStorageStatus,onHaData,keepBrowserCopy,onBrowserCopy,useHaVersion} from "./ha-storage.js";
import {t,onUiLang,uiLang} from "./ui-text.js";
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
  // A restored change of a section loaded later (3D layout): applied once its saved
  // data is in place (after the Home Assistant data delivered right after registering).
  if(deferred.has(key)&&apply){
    const value=deferred.get(key);deferred.delete(key);
    setTimeout(()=>{apply(clone(value));changed()},0);
  }
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
// ---- Recovery of unsaved changes (sessionStorage, per instance) ----
const instance=(()=>{try{return String(window.name||"default").slice(0,120)}catch{return "default"}})();
export const RECOVERY_KEY="maison3d:draft:v1:"+instance;
const session=()=>{try{return window.sessionStorage||null}catch{return null}};
let pending=null,offered=false,banner=null;
const deferred=new Map();
try{
  const raw=session()?.getItem(RECOVERY_KEY);
  const value=raw?JSON.parse(raw):null;
  if(value&&typeof value==="object"&&value.sections&&typeof value.sections==="object"&&Object.keys(value.sections).length)pending=value;
}catch{}
function keepRecovery(){
  const store=session();if(!store)return;
  const dirty=[...sections.entries()].filter(([,s])=>sectionDirty(s));
  try{
    if(dirty.length)store.setItem(RECOVERY_KEY,JSON.stringify({at:new Date().toISOString(),sections:Object.fromEntries(dirty.map(([k,s])=>[k,clone(s.get())]))}));
    // Not answered yet: the recovered changes stay available for the next visit.
    else if(!pending)store.removeItem(RECOVERY_KEY);
  }catch{}
}
/** Recovered unsaved changes (null: none, or already answered). */
export const pendingRecovery=()=>pending?clone(pending):null;
function differsFromSaved(value){
  return Object.entries(value.sections).some(([key,v])=>{const s=sections.get(key);return !s||json(s.compare(clone(v)))!==s.savedCompare});
}
/** « Restaurer »: the recovered changes become the current draft (not saved). */
export function restoreRecovery(){
  if(!pending)return false;
  const value=pending;pending=null;
  for(const [key,v] of Object.entries(value.sections)){
    const s=sections.get(key);
    if(s?.apply)s.apply(clone(v));
    else{deferred.set(key,v);window.dispatchEvent?.(new CustomEvent("maison3d:section-needed",{detail:key}))}
  }
  banner?.remove();banner=null;
  changed();
  return true;
}
/** « Ignorer »: forget the recovered changes. */
export function ignoreRecovery(){
  pending=null;banner?.remove();banner=null;
  if(!isDirty())try{session()?.removeItem(RECOVERY_KEY)}catch{}
}
function offerRecovery(){
  if(offered)return;offered=true;
  if(!pending)return;
  if(!differsFromSaved(pending)){ignoreRecovery();return}
  if(typeof document==="undefined"||!document.body)return;
  banner=document.createElement("div");
  banner.className="maison3d-recovery";banner.setAttribute("role","alertdialog");
  const text=document.createElement("strong");
  const detail=document.createElement("small");
  const yes=document.createElement("button");yes.type="button";yes.className="recovery-restore";
  const no=document.createElement("button");no.type="button";no.className="recovery-ignore";
  yes.addEventListener("click",restoreRecovery);no.addEventListener("click",ignoreRecovery);
  const when=()=>{try{return new Date(pending.at).toLocaleTimeString(uiLang()==="fr"?"fr-FR":"en-GB",{hour:"2-digit",minute:"2-digit"})}catch{return ""}};
  onUiLang(()=>{text.textContent=t("restoreQuestion");detail.textContent=t("restoreDetail",{when:when()});yes.textContent=t("restore");no.textContent=t("ignore")});
  banner.append(text,detail,yes,no);
  document.body.append(banner);
}
// Offered once the saved data (Home Assistant or this browser) is in place.
onHaData(()=>setTimeout(offerRecovery,0));
if(window.parent===window)setTimeout(offerRecovery,0);
let lastDirty=null;
function notify(){
  keepRecovery();
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
  // Non-administrator: this browser's version really takes precedence over Home Assistant here.
  if(connected)keepBrowserCopy(patch);
  setStatus("saved",connected?t("savedBrowser"):t("savedBrowserOffline"));
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
  // This browser's version (non-administrator): badge + « ↺ Revenir à la version Home Assistant ».
  const copyBadge=document.createElement("span");copyBadge.className="browser-copy";copyBadge.hidden=true;
  const haVersion=document.createElement("button");haVersion.type="button";haVersion.className="ha-version-btn";haVersion.hidden=true;
  haVersion.addEventListener("click",()=>{if(typeof confirm==="function"&&!confirm(t("backToHaConfirm")))return;useHaVersion()});
  onUiLang(()=>{copyBadge.textContent="🖥 "+t("browserCopy");copyBadge.title=t("browserCopyTitle");haVersion.textContent=t("backToHa")});
  onBrowserCopy(keys=>{copyBadge.hidden=haVersion.hidden=!keys.length});
  group.append(save,cancel,info,copyBadge,haVersion);
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
  ".maison3d-save .browser-copy{font:600 11px system-ui,sans-serif;color:#9fd3ff;padding:0 4px}",
  ".maison3d-save .browser-copy[hidden],.maison3d-save .ha-version-btn[hidden]{display:none!important}",
  ".maison3d-save .ha-version-btn{font-size:11px}",
  ".maison3d-recovery{position:fixed;z-index:40;left:50%;top:12px;transform:translateX(-50%);max-width:calc(100% - 24px);display:flex;flex-wrap:wrap;",
  "align-items:center;gap:8px;background:#1b2a3cf5;color:#fff;border:1px solid #ffb45a;border-radius:12px;padding:10px 14px;box-shadow:0 10px 30px #000a;font:13px system-ui,sans-serif}",
  ".maison3d-recovery small{flex-basis:100%;order:1;color:#d8e0e8}",
  ".maison3d-recovery button{border:0;border-radius:8px;padding:8px 12px;cursor:pointer;color:#fff;background:#34465d}",
  ".maison3d-recovery .recovery-restore{background:#e07800}",
  "@media(max-width:600px){.maison3d-save .save-status .long{display:none}.maison3d-save .save-status .short{display:inline}}",
  "html.card-mode .maison3d-save .save-status .long{display:none}html.card-mode .maison3d-save .save-status .short{display:inline}"
].join("");
