/**
 * Animated atmospheric layers above the approved house photo.
 * Canvas overlays are screen-space visual effects, not a physical 3D model.
 */
export function createPhotoCinematics(canvas) {
  const ctx=canvas.getContext("2d",{alpha:true});
  let width=1,height=1,dpr=1;
  let reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onMotion=(e)=>{reduced=e.matches};
  const media=matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener?.("change",onMotion);
  function resize() {
    const rect=canvas.getBoundingClientRect();
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    dpr=Math.min(window.devicePixelRatio||1,2);
    const cw=Math.round(width*dpr),ch=Math.round(height*dpr);
    if(canvas.width!==cw||canvas.height!==ch){
      canvas.width=cw;canvas.height=ch;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  const safe=(n,alt)=>Number.isFinite(n)?n:alt;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function cloud(x,y,r,alpha) {
    const gradient=ctx.createRadialGradient(x,y,r*.02,x,y,r);
    gradient.addColorStop(0,"rgba(191,203,219,"+(alpha*.8)+")");
    gradient.addColorStop(.5,"rgba(165,178,201,"+(alpha*.38)+")");
    gradient.addColorStop(1,"rgba(174,184,198,0)");
    ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(x,y,r,r*.32,0,0,Math.PI*2);ctx.fill();
  }
  function clouds(time,opacity,wind) {
    ctx.save();ctx.globalCompositeOperation="source-over";
    const t=time*.000006*(wind>=12?2:1);
    const positions=[[-.22,.12,1.05],[.29,.17,.82],[.73,.11,.88],[1.13,.2,.9]];
    for(let i=0;i<positions.length;i++){
      const [x,y,r]=positions[i];
      const shifted=((x+t*(i%2?1:-.6)+.4)%1.8+1.8)%1.8-.4;
      cloud(shifted*width,y*height,r*width,opacity);
    }
    ctx.restore();
  }
  function sunshine(time,strength) {
    const x=width*.18,y=height*.08;
    const pulse=.92+.08*Math.sin(time*.00045);
    const radial=ctx.createRadialGradient(x,y,0,x,y,width*.7);
    radial.addColorStop(0,"rgba(255,238,165,"+(.24*strength*pulse)+")");
    radial.addColorStop(.3,"rgba(255,223,128,"+(.08*strength)+")");
    radial.addColorStop(1,"rgba(255,212,122,0)");
    ctx.fillStyle=radial;ctx.fillRect(0,0,width,height);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(-.02*Math.sin(time*.0001));
    for(let i=0;i<5;i++){
      ctx.rotate(Math.PI/26);
      const rays=ctx.createLinearGradient(0,0,width*.95,height*.6);
      rays.addColorStop(0,"rgba(255,237,181,"+(.085*strength)+")");
      rays.addColorStop(1,"rgba(255,237,181,0)");
      ctx.fillStyle=rays;
      ctx.beginPath();ctx.moveTo(0,0);
      ctx.lineTo(width*.90,height*.18);
      ctx.lineTo(width*.78,height*.36);
      ctx.fill();
    }
    ctx.restore();
  }
  function drizzleShine(time,strength) {
    // Low-contrast moving sheen; not a claim of physically accurate reflections.
    const g=ctx.createLinearGradient(0,height*.54,0,height);
    g.addColorStop(0,"rgba(98,141,176,0)");
    g.addColorStop(.73,"rgba(100,153,189,"+(.09*strength)+")");
    g.addColorStop(1,"rgba(27,62,96,"+(.19*strength)+")");
    ctx.fillStyle=g;ctx.fillRect(0,height*.5,width,height*.5);
    ctx.save();ctx.strokeStyle="rgba(228,237,245,"+(.11*strength)+")";
    ctx.lineWidth=1.1;
    for(let i=0;i<18;i++){
      const x=(i*130+time*.014)%Math.max(1,width);
      const y=height*(.81+(i%5)*.035);
      ctx.beginPath();ctx.ellipse(x,y,12+(i%4)*4,2.3,0,0,Math.PI);ctx.stroke();
    }
    ctx.restore();
  }
  function snowAccumulation(strength) {
    // Snow dust near the bottom edge; use a dedicated snow JPG for snow on roofs.
    const g=ctx.createLinearGradient(0,height*.73,0,height);
    g.addColorStop(0,"rgba(246,251,255,0)");
    g.addColorStop(1,"rgba(242,249,255,"+(.39*strength)+")");
    ctx.fillStyle=g;ctx.fillRect(0,height*.72,width,height*.28);
  }
  function autumnHaze(time,strength) {
    const gradient=ctx.createLinearGradient(0,0,width,height);
    gradient.addColorStop(0,"rgba(244,173,73,"+(.10*strength)+")");
    gradient.addColorStop(.65,"rgba(212,137,62,0)");
    gradient.addColorStop(1,"rgba(134,69,29,"+(.055*strength)+")");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  }
  function nightHaze(strength) {
    const gradient=ctx.createLinearGradient(0,0,0,height);
    gradient.addColorStop(0,"rgba(11,25,54,"+(.32*strength)+")");
    gradient.addColorStop(.75,"rgba(12,26,57,"+(.10*strength)+")");
    gradient.addColorStop(1,"rgba(6,18,41,"+(.12*strength)+")");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  }
  function fogBanks(time,strength,night) {
    // Slow drifting mist layers, denser near the ground.
    const tone=night?"150,165,190":"222,228,234";
    const veil=ctx.createLinearGradient(0,0,0,height);
    veil.addColorStop(0,"rgba("+tone+","+(.18*strength)+")");
    veil.addColorStop(.55,"rgba("+tone+","+(.34*strength)+")");
    veil.addColorStop(1,"rgba("+tone+","+(.46*strength)+")");
    ctx.fillStyle=veil;ctx.fillRect(0,0,width,height);
    for(let i=0;i<6;i++){
      const y=height*(.38+i*.11);
      const x=((time*.006*(1+i*.25)+i*width*.37)%(width*1.6))-width*.3;
      const r=width*(.35+.06*(i%3));
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,"rgba("+tone+","+(.22*strength)+")");
      g.addColorStop(1,"rgba("+tone+",0)");
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r,r*.18,0,0,Math.PI*2);ctx.fill();
    }
  }
  function frame(time,condition,season,wind,intensity=1,night=false,enabled=true) {
    if(canvas.hidden)return;
    const previousW=width,previousH=height;
    const rect=canvas.getBoundingClientRect();
    if(Math.abs(previousW-rect.width)>2||Math.abs(previousH-rect.height)>2)resize();
    ctx.clearRect(0,0,width,height);
    if(!enabled||!width||!height)return;
    const value=clamp(safe(Number(intensity),1),0,2);
    if(value<=0)return;
    const actualTime=reduced?0:time;
    if(["cloudy","rain","storm","snow","wind"].includes(condition)) {
      clouds(actualTime,condition==="storm"?.40:.24*value,wind);
    }
    if(["day","summer","spring"].includes(condition)&&!night){
      sunshine(actualTime,.76*value);
    }
    if(condition==="rain"||condition==="storm")drizzleShine(actualTime,value);
    if(condition==="snow"||condition==="winter")snowAccumulation(value);
    if(season==="autumn"&&condition!=="snow")autumnHaze(actualTime,.7*value);
    if(condition==="fog")fogBanks(actualTime,Math.min(1.4,value),night);
    if(night)nightHaze(.75*value);
  }
  resize();
  return {frame,resize};
}
