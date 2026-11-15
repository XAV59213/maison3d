// Outdoor lights (lights.js): halo only when on and at night, toggle off by default,
// toggle checks, photo coordinates, and the lights as part of the draft (draft.js).
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const sent=[],handlers={};
const parent={postMessage:m=>sent.push(m)};
globalThis.window={parent,location:{origin:"http://ha"},addEventListener:(t,fn)=>{(handlers[t]??=[]).push(fn)}};
const www=name=>pathToFileURL("custom_components/maison3d/www/"+name).href;
const L=await import(www("lights.js"));
const D=await import(www("draft.js"));

// Validation: light.* / switch.* only, unique, clamped, defaults.
const clean=L.cleanLights([
  {entity_id:"light.porche",name:" Porche ",x:120,y:-4,color:"#FFAA00",intensity:9},
  {entity_id:"light.porche",x:1,y:1},
  {entity_id:"switch.garage_spot",x:"10"},
  {entity_id:"sensor.temperature",x:1,y:1},
  {entity_id:"light.<script>",x:1,y:1},
  "nope",null
]);
assert.deepEqual(clean,[
  {entity_id:"light.porche",name:"Porche",x:100,y:0,color:"#ffaa00",intensity:2},
  {entity_id:"switch.garage_spot",name:"",x:50,y:50,color:L.DEFAULT_COLOR,intensity:1}
]);
assert.equal(L.cleanLights(Array.from({length:40},(_,i)=>({entity_id:"light.l"+i}))).length,L.MAX_LIGHTS);
assert.deepEqual(L.cleanLights(undefined),[]);

// Halo: night AND on only; colour and brightness of the light.
const porch=clean[0];
assert.equal(L.haloFor(porch,{state:"off"},true),null);
assert.equal(L.haloFor(porch,{state:"unavailable"},true),null);
assert.equal(L.haloFor(porch,undefined,true),null);
assert.equal(L.haloFor(porch,{state:"on"},false),null,"no halo by day");
assert.deepEqual(L.haloFor(porch,{state:"on",rgb:[255,0,0],brightness:255},true),{rgb:[255,0,0],strength:2});
assert.deepEqual(L.haloFor({...porch,intensity:1},{state:"on",rgb:null,brightness:51},true),{rgb:[255,170,0],strength:0.25});
assert.deepEqual(L.haloFor({...porch,intensity:1},{state:"on",brightness:127.5},true),{rgb:[255,170,0],strength:0.5});
// A switch has no brightness / colour: configured colour at the configured intensity.
assert.deepEqual(L.haloFor(clean[1],{state:"on",rgb:null,brightness:null},true),{rgb:[255,196,107],strength:1});

// States read by the card / panel (only the watched lights).
const states={
  "light.porche":{entity_id:"light.porche",state:"on",attributes:{friendly_name:"Porche",rgb_color:[255,200,120],brightness:180}},
  "switch.garage_spot":{entity_id:"switch.garage_spot",state:"off",attributes:{}},
  "sensor.t":{entity_id:"sensor.t",state:"3",attributes:{}},
  "light.cuisine":{entity_id:"light.cuisine",state:"on",attributes:{friendly_name:"Cuisine"}}
};
assert.deepEqual(L.lightStates(states,["light.porche","switch.garage_spot","light.gone","sensor.t"]),{
  "light.porche":{state:"on",rgb:[255,200,120],brightness:180,name:"Porche"},
  "switch.garage_spot":{state:"off",rgb:null,brightness:null,name:""},
  "light.gone":{state:"missing"}
});
assert.deepEqual(L.lightOptions(states).map(o=>o.id),["light.cuisine","light.porche","switch.garage_spot"]);

// Toggle: disabled by default; admins only / every user; only a watched light.
assert.equal(L.DEFAULT_TOGGLE,"off");
assert.equal(L.cleanToggle(undefined),"off");
assert.equal(L.cleanToggle("everyone"),"off");
assert.equal(L.toggleAllowed("off",true),false);
assert.equal(L.toggleAllowed("admins",false),false);
assert.equal(L.toggleAllowed("admins",true),true);
assert.equal(L.toggleAllowed("users",false),true);
assert.equal(L.toggleCall("light.porche",["light.porche"],"off",true),null);
assert.equal(L.toggleCall("light.cuisine",["light.porche"],"users",true),null,"not on the photo");
assert.equal(L.toggleCall("lock.porte",["lock.porte"],"users",true),null,"other domains refused");
assert.deepEqual(L.toggleCall("switch.garage_spot",["switch.garage_spot"],"admins",true),
  {domain:"switch",service:"toggle",data:{entity_id:"switch.garage_spot"}});

