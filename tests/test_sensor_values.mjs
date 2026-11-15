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

// Météo-France rain vigilance: Vert → nothing, Jaune alone → nothing (dry weather stays dry),
// Orange → rain, Rouge → storm.
const rainVig=state=>s("sensor.alerte_pluie_inondation",state);
const snowVig=state=>s("sensor.alerte_neige_verglas",state);
const kind=(rainEntity,snowEntity,extra={})=>{
  const p=V.precipitation(rainEntity,snowEntity);
  return V.weatherKind({weather:"sunny",...p,stormAlert:p.storm_alert,iceAlert:p.ice_alert,...extra});
};
assert.equal(kind(rainVig("Vert"),null),null);
assert.equal(kind(rainVig("green"),null),null);
assert.equal(kind(rainVig("Jaune"),null),null,"yellow + dry weather: no forced rain");
assert.equal(kind(rainVig("Jaune"),null,{weather:"rainy"}),"rain","yellow + rainy weather: rain");
assert.equal(V.precipitation(rainVig("Jaune"),null).rain,0);
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
assert.match(V.issueText(issues.temperature_entity,"temperature_entity","en"),/unavailable/);


// Moon phases: French and English, accents and case.
assert.equal(V.moonPhase("Premier croissant"),"waxing_crescent");
assert.equal(V.moonPhase("Gibbeuse décroissante"),"waning_gibbous");
assert.equal(V.moonPhase("Lune gibbeuse croissante"),"waxing_gibbous");
assert.equal(V.moonPhase("full_moon"),"full_moon");
assert.equal(V.moonPhase("Waning Crescent"),"waning_crescent");
assert.equal(V.moonPhase("Bleu"),null);

// Moon auto-detection: only a sensor whose state is a recognised phase (FR / EN).
assert.equal(isMoon(s("sensor.phase_de_la_lune","Premier croissant")),true);
assert.equal(isMoon(s("sensor.phase_lune","x")),false,"a moon name alone is not enough");
assert.equal(isMoon(s("sensor.lune_lever","07:42")),false);
assert.equal(isMoon(s("sensor.moon_illumination","42")),false);
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
// Entity choice: menu placeholders, effective value + source, candidates per field.
assert.equal(V.menuChoice("moon_entity","sensor.moon_phase"),"");
assert.equal(V.menuChoice("sun_entity","sun.sun"),"");
assert.equal(V.menuChoice("moon_entity"," sensor.phase_de_la_lune "),"sensor.phase_de_la_lune");
assert.equal(V.menuChoice("weather_entity",42),"");
const integ={weather_entity:"weather.bermerain",moon_entity:"sensor.phase_de_la_lune",temperature_entity:"sensor.bermerain_temperature_2"};
let eff=V.effectiveEntities([["card",{temperature_entity:"sensor.salon"}],["menu",{weather_entity:"weather.autre",moon_entity:""}],["integration",integ]],
  {weather_entity:{entity_id:"weather.x",source:"auto"},sun_entity:{entity_id:"sun.sun",source:"default"},moon_entity:{entity_id:"sensor.moon",source:"auto"}});
