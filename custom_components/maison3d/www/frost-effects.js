/**
 * Frost ("gel") overlay for the photo view: rime creeping from the edges and a
 * few sparkling ice crystals. Fully procedural (no image asset). The frost
 * texture is drawn once per size/level change; each frame only blits it and
 * draws a handful of sparkles, so the cost stays tiny.
 */
export const FROST_FULL_AT=-5;

/** Convert a reading to °C (accepts °F when the unit says so). */
export function toCelsius(value,unit=""){
  if(!Number.isFinite(value))return null;
  return /f/i.test(String(unit))?(value-32)*5/9:value;
}

/** 0 above 0 °C, 0.35 at 0 °C, growing linearly to 1 at -5 °C and below. */
export function frostLevel(celsius){
  if(!Number.isFinite(celsius)||celsius>0)return 0;
  return Math.min(1,.35+.65*(-celsius)/(-FROST_FULL_AT));
}

export function createFrostEffects(canvas){
  const ctx=canvas.getContext("2d",{alpha:true});
  const motion=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reduced=!!motion?.matches;
  motion?.addEventListener?.("change",e=>{reduced=e.matches});
  let width=1,height=1,dpr=1,texture=null,layer=null,layerLevel=-1,current=0,cleared=true;
  let sparkles=[];
  function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
  function resize(){
    const box=canvas.getBoundingClientRect();
    width=Math.max(1,box.width);height=Math.max(1,box.height);
    dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    texture=null;layerLevel=-1;
  }
  // Ice crystal branches growing inward from the four edges.
  function buildTexture(){
    const t=document.createElement("canvas");
    t.width=Math.round(width);t.height=Math.round(height);
    const g=t.getContext("2d");
    const random=seeded(9173);
    const edge=Math.min(width,height);
    g.lineCap="round";
    const branch=(x,y,angle,length,depth)=>{
      const x2=x+Math.cos(angle)*length,y2=y+Math.sin(angle)*length;
      g.strokeStyle="rgba(240,249,255,"+(.26+.14*depth)+")";
      g.lineWidth=.45+depth*.4;
      g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();
      if(depth<=0)return;
      for(let k=1;k<=3;k++){
        const px=x+(x2-x)*k/4,py=y+(y2-y)*k/4;
        branch(px,py,angle+(random()<.5?-1:1)*(.7+random()*.4),length*.42,depth-1);
      }
      branch(x2,y2,angle+(random()-.5)*.6,length*.62,depth-1);
    };
    const count=Math.round((width+height)/7);
    for(let i=0;i<count;i++){
      const side=i%4,u=random();
      const [x,y,a]=side===0?[u*width,0,Math.PI/2]:side===1?[u*width,height,-Math.PI/2]:
        side===2?[0,u*height,0]:[width,u*height,Math.PI];
      branch(x,y,a+(random()-.5)*1.4,edge*(.04+random()*.1),3);
    }
    // Frosted haze, densest at the very edges.
    for(let i=0;i<5000;i++){
      const side=i%4,u=random(),d=Math.pow(random(),2)*edge*.26;
      const x=side===2?d:side===3?width-d:u*width;
      const y=side===0?d:side===1?height-d:u*height;
      g.fillStyle="rgba(240,248,255,"+(.08+random()*.2)+")";
      g.beginPath();g.arc(x,y,.4+random()*1.8,0,Math.PI*2);g.fill();
    }
    texture=t;
    sparkles=Array.from({length:46},()=>{
      const side=Math.floor(random()*4),u=random(),d=random()*edge*.2;
      return {x:side===2?d:side===3?width-d:u*width,y:side===0?d:side===1?height-d:u*height,
        r:.8+random()*1.8,phase:random()*6.283,speed:.6+random()*1.4};
    });
  }
  // Mask the texture with a vignette whose clear centre shrinks as it gets colder.
  function buildLayer(level){
    if(!texture)buildTexture();
    if(!layer)layer=document.createElement("canvas");
    layer.width=texture.width;layer.height=texture.height;
    const l=layer.getContext("2d");
    l.clearRect(0,0,layer.width,layer.height);
    const cx=layer.width/2,cy=layer.height/2,outer=Math.hypot(cx,cy);
    const haze=l.createRadialGradient(cx,cy,outer*(.62-.3*level),cx,cy,outer);
    haze.addColorStop(0,"rgba(225,240,255,0)");
    haze.addColorStop(.5,"rgba(225,240,255,"+(.1+.22*level)+")");
    haze.addColorStop(1,"rgba(236,246,255,"+(.55+.35*level)+")");
    l.fillStyle=haze;l.fillRect(0,0,layer.width,layer.height);
    l.drawImage(texture,0,0);
    l.globalCompositeOperation="destination-in";
    const mask=l.createRadialGradient(cx,cy,outer*(.66-.3*level),cx,cy,outer*.95);
    mask.addColorStop(0,"rgba(0,0,0,0)");
    mask.addColorStop(1,"rgba(0,0,0,1)");
    l.fillStyle=mask;l.fillRect(0,0,layer.width,layer.height);
    l.globalCompositeOperation="source-over";
    layerLevel=level;
  }
  function clear(){if(!cleared){ctx.clearRect(0,0,width,height);cleared=true}}
  /** target: 0..1 frost strength (0 = none). */
  function frame(time,target){
    const box=canvas.getBoundingClientRect();
    if(Math.abs(box.width-width)>2||Math.abs(box.height-height)>2||!texture&&target>0)resize();
    // Creep in/out smoothly instead of popping (instant with reduced motion).
    current=reduced?target:current+(target-current)*(target<current?.12:.04);
    if(Math.abs(target-current)<.004)current=target;
    if(current<=.005){current=0;clear();return}
    const level=Math.round(current*50)/50;
    if(level!==layerLevel)buildLayer(level);
    ctx.clearRect(0,0,width,height);cleared=false;
    ctx.drawImage(layer,0,0,width,height);
    for(const s of sparkles){
      const twinkle=reduced?.55:Math.max(0,Math.sin(time*.002*s.speed+s.phase));
      const alpha=twinkle*twinkle*current;
      if(alpha<.05)continue;
      ctx.fillStyle="rgba(255,255,255,"+alpha.toFixed(2)+")";
      const r=s.r*(.6+twinkle*.6);
      ctx.fillRect(s.x-r*2.2,s.y-.4,r*4.4,.8);
      ctx.fillRect(s.x-.4,s.y-r*2.2,.8,r*4.4);
    }
  }
  return {frame,resize};
}
