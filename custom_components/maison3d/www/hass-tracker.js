/**
 * Maison 3D — cheap `set hass` for the card and the panel.
 * Home Assistant calls `set hass` for every state change in the house, with a
 * new `states` object but the SAME state object for entities that did not
 * change. The tracker remembers which entity ids matter (diagnostic sensor,
 * weather, sun, moon, sensors) and compares their state objects by reference,
 * so nothing is recomputed or posted when an unrelated entity changes.
 */
export const RESCAN_MS=30000;
export const isDiagnostic=entity=>entity?.attributes?.maison3d_config===true;
export const isWeather=entity=>Boolean(entity?.entity_id?.startsWith("weather.")&&entity.state!=="unknown"&&entity.state!=="unavailable");
export const isMoon=entity=>Boolean(entity?.entity_id?.startsWith("sensor.")&&entity.entity_id.includes("moon")&&entity.state!=="unavailable");
export function createHassTracker({now=()=>Date.now()}={}){
  const found=new Map();
  let snapshot=new Map();
  // Entity matching `test`, memoised by entity id; a miss is rescanned at most every RESCAN_MS.
  function find(key,states,test){
    const hit=found.get(key);
    if(hit?.id){
      const entity=states[hit.id];
      if(entity&&test(entity))return entity;
    }else if(hit&&now()-hit.at<RESCAN_MS)return undefined;
    let match;
    for(const id in states){if(test(states[id])){match=states[id];break}}
    found.set(key,{id:match?.entity_id||"",at:now()});
    return match;
  }
  return {
    find,
    diagnostic:states=>find("diagnostic",states,isDiagnostic),
    /** entries: [[key, object], …]. True if any object (or the list of keys) differs from the previous call. */
    changed(entries){
      const next=new Map(entries);
      let diff=next.size!==snapshot.size;
      if(!diff)for(const [key,value] of next)if(!snapshot.has(key)||snapshot.get(key)!==value){diff=true;break}
      snapshot=next;
      return diff;
    },
    /** Forget everything (e.g. new card configuration). */
    reset(){found.clear();snapshot=new Map()}
  };
}