assert.deepEqual(eff.temperature_entity,{entity_id:"sensor.salon",source:"card"});
assert.deepEqual(eff.weather_entity,{entity_id:"weather.autre",source:"menu"});
assert.deepEqual(eff.moon_entity,{entity_id:"sensor.phase_de_la_lune",source:"integration"});
assert.deepEqual(eff.sun_entity,{entity_id:"sun.sun",source:"default"});
assert.deepEqual(eff.wind_entity,{entity_id:"",source:"none"});
eff=V.effectiveEntities([["menu",{}],["integration",{}]],{moon_entity:{entity_id:"sensor.phase_de_la_lune",source:"auto"}});
assert.deepEqual(eff.moon_entity,{entity_id:"sensor.phase_de_la_lune",source:"auto"});
const cand={
  "weather.bermerain":s("weather.bermerain","cloudy",{friendly_name:"Bermerain"}),
  "sun.sun":s("sun.sun","above_horizon"),
  "sensor.phase_de_la_lune":s("sensor.phase_de_la_lune","Premier croissant"),
  "sensor.t":s("sensor.t","5",{device_class:"temperature",unit_of_measurement:"°C",friendly_name:"Bermerain Température"}),
  "sensor.t_old":s("sensor.t_old","5",{unit_of_measurement:"°F"}),
  "sensor.hum":s("sensor.hum","60",{device_class:"humidity",unit_of_measurement:"%"}),
  "sensor.bat":s("sensor.bat","60",{device_class:"battery",unit_of_measurement:"%"}),
  "sensor.couverture_nuageuse":s("sensor.couverture_nuageuse","80",{unit_of_measurement:"%"}),
  "sensor.vent":s("sensor.vent","12",{device_class:"wind_speed",unit_of_measurement:"km/h"}),
  "sensor.rafales":s("sensor.rafales","20",{unit_of_measurement:"km/h"}),
  "sensor.alerte_pluie_inondation":rainVig("Vert"),
  "sensor.alerte_neige_verglas":snowVig("Jaune"),
  "sensor.pluie_1h":s("sensor.pluie_1h","0",{device_class:"precipitation",unit_of_measurement:"mm"}),
  "binary_sensor.fuite":s("binary_sensor.fuite","off",{device_class:"moisture"}),
  "binary_sensor.porte":s("binary_sensor.porte","off",{device_class:"door"}),
  "light.salon":s("light.salon","on")
};
const O=V.entityOptions(cand);
const ids=key=>O[key].map(o=>o.id);
assert.deepEqual(ids("weather_entity"),["weather.bermerain"]);
assert.deepEqual(ids("sun_entity"),["sun.sun"]);
assert.deepEqual(ids("moon_entity"),["sensor.phase_de_la_lune"]);
assert.deepEqual(ids("temperature_entity").sort(),["sensor.t","sensor.t_old"]);
assert.deepEqual(ids("wind_entity").sort(),["sensor.rafales","sensor.vent"]);
assert.equal(ids("cloud_entity")[0],"sensor.couverture_nuageuse");
assert.ok(!ids("cloud_entity").includes("sensor.bat"));
assert.equal(ids("rain_entity")[0],"sensor.alerte_pluie_inondation");
assert.equal(ids("snow_entity")[0],"sensor.alerte_neige_verglas");
assert.ok(ids("rain_entity").includes("sensor.pluie_1h"));
for(const id of ["binary_sensor.fuite","sensor.alerte_neige_verglas"])assert.ok(!ids("rain_entity").includes(id),id+" is not rain");
assert.ok(!ids("rain_entity").includes("binary_sensor.porte"));
assert.ok(!ids("rain_entity").includes("sensor.t"),"« Bermerain » is a place, not rain");
assert.ok(V.entityMatches("rain_entity",s("sensor.rain_rate","0.2")));
assert.ok(V.entityMatches("snow_entity",s("sensor.hauteur_neige","3")));
assert.ok(!V.entityMatches("snow_entity",s("sensor.bermerain_temperature_2","5",{friendly_name:"Bermerain Température"})));
assert.equal(O.weather_entity[0].name,"Bermerain");

// Stricter filters (production feedback).
const M=(key,entity)=>V.entityMatches(key,entity);
// Cloud: a cloud word + %, never humidity / disk / battery.
assert.ok(M("cloud_entity",s("sensor.nebulosite","40",{unit_of_measurement:"%",friendly_name:"Couverture nuageuse"})));
assert.ok(M("cloud_entity",s("sensor.cloud_cover","40",{unit_of_measurement:"%"})));
assert.ok(!M("cloud_entity",s("sensor.cloud_cover","40",{unit_of_measurement:"okta"})),"needs %");
assert.ok(!M("cloud_entity",s("sensor.humidite","60",{unit_of_measurement:"%"})),"no cloud word");
assert.ok(!M("cloud_entity",s("sensor.cloud_humidity","60",{unit_of_measurement:"%"})));
assert.ok(!M("cloud_entity",s("sensor.nuage_humidite","60",{unit_of_measurement:"%"})));
assert.ok(!M("cloud_entity",s("sensor.nextcloud_disk_free","60",{unit_of_measurement:"%"})));
assert.ok(!M("cloud_entity",s("sensor.cloud_disque","60",{unit_of_measurement:"%"})));
assert.ok(!M("cloud_entity",s("sensor.cloud_battery","60",{unit_of_measurement:"%"})));
assert.ok(!M("cloud_entity",s("sensor.couverture","60",{unit_of_measurement:"%",device_class:"battery"})));
// Moon: only entities with a phase state are offered.
assert.ok(M("moon_entity",s("sensor.moon","waning_gibbous")));
assert.ok(!M("moon_entity",s("sensor.moon_distance","384400",{unit_of_measurement:"km"})));
assert.ok(!M("moon_entity",s("sensor.lune","unknown")));
// Wind: device_class wind_speed first, never a pace (allure).
assert.ok(M("wind_entity",s("sensor.anemometre","3",{device_class:"wind_speed",unit_of_measurement:"m/s"})));
assert.ok(!M("wind_entity",s("sensor.running_pace","10",{unit_of_measurement:"km/h"})));
assert.ok(!M("wind_entity",s("sensor.allure_course","10",{unit_of_measurement:"km/h"})));
assert.ok(!M("wind_entity",s("sensor.voiture_vitesse","50",{device_class:"speed",unit_of_measurement:"km/h"})),"speed of a car ≠ wind");
assert.deepEqual(V.entityOptions({
  "sensor.a_rafales":s("sensor.a_rafales","20",{unit_of_measurement:"km/h"}),
  "sensor.z_vent":s("sensor.z_vent","12",{device_class:"wind_speed",unit_of_measurement:"km/h"})
}).wind_entity.map(o=>o.id),["sensor.z_vent","sensor.a_rafales"],"wind_speed device_class first");
// Rain: rain / pluie / inondation / flood only.
for(const id of ["sensor.alerte_pluie_inondation","sensor.rain_rate","binary_sensor.rain","sensor.flood_level","sensor.inondation"])
  assert.ok(M("rain_entity",s(id,"0")),id);
