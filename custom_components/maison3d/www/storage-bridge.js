/**
 * Maison 3D — parent side of the storage bridge (panel and card).
 * Answers the iframe with the project saved in Home Assistant and relays
 * saves (debounced) to the maison3d/save websocket command (admin only).
 */
export const SAVE_DELAY=800;
export const UPLOAD_MAX=10*1024*1024;
/** Send one image to /api/maison3d/upload (admin); resolves with {url,file,size}. */
export async function uploadPhoto(hass,file,name=""){
  if(!(file instanceof Blob))throw new Error("no_file");
  if(file.size>UPLOAD_MAX)throw new Error("too_big");
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("bad_format");
  const form=new FormData();
  form.append("name",String(name).slice(0,80));
  form.append("file",file,file.name||"photo.jpg");
  const init={method:"POST",body:form};
  const response=typeof hass?.fetchWithAuth==="function"
    ?await hass.fetchWithAuth("/api/maison3d/upload",init)
    :await fetch("/api/maison3d/upload",{...init,headers:{Authorization:"Bearer "+(hass?.auth?.data?.access_token||"")}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.message||("erreur HTTP "+response.status));
  return body;
}
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
  async function upload({id,file,name}){
    const reply=result=>send({type:"maison3d:upload-result",id,...result});
    if(!isAdmin()){reply({ok:false,error:"admin_required"});return}
    try{const result=await uploadPhoto(getHass(),file,name);reply({ok:true,url:result.url})}
    catch(err){reply({ok:false,error:String(err?.message||err)})}
  }
  function onMessage(event){
    const frame=getFrame();
    if(!frame||event.source!==frame.contentWindow||event.origin!==window.location.origin)return;
    const type=event.data?.type;
    if(type==="maison3d:storage-load"){load();return}
    if(type==="maison3d:upload"){upload(event.data);return}
    if(type!=="maison3d:storage-save")return;
    const patch=event.data.patch;
    if(!patch||typeof patch!=="object")return;
    if(!isAdmin()){send({type:"maison3d:storage-saved",ok:false,error:"admin_required"});return}
    for(const key of ["layout","photo_settings","view"])if(key in patch)pending[key]=patch[key];
    clearTimeout(timer);timer=setTimeout(flush,delay);
  }
  return {onMessage,flush,load};
}