// Bridge (card / panel): watch, then toggle through hass.callService; refusal reported.
const calls=[],replies=[];let changes=0;
const hass={user:{is_admin:false},callService:(d,s,data)=>{calls.push([d,s,data]);return Promise.resolve()}};
const bridge=L.createLightBridge({getHass:()=>hass,getFrame:()=>({contentWindow:{postMessage:m=>replies.push(m)}}),onChange:()=>changes++});
assert.equal(bridge.onMessage({type:"other"}),false);
assert.ok(bridge.onMessage({type:"maison3d:lights-watch",entity_ids:["light.porche","sensor.t"],toggle:"admins"}));
assert.deepEqual(bridge.watched,["light.porche"]);assert.equal(changes,1);
bridge.onMessage({type:"maison3d:light-toggle",entity_id:"light.porche"});
assert.deepEqual(calls,[]);assert.deepEqual(replies.pop(),{type:"maison3d:light-toggle-result",entity_id:"light.porche",ok:false,error:"not_allowed"});
hass.user.is_admin=true;
bridge.onMessage({type:"maison3d:light-toggle",entity_id:"light.porche"});
await new Promise(r=>setTimeout(r,0));
assert.deepEqual(calls,[["light","toggle",{entity_id:"light.porche"}]]);
assert.equal(replies.pop().ok,true);
hass.callService=()=>Promise.reject({code:"unauthorized"});
bridge.onMessage({type:"maison3d:light-toggle",entity_id:"light.porche"});
await new Promise(r=>setTimeout(r,0));
assert.deepEqual(replies.pop(),{type:"maison3d:light-toggle-result",entity_id:"light.porche",ok:false,error:"unauthorized"});
assert.deepEqual(bridge.entries(states).map(([k])=>k),["light:light.porche"]);

// Photo coordinates with object-fit: cover (wider box: the photo is cropped top / bottom).
const box={naturalWidth:1000,naturalHeight:500,width:400,height:400};
assert.deepEqual(L.coverPoint(50,50,box),{left:200,top:200});
assert.deepEqual(L.coverPoint(0,0,box),{left:-200,top:0});
assert.deepEqual(L.coverPercent(200,200,box),{x:50,y:50});
for(const [x,y] of [[12.5,80],[73.4,22.2]]){
  const p=L.coverPoint(x,y,box);assert.deepEqual(L.coverPercent(p.left,p.top,box),{x,y});
}
assert.deepEqual(L.coverPercent(-999,999,box),{x:0,y:100});

// Texts: French and English, same keys.
assert.deepEqual(Object.keys(L.TEXT.fr).sort(),Object.keys(L.TEXT.en).sort());
assert.equal(L.langOf("fr-FR"),"fr");assert.equal(L.langOf("en-GB"),"en");assert.equal(L.langOf(""),"en");
assert.equal(L.say("en","placing",{name:"Porch"}),"Tap the photo where « Porch » is · Esc to cancel");

// Draft: adding / moving a light is a change, saved only by « Enregistrer », « Annuler » restores.
const view={lights:[],light_toggle:"off"};
let restored=null;
D.registerSection("photo_settings",{get:()=>({...view,lights:view.lights.map(l=>({...l}))}),
  apply:v=>{restored=v;view.lights=L.cleanLights(v.lights);view.light_toggle=L.cleanToggle(v.light_toggle)}});
assert.equal(D.isDirty(),false);
view.lights=L.cleanLights([{entity_id:"light.porche",x:30,y:60}]);D.changed();
assert.equal(D.isDirty(),true);
view.lights[0].x=31;D.changed();assert.equal(D.isDirty(),true);
D.discardDraft();
assert.ok(restored);
assert.deepEqual(view.lights,[]);assert.equal(view.light_toggle,"off");assert.equal(D.isDirty(),false);
console.log("Outdoor lights: halo when on at night, toggle off by default, draft OK");
