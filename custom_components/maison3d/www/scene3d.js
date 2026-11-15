/**
 * Maison 3D — scène 3D éditable (Three.js), chargée à la demande.
 * index.html n'importe ce module (et three.js, ~690 Ko) qu'à l'ouverture de la vue
 * 3D / plan 2D ou d'une visite intérieure : la photo et la carte Lovelace n'en ont
 * pas besoin. Les modules gardent le ?v= de l'import map (cache-busting).
 */
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createAtmosphere} from "./weather-effects.js";
import {createPresentation} from "./presentation.js";
import {createWorldAmbience} from "./world-ambience.js";
import {createArchitectureKit} from "./architecture.js";
import {onHaData,saveToHa,browserCopySections} from "./ha-storage.js";
import {t,onUiLang} from "./i18n.js";
import {registerSection,markSaved,changed,onDraft} from "./draft.js";
import {createSceneLayout} from "./scene-layout.js";
export function startScene({photoView,interior,isOffscreen=()=>false}){
  const KEY="maison3d-v2-layout";const view=document.getElementById("view");const scene=new THREE.Scene();scene.background=new THREE.Color(0x89b7e7);scene.fog=new THREE.Fog(0x89b7e7,45,115);
  const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,230);camera.position.set(31,23,35);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;view.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=6;controls.maxDistance=95;
  scene.add(new THREE.HemisphereLight(0xe3f0ff,0x40513b,2.1));const sun=new THREE.DirectionalLight(0xffc777,3);sun.position.set(-20,33,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-47;sun.shadow.camera.right=47;sun.shadow.camera.top=47;sun.shadow.camera.bottom=-47;scene.add(sun);
  function mat(color){return new THREE.MeshStandardMaterial({color,roughness:.85})}
  const landmat=mat(0x6d8b49),brick=mat(0xc5a17a),roof=mat(0x393a3d),wood=mat(0x71503d),gray=mat(0x8c9799),grass=mat(0x648a45),roadmat=mat(0x77756f),gold=mat(0xf2cb80);
  const architecture=createArchitectureKit(THREE);
  function box(g,w,h,d,m,x=0,y=0,z=0){const q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;g.add(q);return q}
  function cyl(g,a,b,height,m,x,y,z){let q=new THREE.Mesh(new THREE.CylinderGeometry(a,b,height,9),m);q.position.set(x,y,z);q.castShadow=true;g.add(q);return q}
  const ground=box(scene,90,.4,65,grass,0,-.6,0);box(scene,90,.2,6,roadmat,0,-.37,30);
  // Physical stepped terrain: landscaped low garden, raised dwelling platform and retaining walls.
  box(scene,43,1.55,22,grass,3,.24,-12);
  box(scene,25,.72,16,grass,-25,-.03,-7);
  box(scene,24,.8,15,grass,26,-.01,-5);
  box(scene,41,1.15,.55,brick,3,.12,-.65);
  box(scene,.55,1.25,20,brick,24,.04,-11);
  architecture.landscape(scene);
  const defaultItems=[
  {id:"maison",name:"Maison principale",type:"building",x:7,z:-9,w:14,d:10,h:5,r:0},
  {id:"grange",name:"Grange / salle de jeux indépendante",type:"building",interior:"barn",x:-18,z:-12,w:9,d:7,h:3.3,r:0},
  {id:"garage",name:"Garage extrême droite",type:"garage",x:31,z:4,w:6,d:7,h:3,r:0},
  {id:"rampe",name:"Rampe véhicules gauche",type:"ramp",x:-18,z:13,w:3.5,d:23,h:2.5,r:-18},
  {id:"abri",name:"Petit abri métallique devant",type:"shed",x:-2,z:16,w:5.5,d:3.4,h:2.3,r:0},
  {id:"terrasse",name:"Terrasse surélevée",type:"terrace",x:7,z:-1,w:15,d:5,h:1.4,r:0},
  {id:"muret",name:"Mur de soutènement",type:"wall",x:10,z:10,w:27,d:.5,h:2,r:0},
  {id:"portail",name:"Portail coulissant",type:"gate",x:-14,z:26,w:4.8,d:.3,h:2,r:0},
  {id:"portillon",name:"Portillon gauche",type:"gate",x:-25,z:26,w:1.2,d:.22,h:1.8,r:0},
  {id:"piscine",name:"Piscine jardin bas",type:"pool",x:-29,z:-2,w:6,d:4,h:.7,r:0},
  {id:"balancoire",name:"Balançoire jardin",type:"swing",x:-29,z:10,w:3,d:2,h:2.7,r:0},
  {id:"arbre1",name:"Arbre jardin",type:"tree",x:17,z:14,w:3,d:3,h:7,r:0},
  {id:"arbre2",name:"Arbre près grange",type:"tree",x:-32,z:-10,w:3,d:3,h:7,r:0},
  {id:"escalier1",name:"Escalier jardin - terrasse",type:"steps",x:17,z:3,w:2,d:5,h:1.6,r:0}
  ];let data;
  try {
    const restored=JSON.parse(localStorage.getItem(KEY));
    data=Array.isArray(restored)&&restored.every(o=>o&&typeof o.id==="string"&&typeof o.type==="string")?restored:structuredClone(defaultItems);
  } catch {data=structuredClone(defaultItems)}
  const meshes=new Map();let selected=null,outline;let moving=false;const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),dragHit=new THREE.Vector3(),dragOffset=new THREE.Vector3();
  function build(o){const g=new THREE.Group();g.position.set(o.x,0,o.z);g.rotation.y=THREE.MathUtils.degToRad(o.r||0);g.userData.id=o.id;let {w,d,h}=o;
  if(architecture.build(g,o)){scene.add(g);meshes.set(o.id,g);return;}
  if(o.type==="building"||o.type==="garage"){box(g,w,h*.76,d,brick,0,h*.38,0);const roofMesh=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.73,h*.3,4),roof);roofMesh.rotation.y=Math.PI/4;roofMesh.scale.z=d/w;roofMesh.position.y=h*.89;roofMesh.castShadow=true;g.add(roofMesh);box(g,w*.48,h*.28,.07,wood,0,h*.42,d/2+.06);box(g,w*.16,h*.28,.08,gold,-w*.28,h*.43,d/2+.1)}
  else if(o.type==="shed"){box(g,w,h*.8,d,gray,0,h*.4,0);box(g,w*1.04,.17,d*1.06,roof,0,h*.83,0);box(g,w*.25,h*.6,.1,wood,0,h*.38,d/2+.06)}
  else if(o.type==="wall"){box(g,w,h,d,brick,0,h/2,0)}
  else if(o.type==="terrace"){box(g,w,h,d,brick,0,h/2,0);box(g,w,.12,d,gray,0,h+.06,0);for(let i=0;i<8;i++){cyl(g,.08,.1,.75,gray,-w/2+.3+i*w/8,h+.45,d/2-.15)}}
  else if(o.type==="ramp"){const incline=Math.atan2(h,d);const ramp=box(g,w,.2,Math.hypot(d,h),roadmat,0,h/2,0);ramp.rotation.x=-incline;for(let side of [-1,1]){const wall=box(g,.22,h*.8,d,brick,side*(w/2+.15),h*.4,0);wall.rotation.x=-incline*.5}}
  else if(o.type==="steps"){let n=Math.max(3,Math.round(d/.42));for(let i=0;i<n;i++){box(g,w,(i+1)*h/n,d/n+.04,gray,0,(i+1)*h/(2*n),-d/2+(i+.5)*d/n)}}
  else if(o.type==="road"){box(g,w,.08,d,roadmat,0,.08,0)}
  else if(o.type==="gate"){box(g,w,h,.12,roof,0,h/2,0);for(let i=0;i<Math.max(4,Math.round(w*3));i++){box(g,.03,h*.9,.15,gray,-w/2+(i+.5)*w/Math.max(4,Math.round(w*3)),h/2,0)}}
  else if(o.type==="pool"){box(g,w,.25,d,gray,0,.1,0);box(g,w*.94,.03,d*.9,mat(0x39b8ca),0,.24,0)}
  else if(o.type==="tree"){const trunk=cyl(g,w*.08,w*.11,h*.6,wood,0,h*.3,0);const leaves=new THREE.Mesh(new THREE.SphereGeometry(w*.55,12,10),mat(0x385e31));leaves.scale.y=h/w*.58;leaves.position.y=h*.73;leaves.castShadow=true;g.add(leaves)}
  else if(o.type==="swing"){for(let s of [-1,1]){let l=box(g,.12,h,.12,wood,s*w*.44,h/2,0);l.rotation.z=s*.22}box(g,w,.12,.12,wood,0,h,0);for(let s of [-1,1]){box(g,.025,h*.65,.025,gray,s*w*.19,h*.65,0)}box(g,w*.52,.1,.5,wood,0,h*.33,0)}
  else{box(g,w,h,d,wood,0,h/2,0)}scene.add(g);meshes.set(o.id,g)}
  // Free GPU memory of removed groups, but keep anything still used by the scene (shared materials).
  function disposeUnused(groups){const used=new Set();scene.traverse(o=>{if(o.geometry)used.add(o.geometry);for(const m of [].concat(o.material||[]))used.add(m)});for(const g of groups)g.traverse(o=>{if(o.geometry&&!used.has(o.geometry))o.geometry.dispose();for(const m of [].concat(o.material||[]))if(!used.has(m))m.dispose()})}
  function redraw(){if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null}const old=[...meshes.values()];for(const g of old)scene.remove(g);meshes.clear();data.forEach(build);disposeUnused(old);refreshSelect();if(selected)choose(selected.id);interior?.refresh()}
  const select=document.getElementById("objects"),ids=["x","z","w","d","h","r"];
  const barnRow=document.createElement("label");barnRow.id="barn-example-option";barnRow.style.cssText="display:block;margin-top:8px;font-size:12px;color:#d5dee7";
  const barnCheck=document.createElement("input");barnCheck.type="checkbox";
  const barnLabel=document.createTextNode(t("barn_example"));barnRow.append(barnCheck,barnLabel);
  document.getElementById("editor")?.append(barnRow);
  barnCheck.addEventListener("change",()=>{if(!selected||selected.type!=="building")return;selected.interior=barnCheck.checked?"barn":"off";save();interior?.refresh()});
  function syncBarnOption(){const allow=selected?.type==="building";barnRow.hidden=!allow;if(allow)barnCheck.checked=selected.interior==="barn"||(selected.id==="grange"&&selected.interior!=="off");}
  function refreshSelect(){select.replaceChildren(...data.map(o=>{const opt=document.createElement("option");opt.value=o.id;opt.textContent=o.name||o.id;return opt}));if(data.length){selected=data.find(o=>o.id===selected?.id)||data[0];select.value=selected.id;ids.forEach(k=>document.getElementById(k).value=selected[k]);syncBarnOption()}else{selected=null;syncBarnOption()}}
  function choose(id){selected=data.find(o=>o.id===id);refreshSelect();if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null}if(selected&&meshes.get(id)){outline=new THREE.BoxHelper(meshes.get(id),0x00d8ff);scene.add(outline)}}
  // Saved in Home Assistant (shared by every device) when possible; localStorage stays as cache / offline fallback.
  const saveStatus=t=>{document.getElementById("save").textContent=t};
  // Draft: every edit shows immediately; « 💾 Enregistrer » (bar at the top) saves it
  // in this browser and in Home Assistant, « ↶ Annuler » restores the saved layout (draft.js).
  function save(){changed()}
  const validLayout=items=>Array.isArray(items)&&items.every(o=>o&&typeof o.id==="string"&&typeof o.type==="string");
  let loadStatusKey="saved_locally";
  const loadStatusText=()=>t(loadStatusKey);
  onDraft(({dirty,kind,text})=>saveStatus(kind==="saving"||kind==="saved"||kind==="error"?text:dirty?t("dirty_3d"):loadStatusText()));
  // Project name chosen in the integration options or the card (neutral default « Maison 3D »).
  let projectName="Maison 3D";
  window.addEventListener("message",event=>{if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=="maison3d:conditions")return;
  const name=typeof event.data.project_name==="string"?event.data.project_name.trim().slice(0,60):"";projectName=name||"Maison 3D";
  for(const el of document.querySelectorAll(".project-name"))if(el.textContent!==projectName)el.textContent=projectName});
  ids.forEach(k=>document.getElementById(k).addEventListener("change",e=>{if(!selected)return;const v=+e.target.value;selected[k]=["w","d","h"].includes(k)?Math.max(.2,v):v;redraw();save()}));
  select.onchange=e=>choose(e.target.value);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();renderer.domElement.addEventListener("pointerdown",e=>{pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects([...meshes.values()],true);if(hits.length){let g=hits[0].object;while(g.parent&&!g.userData.id)g=g.parent;if(g.userData.id){choose(g.userData.id);if(ray.ray.intersectPlane(dragPlane,dragHit)){dragOffset.set(selected.x-dragHit.x,0,selected.z-dragHit.z);moving=true;controls.enabled=false}}}});
  renderer.domElement.addEventListener("pointermove",e=>{if(!moving||!selected)return;pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,camera);if(ray.ray.intersectPlane(dragPlane,dragHit)){selected.x=Math.round((dragHit.x+dragOffset.x)*4)/4;selected.z=Math.round((dragHit.z+dragOffset.z)*4)/4;let g=meshes.get(selected.id);if(g){g.position.x=selected.x;g.position.z=selected.z;if(outline)outline.update()}ids.slice(0,2).forEach(k=>document.getElementById(k).value=selected[k])}});
  function endDrag(){if(moving){moving=false;controls.enabled=true;save()}}renderer.domElement.addEventListener("pointerup",endDrag);renderer.domElement.addEventListener("pointercancel",endDrag);window.addEventListener("pointerup",endDrag);
  const typeName=type=>({building:"type_building",tree:"type_tree",shed:"type_shed_short",wall:"type_wall",road:"type_road_short",gate:"type_gate",pool:"type_pool",swing:"type_swing",steps:"type_steps",furniture:"type_furniture"})[type];
  function add(type){const id=type+Date.now();data.push({id,name:typeName(type)?t(typeName(type)):type,type,x:0,z:17,w:3,d:3,h:2,r:0});selected=data.at(-1);redraw();save()}
  function duplicate(){if(!selected)return;const cp={...selected,id:selected.type+Date.now(),name:selected.name+t("copy_suffix"),x:selected.x+2,z:selected.z+2};data.push(cp);selected=cp;redraw();save()}
  function del(){if(!selected)return;data=data.filter(o=>o.id!==selected.id);redraw();save()}
  document.getElementById("add").onclick=()=>add(document.getElementById("kind").value);document.getElementById("copy").onclick=duplicate;document.getElementById("duplicate").onclick=duplicate;document.getElementById("del").onclick=del;document.getElementById("remove").onclick=del;
  document.getElementById("reset").onclick=()=>{if(confirm(t("reset_confirm"))){data=structuredClone(defaultItems);redraw();save()}};
  document.getElementById("addtree").onclick=()=>add("tree");document.getElementById("addchair").onclick=()=>add("furniture");document.getElementById("terrain").onclick=()=>add("wall");document.getElementById("addsteps").onclick=()=>add("steps");
  document.getElementById("toggle").onclick=()=>document.getElementById("editor").classList.toggle("hidden");
  document.getElementById("topview").onclick=()=>{presentation.cancel();camera.position.set(0,60,.1);controls.target.set(0,0,0);controls.update()};
  document.getElementById("tab3d").onclick=document.getElementById("orbit").onclick=()=>{presentation.cancel();camera.position.set(31,23,35);controls.target.set(0,1,0);controls.update()};
  document.getElementById("export").onclick=()=>{let blob=new Blob([JSON.stringify({version:2,items:data},null,2)],{type:"application/json"});let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(projectName.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w-]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"maison3d")+"-projet.json";a.click();URL.revokeObjectURL(a.href)};
  document.getElementById("import").onclick=()=>document.getElementById("file").click();document.getElementById("file").onchange=async e=>{try{const obj=JSON.parse(await e.target.files[0].text());if(!Array.isArray(obj.items))throw Error(t("import_format"));data=obj.items.filter(o=>o&&typeof o.id==="string"&&/^[a-z0-9_-]{1,80}$/i.test(o.id)&&typeof o.type==="string"&&["building","garage","ramp","shed","terrace","wall","gate","pool","swing","tree","furniture","steps","road"].includes(o.type)&&["x","z","w","d","h","r"].every(k=>Number.isFinite(Number(o[k])))&&o.w>0&&o.d>0&&o.h>0).map(o=>({...o,name:String(o.name||o.id).slice(0,120),interior:o.interior==="barn"||o.interior==="off"?o.interior:undefined}));if(!data.length)throw Error(t("import_none"));redraw();save()}catch(err){alert(t("import_fail",{error:err.message}))}};
  const atmosphere=createAtmosphere({scene,sun,renderer});
  const presentation=createPresentation({THREE,camera,controls});
  interior.attach({THREE,scene,camera,controls,getItems:()=>data,getMeshes:()=>meshes,presentation});
  // Floating bars of the 3D view never cover each other (desktop, mobile, landscape).
  createSceneLayout();
  const worldAmbience=createWorldAmbience({THREE,scene,sun});
  atmosphere.update();
  redraw();if(selected)choose(selected.id);
  registerSection("layout",{get:()=>data,
    apply:saved=>{data=saved;selected=data.find(o=>o.id===selected?.id)||null;redraw()},
    writeLocal:value=>localStorage.setItem(KEY,JSON.stringify(value))});
  // Load the project saved in Home Assistant; first time, migrate this browser's layout to it.
  onHaData((ha,{connected,canSave})=>{
    const show=key=>{loadStatusKey=key;changed()};
    if(!connected){show("saved_in_browser");return}
    if(validLayout(ha.layout)){
      if(JSON.stringify(ha.layout)!==JSON.stringify(data)){data=structuredClone(ha.layout);selected=null;redraw()}
      // Cache of the layout saved in Home Assistant (not a new change).
      try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}
      markSaved("layout");
      show(browserCopySections().includes("layout")?"browserCopy":"saved_in_ha");
    }else if(canSave&&localStorage.getItem(KEY)){
      // One-time migration of the layout already saved in this browser.
      saveToHa({layout:data});show("copying_to_ha");
    }
    else show(canSave?"default_project_hint":"readonly_ha");
  });
  onUiLang(()=>{barnLabel.textContent=t("barn_example");changed()});
  addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});// Pause everything when the page is hidden or the Lovelace card is off-screen;
  // skip the WebGL render when the opaque photo view covers the 3D scene.
  const sceneVisible=()=>!document.documentElement.classList.contains("photo-active");
  renderer.setAnimationLoop((time)=>{if(document.hidden||isOffscreen())return;if(sceneVisible()){presentation.frame();controls.update();worldAmbience.frame(time);renderer.render(scene,camera)}atmosphere.frame(time);photoView.frame(time)});
  return {renderer,scene,camera,controls,data:()=>data};
}
