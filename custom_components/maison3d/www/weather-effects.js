/**
 * Maison 3D weather / solar ambience.
 * Real Home Assistant conditions are supplied by parent panel via postMessage.
 * Local clock + seasonal effects are fallbacks, never marketed as actual weather.
 */
import {motionLevel,motionCount} from "./motion-level.js";

export function createAtmosphere({scene, sun, renderer}) {
  const canvas = document.createElement("canvas");
  canvas.id = "maison3d-weather-overlay";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position:"fixed", inset:"0", width:"100%", height:"100%",
    pointerEvents:"none", zIndex:"1"
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const status = document.createElement("div");
  status.id = "maison3d-weather-status";
  status.setAttribute("role","status");
  Object.assign(status.style, {
    position:"fixed",top:"82px",right:"12px",zIndex:"3",
    background:"#101923e8",color:"#fff",borderRadius:"12px",
    padding:"9px 13px",font:"12px system-ui,sans-serif",
    maxWidth:"260px",backdropFilter:"blur(10px)"
  });
  document.body.appendChild(status);
  let live = null;
  let manualWeather = null;
  let manualTime = null;
  let particles = [];
  let lastFrame = 0;
  const bg = scene.background;
  const fallbackSeason = () => {
    const month = new Date().getMonth();
    if ([11,0,1].includes(month)) return "winter";
    if ([2,3,4].includes(month)) return "spring";
    if ([5,6,7].includes(month)) return "summer";
    return "autumn";
  };
  const isNight = () => {
    if (manualTime) return manualTime === "night";
    if (live?.sun === "below_horizon") return true;
    if (live?.sun === "above_horizon") return false;
    const hour = new Date().getHours();
    return hour < 7 || hour >= 20;
  };
  const isEvening = () => {
    if (manualTime) return manualTime === "evening";
    const hour = new Date().getHours();
    return !isNight() && hour >= 17;
  };
  const mode = () => {
    const condition = (manualWeather ?? live?.weather ?? "").toLowerCase();
    if (/snow|hail/.test(condition)) return "snow";
    if (/rain|pouring|lightning|storm/.test(condition)) return "rain";
    if (manualWeather) return "clear";
    return fallbackSeason() === "autumn" ? "leaves" : "clear";
  };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize", resize);
  resize();
  function update() {
    const night = isNight(), evening = isEvening();
    const condition = (manualWeather ?? live?.weather ?? "").toLowerCase();
    const cloudy = /cloud|fog|overcast/.test(condition);
    const color = night ? 0x0d1930 : evening ? 0xf0a878 : cloudy ? 0xa6b6c5 : 0x89b7e7;
    bg.set(color);
    if (scene.fog) scene.fog.color.set(color);
    sun.intensity = night ? 0.14 : evening ? 1.5 : cloudy ? 1.15 : 3;
    renderer.toneMappingExposure = night ? 0.6 : evening ? 0.85 : 1;
    const temp = typeof live?.temperature === "number" ? live.temperature+"°C · " : "";
    const display = manualWeather ? "Simulation "+manualWeather : live?.weather || "Météo non connectée";
    const source = manualWeather || manualTime ? "Aperçu manuel" : live?.weather ? "Home Assistant" : "Simulation locale";
    const light = night ? "Nuit" : evening ? "Soir" : "Jour";
    status.textContent = "☁ "+temp+display+" · "+light+" · "+source;
    window.dispatchEvent(new CustomEvent("maison3d:weather", {detail:{
      weather: manualWeather ?? live?.weather ?? null,
      sun: manualTime === "night" ? "below_horizon" : manualTime ? "above_horizon" : live?.sun ?? null,
      windSpeed: live?.windSpeed ?? 0
    }}));
  }
  function setLive(payload) {
    live = {
      weather: typeof payload.weather === "string" ? payload.weather : null,
      sun: payload.sun === "above_horizon" || payload.sun === "below_horizon" ? payload.sun : null,
      temperature: typeof payload.temperature === "number" && Number.isFinite(payload.temperature) ? payload.temperature : null,
      windSpeed: typeof payload.windSpeed === "number" && Number.isFinite(payload.windSpeed) ? payload.windSpeed : 0
    };
    update();
  }
  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (event.data?.type !== "maison3d:conditions") return;
    setLive(event.data);
  });
  function spawn() {
    return {
      x: Math.random()*window.innerWidth,
      y: -Math.random()*window.innerHeight,
      speed: 0.65+Math.random()*1.5,
      sway: Math.random()*Math.PI*2
    };
  }
  function frame(now) {
    if (now-lastFrame < 30) return;
    lastFrame=now;
    const w=window.innerWidth,h=window.innerHeight;
    ctx.clearRect(0,0,w,h);
    const weather=mode();
    const level=motionLevel();
    const count=motionCount(weather==="rain"?180:weather==="snow"?110:weather==="leaves"?35:0);
    while(particles.length<count) particles.push(spawn());
    particles.length=count;
    for(const particle of particles) {
      const x=particle.x, y=particle.y;
      if(weather==="rain") {
        ctx.strokeStyle="#c8e7ff99";ctx.lineWidth=1.3;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+13);ctx.stroke();
        particle.y+=particle.speed*8*level;particle.x+=1.4*level;
      } else if(weather==="snow") {
        ctx.fillStyle="#f1f7ffdf";
        ctx.beginPath();ctx.arc(x,y,1.2+particle.speed,0,Math.PI*2);ctx.fill();
        particle.y+=particle.speed*1.3*level;particle.x+=Math.sin(now*.001+particle.sway)*0.6*level;
      } else if(weather==="leaves") {
        ctx.save();ctx.translate(x,y);ctx.rotate((now*.001*level)+particle.sway);
        ctx.fillStyle=["#b96c20","#e6ad42","#bf4c19"][Math.floor(particle.sway*3)%3];
        ctx.fillRect(-3,-5,6,10);ctx.restore();
        particle.y+=particle.speed*1.35*level;particle.x+=Math.sin(now*.001+particle.sway)*1.3*level;
      }
      if(particle.y>h+15 || particle.x>w+15 || particle.x < -15) {
        Object.assign(particle,spawn());particle.y=-15;
      }
    }
  }
  document.querySelectorAll("[data-time]").forEach(button => {
    button.addEventListener("click",() => {
      manualTime = button.dataset.time;
      document.querySelectorAll("[data-time]").forEach(el => el.classList.remove("on"));
      button.classList.add("on");
      update();
    });
  });
  const weatherButton=document.getElementById("weather");
  if(weatherButton) {
    weatherButton.title="Prévisualiser pluie, neige, soleil (clic pour changer)";
    weatherButton.addEventListener("click",() => {
      manualWeather=manualWeather===null?"rain":manualWeather==="rain"?"snow":manualWeather==="snow"?"sunny":null;
      update();
    });
  }
  const autoButton=document.createElement("button");
  autoButton.textContent="◉ Auto";
  autoButton.title="Suivre automatiquement Home Assistant / le soleil";
  autoButton.classList.add("on");
  autoButton.onclick=() => {
    manualTime=null;manualWeather=null;
    document.querySelectorAll("[data-time]").forEach(el => el.classList.remove("on"));
    autoButton.classList.add("on");
    update();
  };
  document.querySelector(".modes")?.appendChild(autoButton);
  document.querySelectorAll("[data-time]").forEach(button => button.addEventListener("click",() => autoButton.classList.remove("on")));
  setInterval(update,60000);
  update();
  return {frame, update, setLive};
}
