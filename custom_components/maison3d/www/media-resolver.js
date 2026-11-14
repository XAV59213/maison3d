/**
 * Maison 3D — Home Assistant media (« Médias ») for the photos.
 * A media-source:// id (chosen in the card editor or the integration options)
 * is turned into a signed /media/… URL by the parent with
 * media_source/resolve_media, then passed to the iframe like any other URL.
 */
export const MEDIA_PREFIX="media-source://";
const REFRESH_MS=12*3600*1000; // signed URLs are valid 24 h
export function createMediaResolver({getHass,onResolved}){
  const cache=new Map();
  async function resolve(id){
    const entry=cache.get(id)||{};entry.pending=true;cache.set(id,entry);
    try{
      const result=await getHass().callWS({type:"media_source/resolve_media",media_content_id:id,expires:86400});
      if(typeof result?.url==="string"&&result.url.startsWith("/")){
        cache.set(id,{url:result.url,at:Date.now(),pending:false});onResolved();return;
      }
      throw new Error("url");
    }catch(err){
      console.warn("Maison 3D: média introuvable",id,err?.message||err);
      cache.set(id,{url:"",at:Date.now(),pending:false,failed:true});
    }
  }
  /** Synchronous: the signed URL when known (resolution runs in background), else the value itself. */
  function url(value){
    if(typeof value!=="string"||!value.startsWith(MEDIA_PREFIX))return value||"";
    const entry=cache.get(value);
    if(!entry||(!entry.pending&&Date.now()-entry.at>REFRESH_MS)){if(getHass()?.callWS)resolve(value)}
    return entry?.url||"";
  }
  const images=map=>Object.fromEntries(Object.entries(map||{}).map(([key,value])=>[key,url(value)]).filter(([,value])=>value));
  return {url,images};
}
