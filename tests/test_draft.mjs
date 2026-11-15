// Draft (draft.js): nothing saved before « Enregistrer », saved on click, « Annuler » restores.
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const sent=[],handlers={};
const parent={postMessage:(message)=>sent.push(message)};
globalThis.window={parent,location:{origin:"http://ha"},
  addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn)}};
const fire=(type,event)=>{for(const fn of handlers[type]||[])fn(event)};
const fromParent=data=>fire("message",{source:parent,origin:"http://ha",data});
const www=name=>pathToFileURL("custom_components/maison3d/www/"+name).href;
const ha=await import(www("ha-storage.js"));
const D=await import(www("draft.js"));
const tick=()=>new Promise(r=>setTimeout(r,0));

// Administrator connected to Home Assistant.
ha.onHaData(()=>{});
fromParent({type:"maison3d:storage",data:{},can_save:true});
const saves=()=>sent.filter(m=>m.type==="maison3d:storage-save");

let layout=[{id:"maison",x:7}],local=[];
D.registerSection("layout",{get:()=>layout,apply:v=>{layout=v},writeLocal:v=>local.push(v)});
let view={preset:"reference",presentation:true};
D.registerSection("view",{get:()=>view,compare:()=>null,writeLocal:v=>local.push(v)});
assert.equal(D.isDirty(),false);

// A change is shown (value changed) but nothing is written anywhere.
layout=[{id:"maison",x:9}];D.changed();
assert.equal(D.isDirty(),true);
assert.equal(local.length,0,"no localStorage write before the click");
assert.equal(saves().length,0,"no maison3d/save before the click");
assert.equal(sent.filter(m=>m.type==="maison3d:dirty").at(-1).dirty,true,"parent told: unsaved changes");
// Navigation only (camera preset) is never a modification.
view={preset:"garden",presentation:true};D.changed();
assert.equal(D.isDirty(),true);

// « Annuler » restores the last saved state (navigation kept).
D.discardDraft();
assert.deepEqual(layout,[{id:"maison",x:7}]);
assert.equal(D.isDirty(),false);
assert.equal(local.length+saves().length,0);
assert.equal(sent.filter(m=>m.type==="maison3d:dirty").at(-1).dirty,false);

// Navigation alone: nothing to save.
assert.equal(await D.saveDraft(),false);
assert.equal(saves().length,0);

// « Enregistrer » writes the browser copy and asks Home Assistant to save.
layout=[{id:"maison",x:11}];D.changed();
const pending=D.saveDraft();
assert.equal(D.draftStatus().kind,"saving");
assert.equal(saves().length,1);
assert.deepEqual(saves()[0].patch,{layout:[{id:"maison",x:11}],view:{preset:"garden",presentation:true}});
assert.equal(local.length,2);
fromParent({type:"maison3d:storage-saved",ok:true});
assert.equal(await pending,true);
assert.equal(D.isDirty(),false);
assert.equal(D.draftStatus().text,"Enregistré ✓");
// After saving, « Annuler » comes back to the newly saved state.
layout=[{id:"maison",x:1}];D.changed();D.discardDraft();
assert.deepEqual(layout,[{id:"maison",x:11}]);

// Error from Home Assistant: message shown, changes kept as unsaved.
layout=[{id:"maison",x:2}];D.changed();
const failing=D.saveDraft();
fromParent({type:"maison3d:storage-saved",ok:false,error:"admin_required"});
assert.equal(await failing,false);
assert.equal(D.isDirty(),true);
assert.match(D.draftStatus().text,/administrateur requis/);

// beforeunload is cancelled while there are unsaved changes.
let prevented=false;fire("beforeunload",{preventDefault:()=>{prevented=true},returnValue:undefined});
assert.equal(prevented,true);
D.discardDraft();prevented=false;
fire("beforeunload",{preventDefault:()=>{prevented=true}});
assert.equal(prevented,false);

// Non-administrator: browser copy only.
fromParent({type:"maison3d:storage",data:{},can_save:false});
layout=[{id:"maison",x:5}];D.changed();
const before=saves().length,localBefore=local.length;
assert.equal(await D.saveDraft(),true);
assert.equal(saves().length,before,"no maison3d/save without admin rights");
assert.equal(local.length,localBefore+1);
assert.match(D.draftStatus().text,/Enregistré dans ce navigateur ✓/);
console.log("Draft (nothing saved before the click, save on click, cancel restores, errors, beforeunload) OK");
await tick();process.exitCode=0;setTimeout(()=>process.exit(0),0);

