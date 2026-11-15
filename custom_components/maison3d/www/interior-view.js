/**
 * Explorateur des intérieurs.
 * - Grange : aménagement d'après la photo réelle (barn-interior.js) et bouton
 *   « 📷 Photo réelle » qui affiche cette photo.
 * - Maison : volumes 3D schématiques basés sur les dimensions du bâtiment ; pas
 *   de pièces attestées, un relevé ou des photos restent nécessaires.
 */
import {buildBarnInterior,BARN_VIEW,BARN_PHOTO} from "./barn-interior.js";
// The buttons exist from the start (photo view included); the 3D part is attached by
// scene3d.js once loaded: entering a building first asks ensureScene() to load it.
export function createInteriorExplorer({photoView,ensureScene=null}){
  let THREE,scene,camera,controls,getItems,getMeshes,presentation,shell;
  let paint,floor,accent,timber,dark,glass,cameraBefore;
  function attach(deps){
    ({THREE,scene,camera,controls,getItems,getMeshes,presentation}=deps);
    shell=new THREE.Group();shell.name="maison3d-interior-provisional";
    scene.add(shell);
    const material=(color,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide});
    paint=material(0xe7e0d4);floor=material(0xbca88c);accent=material(0x918b7d);
    timber=material(0x997050);dark=material(0x46443d);glass=material(0x9acbd4,.28);
    cameraBefore={position:new THREE.Vector3(),target:new THREE.Vector3(),fov:46};
  }
  function block(parent,w,h,d,mat,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  }
  const nav=document.createElement("nav");
  nav.id="maison3d-interior-navigation";
  nav.setAttribute("aria-label","Visites intérieures Maison 3D");
  const buttons=new Map();
  function add(key,text){
    const b=document.createElement("button");b.type="button";b.textContent=text;
    b.setAttribute("aria-pressed","false");
    b.addEventListener("click",()=>{
      if(shell||key==="outside")return enter(key);
      ensureScene?.().then(()=>enter(key)).catch(()=>{});
    });
    nav.append(b);buttons.set(key,b);
  }
  add("outside","↩ Extérieur");
  add("maison","🚪 Intérieur maison");
  add("grange","🏚 Intérieur grange");
  // Real photo of the barn interior (only while visiting the barn).
  const photoBtn=document.createElement("button");
  photoBtn.type="button";photoBtn.textContent="📷 Photo réelle";photoBtn.className="interior-photo-btn";
  photoBtn.title="Afficher la photo réelle de l'intérieur de la grange";
  photoBtn.setAttribute("aria-pressed","false");photoBtn.hidden=true;
  nav.append(photoBtn);
  const realPhoto=document.createElement("figure");
  realPhoto.id="maison3d-interior-photo";realPhoto.hidden=true;
  const realImg=document.createElement("img");
  realImg.alt="Photo réelle de l'intérieur de la grange";realImg.decoding="async";
  const caption=document.createElement("figcaption");
  caption.textContent="Photo réelle — intérieur de la grange · « ⬡ Vue 3D » pour revenir à la 3D";
  realPhoto.append(realImg,caption);
  const showPhoto=on=>{
    if(on&&!realImg.src)realImg.src=new URL(BARN_PHOTO,import.meta.url).href;
    realPhoto.hidden=!on;photoBtn.setAttribute("aria-pressed",String(on));
    photoBtn.textContent=on?"⬡ Vue 3D":"📷 Photo réelle";
  };
  photoBtn.addEventListener("click",()=>showPhoto(realPhoto.hidden));
  const label=document.createElement("span");
  label.className="interior-disclaimer";
  label.textContent="Volumes intérieurs provisoires — plans à confirmer";
  label.hidden=true;
  nav.append(label);
  const style=document.createElement("style");
  style.textContent=[
    "#maison3d-interior-navigation{position:fixed;top:66px;left:12px;z-index:10;",
    "display:flex;align-items:center;gap:5px;flex-wrap:wrap;max-width:calc(100vw - 24px);",
    "padding:6px;border-radius:11px;background:#142437ef;box-shadow:0 6px 20px #0006}",
    "#maison3d-interior-navigation button{border:0;background:#31445d;color:white;",
    "padding:9px;border-radius:8px;cursor:pointer;font:12px system-ui}",
    "#maison3d-interior-navigation button[aria-pressed=true]{background:#1476dc}",
    "#maison3d-interior-navigation .interior-disclaimer{font:11px system-ui;color:#c7d3de}",
    "#maison3d-interior-navigation button.interior-photo-btn{background:#7a4b12}",
    "#maison3d-interior-navigation button.interior-photo-btn[aria-pressed=true]{background:#1476dc}",
    "#maison3d-interior-navigation [hidden]{display:none!important}",
    "html.interior-barn #maison3d-weather-overlay,html.interior-barn .season-overlay,html.interior-barn .frost-overlay,html.interior-barn .photo-cinematics{display:none!important}",
    "#maison3d-interior-photo{position:fixed;inset:0;margin:0;z-index:9;background:#0d141d;display:flex;align-items:center;justify-content:center}",
    "#maison3d-interior-photo[hidden]{display:none}",
    "#maison3d-interior-photo img{width:100%;height:100%;object-fit:contain}",
    "#maison3d-interior-photo figcaption{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);max-width:calc(100% - 20px);",
    "background:#101923dd;color:#fff;font:12px system-ui;padding:6px 10px;border-radius:8px;text-align:center}",
    "html.card-mode #maison3d-interior-navigation{top:8px;left:6px}",
    "html.photo-active #maison3d-interior-navigation{top:60px}",
    "@media(max-width:710px){#maison3d-interior-navigation{top:52px;left:6px;right:6px;max-width:none}",
    "#maison3d-interior-navigation button{padding:6px;font-size:11px}",
    "#maison3d-interior-navigation .interior-disclaimer{font-size:10px}}"
  ].join("");
  document.head.append(style);document.body.append(realPhoto,nav);
  let active="outside";
  const hidden=new Map();
  function clear(){
    if(!shell)return;
    for(const mesh of [...shell.children]){
      shell.remove(mesh);
      mesh.traverse(obj=>{obj.geometry?.dispose();if(obj.material&&obj.material!==paint&&obj.material!==floor&&obj.material!==accent&&obj.material!==timber&&obj.material!==dark&&obj.material!==glass)obj.material.dispose?.()});
    }
  }
  // La grange est rendue sur un calque dédié : ni soleil, ni ciel, ni particules météo
  // extérieures (feuilles, neige) ne la traversent ; seules ses propres lampes l'éclairent.
  const BARN_LAYER=2;let layersBefore=null;
  function restore(){
    if(!shell)return;
    if(layersBefore!==null){camera.layers.mask=layersBefore;layersBefore=null}
    document.documentElement.classList.remove("interior-barn");
    for(const [node,value] of hidden)node.visible=value;
    hidden.clear();clear();
  }
  // Grange : pièce réelle (≈ 5 × 15 m, plafond 2,5 m) d'après la photo, centrée sur le
  // bâtiment ; tout le reste de la scène est masqué pendant la visite.
  function drawBarn(o){
    const group=new THREE.Group();
    group.position.set(o.x,0.36,o.z);
    group.rotation.y=THREE.MathUtils.degToRad(o.r||0);
    shell.add(group);
    for(const child of scene.children){
      if(child===shell||child.isLight||child.isCamera)continue;
      hidden.set(child,child.visible);child.visible=false;
    }
    const room=buildBarnInterior(THREE,group);
    group.traverse(obj=>obj.layers.set(BARN_LAYER));
    if(layersBefore===null)layersBefore=camera.layers.mask;
    camera.layers.set(BARN_LAYER);
    document.documentElement.classList.add("interior-barn");
    return {w:room.width,d:room.depth,h:room.height,group,barn:true};
  }
  function drawFloor(o,isBarn){
    const w=Math.max(3,o.w),d=Math.max(3,o.d);
    const h=Math.max(2.3,Math.min(o.h*.82,4.2));
    const group=new THREE.Group();
    group.position.set(o.x,0,o.z);
    group.rotation.y=THREE.MathUtils.degToRad(o.r||0);
    shell.add(group);
    const wall=paint,ground=floor;
    block(group,w,.14,d,ground,0,.07,0);
    block(group,w,h,.18,wall,0,h/2,-d/2);
    block(group,.18,h,d,wall,-w/2,h/2,0);
    block(group,.18,h,d,wall,w/2,h/2,0);
    // Low front edge intentionally open: the user can actually see inside.
    block(group,w,.38,.16,accent,0,.19,d/2);
    for(const sign of [-1,1]){
      block(group,.15,h,.2,accent,sign*(w/2-.10),h/2,-d/2+.08);
    }
    const spots=[[-w*.23,-d*.20],[w*.21,-d*.15]];
    for(const [x,z] of spots){
      const lamp=new THREE.PointLight(0xffe7bc,6,Math.max(w,d)*1.8,2);
      lamp.position.set(x,h-.38,z);group.add(lamp);
      const shade=new THREE.Mesh(new THREE.CylinderGeometry(.24,.34,.15,12),dark);
      shade.position.copy(lamp.position);shade.position.y+=.15;group.add(shade);
    }
    // Maison: simple séjour de démonstration sans inventer de distribution.
    block(group,w*.35,.42,d*.18,accent,0,.21,-d*.17);
    block(group,w*.23,.75,d*.17,timber,-w*.23,.375,d*.18);
    block(group,w*.20,.52,d*.11,dark,w*.23,.26,d*.18);
    block(group,w*.18,1.35,.09,glass,-w*.25,1.38,-d/2+.15);
    return {w,d,h,group};
  }
  function enter(key){
    if(!shell){if(key!=="outside")ensureScene?.().then(()=>enter(key)).catch(()=>{});return}
    if(key==="outside"){
      const wasInside=active!=="outside";
      active="outside";restore();
      if(wasInside){
        presentation.cancel();
        camera.position.copy(cameraBefore.position);
        controls.target.copy(cameraBefore.target);
        camera.fov=cameraBefore.fov;camera.updateProjectionMatrix();controls.update();
      }
    }else{
      const building=getItems().find(item=>item.id===key&&item.type==="building");
      if(!building)return;
      // Enter the real geometry view even when the photographic view was active.
      if(photoView.state.enabled){photoView.state.enabled=false;photoView.update()}
      if(active==="outside"){
        cameraBefore.position.copy(camera.position);
        cameraBefore.target.copy(controls.target);
        cameraBefore.fov=camera.fov;
      }
      restore();
      // Hide only the chosen exterior mesh. Do not delete or alter saved geometry.
      const exterior=getMeshes().get(key);
      if(exterior){hidden.set(exterior,exterior.visible);exterior.visible=false}
      const volume=key==="grange"?drawBarn(building):drawFloor(building,false);
      active=key;
      presentation.cancel();
      const angle=THREE.MathUtils.degToRad(building.r||0);
      const transform=(x,z)=>({
        x:building.x+x*Math.cos(angle)+z*Math.sin(angle),
        z:building.z-x*Math.sin(angle)+z*Math.cos(angle)
      });
      if(volume.barn){
        // Same point of view as the real photo: from the entrance, towards the back.
        const eye=transform(BARN_VIEW.eye[0],BARN_VIEW.eye[2]),aim=transform(BARN_VIEW.target[0],BARN_VIEW.target[2]);
        camera.position.set(eye.x,0.36+BARN_VIEW.eye[1],eye.z);
        controls.target.set(aim.x,0.36+BARN_VIEW.target[1],aim.z);
        camera.fov=camera.aspect<1?78:BARN_VIEW.fov;camera.updateProjectionMatrix();controls.update();
      }else{
        const viewpoint=transform(0,volume.d*.30);
        const target=transform(0,-volume.d*.15);
        camera.position.set(viewpoint.x,Math.min(volume.h*.56,1.8),viewpoint.z);
        controls.target.set(target.x,Math.min(volume.h*.54,1.7),target.z);
        camera.fov=65;camera.updateProjectionMatrix();controls.update();
      }
    }
    for(const [id,b] of buttons)b.setAttribute("aria-pressed",String(id===active));
    label.hidden=active==="outside";
    label.textContent=active==="grange"?"Grange : aménagement d'après la photo réelle · mesures approximatives":
      "Volumes intérieurs provisoires — plans à confirmer";
    photoBtn.hidden=active!=="grange";
    if(active!=="grange")showPhoto(false);
  }
  function refresh(){
    if(active==="outside")return;
    const current=active;
    const beforePosition=cameraBefore.position.clone();
    const beforeTarget=cameraBefore.target.clone();
    const beforeFov=cameraBefore.fov;
    active="outside";restore();enter(current);
    cameraBefore.position.copy(beforePosition);
    cameraBefore.target.copy(beforeTarget);
    cameraBefore.fov=beforeFov;
  }
  for(const [id,b] of buttons)b.setAttribute("aria-pressed",String(id==="outside"));
  return {attach,enter,refresh,showPhoto,get active(){return active}};
}
