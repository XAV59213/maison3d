/**
 * Maison 3D — outdoor lights on the photo at night (no three.js).
 * A light = a light.* or switch.* entity placed on the photo (x / y in % of the
 * photo), with a name, a halo colour and an intensity. At night, a halo is drawn
 * only while the entity is « on », with the rgb_color and brightness of the light.
 * The list is part of the photo settings: it follows the draft (« 💾 Enregistrer »).
 * Optional: a click on the light toggles it (light.toggle / switch.toggle), off by
 * default, for administrators only or every Home Assistant user (checked by the card /
 * panel, then by Home Assistant itself).
 */
import {langOf,t,uiLang} from "./i18n.js";
export {langOf};
export const LIGHT_DOMAINS=["light","switch"];
export const MAX_LIGHTS=24;
export const DEFAULT_COLOR="#ffc46b";
export const TOGGLE_MODES=["off","admins","users"];
export const DEFAULT_TOGGLE="off";
const ENTITY=/^(light|switch)\.[a-z0-9_]{1,120}$/;
const HEX=/^#[0-9a-f]{6}$/i;
const clamp=(value,min,max,fallback)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
export const isLightEntity=id=>typeof id==="string"&&ENTITY.test(id);
/** Valid, unique lights (at most MAX_LIGHTS); anything else is dropped. */
export function cleanLights(list){
  const out=[],seen=new Set();
  for(const item of Array.isArray(list)?list:[]){
    if(!item||typeof item!=="object"||!isLightEntity(item.entity_id)||seen.has(item.entity_id))continue;
    seen.add(item.entity_id);
    out.push({
      entity_id:item.entity_id,
      name:typeof item.name==="string"?item.name.trim().slice(0,60):"",
      x:Math.round(clamp(item.x,0,100,50)*10)/10,
      y:Math.round(clamp(item.y,0,100,50)*10)/10,
      color:typeof item.color==="string"&&HEX.test(item.color)?item.color.toLowerCase():DEFAULT_COLOR,
      intensity:Math.round(clamp(item.intensity,0.2,2,1)*10)/10
    });
    if(out.length>=MAX_LIGHTS)break;
  }
  return out;
}
export const cleanToggle=value=>TOGGLE_MODES.includes(value)?value:DEFAULT_TOGGLE;
/** Can this user toggle the lights from the photo? */
export const toggleAllowed=(mode,isAdmin)=>mode==="users"||(mode==="admins"&&isAdmin===true);
const hex=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
/** Card / panel side: what the view needs about each watched light. */
export function lightStates(states,ids){
  const out={};
  for(const id of Array.isArray(ids)?ids:[]){
    if(!isLightEntity(id))continue;
    const entity=states?.[id];
    if(!entity){out[id]={state:"missing"};continue}
    const a=entity.attributes||{};
    const rgb=Array.isArray(a.rgb_color)&&a.rgb_color.length===3&&a.rgb_color.every(n=>Number.isFinite(n))?a.rgb_color.map(n=>clamp(Math.round(n),0,255,0)):null;
    out[id]={state:String(entity.state).slice(0,20),
      rgb,brightness:Number.isFinite(a.brightness)?clamp(a.brightness,0,255,255):null,
      name:typeof a.friendly_name==="string"?a.friendly_name.slice(0,60):""};
  }
  return out;
}
/** Candidates for the « add a light » selector: light.* and switch.* only. */
export function lightOptions(states,limit=300){
  return Object.values(states||{})
    .filter(e=>isLightEntity(e?.entity_id))
    .map(e=>({id:e.entity_id,name:typeof e.attributes?.friendly_name==="string"&&e.attributes.friendly_name.trim()?e.attributes.friendly_name.trim().slice(0,80):e.entity_id}))
    .sort((a,b)=>(a.id.startsWith("light.")?0:1)-(b.id.startsWith("light.")?0:1)||a.name.localeCompare(b.name,uiLang()==="fr"?"fr":"en"))
    .slice(0,limit);
}
/**
 * Halo of one light, or null (no halo): only at night, only when the entity is on.
 * Colour: rgb_color of the light, else the configured colour. Strength: brightness
 * of the light (0–255, at least 25 %) × configured intensity.
 */
