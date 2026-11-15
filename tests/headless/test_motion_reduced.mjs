/**
 * Headless Chrome: with prefers-reduced-motion, autumn particles must move in
 * Auto (slowly) and Always, and stay still in Never.
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
  ".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".json":"application/json"};

const page=`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>motion</title></head>
<body><canvas id="c" style="width:400px;height:300px" width="400" height="300"></canvas>
<script type="module">
import {createSeasonEffects} from "./season-effects.js";
import {setMotionMode,motionLevel,systemReduced} from "./motion-level.js";
function travel(mode){
  setMotionMode(mode);
  const fx=createSeasonEffects(document.getElementById("c"));
  fx.reset("autumn");
  fx.frame(0,"autumn",1,false,true);
  const a=fx.snapshot();
  fx.frame(2000,"autumn",1,false,true);
  const b=fx.snapshot();
  let sum=0;
  for(let i=0;i<Math.min(a.length,b.length);i++)sum+=Math.hypot(b[i].x-a[i].x,b[i].y-a[i].y);
  return {mode,level:motionLevel(),reduced:systemReduced(),travel:sum,count:a.length};
}
const results={auto:travel("auto"),always:travel("always"),never:travel("never")};
await fetch("/result",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(results)});
</script></body></html>`;

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
if(!puppeteer){
  console.error("puppeteer-core is required for the headless motion test (npm install --no-save puppeteer-core)");
  process.exit(1);
}

const chrome=process.env.CHROME_PATH
  ||["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"]
    .find(p=>existsSync(p));
if(!chrome){
  console.error("No Chrome/Chromium binary found (set CHROME_PATH)");
  process.exit(1);
}

let posted;
const postedPromise=new Promise(resolve=>{posted=resolve});
const server=createServer((req,res)=>{
  if(req.method==="POST"&&req.url==="/result"){
    const chunks=[];
    req.on("data",c=>chunks.push(c));
    req.on("end",()=>{
      res.writeHead(200);res.end("ok");
      posted(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    });
    return;
  }
  if(req.url==="/"||req.url==="/test.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(page);return;
  }
  const file=join(www,decodeURIComponent((req.url||"/").split("?")[0]));
  if(!file.startsWith(www)||!existsSync(file)){res.writeHead(404);res.end();return}
  res.writeHead(200,{"content-type":TYPES[extname(file)]||"application/octet-stream"});
  res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const {port}=server.address();
const url=`http://127.0.0.1:${port}/test.html`;

const browser=await puppeteer.launch({
  executablePath:chrome,headless:"new",
  args:["--no-sandbox","--disable-gpu","--use-gl=angle","--use-angle=swiftshader"]
});
try{
  const tab=await browser.newPage();
  await tab.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
  await tab.goto(url,{waitUntil:"networkidle0",timeout:30000});
  const results=await Promise.race([
    postedPromise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error("timed out waiting for particle results")),20000))
  ]);
  console.log(JSON.stringify(results));
  assert.equal(results.auto.reduced,true,"prefers-reduced-motion must be emulated");
  assert.ok(results.auto.level>0&&results.auto.level<1,"Auto + reduced → slow residual level");
  assert.equal(results.always.level,1);
  assert.equal(results.never.level,0);
  assert.ok(results.always.travel>0,"Always: particles move despite reduced motion");
  assert.ok(results.auto.travel>0,"Auto: particles still move (slowly) under reduced motion");
  assert.ok(results.auto.travel<results.always.travel*0.5,"Auto is clearly slower than Always");
  assert.ok(results.never.travel===0,"Never: particles stay still");
  console.log("Headless reduced-motion particle test OK");
}finally{
  await browser.close();
  server.close();
}
