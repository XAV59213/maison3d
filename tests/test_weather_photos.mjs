import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const text=readFileSync("custom_components/maison3d/www/photo-source.js","utf8");
const m=await import("data:text/javascript;base64,"+Buffer.from(text).toString("base64"));
const {pickWeatherPhoto:pick,suggestedFileName,IMAGE_KEYS,BUNDLED_IMAGES,DEFAULT_MAIN_PHOTO}=m;
const B="/maison3d-assets/images/";
// Bundled photos: <meteo>-<jour|nuit>.webp, all present on disk.
assert.deepEqual(pick({kind:"rain",night:true}),{path:B+"pluie-nuit.webp",nightPhoto:true});
assert.deepEqual(pick({kind:"snow"}),{path:B+"neige-jour.webp",nightPhoto:false});
assert.equal(pick({kind:"storm",night:true}).path,B+"orage-nuit.webp");
assert.equal(pick({kind:"fog"}).path,B+"brouillard-jour.webp");
assert.equal(pick({kind:"wind",night:true}).path,B+"vent-nuit.webp");
assert.deepEqual(pick({kind:"day"}),{path:B+"clair-jour.webp",nightPhoto:false});
assert.deepEqual(pick({kind:"night",night:true}),{path:B+"clair-nuit.webp",nightPhoto:true});
for(const p of Object.values(BUNDLED_IMAGES))assert.ok(existsSync("custom_components/maison3d/www/images/"+p.split("/").pop()),p);
// Custom images override every slot, most specific first.
const images={rain_night:"/local/a.jpg",rain:"/local/b.jpg",night:"/local/n.jpg",moon_full_moon:"/local/m.jpg",winter:"/local/w.jpg",day:"/local/d.jpg"};
assert.deepEqual(pick({kind:"rain",night:true,images}),{path:"/local/a.jpg",nightPhoto:true});
assert.deepEqual(pick({kind:"rain",images}),{path:"/local/b.jpg",nightPhoto:false});
assert.equal(pick({kind:"snow",night:true,lunarKey:"moon_full_moon",images}).path,B+"neige-nuit.webp");
assert.equal(pick({kind:"night",night:true,lunarKey:"moon_full_moon",images}).path,"/local/m.jpg");
assert.equal(pick({kind:"night",night:true,images}).path,"/local/n.jpg");
assert.equal(pick({kind:"day",season:"winter",images}).path,"/local/w.jpg");
assert.equal(pick({kind:"day",images}).path,"/local/d.jpg");
// Invalid URLs are ignored.
assert.equal(pick({kind:"rain",images:{rain:"javascript:alert(1)"}}).path,B+"pluie-jour.webp");
// The user's own main photo: no bundled photos of the reference house.
assert.deepEqual(pick({kind:"rain",night:true,mainPhoto:"/local/home.jpg"}),{path:"/local/home.jpg",nightPhoto:false});
assert.equal(pick({kind:"rain",mainPhoto:"/local/home.jpg",images:{rain_day:"/local/r.jpg"}}).path,"/local/r.jpg");
assert.equal(pick({kind:"unknown"}).path,B+"clair-jour.webp");
assert.equal(pick({kind:"day",bundled:{}}).path,DEFAULT_MAIN_PHOTO);
// Documented file names.
assert.equal(suggestedFileName("snow_night"),"neige-nuit.jpg");
assert.equal(suggestedFileName("rain_day"),"pluie-jour.jpg");
assert.equal(suggestedFileName("fog"),"brouillard.jpg");
assert.equal(suggestedFileName("summer"),"ete.jpg");
assert.equal(suggestedFileName("moon_full_moon"),"lune-full-moon.jpg");
assert.equal(new Set(IMAGE_KEYS.map(suggestedFileName)).size,IMAGE_KEYS.length);
assert.equal(IMAGE_KEYS.length,32);
console.log("Weather day/night photo selection and file names OK");
