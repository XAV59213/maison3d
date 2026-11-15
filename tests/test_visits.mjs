import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const V=await import(pathToFileURL("custom_components/maison3d/www/visits.js").href);

assert.equal(V.isCompactView(390,844),true);
assert.equal(V.isCompactView(844,390),true);
assert.equal(V.isCompactView(1280,800),false);
assert.equal(V.isCompactView(701,501),false);

const maison={id:"maison",name:"Maison principale",type:"building"};
const grange={id:"grange",name:"Grange / salle de jeux indépendante",type:"building",interior:"barn"};
const off={id:"grange",name:"Grange",type:"building",interior:"off"};
const shed={id:"abri",name:"Abri",type:"shed"};
const custom={id:"atelier",name:"Atelier bois",type:"building"};
const opted={id:"atelier",name:"Atelier bois",type:"building",interior:"barn"};

assert.equal(V.isVisitBuilding(maison),true);
assert.equal(V.isVisitBuilding(shed),false);
assert.equal(V.isBarnInterior(grange),true);
assert.equal(V.isBarnInterior({id:"grange",name:"Grange",type:"building"}),true,"legacy default barn");
assert.equal(V.isBarnInterior(off),false);
assert.equal(V.isBarnInterior(custom),false);
assert.equal(V.isBarnInterior(opted),true);
assert.equal(V.canOfferBarnExample(custom),true);
assert.equal(V.canOfferBarnExample(shed),false);
assert.equal(V.hasInteriorPhoto(grange),true);
assert.equal(V.hasInteriorPhoto(off),false);
assert.equal(V.hasInteriorPhoto(custom),false);
assert.equal(V.hasInteriorPhoto({...custom,interior_photo:"/local/x.webp"}),true);

assert.deepEqual(V.visitBuildings([shed,maison,grange]).map(o=>o.id),["maison","grange"]);
assert.deepEqual(V.visitBuildings([]).map(o=>o.id),["maison","grange"],"fallback to the default project");
assert.deepEqual(V.visitBuildings([custom]).map(o=>o.id),["atelier"]);
assert.ok(!V.visitBuildings([maison,shed]).some(o=>o.id==="grange"),"absent barn is hidden");

assert.equal(V.visitButtonLabel(maison),"🚪 Intérieur maison");
assert.equal(V.visitButtonLabel(grange),"🏚 Intérieur grange");
assert.equal(V.visitButtonLabel(custom),"🚪 Intérieur Atelier bois");
assert.equal(V.photoButtonLabel(grange,false),"📷 Photo de la grange");
assert.equal(V.photoButtonLabel(grange,true),"⬡ Vue 3D");
assert.equal(V.photoButtonLabel(custom,false),"📷 Photo de Atelier bois");
assert.equal(V.INTERIOR_DISCLAIMER.includes("Volumes intérieurs provisoires"),true);
console.log("visits helpers OK");
