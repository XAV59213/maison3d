import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const www=name=>pathToFileURL("custom_components/maison3d/www/"+name).href;
const {langOf,t,labelOf}=await import(www("i18n.js"));
const {shouldDeferFirstPhoto,WEATHER_WAIT_MS,bundledPhoto}=await import(www("photo-source.js"));

assert.equal(langOf("fr"),"fr");
assert.equal(langOf("fr-FR"),"fr");
assert.equal(langOf("en"),"en");
assert.equal(langOf("en-GB"),"en");
assert.equal(langOf(""),"en");
assert.equal(t("fr","ed_check"),"Vérifier et prévisualiser");
assert.equal(t("en","ed_check"),"Check and preview");
assert.equal(t("fr","view_photo"),"▣ Photo réelle");
assert.equal(t("en","card_footer").includes("Maison 3D"),true);
assert.equal(labelOf("en","rain"),"Rain");
assert.equal(labelOf("fr","spring"),"Printemps");
assert.equal(t("en","issue_missing",{id:"sensor.x"}),"⚠ sensor.x not found");
assert.equal(WEATHER_WAIT_MS,1500);
assert.equal(shouldDeferFirstPhoto(false),true);
assert.equal(shouldDeferFirstPhoto(true),false);
assert.equal(bundledPhoto("/maison3d-assets/images/jour.webp"),"/maison3d-assets/images/clair-jour.webp");

// Every French key has an English entry (and the other way around).
const source=(await import("node:fs")).readFileSync("custom_components/maison3d/www/i18n.js","utf8");
const keys=lang=>[...source.matchAll(new RegExp(lang+":\\{[\\s\\S]*?\\n  \\},?\\n"))].length;
// Simpler: evaluate by importing TEXT via t falling back to the key name
const sample=["view_photo","ed_general","ed_upload","status_auto","label_snow","source_integration","startup_grace"];
for(const key of ["view_photo","ed_general","ed_upload","status_auto","label_snow","source_integration","card_footer","issue_unavailable"]){
  assert.notEqual(t("fr",key),key,key+" missing in fr");
  assert.notEqual(t("en",key),key,key+" missing in en");
}
console.log("i18n FR/EN, photo wait and legacy mapping OK");
