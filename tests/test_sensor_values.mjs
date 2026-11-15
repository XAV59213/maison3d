import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
const www=name=>pathToFileURL("custom_components/maison3d/www/"+name).href;
const V=await import(www("sensor-values.js"));
const {createHassTracker,isMoon}=await import(www("hass-tracker.js"));
const s=(entity_id,state,attributes={})=>({entity_id,state,attributes});

// Vigilance colours, French / English, any case.
for(const [text,level] of [["Vert",0],["vert",0],["green",0],["GREEN",0],["Jaune",1],["yellow",1],
  ["Orange",2],["orange",2],["ORANGE",2],["Rouge",3],["red",3],["Vigilance jaune",1],[" Rouge ",3]])
  assert.equal(V.vigilanceLevel(text),level,text);
for(const text of ["","Bleu","sunny","redoute","greenhouse",null,undefined])assert.equal(V.vigilanceLevel(text),null,String(text));

// Météo-France rain vigilance: Vert → nothing, Jaune/Orange → rain, Rouge → storm.
const rainVig=state=>s("sensor.alerte_pluie_inondation",state);
const snowVig=state=>s("sensor.alerte_neige_verglas",state);
const kind=(rainEntity,snowEntity,extra={})=>{
  const p=V.precipitation(rainEntity,snowEntity);
  return V.weatherKind({weather:"sunny",...p,stormAlert:p.storm_alert,iceAlert:p.ice_alert,...extra});
};
assert.equal(kind(rainVig("Vert"),null),null);
assert.equal(kind(rainVig("green"),null),null);
assert.equal(kind(rainVig("Jaune"),null),"rain");
assert.equal(kind(rainVig("Orange"),null),"rain");
assert.equal(kind(rainVig("Rouge"),null),"storm");
assert.equal(kind(rainVig("RED"),null),"storm");
assert.equal(V.precipitation(rainVig("Rouge"),null).storm_alert,true);
assert.equal(V.precipitation(rainVig("Orange"),null).storm_alert,false);

// Snow / ice vigilance: Jaune+ → snow; with « verglas » and ≤ 0 °C → frost (if the frost effect is on).
assert.equal(kind(null,snowVig("Vert"),{celsius:-3}),null);
for(const c of ["Jaune","Orange","Rouge","yellow"])assert.equal(kind(null,snowVig(c),{celsius:4}),"snow",c);
assert.equal(kind(null,snowVig("Jaune"),{celsius:0}),"frost");
assert.equal(kind(null,snowVig("Orange"),{celsius:-4}),"frost");
assert.equal(kind(null,snowVig("Orange"),{celsius:-4,frostEnabled:false}),"snow");
assert.equal(kind(null,snowVig("Orange"),{celsius:null}),"snow");
assert.equal(kind(null,s("sensor.alerte_neige","Orange"),{celsius:-4}),"snow","no ice word → snow");
assert.equal(kind(null,s("sensor.vigilance","Jaune",{friendly_name:"Black ice warning"}),{celsius:-1}),"frost");
assert.equal(V.mentionsIce(s("sensor.office_notice","Jaune")),false,"ice only as a word");
assert.equal(V.precipitation(null,snowVig("Vert")).ice_alert,false);

// Unchanged behaviour: numbers and on/off.
assert.deepEqual(V.readSensor(s("sensor.rain_rate","0.4")),{value:.4,vigilance:null,issue:null});
assert.deepEqual(V.readSensor(s("sensor.rain_rate","0")),{value:0,vigilance:null,issue:null});
assert.deepEqual(V.readSensor(s("binary_sensor.rain","on")),{value:1,vigilance:null,issue:null});
assert.deepEqual(V.readSensor(s("binary_sensor.rain","off")),{value:0,vigilance:null,issue:null});
assert.deepEqual(V.readSensor(s("binary_sensor.rain","ON")),{value:1,vigilance:null,issue:null});
assert.equal(kind(s("binary_sensor.rain","on"),null),"rain");
assert.equal(kind(s("binary_sensor.rain","off"),null),null);
assert.equal(kind(null,s("binary_sensor.snow","on"),{celsius:-2}),"snow");
assert.equal(kind(s("sensor.rain_rate","2.5"),null),"rain");
assert.equal(kind(s("sensor.rain_rate","0"),null),null);
// Text from the weather entity still counts.
assert.equal(V.weatherKind({weather:"lightning-rainy"}),"storm");
assert.equal(V.weatherKind({weather:"snowy"}),"snow");
assert.equal(V.weatherKind({weather:"sunny",cloud:80}),"cloudy");
assert.equal(V.weatherKind({weather:"sunny"}),null);

