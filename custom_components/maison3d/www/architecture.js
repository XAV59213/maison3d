/**
 * Geometric architectural details for the editable Maison 3D scene.
 * Every part is genuine WebGL geometry parented to its editable object.
 * No external textures or assets: procedural stone and roof details.
 */
export function createArchitectureKit(THREE) {
  function material(color, metalness=0, roughness=.85) {
    return new THREE.MeshStandardMaterial({color,metalness,roughness});
  }
  function masonryTexture() {
    const canvas=document.createElement("canvas");
    canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#b5a590";ctx.fillRect(0,0,256,256);
    let seed=251;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    for(let row=0;row<12;row++){
      const y=row*22,shift=(row%2)*23;
      for(let x=-47+shift;x<300;x+=47){
        const light=155+Math.floor(random()*47);
        ctx.fillStyle="rgb("+light+","+(light-15)+","+(light-31)+")";
        ctx.fillRect(x+2,y+2,43,18);
        ctx.fillStyle="#6f6a5e66";
        ctx.fillRect(x+2,y+19,43,2);
        for(let n=0;n<7;n++){
          ctx.fillStyle=random()>.45?"#ffffff25":"#393b3620";
          ctx.fillRect(x+3+random()*38,y+3+random()*15,1+random()*5,1+random()*3);
        }
      }
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(2,1.5);
    texture.anisotropy=4;
    return texture;
  }
  const stone=new THREE.MeshStandardMaterial({map:masonryTexture(),roughness:.94});
  const limestone=material(0xd8c8aa);
  const roof=material(0x404349,.06,.78);
  const roofEdge=material(0x252d32,.36,.5);
  const glass=material(0x78b7be,.26,.19);
  const glassDark=material(0x304e60,.36,.16);
  const door=material(0x4f4237,.15,.75);
  const metal=material(0x89959c,.65,.43);
  const concrete=material(0xb3ae9f);
  const wood=material(0x947459);
  const tile=material(0xd1c6b5);
  const black=material(0x2c3136,.4,.5);
  const trim=material(0xe3d5b9);
  const plants=material(0x3d6637);
  const lamp=material(0xffe7a1,0,.2);
  const gravel=material(0x817e71);
  const slopeAngle=Math.PI/7;

  function block(parent,w,h,d,mat,x=0,y=0,z=0) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  }
  function post(parent,r,h,mat,x,y,z) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  }
  function window(parent,x,y,z,w=1.25,h=1.45) {
    block(parent,w+.19,h+.18,.13,trim,x,y,z);
    block(parent,w,h,.16,glass,x,y,z+.08);
    block(parent,.055,h,.2,black,x,y,z+.18);
    block(parent,w,.05,.2,black,x,y,z+.18);
    block(parent,w+.33,.11,.25,limestone,x,y-h/2-.07,z+.08);
    block(parent,w+.3,.12,.22,limestone,x,y+h/2+.1,z+.04);
  }
  function lampFixture(parent,x,y,z) {
    block(parent,.25,.35,.2,black,x,y,z);
    block(parent,.19,.2,.23,lamp,x,y,z+.07);
  }
  function gableRoof(parent,w,d,y,overhang=.38) {
    const half=w/2+overhang;
    const rise=half*Math.tan(slopeAngle);
    for(const sign of [-1,1]){
      const sloped=block(parent,Math.hypot(half,rise),.13,d+2*overhang,roof,
        sign*half/2,y+rise/2,0);
      sloped.rotation.z=-sign*slopeAngle;
      block(parent,.11,.16,d+2*overhang,roofEdge,sign*half,y-.04,0);
      for(let i=0;i<8;i++){
        const zz=-d/2+(i+.5)*d/8;
        const t=block(parent,Math.hypot(half,rise)*.95,.012,.018,roofEdge,
          sign*half/2,y+rise/2+.085,zz);
        t.rotation.z=-sign*slopeAngle;
      }
    }
    block(parent,.13,.15,d+2*overhang,roofEdge,0,y+rise+.01,0);
    return rise;
  }
  function house(group,o,isGarage=false) {
    const {w,d,h}=o;
    const wallHeight=h*.78;
    const raised=o.id==="maison"?.48:0;
    if(raised)block(group,w+1.4,raised,d+1.1,concrete,0,raised/2,0);
    block(group,w,wallHeight,d,stone,0,raised+wallHeight/2,0);
    block(group,w+.13,.19,d+.12,limestone,0,raised+.12,0);
    block(group,w+.19,.16,d+.16,trim,0,raised+wallHeight-.13,0);
    const roofBase=raised+wallHeight;
    gableRoof(group,w,d,roofBase);
    const facade=d/2+.08;
    if(isGarage){
      const doorW=Math.min(w*.72,4.8),doorH=Math.min(wallHeight*.72,2.6);
      block(group,doorW+.18,doorH+.19,.23,limestone,0,raised+doorH/2+.11,facade);
      block(group,doorW,doorH,.25,metal,0,raised+doorH/2+.1,facade+.08);
      for(let j=1;j<7;j++)block(group,doorW-.04,.028,.26,roofEdge,0,raised+j*doorH/7+.1,facade+.23);
      lampFixture(group,-w*.42,raised+wallHeight*.7,facade+.16);
      lampFixture(group,w*.42,raised+wallHeight*.7,facade+.16);
    } else {
      const doorway=w*.05;
      block(group,Math.max(1.2,w*.15),wallHeight*.66,.18,door,doorway,raised+wallHeight*.33,facade+.12);
      block(group,.09,wallHeight*.66,.19,black,doorway+Math.max(1.2,w*.15)/2,raised+wallHeight*.33,facade+.2);
      for(const x of [-w*.32,w*.32]){
        window(group,x,raised+wallHeight*.48,facade,Math.min(w*.19,1.65),Math.min(wallHeight*.53,1.6));
        window(group,x,raised+wallHeight*.48,-facade,Math.min(w*.19,1.65),Math.min(wallHeight*.53,1.6));
      }
      if(h>4) {
        // Upper attic windows add depth without needing imported models.
        for(const x of [-w*.23,w*.23]){
          window(group,x,raised+wallHeight*.87,facade,.82,.68);
        }
      }
      lampFixture(group,doorway+1.3,raised+wallHeight*.62,facade+.16);
      const chimney=block(group,.6,1.25,.65,stone,-w*.28,roofBase+1.15,-d*.28);
      block(group,.84,.14,.85,roofEdge,chimney.position.x,chimney.position.y+.68,chimney.position.z);
    }
    // Downspouts and gutters
    for(const x of [-w/2-.28,w/2+.28]){
      post(group,.055,wallHeight*.93,metal,x,raised+wallHeight*.47,d/2+.16);
    }
    for(const x of [-w/2-.22,w/2+.22])block(group,.12,.09,d+.6,roofEdge,x,roofBase-.03,0);
  }
  function shed(group,o) {
    const {w,d,h}=o;
    const steel=material(0x879292,.65,.56);
    block(group,w,h*.84,d,steel,0,h*.42,0);
    for(let x=-w*.43;x<w*.48;x+=Math.max(.25,w/12)){
      block(group,.025,h*.79,d+.025,metal,x,h*.42,0);
    }
    const roofPanel=block(group,w+.5,.16,d+.55,roof,0,h*.83,0);
    roofPanel.rotation.z=-.065;
    block(group,w*.6,h*.7,.12,glassDark,0,h*.4,d/2+.1);
    for(let x of [-w*.3,w*.3])block(group,.07,h*.72,.18,black,x,h*.4,d/2+.18);
    block(group,w+.5,.12,.18,roofEdge,0,h*.8,d/2+.29);
  }
  function terrace(group,o) {
    const {w,d,h}=o;
    block(group,w,h,d,stone,0,h/2,0);
    block(group,w+.14,.14,d+.14,tile,0,h+.08,0);
    for(let i=0;i<Math.max(3,Math.floor(w));i++){
      block(group,.02,.015,d-.2,limestone,-w/2+.4+i*(w-.8)/Math.max(2,Math.floor(w)-1),h+.16,0);
    }
    const railingHeight=.87;
    for(let x=-w/2+.18;x<=w/2-.12;x+=1.15){
      post(group,.045,railingHeight,metal,x,h+railingHeight/2,d/2-.12);
    }
    block(group,w-.28,.07,.07,metal,0,h+railingHeight,d/2-.12);
    for(let z=-d/2+.12;z<d/2-.1;z+=1.15){
      post(group,.045,railingHeight,metal,w/2-.12,h+railingHeight/2,z);
    }
  }
  function wall(group,o) {
    const {w,d,h}=o;
    block(group,w,h,d,stone,0,h/2,0);
    block(group,w+.18,.12,d+.23,trim,0,h+.06,0);
    for(let x=-w/2+1;x<w/2;x+=3){
      block(group,.18,h+.05,d+.09,limestone,x,h/2,0);
    }
    for(let x=-w/2+2;x<w/2;x+=5)lampFixture(group,x,h*.68,d/2+.15);
  }
  function ramp(group,o) {
    const {w,d,h}=o;
    const angle=Math.atan2(h,d);
    const length=Math.hypot(d,h);
    const surface=block(group,w,.24,length,concrete,0,h/2,0);
    surface.rotation.x=-angle;
    for(let sign of [-1,1]){
      const edge=block(group,.2,.35,length+.15,stone,sign*(w/2-.08),h/2+.06,0);
      edge.rotation.x=-angle;
      const guard=block(group,.045,.06,length,metal,sign*(w/2-.1),h/2+.35,0);
      guard.rotation.x=-angle;
    }
    for(let z=-d/2+1;z<d/2;z+=1.8){
      // Sloped paving joints positioned on the inclined deck.
      const joint=block(group,w-.38,.012,.025,gravel,0,h/2+z*Math.sin(angle)+.13,z*Math.cos(angle));
      joint.rotation.x=-angle;
    }
  }
  function tree(group,o) {
    const {w,h}=o;
    post(group,w*.1,h*.55,wood,0,h*.275,0);
    for(const [dx,dy,dz,r] of [[0,.74,0,.48],[-.25,.62,0,.36],[.22,.67,.19,.38]]){
      const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(w*r,1),plants);
      canopy.position.set(w*dx,h*dy,w*dz);
      canopy.scale.set(1,.63,1);
      canopy.castShadow=true;group.add(canopy);
    }
  }
  function build(group,o) {
    if(!o||!Number.isFinite(o.w)||!Number.isFinite(o.h)||!Number.isFinite(o.d))return false;
    if(o.type==="building"||o.type==="garage"){house(group,o,o.type==="garage");return true}
    if(o.type==="shed"){shed(group,o);return true}
    if(o.type==="terrace"){terrace(group,o);return true}
    if(o.type==="wall"){wall(group,o);return true}
    if(o.type==="ramp"){ramp(group,o);return true}
    if(o.type==="tree"){tree(group,o);return true}
    return false;
  }
  function landscape(scene) {
    // Recessed gravel walk and paving stones strengthen the stepped topography.
    block(scene,4,.05,22,gravel,-9,-.32,15);
    for(let i=0;i<16;i++){
      const z=-1+i*1.25;
      block(scene,1.1,.025,.7,tile,-9,-.27,z);
    }
    for(const [x,z,w,d] of [[-34,-17,9,2],[19,16,7,2.1],[30,18,4,2.5]]){
      block(scene,w,.07,d,stone,x,-.32,z);
      for(let j=0;j<7;j++){
        const flower=new THREE.Mesh(new THREE.IcosahedronGeometry(.23,0),plants);
        flower.position.set(x-w*.42+j*w/7,-.12,z);
        flower.castShadow=true;scene.add(flower);
      }
    }
  }
  return {build,landscape};
}
