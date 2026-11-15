// srcset / sizes of the bundled photos (photo-source.js).
import assert from "node:assert/strict";
import {responsiveSrcset,photoSizes,BUNDLED_IMAGES,DEFAULT_MAIN_PHOTO} from "../custom_components/maison3d/www/photo-source.js";
assert.equal(responsiveSrcset("/maison3d-assets/images/clair-jour.webp"),
  "/maison3d-assets/images/clair-jour-640.webp 640w, /maison3d-assets/images/clair-jour-960.webp 960w, /maison3d-assets/images/clair-jour.webp 1286w");
assert.match(responsiveSrcset(DEFAULT_MAIN_PHOTO),/maison3d-reference-640\.webp 640w/);
assert.match(responsiveSrcset("/maison3d-assets/images/grange-interieur.webp"),/grange-interieur\.webp 1500w$/);
for(const path of Object.values(BUNDLED_IMAGES))assert.ok(responsiveSrcset(path),path);
// Custom images (user URLs) and unknown files: no srcset.
for(const url of ["/local/maison3d/jour.jpg","/maison3d-media/a.webp","https://example.org/a.webp","/maison3d-assets/images/jour.webp","/maison3d-assets/images/clair-jour.webp?x=1"])
  assert.equal(responsiveSrcset(url),"",url);
// Cover: width of the rendered photo; density capped at 1.5.
assert.equal(photoSizes({width:1280,height:800,ratio:1286/914,dpr:1}),"1280px");
assert.equal(photoSizes({width:390,height:844,ratio:1286/914,dpr:3}),Math.ceil(844*1286/914*1.5/3)+"px");
assert.equal(photoSizes({width:390,height:844,ratio:1500/845,fit:"contain",dpr:2}),Math.ceil(390*1.5/2)+"px");
console.log("responsive photos OK");
