/**
 * Four seasons, computed from the Home Assistant IANA time zone.
 * Northern-hemisphere meteorological seasons:
 * Mar 1 spring, Jun 1 summer, Sep 1 autumn, Dec 1 winter.
 * Doesn't modify entity states or the approved original photograph.
 */
export const SEASONS=["spring","summer","autumn","winter"];
export const SEASON_LABELS={
  spring:"Printemps",summer:"Été",autumn:"Automne",winter:"Hiver"
};
export function haCalendarDate(timeZone,now=new Date()){
  const zone=typeof timeZone==="string"&&timeZone.trim()?timeZone:"UTC";
  try{
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(now);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {year:Number(p.year),month:Number(p.month),day:Number(p.day),zone};
  }catch{
    // "UTC" fallback, never silently use a different device's time zone.
    const iso=now.toISOString().slice(0,10);
    const [year,month,day]=iso.split("-").map(Number);
    return {year,month,day,zone:"UTC"};
  }
}
/** Hour (0–23) in the Home Assistant time zone (UTC if the zone is unknown). */
export function haHour(timeZone,now=new Date()){
  const zone=typeof timeZone==="string"&&timeZone.trim()?timeZone:"UTC";
  try{
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",hourCycle:"h23"}).formatToParts(now);
    const hour=Number(parts.find(x=>x.type==="hour")?.value);
    if(Number.isFinite(hour))return hour%24;
  }catch{}
  return now.getUTCHours();
}
export function automaticSeason(timeZone,now=new Date()){
  const {month}=haCalendarDate(timeZone,now);
  return month>=3&&month<=5?"spring":
    month>=6&&month<=8?"summer":
    month>=9&&month<=11?"autumn":"winter";
}
export function createSeasonEffects(canvas){
  const ctx=canvas.getContext("2d",{alpha:true});
  const motion=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reduced=!!motion?.matches;
  motion?.addEventListener?.("change",e=>{reduced=e.matches});
  let width=1,height=1,dpr=1,particles=[],previousSeason="";
  function resize(){
    const box=canvas.getBoundingClientRect();
    width=Math.max(1,box.width);height=Math.max(1,box.height);
    dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.round(width*dpr),h=Math.round(height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function populate(season){
    particles=Array.from({length:105},(_,i)=>({
      x:Math.random()*width,y:Math.random()*height,
      radius:1.3+Math.random()*3.6,
      speed:.4+Math.random()*1.3,
      angle:Math.random()*6.283,
      palette:i%4
    }));
    previousSeason=season;
  }
  const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
  function frame(time,season,intensity=1,night=false,enabled=true){
    const box=canvas.getBoundingClientRect();
    if(Math.abs(box.width-width)>2||Math.abs(box.height-height)>2)resize();
    ctx.clearRect(0,0,width,height);
    if(!enabled||!SEASONS.includes(season))return;
    const power=clamp(Number.isFinite(intensity)?intensity:1,0,2);
    if(power===0)return;
    if(season!==previousSeason)populate(season);
    const count=Math.floor((season==="winter"?95:season==="summer"?14:55)*power);
    if(season==="spring"){
      const glow=ctx.createLinearGradient(0,0,0,height);
      glow.addColorStop(0,"rgba(255,216,230,"+(.07*power)+")");
      glow.addColorStop(1,"rgba(177,241,161,"+(.045*power)+")");
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    }else if(season==="summer"){
      const x=width*.22,y=height*.09;
      const g=ctx.createRadialGradient(x,y,2,x,y,width*.8);
      const pulse=reduced?1:.88+.12*Math.sin(time*.0005);
      g.addColorStop(0,"rgba(255,227,139,"+(.20*power*pulse)+")");
      g.addColorStop(1,"rgba(255,227,139,0)");
      ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    }else if(season==="autumn"){
      const g=ctx.createLinearGradient(0,0,width,height);
      g.addColorStop(0,"rgba(247,167,87,"+(.085*power)+")");
      g.addColorStop(1,"rgba(185,106,44,"+(.065*power)+")");
      ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    }else{
      const g=ctx.createLinearGradient(0,height*.62,0,height);
      g.addColorStop(0,"rgba(237,247,255,0)");
      g.addColorStop(1,"rgba(239,247,255,"+(.23*power)+")");
      ctx.fillStyle=g;ctx.fillRect(0,height*.62,width,height*.38);
    }
    if(season==="summer"&&!night)return;
    for(const p of particles.slice(0,count)){
      if(season==="summer"){
        const alpha=(reduced?.14:.08+.1*Math.sin(time*.001+p.angle))*power;
        const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,11);
        g.addColorStop(0,"rgba(255,239,159,"+alpha+")");
        g.addColorStop(1,"rgba(255,239,159,0)");
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();
      }else if(season==="winter"){
        ctx.fillStyle="#f7fbffcc";ctx.beginPath();
        ctx.arc(p.x,p.y,p.radius*.65,0,Math.PI*2);ctx.fill();
      }else{
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
        ctx.fillStyle=season==="spring"
          ?["#fff2f6cf","#ffdaedbd","#ef9cbdbd","#fff4fbcf"][p.palette]
          :["#d89d3dcc","#bd6e29c9","#c45a21bc","#e4b04acc"][p.palette];
        ctx.beginPath();ctx.ellipse(0,0,p.radius*1.2,p.radius*.65,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      if(!reduced){
        p.x+=(season==="autumn"?2:season==="spring"?.35:0)+Math.sin(time*.001+p.angle)*.6;
        p.y+=p.speed*(season==="winter"?1.6:season==="spring"?.9:.45);
        p.angle+=season==="autumn"?.023:.012;
      }
      if(p.y>height+12||p.x>width+12){p.x=Math.random()*width;p.y=-10}
    }
  }
  resize();
  return {frame,resize};
}
