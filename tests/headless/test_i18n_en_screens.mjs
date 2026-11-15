/**
 * Headless Chrome: after switching the UI to English, the main screens must
 * not show leftover French chrome (settings, 3D, visit, presentation, 390 px).
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync, existsSync, mkdirSync} from "node:fs";
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
  await page.evaluate(async()=>{
    const {setUiLang}=await import("/i18n.js");
    setUiLang("en");
  });
  await sleep(200);
  return page;
}

async function expandBar(page){
  const collapsed=await page.$eval("#maison3d-photo-controls",el=>el.classList.contains("collapsed")).catch(()=>false);
  if(collapsed)await page.$eval("#maison3d-photo-controls .bar-toggle",el=>el.click());
}

async function clickByText(page,selector,pattern){
  const re=pattern instanceof RegExp?pattern:new RegExp(pattern);
  const ok=await page.evaluate((sel,source)=>{
    const rx=new RegExp(source);
    const el=[...document.querySelectorAll(sel)].find(x=>rx.test((x.textContent||"")+" "+(x.title||"")+" "+(x.getAttribute("aria-label")||"")));
    if(!el)return false;
    el.click();
    return true;
  },selector,re.source);
  assert.equal(ok,true,"click failed: "+re);
}

async function open3d(page){
  await expandBar(page);
  await clickByText(page,"#maison3d-photo-controls button",/Editable 3D|3D éditable/);
  await page.waitForSelector("#maison3d-presentation",{timeout:30000});
  await sleep(800);
}

function visibleCopy(){
  const hidden=el=>{
    if(!el||el.hidden||el.closest("[hidden]"))return true;
    const s=getComputedStyle(el);
    return s.display==="none"||s.visibility==="hidden"||Number(s.opacity)===0;
  };
  const bits=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;
    const el=node.parentElement;
    if(!el)continue;
    if(el.closest("script,style,noscript,#objects,.project-name"))continue;
    if(hidden(el))continue;
    const text=node.textContent.replace(/\s+/g," ").trim();
    if(text)bits.push(text);
  }
  const isPath=v=>/^(https?:|\/(?:local|maison3d|api)\/)|\/[\w.-]+\.(jpe?g|png|webp|gif)(?:\?|$)/i.test(v)
    ||/^(weather|sun|sensor|binary_sensor|climate|light)\./i.test(v);
  for(const el of document.querySelectorAll("[title],[aria-label],[placeholder],input,textarea")){
    if(hidden(el)||el.closest("#objects,.project-name"))continue;
    for(const a of ["title","aria-label"]){
      const v=el.getAttribute(a);
      if(v&&v.trim())bits.push(v.trim());
    }
    const ph=el.getAttribute("placeholder");
    if(ph&&ph.trim()&&!isPath(ph))bits.push(ph.trim());
  }
  return bits;
}

const FRENCH_UI=/Enregistrer|Annuler|Fermer|Réinitialiser|personnalis|prévisualis|Vérifier et|Vérifiez |Disponible dans|pour les administrateurs|contrôler son accès|Extérieur|Intérieur(?: maison| grange)?|Photo réelle|Plan 2D|3D éditable|Présentation|Ajouter le gel|Météo forcée|Moment forcé|Image principale|Entité |Capteur |Chargement de la 3D|Aménagement réaliste|Volumes intérieurs|Photo de la grange|Images et saisons|Revenir à la météo|Forcer le jour|Forcer la nuit|Printemps|Automne|\bÉté\b|\bHiver\b|aucune entité|saisie libre|administrateur requis|délai dépassé|Envoyer une photo|Choisir et envoyer|Effet gel|Intensité des animations|photographie officielle|Activer les effets|Mode édition|Vue générale|Dupliquer|Supprimer|Exporter JSON|Importer JSON|Scène éditable|Nouvel objet|Objet sélectionné|Visites intérieures|Photo du bâtiment|Édition des objets|Clique sur|\bLargeur\b|\bLongueur\b|\bHauteur\b|Végétation|Mobilier|Escalier|Abri métal|Chemin \/ route|Balançoire|Piscine|Portail|\bMuret\b|\bArbre\b|Bâtiment|\bJour\b|\bSoir\b|\bNuit\b|Projet :|Réglages|Automatique \(Home Assistant\)|Modifications non enregistrées|Enregistré (localement|dans)|Lecture seule|Projet par défaut|aucun objet|format refusé|Fichier trop gros|Vérification en cours|Image trouvée|Image inaccessible|Image modifiée|Ambiance/i;

async function assertEnglish(page,label){
  const bits=await page.evaluate(visibleCopy);
  const hits=bits.filter(text=>FRENCH_UI.test(text));
  assert.deepEqual(hits,[],"French leftover on "+label+": "+hits.slice(0,8).join(" | "));
  return bits;
}

const shotsDir=process.env.SHOTS_DIR||"";
async function shot(page,name){
  if(!shotsDir)return;
  mkdirSync(shotsDir,{recursive:true});
  await page.screenshot({path:join(shotsDir,name),fullPage:false});
}

const failures=[];
try{
  const desktop=await openPage({width:1280,height:800});
  await expandBar(desktop);
  await clickByText(desktop,"#maison3d-photo-controls button",/Images \/ weather|Images \/ météo|⚙/);
  await desktop.waitForSelector("#maison3d-photo-settings:not([hidden])",{timeout:10000});
  await sleep(200);
  await assertEnglish(desktop,"settings");
  await shot(desktop,"i18n-en-settings.png");
  await desktop.evaluate(()=>{
    const s=document.getElementById("maison3d-photo-settings");
    if(s&&!s.hidden){
      const b=[...document.querySelectorAll("#maison3d-photo-controls button")].find(x=>/⚙/.test(x.textContent||""));
      b?.click();
    }
  });

  await open3d(desktop);
  await assertEnglish(desktop,"3d");
  await shot(desktop,"i18n-en-3d.png");

  const visitClicked=await desktop.evaluate(()=>{
    const nav=document.querySelector("#maison3d-interior-navigation");
    const b=nav&&[...nav.querySelectorAll("button")].find(x=>/interior|Intérieur/i.test(x.textContent||""));
    b?.click();
    return Boolean(b);
  });
  assert.equal(visitClicked,true,"visit button missing");
  await sleep(800);
  await assertEnglish(desktop,"visit");
  await shot(desktop,"i18n-en-visite.png");

  await desktop.evaluate(()=>{
    const nav=document.querySelector("#maison3d-interior-navigation");
    const b=nav&&[...nav.querySelectorAll("button")].find(x=>/Outside|Extérieur/i.test(x.textContent||""));
    b?.click();
  });
  await sleep(500);
  const pres=await desktop.evaluate(()=>{
    const labels=[...document.querySelectorAll("#maison3d-presentation button")].map(x=>x.textContent||"");
    const aerial=[...document.querySelectorAll("#maison3d-presentation button")].find(x=>/Aerial|Aérienne/i.test(x.textContent||""));
    aerial?.click();
    return labels;
  });
  assert.ok(pres.some(l=>/Front|Aerial|Garden|Edit|Presentation|Façade|Aérienne|Jardin|Édition|Présentation/i.test(l)),
    "presentation toolbar missing: "+JSON.stringify(pres));
  await sleep(600);
  await assertEnglish(desktop,"presentation");
  await shot(desktop,"i18n-en-presentation.png");
  await desktop.close();

  const phone=await openPage({width:390,height:844,isMobile:true});
  await expandBar(phone);
  await clickByText(phone,"#maison3d-photo-controls button",/Images \/ weather|Images \/ météo|⚙/);
  await phone.waitForSelector("#maison3d-photo-settings:not([hidden])",{timeout:10000});
  await sleep(200);
  await assertEnglish(phone,"iphone-settings");
  await shot(phone,"i18n-en-iphone.png");
  await phone.close();
}catch(err){
  failures.push(err);
}finally{
  await browser.close();
  await new Promise(r=>server.close(r));
}
if(failures.length){
  console.error(failures[0]);
  process.exit(1);
}
console.log("i18n EN residual-French scan OK");
