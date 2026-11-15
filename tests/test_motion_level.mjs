// Animations option: Auto / Always / Never, slow residual motion when Auto + reduced, draft.
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";

const media={matches:false,listeners:[]};
globalThis.matchMedia=()=>({
  get matches(){return media.matches},
  addEventListener:(type,fn)=>{if(type==="change")media.listeners.push(fn)},
  removeEventListener:(type,fn)=>{media.listeners=media.listeners.filter(f=>f!==fn)}
});
const setReduced=value=>{
  media.matches=!!value;
  for(const fn of media.listeners)fn({matches:media.matches});
};

const www=name=>pathToFileURL("custom_components/maison3d/www/"+name).href;
const M=await import(www("motion-level.js"));

assert.deepEqual(M.MOTION_MODES,["auto","always","never"]);
assert.ok(M.MOTION_REDUCED>=.15&&M.MOTION_REDUCED<=.25);

// Default Auto, no system reduction: full speed.
M.setMotionMode("auto");setReduced(false);
assert.equal(M.motionMode(),"auto");
assert.equal(M.motionLevel(),1);
assert.equal(M.systemReduced(),false);
assert.equal(M.motionCount(100),100);

// Auto + reduced: slow but not zero, fewer particles.
setReduced(true);
assert.equal(M.systemReduced(),true);
const slow=M.motionLevel();
assert.equal(slow,M.MOTION_REDUCED);
assert.ok(slow>0&&slow<1,"Auto with reduction must keep a non-zero slow movement");
assert.equal(M.motionCount(100),Math.max(3,Math.round(100*slow)));
assert.ok(M.motionCount(100)<100&&M.motionCount(100)>=3);

// Always ignores the system (full speed even when reduced).
M.setMotionMode("always");
assert.equal(M.motionLevel(),1);
assert.equal(M.motionCount(100),100);
setReduced(false);
assert.equal(M.motionLevel(),1);

// Never is static, with or without the system preference.
M.setMotionMode("never");setReduced(true);
assert.equal(M.motionLevel(),0);
assert.equal(M.motionCount(80),80,"static particles stay on screen, unmoved");
setReduced(false);
assert.equal(M.motionLevel(),0);

// Invalid value falls back to Auto.
M.setMotionMode("nope");
assert.equal(M.motionMode(),"auto");

// matchMedia changes notify only in Auto.
M.setMotionMode("auto");setReduced(false);
const seen=[];
const stop=M.onMotionChange((level,mode,reduced)=>seen.push({level,mode,reduced}));
setReduced(true);
assert.equal(seen.at(-1).level,M.MOTION_REDUCED);
assert.equal(seen.at(-1).mode,"auto");
assert.equal(seen.at(-1).reduced,true);
M.setMotionMode("always");
assert.equal(seen.at(-1).level,1);
const n=seen.length;
setReduced(false);setReduced(true);
assert.equal(seen.length,n,"Always does not react to the system preference");
M.setMotionMode("never");
assert.equal(seen.at(-1).level,0);
stop();

// FR / EN labels.
assert.equal(M.motionLocale("fr").always,"Toujours");
assert.equal(M.motionLocale("en").always,"Always");
assert.match(M.motionLocale("fr").reduced,/animations réduites par le système/);
assert.match(M.motionLocale("en").reduced,/animations reduced by the system/);
assert.equal(M.motionLocale("es").title,M.MOTION_LABELS.fr.title,"unknown language falls back to French");

// Autumn particles: Always moves, Auto+reduced moves less, Never stays put.
globalThis.window={devicePixelRatio:1,matchMedia:globalThis.matchMedia};
globalThis.devicePixelRatio=1;
const canvas={width:400,height:300,getBoundingClientRect:()=>({width:400,height:300}),
  getContext:()=>{
    const noop=()=>{};
    const grad={addColorStop:noop};
    return {setTransform:noop,clearRect:noop,fillRect:noop,beginPath:noop,arc:noop,ellipse:noop,
      fill:noop,save:noop,restore:noop,translate:noop,rotate:noop,
      createLinearGradient:()=>grad,createRadialGradient:()=>grad,
      set fillStyle(v){},get fillStyle(){return ""}};
  }};
const {createSeasonEffects}=await import(www("season-effects.js"));
const fx=createSeasonEffects(canvas);
const travel=(mode,reduced,t0=0,t1=2000)=>{
  M.setMotionMode(mode);setReduced(reduced);
  fx.reset("autumn");
  fx.frame(t0,"autumn",1,false,true);
  const a=fx.snapshot();
  fx.frame(t1,"autumn",1,false,true);
  const b=fx.snapshot();
  let sum=0;
  for(let i=0;i<a.length&&i<b.length;i++)sum+=Math.hypot(b[i].x-a[i].x,b[i].y-a[i].y);
  return sum;
};
const alwaysMove=travel("always",true);
const autoMove=travel("auto",true);
const neverMove=travel("never",true);
assert.ok(alwaysMove>0,"Always must move particles even with reduced motion");
assert.ok(autoMove>0,"Auto with reduction must keep a slow non-zero movement");
assert.ok(autoMove<alwaysMove*0.5,"Auto+reduced is clearly slower than Always");
assert.equal(neverMove,0,"Never must not move particles");

// Draft: changing motion is an unsaved change, saved on « Enregistrer », restored by « Annuler ».
const sent=[],handlers={};
const parent={postMessage:(message)=>sent.push(message)};
globalThis.window={parent,location:{origin:"http://ha"},
  addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn)}};
const fire=(type,event)=>{for(const fn of handlers[type]||[])fn(event)};
const fromParent=data=>fire("message",{source:parent,origin:"http://ha",data});
const ha=await import(www("ha-storage.js"));
const D=await import(www("draft.js"));
ha.onHaData(()=>{});
fromParent({type:"maison3d:storage",data:{},can_save:true});
let settings={motion:"auto",effect_intensity:1},local=[];
D.registerSection("photo_settings",{get:()=>settings,apply:v=>{settings=v},writeLocal:v=>local.push(v)});
assert.equal(D.isDirty(),false);
settings={motion:"always",effect_intensity:1};D.changed();
assert.equal(D.isDirty(),true);
assert.equal(local.length,0,"no localStorage write before the click");
assert.equal(sent.filter(m=>m.type==="maison3d:storage-save").length,0);
D.discardDraft();
assert.deepEqual(settings,{motion:"auto",effect_intensity:1});
assert.equal(D.isDirty(),false);
settings={motion:"never",effect_intensity:1};D.changed();
const pending=D.saveDraft();
fromParent({type:"maison3d:storage-saved",ok:true});
assert.equal(await pending,true);
assert.equal(D.isDirty(),false);
assert.deepEqual(local.at(-1),{motion:"never",effect_intensity:1});
const save=sent.filter(m=>m.type==="maison3d:storage-save").at(-1);
assert.deepEqual(save.patch,{photo_settings:{motion:"never",effect_intensity:1}});

console.log("Animations option (Auto / Always / Never, slow Auto+reduced, draft) OK");
process.exitCode=0;setTimeout(()=>process.exit(0),0);
