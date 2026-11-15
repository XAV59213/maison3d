/**
 * Maison 3D — aménagement intérieur de la grange / salle de jeux, d'après la
 * photo réelle (images/grange-interieur.webp) et la description de Xavier.
 * Repères : pièce ≈ 3 × plus profonde que large, plafond ≈ 2,5 m.
 * Coordonnées locales : x = largeur (gauche < 0 vu depuis l'entrée), z = profondeur
 * (entrée en +z, fond en −z), y = hauteur. Dimensions des meubles : estimées.
 */
export const BARN_ROOM={width:5,depth:15,height:2.5};
export const BARN_PHOTO="./images/grange-interieur.webp";
// Point de vue de la photo : depuis l'entrée, à hauteur d'yeux, vers le fond.
export const BARN_VIEW={eye:[0.1,1.55,7.3],target:[0.1,0.75,0.3],fov:50};
export function buildBarnInterior(THREE,group){
  const {width:W,depth:D,height:H}=BARN_ROOM;
  const mats=new Map();
  const mat=(color,opts={})=>{
    const key=color+JSON.stringify(opts);
    if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness:.8,...opts}));
    return mats.get(key);
  };
  const C={wall:0xf1eee8,ceiling:0xf6f5f1,floor:0x7d776d,plank:0x6c665d,wood:0xd2a46a,bamboo:0xd8b27a,
    black:0x1c1c1f,leather:0x232325,orange:0xe9852b,red:0xbf1620,white:0xf3f3f1,steel:0x9aa1a8,
    wicker:0xc49a5e,green:0x7fc49a,yellow:0xe5c21b,lime:0xd7e23c,screen:0xf4f4f4,glass:0xbfe2ea};
  const box=(w,h,d,color,x,y,z,opts,parent=group)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof color==="number"?mat(color,opts):color);
    m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;
  };
  const cyl=(rt,rb,h,color,x,y,z,opts,parent=group,seg=16)=>{
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat(color,opts));
    m.position.set(x,y,z);parent.add(m);return m;
  };
  const sphere=(r,color,x,y,z,opts,parent=group)=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),mat(color,opts));m.position.set(x,y,z);parent.add(m);return m;
  };
  const sub=(x,z,rotDeg=0,y=0)=>{const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=THREE.MathUtils.degToRad(rotDeg);group.add(g);return g};
  const L=-W/2,R=W/2,F=D/2,B=-D/2;

  // ---- Pièce : sol façon parquet gris, murs blancs, plafond blanc à spots.
  box(W,.06,D,C.floor,0,.03,0);
  for(let x=L+.25;x<R;x+=.25)box(.012,.004,D,C.plank,x,.062,0);
  for(let z=F-1.1;z>B;z-=1.2)box(W,.004,.012,C.plank,0,.062,z);
  box(W,.06,D,C.ceiling,0,H+.03,0,{emissive:0xf6f5f1,emissiveIntensity:.55});
  box(W,H,.12,C.wall,0,H/2,B-.06);
  box(W,H,.12,C.wall,0,H/2,F+.06);
  box(.12,H,D,C.wall,L-.06,H/2,0);
  box(.12,H,D,C.wall,R+.06,H/2,0);
  // Spots encastrés (3 × 6) + quelques vraies lumières.
  for(const x of [-1.5,0,1.5])for(let i=0;i<6;i++){
    cyl(.07,.07,.02,0xfff6dc,x,H-.005,F-1.2-i*2.5,{emissive:0xfff1c8,emissiveIntensity:1.4});
  }
  // Éclairage d'ambiance propre à la pièce (plafond blanc + spots).
  const ambient=new THREE.HemisphereLight(0xfffdf6,0x8c867c,1.5);ambient.position.set(0,H,0);group.add(ambient);
  for(const z of [4.5,0,-4.5]){
    const lamp=new THREE.PointLight(0xfff0d6,7,9,1.6);lamp.position.set(0,H-.2,z);group.add(lamp);
  }

  // ---- 1er tiers, à gauche : rack serveur, paravent en osier, bureau.
  const rack=sub(L+.36,F-2.3);
  box(.62,2.05,.8,C.black,0,1.025,0,{},rack);
  box(.56,1.9,.02,C.glass,0,1.03,.41,{transparent:true,opacity:.35,roughness:.1},rack);
  for(let i=0;i<9;i++){
    box(.5,.08,.02,i%3===1?0x9a1d22:0x6f747a,0,.35+i*.18,.39,{},rack);
    box(.03,.02,.01,i%2?0x3cff7a:0xffb347,-.2,.35+i*.18,.405,{emissive:i%2?0x3cff7a:0xffb347,emissiveIntensity:2},rack);
  }
  const screenWicker=sub(L+.45,F-3.3,90);
  for(const dx of [-.5,0,.5])box(.48,1.8,.04,C.wicker,dx,.92,0,{},screenWicker);
  for(const [dx,y] of [[-.3,1.6],[.1,1.25],[.4,1.5],[-.2,.95],[.3,.6],[-.4,.45]])sphere(.075,C.green,dx,y,.12,{},screenWicker);
  // Étagère en fer forgé noir (montants fins + volutes).
  for(const dz of [-.18,.18])box(.025,1.95,.025,C.black,L+.95,.975,F-3.95+dz);
  for(const y of [.5,1.1,1.7])box(.3,.02,.38,C.black,L+.95,y,F-3.95);
  for(const y of [1.95,1.75]){const t=new THREE.Mesh(new THREE.TorusGeometry(.09,.012,6,14),mat(C.black));t.position.set(L+.95,y,F-3.95+(y>1.8?-.08:.08));t.rotation.y=Math.PI/2;group.add(t)}
  // Bureau en bois clair perpendiculaire au mur, écrans tournés vers l'entrée.
  const desk=sub(L+1.65,F-5.0);
  box(1.75,.04,.75,C.wood,0,.75,0,{},desk);
  for(const dx of [-.84,.84])box(.04,.73,.7,C.wood,dx,.375,0,{},desk);
  box(1.2,.04,.3,C.wood,-.1,.95,-.25,{},desk);
  for(const dx of [-.5,.15]){
    box(.56,.34,.03,C.black,dx,1.2,-.3,{},desk);
    box(.52,.3,.005,0x2e3d52,dx,1.2,-.284,{emissive:0x1d2a3d,emissiveIntensity:.6},desk);
    box(.05,.12,.05,C.black,dx,1.02,-.3,{},desk);
  }
  box(.45,.02,.15,C.black,-.15,.78,.15,{},desk);
  box(.2,.45,.42,C.black,-.7,.23,.05,{},desk);
  // Fauteuil de bureau noir, côté entrée.
  const chair=sub(L+1.75,F-4.2,180);
  cyl(.28,.28,.03,C.black,0,.08,0,{},chair,5);
  cyl(.03,.03,.38,C.black,0,.28,0,{},chair);
  box(.5,.07,.5,C.black,0,.5,0,{},chair);
  box(.48,.62,.06,C.black,0,.88,-.24,{},chair);

  // ---- Mur gauche, 2e tiers : fenêtre à volets blancs, clim, panneau jaune, porte vitrée.
  box(.04,1.05,.95,C.white,L+.02,1.55,F-5.6);
  for(let i=0;i<8;i++)box(.05,.02,.9,0xd9d9d6,L+.04,1.1+i*.12,F-5.6);
  box(.22,.28,.85,C.white,L+.11,2.22,F-5.6);
  const sign=box(.02,.4,.4,C.yellow,L+.02,1.65,F-6.7);sign.rotation.x=Math.PI/4;
  box(.02,.45,.32,0x6b4c3a,L+.02,1.6,F-7.4);
  box(.03,1.95,.85,0xfff0b0,L+.02,.98,F-8.2,{emissive:0xffe9a0,emissiveIntensity:.5});
  for(const [z,y] of [[-8.9,1.9],[-9.2,1.75],[-9.5,1.95],[-9.8,1.8]])sphere(.09,0xd9b23a,L+.08,y,F+z,{metalness:.7,roughness:.25});

  // ---- 2e tiers, au centre : grande table en bois clair et chaises orange.
  const table=sub(-.45,-.1);
  box(.9,.05,3.8,C.wood,0,.75,0,{},table);
  for(const [dx,dz] of [[-.38,-1.8],[.38,-1.8],[-.38,1.8],[.38,1.8]])box(.05,.73,.05,C.wood,dx,.365,dz,{},table);
  cyl(.18,.14,.12,0xc9963f,0,.84,1.0,{},table);
  cyl(.07,.07,.25,C.white,0,.9,1.45,{},table);
  const chairAt=(x,z,rot)=>{
    const g=sub(x,z,rot);
    box(.42,.04,.42,C.orange,0,.46,0,{},g);
    box(.42,.42,.04,C.orange,0,.7,-.2,{},g);
    for(const [dx,dz] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]])box(.02,.46,.02,C.steel,dx,.23,dz,{},g);
  };
  for(const z of [1.3,.4,-.5,-1.4])chairAt(.25,z-.1,-90);
  for(const z of [.9,-.1,-1.1])chairAt(-1.15,z-.1,90);

  // ---- Fond : canapé d'angle en cuir noir, écran de projection, enceintes.
  box(2.8,.42,.9,C.leather,L+1.6,.21,B+.55);
  box(2.8,.45,.2,C.leather,L+1.6,.62,B+.12);
  box(.9,.42,1.6,C.leather,L+.55,.21,B+1.8);
  box(.2,.45,1.6,C.leather,L+.12,.62,B+1.8);
  for(const dx of [.4,1.2,2.0])box(.5,.32,.12,0x4a4a4c,L+dx,.6,B+.3);
  box(1.9,1.15,.02,C.screen,-.15,1.62,B+.02,{emissive:0xffffff,emissiveIntensity:.15});
  box(1.95,.06,.06,C.black,-.15,2.23,B+.05);
  for(const dx of [-1.45,1.15]){box(.18,.26,.18,C.black,dx,2.15,B+.15);box(.04,.04,.25,C.black,dx,2.3,B+.08)}
  // Silhouette rouge et trépied à droite de l'écran.
  cyl(.13,.16,1.2,0xd8242b,.75,.6,B+.55);sphere(.12,0xd8242b,.75,1.33,B+.55);
  for(const a of [0,2.1,4.2]){const leg=cyl(.012,.012,1.5,C.black,1.2+Math.cos(a)*.15,.72,B+.8+Math.sin(a)*.15);leg.rotation.z=Math.cos(a)*.12;leg.rotation.x=Math.sin(a)*.12}
  box(.25,.15,.12,C.black,1.2,1.5,B+.8);
  // Boule à facettes.
  cyl(.004,.004,.3,C.steel,.55,H-.15,-3.3);
  sphere(.15,0xd7dde3,.55,H-.42,-3.3,{metalness:.9,roughness:.15});

  // ---- Fond à droite : bar arrondi façon bambou, tabourets hauts, étagères, frigo.
  const bar=sub(1.35,-4.4);
  box(.6,1.05,2.4,C.bamboo,0,.525,-.2,{},bar);
  cyl(.3,.3,1.05,C.bamboo,0,.525,1.0,{},bar,24);
  box(.75,.05,2.5,C.wood,0,1.08,-.2,{},bar);
  cyl(.37,.37,.05,C.wood,0,1.08,1.0,{},bar,24);
  cyl(.13,.13,.25,0x9a6a3a,.1,1.23,.2,{},bar);
  for(const z of [-3.0,-3.55,-4.1,-4.65]){
    const s=sub(.62,z);
    cyl(.17,.17,.06,C.black,0,.78,0,{},s);
    cyl(.025,.025,.75,C.steel,0,.4,0,{},s);
    cyl(.2,.2,.02,C.steel,0,.02,0,{},s);
  }
  for(const y of [1.25,1.6,1.95])box(.35,.02,1.4,C.glass,R-.18,y,B+2.3,{transparent:true,opacity:.5,roughness:.1});
  for(let i=0;i<14;i++)cyl(.03,.035,.24,[0x3d6b2e,0x8a3b1d,0xc9a227,0x2b4a7a][i%4],R-.18,1.38+Math.floor(i/5)*.35,B+1.7+(i%5)*.28);
  box(.6,1.6,.6,0xd4d7da,R-.32,.8,B+.35,{metalness:.4,roughness:.35});

  // ---- Mur de droite derrière la moto : borne d'arcade et armoires blanches.
  const arcade=sub(R-.42,-2.35,-90);
  box(.7,1.7,.75,0x5a5f66,0,.85,0,{},arcade);
  box(.6,.45,.05,0x18202b,0,1.35,.36,{emissive:0x2d5d8a,emissiveIntensity:.5},arcade);
  box(.68,.12,.3,0x3a3e44,0,1.0,.45,{},arcade);
  box(.03,.5,.5,0xb8862b,R-.02,1.75,-3.25);
  cyl(.18,.18,.03,0x1d6b3a,R-.03,1.6,-2.95).rotation.z=Math.PI/2;
  for(const z of [-1.55,-.95,-.35,.25])box(.6,2.05,.58,C.white,R-.31,1.025,z);
  for(const z of [-1.55,-.95,-.35,.25])box(.012,1.9,.005,0xc9c9c6,R-.6,1.03,z+.29);
  for(const [z,w,h,c] of [[-1.5,.45,.3,0xb98f5a],[-.9,.4,.25,0x2b4a8a],[-.3,.5,.32,0xb98f5a],[.3,.45,.28,0x3a3a3a]])box(.5,h,w,c,R-.31,2.05+h/2,z);

  // ---- 2e tiers à droite : moto rouge de tourisme, de trois quarts.
  const moto=sub(1.55,1.5,-35);moto.scale.setScalar(1.2);
  const wheel=(z)=>{const w=new THREE.Mesh(new THREE.TorusGeometry(.27,.08,10,20),mat(C.black));w.rotation.y=Math.PI/2;w.position.set(0,.35,z);moto.add(w);
    cyl(.12,.12,.06,C.steel,0,.35,z,{metalness:.7,roughness:.3},moto).rotation.z=Math.PI/2};
  wheel(.85);wheel(-.75);
  box(.42,.4,1.2,C.red,0,.7,.05,{metalness:.35,roughness:.35},moto);
  box(.5,.28,.55,C.red,0,.92,.55,{metalness:.35,roughness:.35},moto);
  box(.38,.12,.7,C.black,0,1.0,-.15,{},moto);
  box(.6,.3,.5,C.red,0,.65,-.55,{metalness:.35,roughness:.35},moto);
  box(.45,.35,.45,C.red,0,1.2,-.62,{metalness:.35,roughness:.35},moto);
  box(.5,.3,.03,C.glass,0,1.25,.85,{transparent:true,opacity:.5,roughness:.1},moto).rotation.x=-.35;
  box(.75,.04,.04,C.steel,0,1.05,.78,{},moto);
  box(.22,.1,.02,C.white,0,.62,-.82,{},moto);

  // ---- Premier plan à droite : volière blanche sur roulettes, toit vert-jaune.
  const aviary=sub(R-.58,F-2.3);
  box(1.0,.06,.85,C.white,0,.18,0,{},aviary);
  for(const [dx,dz] of [[-.47,-.4],[.47,-.4],[-.47,.4],[.47,.4]]){
    box(.03,1.75,.03,C.white,dx,1.05,dz,{},aviary);
    cyl(.045,.045,.05,C.black,dx,.05,dz,{},aviary).rotation.z=Math.PI/2;
  }
  for(let i=0;i<=12;i++){
    box(.008,1.7,.008,0xdedede,-.47+i*.94/12,1.05,.42,{},aviary);
    box(.008,1.7,.008,0xdedede,.48,1.05,-.4+i*.8/12,{},aviary);
    box(.008,1.7,.008,0xdedede,-.48,1.05,-.4+i*.8/12,{},aviary);
  }
  const roof=box(1.15,.05,1.0,C.lime,0,2.0,0,{},aviary);roof.rotation.x=-.12;
  box(1.15,.12,1.0,C.lime,0,1.94,0,{},aviary);
  box(.9,.03,.75,0xc8a978,0,.25,0,{},aviary);
  return {width:W,depth:D,height:H};
}
