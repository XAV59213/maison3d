/**
 * Headless Chrome: generic visits and the 390 px (portrait + landscape) 3D chrome
 * on the panel page (not the Lovelace card).
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync, existsSync} from "node:fs";
import {extname, join, dirname} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createRequire} from "node:module";

const root=join(dirname(fileURLToPath(import.meta.url)),"..","..");
const www=join(root,"custom_components","maison3d","www");
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".json":"application/json",
  ".mjs":"text/javascript; charset=utf-8"};

function loadPuppeteer(){
  const candidates=[
    process.env.NODE_PATH&&join(process.env.NODE_PATH,"puppeteer-core"),
    "/workspace/harness/node_modules/puppeteer-core",
    join(root,"node_modules","puppeteer-core")
  ].filter(Boolean);
  for(const dir of candidates){
    if(!existsSync(join(dir,"package.json")))continue;
    try{return createRequire(pathToFileURL(join(dir,"package.json")).href)("puppeteer-core")}catch{}
  }
  return null;
}
const puppeteer=loadPuppeteer()||await import("puppeteer-core").then(m=>m.default).catch(()=>null);
if(!puppeteer){console.error("puppeteer-core is required");process.exit(1)}
const chrome=process.env.CHROME_PATH
  ||["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"]
    .find(p=>existsSync(p));
if(!chrome){console.error("No Chrome/Chromium binary found (set CHROME_PATH)");process.exit(1)}

const server=createServer((req,res)=>{
  const url=decodeURIComponent((req.url||"/").split("?")[0]);
  const file=url==="/"||url==="/index.html"?join(www,"index.html"):join(www,url.replace(/^\/+/,"" ));
  if(!file.startsWith(www)||!existsSync(file)){res.writeHead(404);res.end("no");return}
  res.writeHead(200,{"content-type":TYPES[extname(file)]||"application/octet-stream","cache-control":"no-store"});
  res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const port=server.address().port;
const base=`http://127.0.0.1:${port}`;

const browser=await puppeteer.launch({
  executablePath:chrome,headless:"new",
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function openPage({width,height,isMobile=false}){
  const page=await browser.newPage();
  await page.setViewport({width,height,deviceScaleFactor:isMobile?2:1,isMobile,hasTouch:isMobile});
  await page.evaluateOnNewDocument(()=>{try{localStorage.removeItem("maison3d:card-bar:v1")}catch{}});
  await page.goto(base+"/index.html",{waitUntil:"networkidle0",timeout:60000});
  await page.waitForSelector("#maison3d-photo-controls",{timeout:20000});
  return page;
}

async function open3d(page){
  const bar=await page.$("#maison3d-photo-controls");
  const collapsed=await page.$eval("#maison3d-photo-controls",el=>el.classList.contains("collapsed"));
  if(collapsed)await page.$eval("#maison3d-photo-controls .bar-toggle",el=>el.click());
  await page.evaluate(()=>{
    const b=[...document.querySelectorAll("#maison3d-photo-controls button")].find(x=>/3D éditable/.test(x.textContent));
    b?.click();
  });
  await page.waitForSelector("#maison3d-presentation",{timeout:30000});
  await sleep(800);
}

function chromeInfo(){
  return ({
    compact:document.documentElement.classList.contains("compact-scene"),
    photoActive:document.documentElement.classList.contains("photo-active"),
    bar:{
      height:document.getElementById("maison3d-photo-controls")?.getBoundingClientRect().height||0,
      collapsed:document.getElementById("maison3d-photo-controls")?.classList.contains("collapsed")||false,
      toggle:getComputedStyle(document.querySelector("#maison3d-photo-controls .bar-toggle")||document.body).display
    },
    visits:{
      inMenu:document.getElementById("maison3d-interior-navigation")?.classList.contains("in-menu")||false,
      parent:document.getElementById("maison3d-interior-navigation")?.parentElement?.id||"",
      buttons:[...document.querySelectorAll("#maison3d-interior-navigation button")].map(b=>({
        text:b.textContent.trim(),hidden:b.hidden||getComputedStyle(b).display==="none",pressed:b.getAttribute("aria-pressed")
      }))
    },
    modes:{
      display:getComputedStyle(document.querySelector(".modes")||document.body).display,
      top:document.querySelector(".modes")?.getBoundingClientRect().top??-1,
      height:document.querySelector(".modes")?.getBoundingClientRect().height??0
    },
    weather:{
      text:document.getElementById("maison3d-weather-status")?.textContent||"",
      display:document.getElementById("maison3d-weather-status")?getComputedStyle(document.getElementById("maison3d-weather-status")).display:"missing",
      box:document.getElementById("maison3d-weather-status")?.getBoundingClientRect()||null
    },
    photoAmbienceShown:[...document.querySelectorAll("#maison3d-photo-controls .chrome-photo")].some(b=>getComputedStyle(b).display!=="none")
  });
}

function overlap(a,b){
  if(!a||!b||a.width<2||b.width<2||a.display==="none"||b.display==="none")return false;
  return a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
}

// Desktop: visit buttons visible, toggle available, both default buildings present.
{
  const page=await openPage({width:1280,height:800});
  await open3d(page);
  const info=await page.evaluate(chromeInfo);
  assert.equal(info.photoActive,false);
  assert.equal(info.visits.inMenu,false,"desktop visits stay on their own bar");
  const labels=info.visits.buttons.map(b=>b.text);
  assert.ok(labels.some(t=>t.includes("Extérieur")),labels.join("|"));
  assert.ok(labels.some(t=>t.includes("Intérieur maison")),labels.join("|"));
  assert.ok(labels.some(t=>t.includes("Intérieur grange")),labels.join("|"));
  assert.notEqual(info.bar.toggle,"none","fold toggle is visible in the panel");
  assert.equal(info.bar.collapsed,false);
  await page.evaluate(()=>{
    const b=[...document.querySelectorAll("#maison3d-interior-navigation button")].find(x=>/grange/i.test(x.textContent));
    b?.click();
  });
  await sleep(1200);
  const barn=await page.evaluate(()=>{
    const photo=[...document.querySelectorAll("#maison3d-interior-navigation button")].find(x=>x.classList.contains("interior-photo-btn"));
    const disclaimer=document.querySelector("#maison3d-interior-navigation .interior-disclaimer");
    return {
      photoText:photo?.textContent.trim(),
      photoHidden:photo?.hidden||!photo,
      disclaimerHidden:disclaimer?.hidden!==false
    };
  });
  assert.equal(barn.photoText,"📷 Photo de la grange");
  assert.equal(barn.photoHidden,false);
  assert.equal(barn.disclaimerHidden,true,"disclaimer is optional and off by default");
  await page.close();
  console.log("desktop visits OK",info.bar.height);
}

async function checkCompact(name,viewport){
  const page=await openPage({...viewport,isMobile:true});
  // Before opening 3D, the bottom bar should already be foldable and, on a phone, collapsed.
  const before=await page.evaluate(()=>{
    const nav=document.getElementById("maison3d-photo-controls");
    return {collapsed:nav.classList.contains("collapsed"),height:nav.getBoundingClientRect().height,inMenu:document.getElementById("maison3d-interior-navigation")?.classList.contains("in-menu")};
  });
  assert.equal(before.collapsed,true,name+" bar starts collapsed");
  assert.ok(before.height<80,name+" collapsed height "+before.height);
  assert.equal(before.inMenu,true,name+" visit buttons already parked in the menu");
  await open3d(page);
  // Collapse again after opening 3D (open3d expands the menu to click 3D).
  await page.evaluate(()=>{
    const nav=document.getElementById("maison3d-photo-controls");
    if(!nav.classList.contains("collapsed"))document.querySelector("#maison3d-photo-controls .bar-toggle")?.click();
  });
  await sleep(300);
  const info=await page.evaluate(chromeInfo);
  assert.equal(info.photoActive,false);
  assert.equal(info.visits.inMenu,true,name+" visits live in ☰ Menu");
  assert.equal(info.visits.parent,"maison3d-photo-controls");
  assert.equal(info.bar.collapsed,true);
  assert.ok(info.bar.height<80,name+" folded bar is short, got "+info.bar.height);
  assert.equal(info.photoAmbienceShown,false,name+" photo day/night/effects hidden in 3D: one ambience bar");
  assert.notEqual(info.modes.display,"none",name+" 3D ambience bar is visible");
  // Weather / « Simulation locale » must not be covered by the visit bar (it is in the menu).
  const visitBox=await page.evaluate(()=>{
    const nav=document.getElementById("maison3d-interior-navigation");
    const r=nav.getBoundingClientRect();
    const shown=getComputedStyle(nav).display!=="none"&&r.width>1&&r.height>1;
    const visible=shown&&[...nav.querySelectorAll("button")].some(b=>!b.hidden&&b.getBoundingClientRect().width>1);
    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,visible,display:getComputedStyle(nav).display};
  });
  assert.equal(visitBox.visible,false,name+" visit buttons are inside the collapsed menu ("+visitBox.display+")");
  if(info.weather.display!=="none"&&info.weather.box){
    assert.equal(overlap(info.weather.box,visitBox),false,name+" weather status is not covered");
    assert.match(info.weather.text,/Simulation locale|Home Assistant|Météo/i);
  }
  // Expand: visit buttons available, still no second ambience row.
  await page.$eval("#maison3d-photo-controls .bar-toggle",el=>el.click());
  await sleep(200);
  const open=await page.evaluate(chromeInfo);
  const labels=open.visits.buttons.filter(b=>!b.hidden).map(b=>b.text);
  assert.ok(labels.some(t=>t.includes("Extérieur")),name+" "+labels.join("|"));
  assert.ok(labels.some(t=>t.includes("Intérieur maison")),name);
  assert.ok(labels.some(t=>t.includes("Intérieur grange")),name);
  assert.equal(open.photoAmbienceShown,false,name+" still a single ambience bar when the menu is open");
  await page.close();
  console.log(name,"OK",{folded:info.bar.height,modes:info.modes.height});
}

await checkCompact("iphone-portrait",{width:390,height:844});
await checkCompact("iphone-paysage",{width:844,height:390});

await browser.close();
server.close();
console.log("Headless visits and 390 px chrome OK");
