import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
globalThis.window={location:{origin:"http://ha.local"}};
const text=readFileSync("custom_components/maison3d/www/storage-bridge.js","utf8");
const {createStorageBridge}=await import("data:text/javascript;base64,"+Buffer.from(text).toString("base64"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const posted=[],calls=[];
const frame={contentWindow:{postMessage:(m,origin)=>{assert.equal(origin,"http://ha.local");posted.push(m)}}};
let admin=true,stored={layout:[{id:"a",type:"tree"}]};
const hass={get user(){return {is_admin:admin}},callWS:async msg=>{calls.push(msg);if(msg.type==="maison3d/get")return {data:stored};return {updated_at:"now"}}};
const bridge=createStorageBridge({getFrame:()=>frame,getHass:()=>hass,delay:30});
const from=(data,source=frame.contentWindow,origin="http://ha.local")=>({data,source,origin});
// Load relays the HA data with the admin flag.
bridge.onMessage(from({type:"maison3d:storage-load"}));await sleep(5);
assert.deepEqual(posted.pop(),{type:"maison3d:storage",data:stored,can_save:true});
// Messages from another window/origin are ignored.
bridge.onMessage(from({type:"maison3d:storage-load"},{}));
bridge.onMessage(from({type:"maison3d:storage-load"},frame.contentWindow,"https://evil.test"));await sleep(5);
assert.equal(calls.length,1);
// Saves are debounced and merged into one websocket call.
bridge.onMessage(from({type:"maison3d:storage-save",patch:{layout:[1]}}));
bridge.onMessage(from({type:"maison3d:storage-save",patch:{layout:[2],view:{preset:"garden"}}}));
bridge.onMessage(from({type:"maison3d:storage-save",patch:{photo_settings:{season:"winter"},evil:1}}));
await sleep(60);
assert.equal(calls.length,2);
assert.deepEqual(calls[1],{type:"maison3d/save",layout:[2],view:{preset:"garden"},photo_settings:{season:"winter"}});
assert.deepEqual(posted.pop(),{type:"maison3d:storage-saved",ok:true});
// Non-admin: nothing sent, the iframe is told why.
admin=false;
bridge.onMessage(from({type:"maison3d:storage-save",patch:{layout:[3]}}));await sleep(60);
assert.equal(calls.length,2);
assert.deepEqual(posted.pop(),{type:"maison3d:storage-saved",ok:false,error:"admin_required"});
// Integration without the command: browser storage only.
admin=true;hass.callWS=async()=>{throw {code:"unknown_command",message:"Unknown command."}};
bridge.onMessage(from({type:"maison3d:storage-load"}));await sleep(5);
assert.deepEqual(posted.pop(),{type:"maison3d:storage",data:null,can_save:false,error:"Unknown command."});
// flush() sends pending saves at once (panel/card removed).
hass.callWS=async msg=>{calls.push(msg);return {}};
bridge.onMessage(from({type:"maison3d:storage-save",patch:{view:{preset:"garage"}}}));
await bridge.flush();
assert.deepEqual(calls.at(-1),{type:"maison3d/save",view:{preset:"garage"}});
console.log("Storage bridge (load, debounce, admin, origin checks) OK");