for(const id of ["binary_sensor.fuite_eau","sensor.alerte_neige_verglas","sensor.alerte_canicule","sensor.bermerain_temperature_2","sensor.drainage"])
  assert.ok(!M("rain_entity",s(id,"0")),id);
assert.ok(!M("rain_entity",s("binary_sensor.sdb","off",{device_class:"moisture"})),"leak detector ≠ rain");
// Snow: neige / verglas / snow / ice only.
for(const id of ["sensor.alerte_neige_verglas","sensor.snow_depth","binary_sensor.ice_alert","sensor.verglas"])
  assert.ok(M("snow_entity",s(id,"0")),id);
for(const id of ["sensor.alerte_pluie_inondation","sensor.office_temperature","sensor.price","sensor.froid"])
  assert.ok(!M("snow_entity",s(id,"0")),id);

// Timestamp sensors (e.g. next rain) and "chance" / probability % are not rain or snow.
assert.ok(!M("rain_entity",s("sensor.bermerain_next_rain","2026-11-15T16:00:00+01:00",{device_class:"timestamp"})),"next_rain timestamp");
assert.ok(!M("rain_entity",s("sensor.bermerain_rain_chance","40",{unit_of_measurement:"%"})),"rain chance %");
assert.ok(!M("snow_entity",s("sensor.snow_chance","20",{unit_of_measurement:"%"})),"snow chance %");
assert.ok(!M("snow_entity",s("sensor.next_snow","2026-12-01T00:00:00+01:00",{device_class:"timestamp"})),"next_snow timestamp");
assert.ok(M("rain_entity",s("sensor.rain_rate","1",{device_class:"precipitation_intensity"})),"real rain still matches");

// Wind in km/h whatever the unit (sensor unit first, else the weather's wind_speed_unit).
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+" ≠ "+b);
near(V.toKmh(10,"km/h"),10);
near(V.toKmh(10,"m/s"),36);
near(V.toKmh(10,"mph"),16.09344);
near(V.toKmh(10,"kn"),18.52);
near(V.toKmh(10,"kt"),18.52);
near(V.toKmh(10,"ft/s"),10.9728);
near(V.toKmh(0,"Beaufort"),0);
near(V.toKmh(4,"Beaufort"),24);
near(V.toKmh(12,"Bft"),120);
near(V.toKmh(3.6,"Beaufort"),24); // force rounded, middle of its range
near(V.toKmh(25,""),25);
assert.equal(V.toKmh("x","m/s"),null);
near(V.windKmh(s("sensor.vent","5",{unit_of_measurement:"m/s"}),{wind_speed:99,wind_speed_unit:"km/h"}),18);
near(V.windKmh(null,{wind_speed:10,wind_speed_unit:"m/s"}),36);
near(V.windKmh(s("sensor.vent","unavailable",{unit_of_measurement:"m/s"}),{wind_speed:20,wind_speed_unit:"mph"}),32.18688);
near(V.windKmh(null,{wind_speed:30}),30);
assert.equal(V.windKmh(null,{}),null);
// 7 m/s (25.2 km/h) reaches the 25 km/h « windy » threshold; 7 km/h doesn't.
assert.ok(V.toKmh(7,"m/s")>=25&&V.toKmh(7,"km/h")<25);
assert.equal(V.entityName(s("sensor.x","1")),"sensor.x");
console.log("Sensor values (vigilance Vert/Jaune/Orange/Rouge, on/off, unknown text, warnings, moon detection, stricter filters, wind units) OK");
