import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const text=readFileSync("custom_components/maison3d/www/photo-source.js","utf8");
const {allowedPhotoUrl,resolveMainPhoto,DEFAULT_MAIN_PHOTO}=await import("data:text/javascript;base64,"+Buffer.from(text).toString("base64"));
const official=DEFAULT_MAIN_PHOTO;
assert.equal(official,"/maison3d-assets/maison3d-reference.webp");
for(const url of ["/local/maison3d/ma-maison.jpg","/maison3d-assets/images/jour.jpg","https://example.org/photo.jpg"])assert.equal(allowedPhotoUrl(url),true,url);
for(const url of ["","http://example.org/x.jpg","javascript:alert(1)","//evil.test/house.jpg","/local/\\bad.jpg","https://user:pass@example.org/image.jpg"])assert.equal(allowedPhotoUrl(url),false,url);
assert.equal(resolveMainPhoto(),official);
assert.equal(resolveMainPhoto({parent:"/local/global.jpg"}),"/local/global.jpg");
assert.equal(resolveMainPhoto({parent:"/local/global.jpg",local:"/local/panel.jpg"}),"/local/panel.jpg");
assert.equal(resolveMainPhoto({isCard:true,parent:"/local/card.jpg",local:"/local/panel.jpg"}),"/local/card.jpg");
assert.equal(resolveMainPhoto({isCard:true,parent:"/local/global.jpg",local:"/local/panel.jpg"}),"/local/global.jpg");
assert.equal(resolveMainPhoto({parent:"javascript:alert(1)",local:"/local/my-house.jpg"}),"/local/my-house.jpg");
console.log("Main photo selection, prioritization, and URL validation OK");
// Bundled photos are WebP: old .jpg addresses of bundled files still work, user files are untouched.
{const {bundledPhoto,pickWeatherPhoto}=await import("data:text/javascript;base64,"+Buffer.from(readFileSync("custom_components/maison3d/www/photo-source.js","utf8")).toString("base64"));
assert.equal(bundledPhoto("/maison3d-assets/images/jour.jpg"),"/maison3d-assets/images/clair-jour.webp");
assert.equal(bundledPhoto("/maison3d-assets/images/jour.webp"),"/maison3d-assets/images/clair-jour.webp");
assert.equal(bundledPhoto("/maison3d-assets/images/nuageux.jpg?v=1"),"/maison3d-assets/images/nuageux-jour.webp?v=1");
assert.equal(bundledPhoto("/maison3d-assets/images/pluie.webp"),"/maison3d-assets/images/pluie-jour.webp");
assert.equal(bundledPhoto("/maison3d-assets/images/neige.jpg"),"/maison3d-assets/images/neige-jour.webp");
assert.equal(bundledPhoto("/maison3d-assets/maison3d-reference.jpg?v=3"),"/maison3d-assets/maison3d-reference.webp?v=3");
for(const url of ["/local/maison3d/jour.jpg","/maison3d-media/a.jpg","https://example.org/a.jpg","/maison3d-assets/images/../x.jpg","/local/a.png"])assert.equal(bundledPhoto(url),url);
assert.equal(resolveMainPhoto({parent:"/maison3d-assets/maison3d-reference.jpg"}),official);
assert.equal(pickWeatherPhoto({kind:"rain",images:{rain_day:"/maison3d-assets/images/pluie.jpg"}}).path,"/maison3d-assets/images/pluie-jour.webp");
// Old bundled main photo address = official photo: bundled weather photos stay enabled.
assert.equal(pickWeatherPhoto({kind:"snow",mainPhoto:"/maison3d-assets/maison3d-reference.jpg"}).path,"/maison3d-assets/images/neige-jour.webp");}
console.log("Bundled WebP + legacy .jpg addresses OK");
