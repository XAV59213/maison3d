/**
 * Maison 3D — cheap `set hass` for the card and the panel.
 * Home Assistant calls `set hass` for every state change in the house, with a
 * new `states` object but the SAME state object for entities that did not
 * change. The tracker remembers which entity ids matter (diagnostic sensor,
 * weather, sun, moon, sensors) and compares their state objects by reference,
 * so nothing is recomputed or posted when an unrelated entity changes.
 */
// Cache-busting: same ?v=<version> as this module for its import.
const VERSION=new URL(import.meta.url).searchParams.get("v")||"";
const {isMoon:moonSensor,moonRank}=await import("./sensor-values.js"+(VERSION?"?v="+encodeURIComponent(VERSION):""));
export const RESCAN_MS=30000;
export const isDiagnostic=entity=>entity?.attributes?.maison3d_config===true;
export const isWeather=entity=>Boolean(entity?.entity_id?.startsWith("weather.")&&entity.state!=="unknown"&&entity.state!=="unavailable");
// Moon: id with moon / lune (phase_lune, moon_phase…) or a state that is a known phase.
export const isMoon=moonSensor;
export function createHassTracker({now=()=>Date.now()}={}){
  const found=new Map();
  let snapshot=new Map();
  // Entity matching `test`, memoised by entity id; a miss is rescanned at most every RESCAN_MS.
  // With `rank`, every match is compared and the best one wins (first on a tie).
  function find(key,states,test,rank){
    const hit=found.get(key);
    if(hit?.id){
      const entity=states[hit.id];
      if(entity&&test(entity))return entity;
    }else if(hit&&now()-hit.at<RESCAN_MS)return undefined;
    let match;
    let best=-Infinity;
    for(const id in states){
      if(!test(states[id]))continue;
      if(!rank){match=states[id];break}
      const score=rank(states[id]);
      if(score>best){best=score;match=states[id]}
    }
    found.set(key,{id:match?.entity_id||"",at:now()});
    return match;
  }
  return {
    find,
    diagnostic:states=>find("diagnostic",states,isDiagnostic),
    moon:states=>find("moon",states,isMoon,moonRank),
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
