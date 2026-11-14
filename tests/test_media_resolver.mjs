import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const text=readFileSync("custom_components/maison3d/www/media-resolver.js","utf8");
const {createMediaResolver,MEDIA_PREFIX}=await import("data:text/javascript;base64,"+Buffer.from(text).toString("base64"));
const calls=[];let resolved=0;
const hass={callWS:async msg=>{calls.push(msg);if(msg.media_content_id.endsWith("missing.jpg"))throw {code:"resolve_media_failed"};return {url:"/media/local/"+msg.media_content_id.split("/").pop()+"?authSig=abc"}}};
const media=createMediaResolver({getHass:()=>hass,onResolved:()=>resolved++});
assert.equal(MEDIA_PREFIX,"media-source://");
assert.equal(media.url("/local/a.jpg"),"/local/a.jpg");
assert.equal(media.url(""),"");
const id="media-source://media_source/local/maison.jpg";
assert.equal(media.url(id),"");          // resolving in background
assert.equal(media.url(id),"");          // no duplicate request while pending
await new Promise(r=>setTimeout(r,5));
assert.equal(calls.length,1);
assert.deepEqual(calls[0],{type:"media_source/resolve_media",media_content_id:id,expires:86400});
assert.equal(resolved,1);
assert.equal(media.url(id),"/media/local/maison.jpg?authSig=abc");
assert.deepEqual(media.images({rain:"/local/r.jpg",snow:id,fog:"media-source://media_source/local/missing.jpg"}),{rain:"/local/r.jpg",snow:"/media/local/maison.jpg?authSig=abc"});
await new Promise(r=>setTimeout(r,5));
assert.deepEqual(media.images({fog:"media-source://media_source/local/missing.jpg"}),{});
console.log("Media resolver (media-source → signed URL, cache, errors) OK");
