/**
 * Shared animation intensity for seasonal, cinematic, frost, weather and 3D effects.
 * Setting (photo_settings.motion): auto | always | never.
 * Auto follows prefers-reduced-motion: full speed normally, a slow residual
 * movement (MOTION_REDUCED, fewer particles) when the system asks to reduce
 * motion — leaves no longer freeze completely. Always ignores the system.
 * Never is static. Reacts to matchMedia changes.
 */
export const MOTION_MODES=["auto","always","never"];
/** Slow residual speed in Auto when the system reduces motion (15–25 %). */
export const MOTION_REDUCED=.2;
export const MOTION_QUERY="(prefers-reduced-motion: reduce)";

const listeners=new Set();
let mode="auto";

function media(){
  try{
    const fn=globalThis.matchMedia||globalThis.window?.matchMedia;
    return typeof fn==="function"?fn.call(globalThis.window||globalThis,MOTION_QUERY):null;
  }catch{return null}
}

export function systemReduced(){return !!media()?.matches}

export function setMotionMode(value){
  const next=MOTION_MODES.includes(value)?value:"auto";
  if(next===mode)return;
  mode=next;
  notify();
}

export function motionMode(){return mode}

/**
 * 0 = static, 1 = full speed, MOTION_REDUCED when Auto + system reduction.
 */
export function motionLevel(){
  if(mode==="never")return 0;
  if(mode==="always")return 1;
  return systemReduced()?MOTION_REDUCED:1;
}

/** Particle count: unchanged when static (they stay put), reduced when slow. */
export function motionCount(n){
  const level=motionLevel();
  if(!Number.isFinite(n)||n<=0)return 0;
  if(level===0||level>=1)return Math.round(n);
  return Math.max(3,Math.round(n*level));
}

export function onMotionChange(fn){
  listeners.add(fn);
  return()=>listeners.delete(fn);
}

function notify(){
  const level=motionLevel();
  for(const fn of listeners){try{fn(level,mode,systemReduced())}catch(err){console.error(err)}}
}

media()?.addEventListener?.("change",()=>{if(mode==="auto")notify()});

export const MOTION_LABELS={
  fr:{
    title:"Animations",
    auto:"Auto",
    always:"Toujours",
    never:"Jamais",
    hint:"Auto suit le système. Avec une réduction d'animations, le mouvement reste lent au lieu d'être figé.",
    reduced:"animations réduites par le système"
  },
  en:{
    title:"Animations",
    auto:"Auto",
    always:"Always",
    never:"Never",
    hint:"Auto follows the system. With reduced motion, movement stays slow instead of freezing.",
    reduced:"animations reduced by the system"
  }
};

export function motionLocale(lang){
  const raw=lang
    ||(typeof document!=="undefined"&&document.documentElement?.lang)
    ||(typeof navigator!=="undefined"&&navigator.language)
    ||"fr";
  const code=String(raw).slice(0,2).toLowerCase();
  return MOTION_LABELS[code]||MOTION_LABELS.fr;
}
