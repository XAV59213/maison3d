/** Moon drawn on the photo's sky, visible in daytime and nighttime.
 *  The phase follows the configured Home Assistant sensor. Without a phase
 *  sensor the visual is labelled illustrative, never described as actual.
 */
import {moonPhase} from "./sensor-values.js";
export function createMoonOverlay({container}) {
  const canvas=document.createElement("canvas");
  canvas.className="maison3d-sky-moon";
  canvas.setAttribute("aria-hidden","true");
  const style=document.createElement("style");
  style.textContent=[
    "#maison3d-photo-view .maison3d-sky-moon{position:absolute;top:8%;right:14%;",
    "width:clamp(46px,10vw,120px);height:clamp(46px,10vw,120px);",
    "pointer-events:none;z-index:3;filter:drop-shadow(0 0 10px #eff6ff77)}",
    "#maison3d-photo-view.photo-night .maison3d-sky-moon{filter:drop-shadow(0 0 16px #a9c8ffca)}",
    "@media(max-width:600px){#maison3d-photo-view .maison3d-sky-moon{top:12%;right:13%;width:55px;height:55px}}"
  ].join("");
  document.head.append(style);
  container.append(canvas);
  const ctx=canvas.getContext("2d");
  const phases=["new_moon","waxing_crescent","first_quarter","waxing_gibbous",
    "full_moon","waning_gibbous","last_quarter","waning_crescent"];
  let lastSignature="";
  // Shared parser: English/French phase names, accents and case (sensor-values.js).
  const normalize=moonPhase;
  // Render the illuminated lunar disc with a pixel-free mask based on a
  // sphere's orthographic projection; no external images or libraries needed.
  function draw(phase,night=true,visible=true,intensity=1){
    canvas.hidden=!visible;
    if(!visible)return;
    const size=Math.min(256,Math.max(96,Math.round(canvas.getBoundingClientRect().width*2)));
    const sig=[phase,night,visible,size,intensity].join("|");
    if(lastSignature===sig)return;
    lastSignature=sig;
    canvas.width=size;canvas.height=size;
    ctx.clearRect(0,0,size,size);
    const c=size/2,r=size*.34;
    const index=phases.indexOf(phase);
    const age=index<0?4:index;
    const illumination=[0,.15,.50,.85,1,.85,.50,.15][age];
    const waxing=age>0&&age<4;
    const brightness=night?.99:.66;
    const glow=night?.22:.07;
    const halo=ctx.createRadialGradient(c,c,r*.5,c,c,r*1.55);
    halo.addColorStop(0,"rgba(241,247,255,"+(glow*Math.max(.3,intensity))+")");
    halo.addColorStop(1,"rgba(241,247,255,0)");
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(c,c,r*1.55,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(c,c,r,0,2*Math.PI);ctx.clip();
    ctx.fillStyle=night?"#26354c":"#526a80";
    ctx.fillRect(c-r,c-r,r*2,r*2);
    const bright=night?"#f0f2e5":"#f5f9f4";
    const shade=night?"#9baab9":"#c4cdd3";
    const light=ctx.createLinearGradient(c-r,c-r,c+r,c+r);
    light.addColorStop(0,bright);
    light.addColorStop(1,shade);
    ctx.fillStyle=light;
    const phaseFraction=illumination;
    const waning=age>=5;
    for(let iy=-r;iy<=r;iy+=.75){
      const half=Math.sqrt(Math.max(0,r*r-iy*iy));
      const terminator=half*(1-2*phaseFraction);
      let left,right;
      if(age===4){left=-half;right=half}
      else if(age===0){continue}
      else if(waning){
        left=-half;right=phaseFraction<=.5?-terminator:half;
        if(phaseFraction>.5)left=-half;
      }else{
        left=phaseFraction<=.5?terminator:-half;right=half;
      }
      // Thin crescents and gibbous phases should be visibly distinguishable.
      if(phaseFraction>.5&&phaseFraction<1){
        const darkWidth=(1-phaseFraction)*2*half;
        if(waning){left=-half;right=half-darkWidth}
        else{left=-half+darkWidth;right=half}
      }
      if(phaseFraction<=.5&&phaseFraction>0){
        const litWidth=phaseFraction*2*half;
        if(waning){left=-half;right=-half+litWidth}
        else{left=half-litWidth;right=half}
      }
      ctx.fillRect(c+left,c+iy,Math.max(0,right-left),1.3);
    }
    // Gentle crater textures clipped to moon face.
    ctx.globalAlpha=night?.13:.09;
    ctx.fillStyle="#70808c";
    for(const [dx,dy,rr] of [[-.15,-.2,.09],[.22,.16,.11],[.05,.33,.07],[-.34,.18,.06]]){
      ctx.beginPath();ctx.arc(c+dx*r,c+dy*r,rr*r,0,2*Math.PI);ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha=brightness;
  }
  return {canvas,draw,normalize};
}
