/**
 * Explorateur des intérieurs — volumes 3D schématiques basés sur les
 * dimensions des bâtiments existants. Les cloisons et meubles ne représentent
 * PAS des pièces attestées : un relevé ou des photos restent nécessaires.
 */
export function createInteriorExplorer({THREE,scene,camera,controls,getItems,getMeshes,presentation,photoView}){
  const shell=new THREE.Group();shell.name="maison3d-interior-provisional";
  scene.add(shell);
  const material=(color,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide});
  const paint=material(0xe7e0d4),floor=material(0xbca88c),accent=material(0x918b7d);
  const timber=material(0x997050),stone=material(0xb8b0a0),dark=material(0x46443d),glass=material(0x9acbd4,.28);
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
    b.addEventListener("click",()=>enter(key));
    nav.append(b);buttons.set(key,b);
  }
  add("outside","↩ Extérieur");
  add("maison","🚪 Intérieur maison");
  add("grange","🏚 Intérieur grange");
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
    "html.card-mode #maison3d-interior-navigation{top:8px;left:6px}",
    "html.photo-active #maison3d-interior-navigation{top:60px}",
    "@media(max-width:710px){#maison3d-interior-navigation{top:52px;left:6px;right:6px;max-width:none}",
    "#maison3d-interior-navigation button{padding:6px;font-size:11px}",
    "#maison3d-interior-navigation .interior-disclaimer{font-size:10px}}"
  ].join("");
  document.head.append(style);document.body.append(nav);
  let active="outside";
  const hidden=new Map();
  const cameraBefore={position:new THREE.Vector3(),target:new THREE.Vector3(),fov:46};
  function clear(){
    for(const mesh of [...shell.children]){
      shell.remove(mesh);
      mesh.traverse(obj=>obj.geometry?.dispose());
    }
  }
  function restore(){
    for(const [node,value] of hidden)node.visible=value;
    hidden.clear();clear();
  }
  function drawFloor(o,isBarn){
    const w=Math.max(3,o.w),d=Math.max(3,o.d);
    const h=Math.max(2.3,Math.min(o.h*.82,4.2));
    const group=new THREE.Group();
    group.position.set(o.x,0,o.z);
    group.rotation.y=THREE.MathUtils.degToRad(o.r||0);
    shell.add(group);
    const wall=isBarn?stone:paint,ground=isBarn?stone:floor;
    block(group,w,.14,d,ground,0,.07,0);
    block(group,w,h,.18,wall,0,h/2,-d/2);
    block(group,.18,h,d,wall,-w/2,h/2,0);
    block(group,.18,h,d,wall,w/2,h/2,0);
    // Low front edge intentionally open: the user can actually see inside.
    block(group,w,.38,.16,accent,0,.19,d/2);
    for(const sign of [-1,1]){
      block(group,.15,h,.2,isBarn?timber:accent,sign*(w/2-.10),h/2,-d/2+.08);
    }
    const spots=[[-w*.23,-d*.20],[w*.21,-d*.15]];
    for(const [x,z] of spots){
      const lamp=new THREE.PointLight(0xffe7bc,isBarn?8:6,Math.max(w,d)*1.8,2);
      lamp.position.set(x,h-.38,z);group.add(lamp);
      const shade=new THREE.Mesh(new THREE.CylinderGeometry(.24,.34,.15,12),dark);
      shade.position.copy(lamp.position);shade.position.y+=.15;group.add(shade);
    }
    if(isBarn){
      // Grange: charpente et espace libre ; mobilier volontairement neutre.
      for(const x of [-w*.33,0,w*.33]){
        block(group,.2,.25,d*.92,timber,x,h-.28,0);
      }
      for(const z of [-d*.38,d*.30]){
        block(group,w*.9,.20,.24,timber,0,h-.45,z);
      }
      block(group,w*.25,.78,d*.22,timber,w*.28,.39,-d*.22);
      block(group,w*.3,.75,d*.25,dark,-w*.23,.38,d*.18);
    }else{
      // Maison: simple séjour de démonstration sans inventer de distribution.
      block(group,w*.35,.42,d*.18,accent,0,.21,-d*.17);
      block(group,w*.23,.75,d*.17,timber,-w*.23,.375,d*.18);
      block(group,w*.20,.52,d*.11,dark,w*.23,.26,d*.18);
      block(group,w*.18,1.35,.09,glass,-w*.25,1.38,-d/2+.15);
    }
    return {w,d,h,group};
  }
  function enter(key){
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
      const volume=drawFloor(building,key==="grange");
      active=key;
      presentation.cancel();
      const angle=THREE.MathUtils.degToRad(building.r||0);
      const transform=(x,z)=>({
        x:building.x+x*Math.cos(angle)+z*Math.sin(angle),
        z:building.z-x*Math.sin(angle)+z*Math.cos(angle)
      });
      const viewpoint=transform(0,volume.d*.30);
      const target=transform(0,-volume.d*.15);
      camera.position.set(viewpoint.x,Math.min(volume.h*.56,1.8),viewpoint.z);
      controls.target.set(target.x,Math.min(volume.h*.54,1.7),target.z);
      camera.fov=65;camera.updateProjectionMatrix();controls.update();
    }
    for(const [id,b] of buttons)b.setAttribute("aria-pressed",String(id===active));
    label.hidden=active==="outside";
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
  return {enter,refresh,get active(){return active}};
}
