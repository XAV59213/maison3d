/**
 * Maison 3D — French / English texts of the review settings (previews, fixed season,
 * integration overrides, unsaved-changes recovery, this browser's copy).
 * Language: the Home Assistant language sent by the card / panel (maison3d:conditions).
 */
export const UI_TEXT={
  fr:{
    previewTitle:"Aperçu temporaire : {what} · non enregistré · se termine seul après 2 min",
    previewBack:"↩ Revenir",previewBackTitle:"Terminer l'aperçu (revenir à la saison réglée)",
    previewSeason:"Aperçu : {name}",seasonBubbles:"Aperçu des saisons (temporaire, non enregistré)",
    moonPreview:"Aperçu de la phase de lune (temporaire, non enregistré)",moonFromSensor:"Depuis le capteur Home Assistant",
    fixedSeason:"Saison fixe (réglage enregistré avec 💾)",fixedAuto:"Auto (calendrier Home Assistant)",
    previewStatus:"👁 Aperçu",moonPreviewStatus:"Lune en aperçu",
    overrides:"remplace l'option de l'intégration",overridesCard:"remplace l'option de la carte",
    integrationValue:"intégration : {value}",cardValue:"carte : {value}",on:"activé",off:"désactivé",none:"vide",
    backToIntegration:"Revenir à l'intégration",
    restoreQuestion:"Restaurer les modifications non enregistrées ?",restoreDetail:"Modifications non enregistrées trouvées ({when}).",
    restore:"Restaurer",ignore:"Ignorer",
    browserCopy:"Version de ce navigateur (non partagée)",browserCopyTitle:"Vos modifications sont enregistrées dans ce navigateur seulement et y priment sur Home Assistant (administrateur requis pour les partager).",
    backToHa:"↺ Revenir à la version Home Assistant",backToHaConfirm:"Abandonner la version de ce navigateur et revenir à la version Home Assistant ?",
    savedBrowser:"Enregistré dans ce navigateur ✓ (prime sur Home Assistant ici · administrateur requis pour partager)",
    savedBrowserOffline:"Enregistré dans ce navigateur ✓"
  },
  en:{
    previewTitle:"Temporary preview: {what} · not saved · ends by itself after 2 min",
    previewBack:"↩ Back",previewBackTitle:"End the preview (back to the chosen season)",
    previewSeason:"Preview: {name}",seasonBubbles:"Season preview (temporary, not saved)",
    moonPreview:"Moon phase preview (temporary, not saved)",moonFromSensor:"From the Home Assistant sensor",
    fixedSeason:"Fixed season (setting saved with 💾)",fixedAuto:"Auto (Home Assistant calendar)",
    previewStatus:"👁 Preview",moonPreviewStatus:"Moon preview",
    overrides:"overrides the integration option",overridesCard:"overrides the card option",
    integrationValue:"integration: {value}",cardValue:"card: {value}",on:"on",off:"off",none:"empty",
    backToIntegration:"Back to the integration",
    restoreQuestion:"Restore the unsaved changes?",restoreDetail:"Unsaved changes found ({when}).",
    restore:"Restore",ignore:"Ignore",
    browserCopy:"This browser's version (not shared)",browserCopyTitle:"Your changes are saved in this browser only and take precedence over Home Assistant here (administrator needed to share them).",
    backToHa:"↺ Back to the Home Assistant version",backToHaConfirm:"Drop this browser's version and go back to the Home Assistant version?",
    savedBrowser:"Saved in this browser ✓ (takes precedence over Home Assistant here · administrator needed to share)",
    savedBrowserOffline:"Saved in this browser ✓"
  }
};
export const SEASON_NAMES={fr:{spring:"Printemps",summer:"Été",autumn:"Automne",winter:"Hiver"},en:{spring:"Spring",summer:"Summer",autumn:"Autumn",winter:"Winter"}};
let lang="fr";
const subscribers=new Set();
export const uiLang=()=>lang;
export function setUiLang(value){
  if(!value)return;
  const next=/^fr/i.test(String(value))?"fr":"en";
  if(next===lang)return;
  lang=next;for(const fn of subscribers){try{fn(lang)}catch(err){console.error(err)}}
}
export const t=(key,vars={})=>(UI_TEXT[lang]?.[key]??UI_TEXT.fr[key]??key).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??"");
export function onUiLang(fn){subscribers.add(fn);fn(lang);return()=>subscribers.delete(fn)}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("message",event=>{
  if(event.source!==window.parent||event.origin!==window.location?.origin)return;
  if(event.data?.type==="maison3d:conditions"&&typeof event.data.language==="string"&&event.data.language)setUiLang(event.data.language);
});
