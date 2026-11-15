/**
 * Immersive 3D weather for the Maison 3D property.
 * Uses condition events from the verified Home Assistant weather bridge.
 * Particles live in 3D (not a photographic overlay), so orbiting retains depth.
 */
import {motionLevel} from "./motion-level.js";

export function createWorldAmbience({THREE,scene,sun}) {
  const COUNT=680;
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(COUNT*3);
  const velocities=new Float32Array(COUNT);
  const phases=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){
    positions[i*3]=Math.random()*92-46;
    positions[i*3+1]=1+Math.random()*28;
    positions[i*3+2]=Math.random()*75-37.5;
    velocities[i]=.6+Math.random()*1.6;
    phases[i]=Math.random()*Math.PI*2;
  }
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({
    color:0xd9eeff,size:.13,transparent:true,opacity:.75,
    depthWrite:false,sizeAttenuation:true
  });
  const particles=new THREE.Points(geometry,material);
  particles.frustumCulled=false;particles.visible=false;scene.add(particles);
  const season=(month)=>{
    if([11,0,1].includes(month))return "winter";
    if([2,3,4].includes(month))return "spring";
    if([5,6,7].includes(month))return "summer";
    return "autumn";
  };
  let weather="unknown",sunState=null,wind=0,kind="none",last=0;
  const lampMat=new THREE.MeshStandardMaterial({
    color:0xffcc84,emissive:0xffaf58,emissiveIntensity:.15,roughness:.3
  });
  const lampGroup=new THREE.Group();
  scene.add(lampGroup);
  for(const [x,y,z] of [[-20,3,19],[-5,3,20],[12,3,20],[26,3,13],[34,3,8]]){
    const pole=new THREE.Mesh(
      new THREE.CylinderGeometry(.055,.085,2.6,8),
      new THREE.MeshStandardMaterial({color:0x303a40,metalness:.65,roughness:.45})
    );
    pole.position.set(x,y-1.3,z);lampGroup.add(pole);
    const fixture=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),lampMat);
    fixture.position.set(x,y,z);lampGroup.add(fixture);
  }
  const ambientGlow=new THREE.PointLight(0xffae69,0,70,1.85);
  ambientGlow.position.set(0,8,7);scene.add(ambientGlow);
  const baseSky=new THREE.Color(0x89b7e7);
  const cloudySky=new THREE.Color(0x9eabb7);
  const fogShade=new THREE.Color();
  function update(detail={}) {
    weather=String(detail.weather||"unknown").toLowerCase();
    sunState=detail.sun||null;
    wind=Number.isFinite(detail.windSpeed)?Math.min(Math.max(detail.windSpeed,0),90):0;
    if(/snow|hail/.test(weather))kind="snow";
    else if(/rain|pouring|lightning|storm/.test(weather))kind="rain";
    else if(season(new Date().getMonth())==="autumn")kind="leaves";
    else kind="none";
    particles.visible=kind!=="none";
    material.color.set(kind==="leaves"?0xc87b2a:kind==="snow"?0xf2f7ff:0x9ccdf0);
    material.size=kind==="leaves"?.32:kind==="snow"?.17:.095;
    material.opacity=kind==="rain"?.55:.85;
    const now=new Date(),hour=now.getHours()+now.getMinutes()/60;
    const night=sunState==="below_horizon" || (!sunState&&(hour>=20||hour<7));
    const cloudy=/cloud|fog|rain|snow|storm|pouring/.test(weather);
    lampMat.emissiveIntensity=night?2.8:.08;
    ambientGlow.intensity=night?4.5:.15;
    sun.color.set(night?0xb0c7ff:hour>=17?0xffba83:0xffe6ba);
    sun.position.set(-16+Math.cos((hour-6)/12*Math.PI)*24,night?7:30,15);
    if(scene.fog){
      fogShade.copy(cloudy?cloudySky:baseSky);
      if(night)fogShade.multiplyScalar(.25);
      scene.fog.color.copy(fogShade);
      scene.fog.near=cloudy?24:45;
      scene.fog.far=cloudy?92:140;
    }
  }
  window.addEventListener("maison3d:weather",event=>update(event.detail));
  update();
  function frame(time) {
    if(!particles.visible)return;
    const level=motionLevel();
    if(level===0)return;
    if(time-last<30)return;
    const dt=Math.min((time-last)/1000||.033,.07)*level;
    last=time;
    const pos=geometry.attributes.position;
    const used=level<1?Math.max(3,Math.round(COUNT*level)):COUNT;
    for(let i=0;i<used;i++){
      let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const speed=velocities[i],swirl=Math.sin(time*.0014+phases[i]);
      y-=dt*speed*(kind==="rain"?19:kind==="snow"?2.1:1.8);
      x+=dt*(kind==="rain"?.8:swirl*.5)+(wind*.008*dt);
      z+=dt*(kind==="leaves"?Math.cos(time*.001+phases[i]):0)*.5;
      if(y<.02){y=15+Math.random()*15;x=Math.random()*92-46;z=Math.random()*75-37.5}
      if(x>47)x=-46;
      pos.setXYZ(i,x,y,z);
    }
    pos.needsUpdate=true;
  }
  return {frame,update};
}
