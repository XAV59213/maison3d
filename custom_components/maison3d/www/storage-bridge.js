/**
 * Maison 3D — parent side of the storage bridge (panel and card).
 * Answers the iframe with the project saved in Home Assistant and relays
 * saves (debounced) to the maison3d/save websocket command (admin only).
 */
export const SAVE_DELAY=800;
export function createStorageBridge({getFrame,getHass,delay=SAVE_DELAY}){
  let pending={},timer=null;
  const send=message=>getFrame()?.contentWindow?.postMessage(message,window.location.origin);
  const isAdmin=()=>getHass()?.user?.is_admin===true;
  async function load(){
    const hass=getHass();
    if(!hass?.callWS){send({type:"maison3d:storage",data:null,can_save:false,error:"no_connection"});return}
    try{
      const result=await hass.callWS({type:"maison3d/get"});
      send({type:"maison3d:storage",data:result?.data&&typeof result.data==="object"?result.data:{},can_save:isAdmin()});
    }catch(err){
      // Older integration without the commands, or no permission: browser storage only.
      send({type:"maison3d:storage",data:null,can_save:false,error:String(err?.message||err?.code||err)});
    }
  }
  async function flush(){
    clearTimeout(timer);timer=null;
    const patch=pending;pending={};
    if(!Object.keys(patch).length)return;
    const hass=getHass();
    try{
      await hass.callWS({type:"maison3d/save",...patch});
      send({type:"maison3d:storage-saved",ok:true});
    }catch(err){
      send({type:"maison3d:storage-saved",ok:false,error:String(err?.message||err?.code||err)});
    }
  }
  function onMessage(event){
    const frame=getFrame();
    if(!frame||event.source!==frame.contentWindow||event.origin!==window.location.origin)return;
    const type=event.data?.type;
    if(type==="maison3d:storage-load"){load();return}
    if(type!=="maison3d:storage-save")return;
    const patch=event.data.patch;
    if(!patch||typeof patch!=="object")return;
    if(!isAdmin()){send({type:"maison3d:storage-saved",ok:false,error:"admin_required"});return}
    for(const key of ["layout","photo_settings","view"])if(key in patch)pending[key]=patch[key];
    clearTimeout(timer);timer=setTimeout(flush,delay);
  }
  return {onMessage,flush,load};
}