export function haloFor(light,live,night){
  if(!night||!light||live?.state!=="on")return null;
  const rgb=live.rgb||hex(HEX.test(light.color||"")?light.color:DEFAULT_COLOR);
  const level=live.brightness==null?1:Math.max(.25,live.brightness/255);
  return {rgb,strength:Math.round(level*clamp(light.intensity,0.2,2,1)*100)/100};
}
/** Photo point (%) → position in a box showing the photo with object-fit: cover. */
export function coverPoint(x,y,{naturalWidth:nw,naturalHeight:nh,width:w,height:h}){
  const scale=nw>0&&nh>0?Math.max(w/nw,h/nh):1;
  const dw=(nw>0?nw:w)*scale,dh=(nh>0?nh:h)*scale;
  return {left:(w-dw)/2+x/100*dw,top:(h-dh)/2+y/100*dh};
}
/** Position in the box → photo point (%), clamped to the photo. */
export function coverPercent(left,top,{naturalWidth:nw,naturalHeight:nh,width:w,height:h}){
  const scale=nw>0&&nh>0?Math.max(w/nw,h/nh):1;
  const dw=(nw>0?nw:w)*scale,dh=(nh>0?nh:h)*scale;
  const r=v=>Math.round(Math.min(100,Math.max(0,v))*10)/10;
  return {x:r((left-(w-dw)/2)/dw*100),y:r((top-(h-dh)/2)/dh*100)};
}
/** Service call for a toggle request, or null if it is not allowed. */
export function toggleCall(entityId,watched,mode,isAdmin){
  if(!isLightEntity(entityId)||!Array.isArray(watched)||!watched.includes(entityId)||!toggleAllowed(mode,isAdmin))return null;
  return {domain:entityId.split(".")[0],service:"toggle",data:{entity_id:entityId}};
}
/**
 * Card / panel side. The view asks for the states of its lights (maison3d:lights-watch)
 * and may ask for a toggle (maison3d:light-toggle): only a watched light.* / switch.*,
 * only if the saved option allows this user; Home Assistant checks the permissions again.
 */
export function createLightBridge({getHass,getFrame,onChange}){
  let watched=[],mode=DEFAULT_TOGGLE;
  const reply=message=>getFrame()?.contentWindow?.postMessage(message,window.location.origin);
  return {
    /** True if the message was for the lights. */
    onMessage(data){
      if(data?.type==="maison3d:lights-watch"){
        watched=(Array.isArray(data.entity_ids)?data.entity_ids:[]).filter(isLightEntity).slice(0,MAX_LIGHTS);
        mode=cleanToggle(data.toggle);
        onChange?.();return true;
      }
      if(data?.type==="maison3d:light-toggle"){
        const hass=getHass();
        const call=toggleCall(data.entity_id,watched,mode,hass?.user?.is_admin===true);
        if(!call||!hass?.callService){reply({type:"maison3d:light-toggle-result",entity_id:String(data.entity_id||"").slice(0,130),ok:false,error:"not_allowed"});return true}
        Promise.resolve(hass.callService(call.domain,call.service,call.data)).then(
          ()=>reply({type:"maison3d:light-toggle-result",entity_id:call.data.entity_id,ok:true}),
          err=>reply({type:"maison3d:light-toggle-result",entity_id:call.data.entity_id,ok:false,error:String(err?.code||err?.message||"error").slice(0,80)}));
        return true;
      }
      return false;
    },
    /** [key, state object] pairs for the change tracker. */
    entries:states=>watched.map(id=>["light:"+id,states?.[id]]),
    states:states=>lightStates(states,watched),
    get watched(){return [...watched]},
    get mode(){return mode}
  };
}
export const say=(lang,key,vars={})=>t(lang,"light_"+key,vars);
const LIGHT_KEYS=["legend","note","add","choose","none","name","color","intensity","place","remove","placing","cancel","toggle","toggleOff","toggleAdmins","toggleUsers","on","off","unavailable","missing","denied","toggled","full","position","halo_title","clickTitle"];
export const TEXT={
  fr:Object.fromEntries(LIGHT_KEYS.map(k=>[k,t("fr","light_"+k)])),
  en:Object.fromEntries(LIGHT_KEYS.map(k=>[k,t("en","light_"+k)]))
};
/**
 * DOM layer over the photo: one halo per light that is on (night), plus markers while
 * the settings are open and click targets when toggling is allowed.
 */