// Unknown text, unavailable, unknown → value null + issue; nothing changes on the photo.
assert.deepEqual(V.readSensor(s("sensor.rain","Bleu")),{value:null,vigilance:null,issue:"unrecognized"});
assert.equal(V.readSensor(s("sensor.rain","unavailable")).issue,"unavailable");
assert.equal(V.readSensor(s("sensor.rain","unknown")).issue,"unknown");
assert.equal(V.readSensor(undefined).issue,"missing");
assert.equal(kind(s("sensor.rain","Bleu"),s("sensor.snow","unavailable")),null);

// Warnings for the settings.
const states={
  "sensor.alerte_pluie_inondation":rainVig("Jaune"),
  "sensor.alerte_neige_verglas":snowVig("Bleu"),
  "sensor.phase_de_la_lune":s("sensor.phase_de_la_lune","Premier croissant"),
  "sensor.temp":s("sensor.temp","unavailable"),
  "sensor.cloud":s("sensor.cloud","Orange"),
  "sensor.wind":s("sensor.wind","12")
};
const issues=V.sensorIssues({rain_entity:"sensor.alerte_pluie_inondation",snow_entity:"sensor.alerte_neige_verglas",
  moon_entity:"sensor.phase_de_la_lune",temperature_entity:"sensor.temp",cloud_entity:"sensor.cloud",
  wind_entity:"sensor.wind",weather_entity:"",sun_entity:"sun.sun"},states);
assert.deepEqual(Object.keys(issues).sort(),["cloud_entity","snow_entity","sun_entity","temperature_entity"]);
assert.equal(issues.snow_entity.issue,"unrecognized");
assert.equal(issues.temperature_entity.issue,"unavailable");
assert.equal(issues.sun_entity.issue,"missing");
assert.match(V.issueText(issues.snow_entity,"snow_entity"),/Valeur non reconnue « Bleu ».*Vert\/Jaune\/Orange\/Rouge/);
assert.match(V.issueText(issues.temperature_entity),/sensor\.temp indisponible/);
assert.equal(V.sensorIssue("moon_entity",s("sensor.x","Lune bleue")),"unrecognized");
assert.equal(V.sensorIssue("moon_entity",states["sensor.phase_de_la_lune"]),null);
assert.equal(V.issueText(null),"");

// Moon phases: French and English, accents and case.
assert.equal(V.moonPhase("Premier croissant"),"waxing_crescent");
assert.equal(V.moonPhase("Gibbeuse décroissante"),"waning_gibbous");
assert.equal(V.moonPhase("Lune gibbeuse croissante"),"waxing_gibbous");
assert.equal(V.moonPhase("full_moon"),"full_moon");
assert.equal(V.moonPhase("Waning Crescent"),"waning_crescent");
assert.equal(V.moonPhase("Bleu"),null);

// Moon auto-detection: moon / lune / phase_lune / moon_phase in the id, or a known phase as state.
assert.equal(isMoon(s("sensor.phase_de_la_lune","Premier croissant")),true);
assert.equal(isMoon(s("sensor.phase_lune","x")),true);
assert.equal(isMoon(s("sensor.moon_phase","new_moon")),true);
assert.equal(isMoon(s("sensor.astro","Pleine lune")),true);
assert.equal(isMoon(s("sensor.temperature","12")),false);
assert.equal(isMoon(s("sensor.moon_phase","unavailable")),false);
assert.equal(isMoon(s("binary_sensor.moon","on")),false);
const pick=st=>createHassTracker().moon(st)?.entity_id;
assert.equal(pick({"sensor.phase_de_la_lune":s("sensor.phase_de_la_lune","Premier croissant")}),"sensor.phase_de_la_lune");
assert.equal(pick({"sensor.phase_de_la_lune":s("sensor.phase_de_la_lune","Premier croissant"),
  "sensor.moon_phase":s("sensor.moon_phase","waxing_crescent")}),"sensor.moon_phase","English slug preferred");
assert.equal(pick({"sensor.astro":s("sensor.astro","Pleine lune"),"sensor.lune":s("sensor.lune","Pleine lune")}),"sensor.lune");
assert.equal(pick({"sensor.astro":s("sensor.astro","Pleine lune")}),"sensor.astro");
assert.equal(pick({"sensor.temperature":s("sensor.temperature","3")}),undefined);
console.log("Sensor values (vigilance Vert/Jaune/Orange/Rouge, on/off, unknown text, warnings, moon detection) OK");
