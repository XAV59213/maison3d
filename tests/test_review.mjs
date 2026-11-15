// Review v2.10.0, points 2 and 4: unsaved changes kept per instance (sessionStorage) and
// offered back after an internal navigation; non-administrator « this browser's version »
// that really takes precedence over Home Assistant data, until « back to Home Assistant ».
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";
const phase=process.argv[2]||"main";
const memory=init=>{const m=new Map(Object.entries(init||{}));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}};
const sent=[],handlers={},events=[];
const parent={postMessage:m=>sent.push(m)};
const session=memory(JSON.parse(process.env.M3D_SESSION||"{}"));
globalThis.localStorage=memory(JSON.parse(process.env.M3D_LOCAL||"{}"));
globalThis.window={parent,name:process.env.M3D_NAME||"maison3d-card:abc",location:{origin:"http://ha"},sessionStorage:session,
  addEventListener:(t,fn)=>{(handlers[t]??=[]).push(fn)},dispatchEvent:e=>{events.push(e);return true}};
globalThis.CustomEvent=class{constructor(type,init){this.type=type;this.detail=init?.detail}};
const fire=(type,event)=>{for(const fn of handlers[type]||[])fn(event)};
const fromParent=data=>fire("message",{source:parent,origin:"http://ha",data});
const www=name=>pathToFileURL("custom_components/maison3d/www/"+name).href;
const ha=await import(www("ha-storage.js"));
const D=await import(www("draft.js"));
const T=await import(www("ui-text.js"));
const tick=()=>new Promise(r=>setTimeout(r,0));
const KEY="maison3d:draft:v1:"+window.name;
const child=(name,env)=>{const r=spawnSync(process.execPath,[process.argv[1],name],{env:{...process.env,...env},encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim().split("\n").at(-1))};

if(phase==="main"){
  // ---- 2) Unsaved changes survive the destruction of the iframe ----
  ha.onHaData(()=>{});
  fromParent({type:"maison3d:storage",data:{photo_settings:{season:"auto"}},can_save:true});
  let ps={season:"auto",mode:"auto"};
  D.registerSection("photo_settings",{get:()=>ps,apply:v=>{ps=v}});
  assert.equal(session.getItem(KEY),null,"nothing kept while there is no change");
  ps={season:"winter",mode:"auto"};D.changed();
  const kept=JSON.parse(session.getItem(KEY));
  assert.deepEqual(kept.sections,{photo_settings:{season:"winter",mode:"auto"}});
  D.discardDraft();
  assert.equal(session.getItem(KEY),null,"« Annuler » forgets the copy");
  ps={season:"summer",mode:"rain"};D.changed();
  // The panel / card is destroyed (navigation in Home Assistant): the copy stays in sessionStorage.
  const stored=session.dump();
  // (and a 3D layout change made in the same session)
  stored[KEY]=JSON.stringify({...JSON.parse(stored[KEY]),sections:{...JSON.parse(stored[KEY]).sections,layout:[{id:"edited"}]}});
  // New iframe, same instance: « Restaurer ».
  const restored=child("restore",{M3D_SESSION:JSON.stringify(stored)});
  assert.deepEqual(restored.applied,{season:"summer",mode:"rain"});
  assert.equal(restored.dirty,true,"restored changes are a draft, not saved");
  assert.equal(restored.layoutApplied,true,"section loaded later (3D layout) restored too");
  assert.deepEqual(restored.events,["layout"]);
  // « Ignorer »: back to the saved data, copy removed.
  const ignored=child("ignore",{M3D_SESSION:JSON.stringify(stored)});
  assert.deepEqual(ignored,{pending:false,stored:null,dirty:false,value:{season:"auto",mode:"auto"}});
  // Another panel / card instance does not see it.
  assert.equal(child("other",{M3D_SESSION:JSON.stringify(stored),M3D_NAME:"maison3d-panel"}).pending,false);
  // Same values as saved: nothing to offer.
  const same={[KEY]:JSON.stringify({at:"x",sections:{photo_settings:{season:"auto",mode:"auto"}}})};
  assert.equal(child("same",{M3D_SESSION:JSON.stringify(same)}).pending,false);
  D.discardDraft();

  // ---- 4) Non-administrator: this browser's version takes precedence ----
  const seen=[];ha.onHaData(data=>seen.push(data));
  const HA={photo_settings:{season:"auto",mode:"auto"},layout:[{id:"maison",type:"building"}]};
  fromParent({type:"maison3d:storage",data:HA,can_save:false});
  assert.deepEqual(seen.at(-1),HA);
  assert.deepEqual(ha.browserCopySections(),[]);
  ps={season:"winter",mode:"snow"};D.changed();
  assert.equal(await D.saveDraft(),true);
  assert.equal(sent.filter(m=>m.type==="maison3d:storage-save").length,0,"never written to Home Assistant");
  assert.match(D.draftStatus().text,/prime sur Home Assistant/);
  assert.deepEqual(ha.browserCopySections(),["photo_settings"]);
  // Home Assistant data delivered again (reload, other device saved): this browser's copy wins here.
  fromParent({type:"maison3d:storage",data:{...HA,photo_settings:{season:"spring"}},can_save:false});
  assert.deepEqual(seen.at(-1).photo_settings,{season:"winter",mode:"snow"});
  assert.deepEqual(seen.at(-1).layout,HA.layout,"other sections still come from Home Assistant");
  // An administrator always gets the Home Assistant data.
  fromParent({type:"maison3d:storage",data:HA,can_save:true});
  assert.deepEqual(seen.at(-1),HA);assert.deepEqual(ha.browserCopySections(),[]);
  fromParent({type:"maison3d:storage",data:HA,can_save:false});
  assert.deepEqual(seen.at(-1).photo_settings,{season:"winter",mode:"snow"});
  // « ↺ Revenir à la version Home Assistant ».
  ha.useHaVersion();
  assert.deepEqual(seen.at(-1),HA);
  assert.deepEqual(ha.browserCopySections(),[]);
  assert.equal(localStorage.getItem("maison3d:browser-copy:v1"),null);

  // ---- Texts FR / EN ----
  assert.deepEqual(Object.keys(T.UI_TEXT.fr).sort(),Object.keys(T.UI_TEXT.en).sort());
  assert.equal(T.t("restoreQuestion"),"Restaurer les modifications non enregistrées ?");
  fromParent({type:"maison3d:conditions",language:"en"});
  assert.equal(T.t("restore"),"Restore");
  assert.equal(T.t("backToIntegration"),"Back to the integration");
  fromParent({type:"maison3d:conditions",language:""});
  assert.equal(T.uiLang(),"en","an empty language keeps the current one");
  fromParent({type:"maison3d:conditions",language:"fr-FR"});
  assert.equal(T.t("ignore"),"Ignorer");
  console.log("Review: recovery of unsaved changes per instance, this browser's version for non-admins, texts FR/EN OK");
  await tick();setTimeout(()=>process.exit(0),0);
}else{
  ha.onHaData(()=>{});
  let ps={season:"old",mode:"old"};
  D.registerSection("photo_settings",{get:()=>ps,apply:v=>{ps=v}});
  fromParent({type:"maison3d:storage",data:{photo_settings:{season:"auto",mode:"auto"}},can_save:true});
  ps={season:"auto",mode:"auto"};D.markSaved("photo_settings"); // what photo-view does with the HA data
  await tick();
  const out={};
  if(phase==="restore"){
    // The stored copy also has a 3D layout change (scene not loaded yet).
    out.pending=Boolean(D.pendingRecovery());
    assert.ok(D.restoreRecovery());
    out.applied=ps;out.dirty=D.isDirty();
    out.events=events.filter(e=>e.type==="maison3d:section-needed").map(e=>e.detail);
    let layout=[{id:"saved"}];
    D.registerSection("layout",{get:()=>layout,apply:v=>{layout=v}});
    await tick();
    out.layoutApplied=JSON.stringify(layout)===JSON.stringify([{id:"edited"}]);
  }else if(phase==="ignore"){
    D.ignoreRecovery();
    out.pending=Boolean(D.pendingRecovery());out.stored=session.getItem(KEY);out.dirty=D.isDirty();out.value=ps;
  }else out.pending=Boolean(D.pendingRecovery());
  console.log(JSON.stringify(out));
  setTimeout(()=>process.exit(0),0);
}