export function createLightOverlay({container,image,after=null,onToggle}){
  const layer=document.createElement("div");
  layer.className="maison3d-lights";
  if(after)after.after(layer);else container.append(layer);
  let last={lights:[],live:{},night:false,markers:false,clickable:false,lang:"fr"};
  const nodes=new Map();
  function render(next=last){
    last=next;
    const {lights,live,night,markers,clickable,lang}=next;
    const box={naturalWidth:image.naturalWidth||1286,naturalHeight:image.naturalHeight||914,width:container.clientWidth,height:container.clientHeight};
    const base=Math.max(60,Math.min(box.width,box.height)*.3);
    const keep=new Set();
    for(const light of lights){
      keep.add(light.entity_id);
      let node=nodes.get(light.entity_id);
      if(!node){
        node={halo:document.createElement("div"),dot:document.createElement("button")};
        node.halo.className="light-halo";node.dot.className="light-dot";node.dot.type="button";
        // Placing a light: the click goes on to the photo (new position).
        node.dot.addEventListener("click",event=>{if(node.dot.dataset.clickable!=="1")return;event.stopPropagation();onToggle?.(node.entity_id)});
        layer.append(node.halo,node.dot);nodes.set(light.entity_id,node);
      }
      node.entity_id=light.entity_id;
      const {left,top}=coverPoint(light.x,light.y,box);
      const halo=haloFor(light,live[light.entity_id],night);
      node.halo.hidden=!halo;
      node.halo.dataset.entity=light.entity_id;
      if(halo){
        const size=base*(.6+.5*halo.strength);
        const [r,g,b]=halo.rgb,a=Math.min(1,.7+.3*halo.strength);
        Object.assign(node.halo.style,{left:left-size/2+"px",top:top-size/2+"px",width:size+"px",height:size+"px",
          background:`radial-gradient(circle,rgba(255,255,255,${a}) 0%,rgba(${r},${g},${b},${a}) 6%,rgba(${r},${g},${b},${a*.72}) 20%,rgba(${r},${g},${b},${a*.32}) 42%,rgba(${r},${g},${b},0) 70%)`});
      }
      const state=live[light.entity_id]?.state;
      const label=light.name||live[light.entity_id]?.name||light.entity_id;
      node.dot.hidden=!(markers||clickable);
      node.dot.dataset.clickable=clickable?"1":"0";
      node.dot.dataset.entity=light.entity_id;
      node.dot.dataset.state=state||"";
      node.dot.classList.toggle("lit",state==="on");
      node.dot.classList.toggle("marker",markers);
      node.dot.textContent=markers?"💡 "+label:"";
      node.dot.title=clickable?say(lang,"clickTitle",{name:label}):label+" · "+(say(lang,state||"missing"));
      node.dot.setAttribute("aria-label",node.dot.title);
      node.dot.tabIndex=clickable?0:-1;
      Object.assign(node.dot.style,{left:left+"px",top:top+"px"});
    }
    for(const [id,node] of nodes)if(!keep.has(id)){node.halo.remove();node.dot.remove();nodes.delete(id)}
    layer.classList.toggle("interactive",clickable||markers);
  }
  addEventListener("resize",()=>render());
  image.addEventListener("load",()=>render());
  return {render,layer,count:()=>layer.querySelectorAll(".light-halo:not([hidden])").length};
}
export const LIGHT_STYLE=
  "#maison3d-photo-view .maison3d-lights{position:absolute;inset:0;pointer-events:none}"+
  "#maison3d-photo-view .light-halo{position:absolute;border-radius:50%;mix-blend-mode:screen;pointer-events:none;transition:opacity .6s}"+
  "#maison3d-photo-view .light-halo[hidden]{display:none}"+
  "#maison3d-photo-view .light-dot{position:absolute;transform:translate(-50%,-50%);min-width:30px;min-height:30px;border-radius:15px;"+
  "border:2px solid #ffffffb0;background:#10192366;color:#fff;font:11px system-ui;padding:2px 7px;cursor:pointer;pointer-events:auto;white-space:nowrap}"+
  "#maison3d-photo-view .light-dot:not(.marker){background:transparent!important;border-color:#ffffff40;width:34px;height:34px;padding:0}"+
  "#maison3d-photo-view .light-dot.lit{border-color:#ffd27a}"+
  "#maison3d-photo-view .light-dot[hidden]{display:none}"+
  "#maison3d-photo-view.placing-light{cursor:crosshair}"+
  // Placing a light: the whole photo is free (the command bar comes back after the click).
  "html.placing-light #maison3d-photo-controls{display:none!important}"+
  "#maison3d-photo-view .light-placing{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:3;background:#1579eaee;color:#fff;"+
  "font:13px system-ui;padding:9px 14px;border-radius:10px;max-width:86%;text-align:center;box-shadow:0 6px 18px #0007}"+
  "#maison3d-photo-view .light-placing[hidden]{display:none}"+
  ".maison3d-lights-settings{border:1px solid #66778c;border-radius:8px;margin-top:12px;display:grid;gap:7px}"+
  ".maison3d-lights-settings legend{font-size:13px;font-weight:bold}"+
  ".maison3d-lights-settings .light-add{display:flex;gap:6px}.maison3d-lights-settings .light-add select{flex:1;min-width:0;margin:0!important}"+
  ".maison3d-lights-settings .light-row{border-top:1px solid #ffffff22;padding-top:7px;display:grid;grid-template-columns:1fr auto;gap:5px 8px;align-items:center;font:12px system-ui}"+
  ".maison3d-lights-settings .light-row label{margin:0!important}"+
  ".maison3d-lights-settings .light-row input[type=text]{margin-top:2px!important}"+
  ".maison3d-lights-settings .light-row .light-id{grid-column:1/-1;font-size:11px;color:#a9c4de;overflow-wrap:anywhere}"+
  ".maison3d-lights-settings .light-row .light-actions{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}"+
  ".maison3d-lights-settings input[type=color]{width:44px;height:30px;border:0;background:none;padding:0;vertical-align:middle}"+
  ".maison3d-lights-settings .light-status{font-size:11px;color:#f3c77a}";
