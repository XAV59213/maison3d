/** Cinematic presets for the editable 3D property, not a replacement image. */
export function createPresentation({THREE,camera,controls}) {
  const presets={
    reference:{position:[-12,23,56],target:[0,1,1],fov:45,label:"Façade"},
    elevated:{position:[31,29,43],target:[1,1,-2],fov:49,label:"Aérienne"},
    garden:{position:[-26,14,-27],target:[1,2,3],fov:52,label:"Jardin"},
    garage:{position:[39,16,39],target:[18,1,5],fov:48,label:"Garage"}
  };
  let destination=null;
  let selected="reference";
  const root=document.createElement("nav");
  root.id="maison3d-presentation";
  root.setAttribute("aria-label","Vues 3D Maison 3D");
  const style=document.createElement("style");
  style.textContent=[
    "#maison3d-presentation{position:fixed;right:12px;top:10px;z-index:6;display:flex;",
    "gap:5px;padding:6px;flex-wrap:wrap;max-width:calc(100vw - 24px);",
    "background:#101923ea;border:1px solid #ffffff25;border-radius:12px;box-shadow:0 8px 25px #0006}",
    "#maison3d-presentation button{color:white;border:1px solid #ffffff23;cursor:pointer;",
    "border-radius:8px;background:#314158;padding:8px 10px;font:12px system-ui,sans-serif}",
    "#maison3d-presentation button[aria-pressed=true]{background:#1270e9}",
    "#maison3d-presentation button:focus-visible{outline:2px solid white}",
    "html.presentation-mode:not(.card-mode) .toolbar,html.presentation-mode:not(.card-mode) .side,",
    "html.presentation-mode:not(.card-mode) .bottom,html.presentation-mode:not(.card-mode) .editor,",
    "html.presentation-mode:not(.card-mode) .brand,html.presentation-mode:not(.card-mode) #hint{display:none!important}",
    "html.card-mode #maison3d-presentation{top:auto;bottom:8px;right:8px;justify-content:center}",
    "html.card-mode #maison3d-presentation button{padding:6px;font-size:11px}",
    "html.card-mode #maison3d-weather-status{top:8px!important;right:8px!important}",
    "#maison3d-weather-status{top:74px!important;right:12px!important}",
    "@media(max-width:710px){#maison3d-presentation{top:auto;bottom:8px;right:8px}}"
  ].join("");
  document.head.appendChild(style);
  const buttons=new Map();
  function button(label,fn){
    const b=document.createElement("button");
    b.type="button";b.textContent=label;b.setAttribute("aria-pressed","false");
    b.addEventListener("click",fn);root.appendChild(b);return b;
  }
  function showSelected(){
    for(const [key,b] of buttons)b.setAttribute("aria-pressed",String(key===selected));
  }
  function changeView(name,immediate=false){
    const preset=presets[name];if(!preset)return;
    selected=name;showSelected();
    destination={
      position:new THREE.Vector3(...preset.position),
      target:new THREE.Vector3(...preset.target),
      fov:preset.fov
    };
    if(immediate){
      camera.position.copy(destination.position);
      controls.target.copy(destination.target);
      camera.fov=destination.fov;camera.updateProjectionMatrix();
      controls.update();destination=null;
    }
    try{localStorage.setItem("maison3d:view:v1",name)}catch{}
  }
  for(const [key,preset] of Object.entries(presets)){
    buttons.set(key,button(preset.label,()=>changeView(key)));
  }
  let presentation=true;
  try{presentation=localStorage.getItem("maison3d:presentation")!=="false"}catch{}
  const mode=button("✎ Édition",()=>{
    presentation=!presentation;
    document.documentElement.classList.toggle("presentation-mode",presentation);
    mode.textContent=presentation?"✎ Édition":"▣ Présentation";
    try{localStorage.setItem("maison3d:presentation",String(presentation))}catch{}
  });
  document.body.appendChild(root);
  document.documentElement.classList.toggle("presentation-mode",presentation);
  mode.textContent=presentation?"✎ Édition":"▣ Présentation";
  if(document.documentElement.classList.contains("card-mode"))mode.hidden=true;
  const stored=(()=>{try{return localStorage.getItem("maison3d:view:v1")}catch{return null}})();
  changeView(Object.prototype.hasOwnProperty.call(presets,stored)?stored:"reference",true);
  controls.addEventListener("start",()=>{destination=null});
  function frame(){
    if(!destination)return;
    camera.position.lerp(destination.position,.09);
    controls.target.lerp(destination.target,.09);
    camera.fov+=(destination.fov-camera.fov)*.09;
    camera.updateProjectionMatrix();
    if(camera.position.distanceTo(destination.position)<.03 &&
       controls.target.distanceTo(destination.target)<.03)destination=null;
  }
  // Stop any camera glide so a toolbar view (top, 3D) is not overridden.
  function cancel(){destination=null}
  return {frame,changeView,presets,cancel};
}
