/**
 * Maison 3D — places the floating bars of the 3D view (panel, outside photo
 * mode) so they never cover each other, whatever the screen size.
 * Each element keeps its natural size; it is put at the first free spot of
 * its zone (top / middle / bottom) on its preferred side, like a skyline.
 */
const GAP=8,MARGIN=10;
const PROPS=["top","left","right","bottom","transform","max-height","overflow-y","display"];
// [selector, zone, side]; order = priority.
export const LAYOUT=[
  ["#maison3d-photo-controls","top","left"],
  ["#maison3d-presentation","top","right"],
  [".brand","top","left"],
  [".toolbar","top","center"],
  ["#maison3d-weather-status","top","right"],
  ["#hint","top","right"],
  [".bottom","bottom","left"],
  [".side","middle","left"],
  [".modes","middle","right"],
  [".editor","middle","right"]
];
// On narrow screens the two view bars move to the bottom (thumb reach).
const NARROW=700,SHORT=500;
const overlaps=(a,b)=>a.x<b.x+b.w+GAP&&b.x<a.x+a.w+GAP&&a.y<b.y+b.h+GAP&&b.y<a.y+a.h+GAP;
export function place(items,W,H,{compact=false}={}){
  // items: [{key,zone,side,w,h,shrink}] → Map key → {x,y,h}
  const placed=[],out=new Map();
  const xFor=(side,w)=>side==="left"?MARGIN:side==="right"?W-MARGIN-w:Math.max(MARGIN,(W-w)/2);
  const fits=r=>r.x>=MARGIN-1&&r.x+r.w<=W-MARGIN+1&&!placed.some(p=>overlaps(r,p));
  // Required bars first, optional helpers only where room is left.
  const order=[false,true].flatMap(optional=>["top","bottom","middle"].map(zone=>[zone,optional]));
  for(const [zone,optional] of order){
    for(const item of items.filter(i=>i.zone===zone&&!!i.optional===optional)){
      const w=Math.min(item.w,W-2*MARGIN);
      // Candidate columns: preferred side, then next to every placed box.
      const xs=[xFor(item.side,w)];
      for(const p of placed){
        const x=item.side==="right"?p.x-GAP-w:p.x+p.w+GAP;
        // Large screens: side panels stay on their side, the 3D scene keeps the centre.
        if(!compact&&item.zone==="middle"&&(item.side==="right"?x<W*0.55:x+w>W*0.45))continue;
        xs.push(x);
      }
      let best=null,roomiest=null;
      // Closest to the usual corner: distance down (or up) plus sideways drift.
      const score=r=>(zone==="bottom"?H-MARGIN-item.h-r.y:r.y)+Math.abs(r.x-xs[0])*0.6;
      if(zone==="bottom"){
        const ys=[H-MARGIN-item.h,...placed.map(p=>p.y-GAP-item.h)];
        for(const x of xs)for(const y of ys){
          const r={x,y,w,h:item.h};
          if(y>=MARGIN&&fits(r)&&(!best||score(r)<score(best)))best=r;
        }
      }else{
        const ys=[MARGIN,...placed.map(p=>p.y+p.h+GAP)];
        for(const x of xs)for(const y of ys){
          let h=item.h;
          const r={x,y,w,h};
          if(!fits(r)&&item.shrink){
            // Scrollable panel: use the free height under this spot.
            const below=placed.filter(p=>p.x<x+w+GAP&&x<p.x+p.w+GAP&&p.y>=y).map(p=>p.y-GAP);
            r.h=Math.min(item.h,Math.min(H-MARGIN,...below)-y);
            if(r.h>=48&&fits(r)&&(!roomiest||r.h>roomiest.h))roomiest={...r};
            if(r.h<item.shrink)continue;
          }
          if(y+r.h<=H-MARGIN+1&&fits(r)&&(!best||score(r)<score(best)))best=r;
        }
      }
      // Very short screens: the scrollable editor takes the tallest free spot.
      if(!best&&roomiest)best=roomiest;
      if(!best){
        // Optional helpers (hint) give way; others stay at their usual spot.
        if(item.optional){out.set(item.key,{hidden:true});continue}
        best={x:xs[0],y:zone==="bottom"?H-MARGIN-item.h:MARGIN,w,h:item.h,crowded:true};
      }
      placed.push(best);out.set(item.key,best);
    }
  }
  return out;
}
export function createSceneLayout(doc=document){
  const html=doc.documentElement;
  let frame=0;
  const reset=el=>{for(const p of PROPS)el.style.removeProperty(p)};
  const visible=el=>{if(!el)return false;const cs=getComputedStyle(el);return cs.display!=="none"&&cs.visibility!=="hidden"};
  function apply(){
    frame=0;
    const els=LAYOUT.map(([sel])=>doc.querySelector(sel));
    const active=!html.classList.contains("card-mode")&&!html.classList.contains("photo-active");
    if(!active){html.classList.remove("compact-scene");els.forEach(el=>el&&reset(el));return}
    const W=innerWidth,H=innerHeight,narrow=W<=NARROW,compact=narrow||H<=SHORT;
    if(html.classList.contains("compact-scene")!==compact){html.classList.toggle("compact-scene",compact);return}
    const items=[];
    LAYOUT.forEach(([sel,zone,side],i)=>{
      const el=els[i];
      if(!el)return;
      el.style.removeProperty("display");
      if(!visible(el))return;
      const box=el.getBoundingClientRect();
      if(box.width<2||box.height<2)return;
      // Natural height even when a previous layout made the panel scrollable.
      const height=el.style.getPropertyValue("max-height")?Math.max(box.height,el.scrollHeight+2):box.height;
      let z=zone;
      if(compact&&(sel==="#maison3d-photo-controls"||sel==="#maison3d-presentation"))z="bottom";
      // On small screens the weather bubble and the hint give way to the editing tools.
      if(compact&&sel==="#hint"){el.style.setProperty("display","none","important");return}
      const optional=sel==="#hint"||(compact&&sel==="#maison3d-weather-status");
      items.push({key:i,zone:z,side,w:box.width,h:height,shrink:sel===".editor"?120:0,optional});
    });
    const spots=place(items,W,H,{compact});
    for(const [i,r] of spots){
      const el=els[i],s=el.style;
      if(r.hidden){s.setProperty("display","none","important");continue}
      s.setProperty("top",Math.round(r.y)+"px","important");
      s.setProperty("left",Math.round(r.x)+"px","important");
      s.setProperty("right","auto","important");s.setProperty("bottom","auto","important");
      s.setProperty("transform","none","important");
      const natural=items.find(it=>it.key===i).h;
      if(r.h<natural){s.setProperty("max-height",Math.floor(r.h)+"px","important");s.setProperty("overflow-y","auto","important")}
      else{s.removeProperty("max-height");s.removeProperty("overflow-y")}
    }
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(apply)};
  addEventListener("resize",schedule);
  new MutationObserver(schedule).observe(html,{attributes:true,attributeFilter:["class"]});
  // Bars are created by several modules and change size (wrapping, edit panel).
  const sizes=typeof ResizeObserver==="function"?new ResizeObserver(schedule):null;
  const watched=new Set();
  const watch=()=>{for(const [sel] of LAYOUT){const el=doc.querySelector(sel);if(el&&!watched.has(el)){watched.add(el);sizes?.observe(el);new MutationObserver(schedule).observe(el,{attributes:true,attributeFilter:["class","hidden"]})}}};
  new MutationObserver(()=>{watch();schedule()}).observe(doc.body,{childList:true});
  watch();schedule();
  return {apply,schedule};
}
