import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
// File URL import: hass-tracker.js imports ./sensor-values.js.
const {createHassTracker,isWeather,isDiagnostic,RESCAN_MS}=await import(pathToFileURL("custom_components/maison3d/www/hass-tracker.js").href);
let clock=0;const t=createHassTracker({now:()=>clock});
// A states object that counts how many times it is scanned.
let scans=0;
const proxy=obj=>new Proxy(obj,{ownKeys(target){scans++;return Reflect.ownKeys(target)}});
const diag={entity_id:"sensor.maison3d_etat",state:"OK",attributes:{maison3d_config:true}};
const w={entity_id:"weather.home",state:"sunny",attributes:{}};
const base={"light.a":{entity_id:"light.a",state:"on"},"sensor.maison3d_etat":diag,"weather.home":w};
let states=proxy({...base});
assert.equal(t.diagnostic(states),diag);assert.equal(t.find("weather",states,isWeather),w);
const first=scans;assert.ok(first>=1);
// Unrelated entity changes: new states object, same tracked objects → memoised, unchanged.
assert.equal(t.changed([["d",diag],["w",w]]),true);
for(let i=0;i<50;i++){
  states=proxy({...base,"light.a":{entity_id:"light.a",state:i%2?"on":"off"}});
  assert.equal(t.diagnostic(states),diag);assert.equal(t.find("weather",states,isWeather),w);
  assert.equal(t.changed([["d",states["sensor.maison3d_etat"]],["w",states["weather.home"]]]),false);
}
assert.equal(scans,first,"no rescan of all states for unrelated updates");
// Tracked entity changes → detected by reference.
const w2={...w,state:"rainy"};states=proxy({...base,"weather.home":w2});
assert.equal(t.find("weather",states,isWeather),w2);
assert.equal(t.changed([["d",diag],["w",w2]]),true);
assert.equal(t.changed([["d",diag],["w",w2]]),false);
assert.equal(t.changed([["d",diag]]),true,"list of keys changed");
// Weather becomes unavailable → rescan picks another one.
const other={entity_id:"weather.other",state:"cloudy"};
states=proxy({...base,"weather.home":{...w,state:"unavailable"},"weather.other":other});
assert.equal(t.find("weather",states,isWeather),other);
// No diagnostic sensor: one scan, then at most one rescan every RESCAN_MS.
const t2=createHassTracker({now:()=>clock});scans=0;
const none=proxy({"light.a":base["light.a"]});
for(let i=0;i<20;i++)assert.equal(t2.diagnostic(none),undefined);
assert.equal(scans,1);
clock+=RESCAN_MS+1;t2.diagnostic(none);assert.equal(scans,2);
assert.equal(isDiagnostic(diag),true);
console.log("Hass tracker (memoised ids, reference comparison, throttled rescans) OK");
