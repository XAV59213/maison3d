import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
globalThis.window={location:{origin:"http://ha.local"}};
const text=readFileSync("custom_components/maison3d/www/storage-bridge.js","utf8");
const {createStorageBridge,uploadPhoto,UPLOAD_MAX}=await import("data:text/javascript;base64,"+Buffer.from(text).toString("base64"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const requests=[];let status=200;
const hass={user:{is_admin:true},fetchWithAuth:async(path,init)=>{
  requests.push({path,init});
  return {ok:status<300,status,json:async()=>status<300?{url:"/maison3d-media/neige-nuit.jpg?v=1",file:"neige-nuit.jpg"}:{message:"Format refusé"}};
}};
const jpeg=new File([new Uint8Array([255,216,255,0])],"IMG.JPG",{type:"image/jpeg"});
const result=await uploadPhoto(hass,jpeg,"neige-nuit");
assert.equal(result.url,"/maison3d-media/neige-nuit.jpg?v=1");
assert.equal(requests[0].path,"/api/maison3d/upload");
assert.equal(requests[0].init.method,"POST");
assert.equal(requests[0].init.body.get("name"),"neige-nuit");
assert.equal(requests[0].init.body.get("file").name,"IMG.JPG");
await assert.rejects(uploadPhoto(hass,new File(["x"],"a.gif",{type:"image/gif"})),/bad_format/);
await assert.rejects(uploadPhoto(hass,new File([new Uint8Array(UPLOAD_MAX+1)],"a.jpg",{type:"image/jpeg"})),/too_big/);
await assert.rejects(uploadPhoto(hass,null),/no_file/);
status=415;await assert.rejects(uploadPhoto(hass,jpeg),/Format refusé/);status=200;
assert.equal(requests.length,2); // client-side checks never reach the server
// Bridge: the iframe asks, the parent uploads and replies with the same id.
const posted=[];
const frame={contentWindow:{postMessage:m=>posted.push(m)}};
const bridge=createStorageBridge({getFrame:()=>frame,getHass:()=>hass});
const from=data=>({data,source:frame.contentWindow,origin:"http://ha.local"});
bridge.onMessage(from({type:"maison3d:upload",id:7,file:jpeg,name:"ma-maison"}));await sleep(5);
assert.deepEqual(posted.pop(),{type:"maison3d:upload-result",id:7,ok:true,url:"/maison3d-media/neige-nuit.jpg?v=1"});
bridge.onMessage({data:{type:"maison3d:upload",id:8,file:jpeg},source:{},origin:"http://ha.local"});await sleep(5);
assert.equal(posted.length,0); // foreign window ignored
hass.user={is_admin:false};
bridge.onMessage(from({type:"maison3d:upload",id:9,file:jpeg}));await sleep(5);
assert.deepEqual(posted.pop(),{type:"maison3d:upload-result",id:9,ok:false,error:"admin_required"});
assert.equal(requests.length,3);
console.log("Upload photo (checks, fetchWithAuth, bridge admin/origin) OK");
