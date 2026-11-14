/** Shared safe image URL selection for Lovelace and the photo view. */
export const DEFAULT_MAIN_PHOTO="/maison3d-assets/maison3d-reference.jpg";

export function allowedPhotoUrl(value){
  if(typeof value!=="string"||value.length>500||/[\u0000-\u001f]/.test(value))return false;
  if(value.startsWith("/local/")||value.startsWith("/maison3d-assets/")||value.startsWith("/api/")){
    return !value.includes("\\")&&!value.startsWith("//");
  }
  if(!value.startsWith("https://"))return false;
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&Boolean(url.hostname)&&!url.username&&!url.password;
  }catch{return false}
}

/**
 * Panel: an explicitly set local override takes priority over integration options.
 * Lovelace: the parent supplies card > integration and ignores iframe-local storage.
 */
export function resolveMainPhoto({parent="",local="",isCard=false}={}){
  const options=isCard?[parent]:[local,parent];
  return options.find(allowedPhotoUrl)||DEFAULT_MAIN_PHOTO;
}
