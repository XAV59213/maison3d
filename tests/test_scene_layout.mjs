import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const text=readFileSync("custom_components/maison3d/www/scene-layout.js","utf8");
const {place,LAYOUT}=await import("data:text/javascript;base64,"+Buffer.from(text).toString("base64"));
const free=(spots,W,H)=>{const r=[...spots.values()].filter(s=>!s.hidden);
  for(const a of r)assert.ok(a.x>=9&&a.y>=9&&a.x+a.w<=W-9&&a.y+a.h<=H-9,"inside "+JSON.stringify(a));
  for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],b=r[j];
    assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,"overlap "+JSON.stringify([a,b]))}};
// Typical desktop edit mode (sizes measured in Chrome at 1280×800).
const desk=[["controls","top","left",640,47],["views","top","right",380,49],["brand","top","left",180,62],["toolbar","top","center",590,50],
  ["weather","top","right",240,35],["hint","top","right",391,39,{optional:true}],["bottom","bottom","left",530,46],
  ["side","middle","left",48,200],["modes","middle","right",86,195],["editor","middle","right",288,480,{shrink:120}]]
  .map(([key,zone,side,w,h,extra])=>({key,zone,side,w,h,...extra}));
let spots=place(desk,1280,800);free(spots,1280,800);
assert.equal(spots.get("controls").x,10);assert.equal(spots.get("controls").y,10);
assert.ok(spots.get("brand").y>=spots.get("controls").y+47,"brand under the view bar");
assert.equal(spots.get("brand").x,10);
assert.ok(spots.get("editor").x>640,"editor stays on the right");
assert.equal(spots.get("bottom").y+46,790);
// Phone: everything still fits, the scrollable editor shrinks, optional helpers give way.
const phone=desk.map(i=>({...i,w:Math.min(i.w,370),zone:["controls","views"].includes(i.key)?"bottom":i.zone,optional:i.optional||i.key==="weather"}));
spots=place(phone,390,700,{compact:true});free(spots,390,700);
assert.ok(!spots.get("brand").hidden);assert.ok(spots.get("editor").h<480);
// Nothing fits: optional boxes are hidden instead of covering the others.
spots=place([{key:"a",zone:"top",side:"left",w:300,h:280},{key:"hint",zone:"top",side:"right",w:300,h:100,optional:true}],320,300);
assert.ok(spots.get("hint").hidden);
assert.deepEqual(LAYOUT.map(l=>l[0]).slice(0,4),["#maison3d-photo-controls","#maison3d-presentation",".brand",".toolbar"]);
console.log("Scene layout (no overlap desktop/phone, brand under the view bar) OK");
