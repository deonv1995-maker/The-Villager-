import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export function installThirdPersonCamera({playerRoot}){
 if(!playerRoot)return null;
 const look=document.getElementById('look-stick'),knob=document.getElementById('look-stick-knob');
 if(look){look.style.display='block';look.style.pointerEvents='auto';}
 let yaw=0,pitch=.12,pointer=null,sx=0,sy=0,last=performance.now();
 const target=new THREE.Vector3(),desired=new THREE.Vector3(),lastPlayer=new THREE.Vector3().copy(playerRoot.position);
 const distance=6.7,targetHeight=1.55,cameraLift=1.15;

 function updateStick(e){
  if(!look)return;const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;
  let dx=e.clientX-cx,dy=e.clientY-cy,l=Math.hypot(dx,dy)||1;if(l>max){dx=dx/l*max;dy=dy/l*max;}
  sx=dx/max;sy=dy/max;if(knob)knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
 }
 look?.addEventListener('pointerdown',e=>{pointer=e.pointerId;look.setPointerCapture?.(pointer);updateStick(e);e.preventDefault();e.stopPropagation();});
 addEventListener('pointermove',e=>{if(e.pointerId===pointer)updateStick(e);});
 function release(e){if(e.pointerId!==pointer)return;pointer=null;sx=sy=0;if(knob)knob.style.transform='translate(-50%,-50%)';}
 addEventListener('pointerup',release);addEventListener('pointercancel',release);

 // Camera-relative movement: install after world collision so collision checks the final rotated destination.
 const previousSet=playerRoot.position.set.bind(playerRoot.position);
 playerRoot.position.set=(x,y,z)=>{
  const dx=x-playerRoot.position.x,dz=z-playerRoot.position.z,step=Math.hypot(dx,dz);
  if(Math.abs(y)<.001&&step>0&&step<1.0){
   const c=Math.cos(yaw),s=Math.sin(yaw),rx=dx*c+dz*s,rz=-dx*s+dz*c;
   return previousSet(playerRoot.position.x+rx,y,playerRoot.position.z+rz);
  }
  return previousSet(x,y,z);
 };

 // The legacy runtime owns renderer.render(). Override camera pose immediately before each draw,
 // so the old isometric follow code cannot win the frame.
 const originalRender=THREE.WebGLRenderer.prototype.render;
 if(!globalThis.__villagerThirdPersonRenderHook){
  THREE.WebGLRenderer.prototype.render=function(scene,camera){
   const ctrl=globalThis.__villagerThirdPersonCamera;
   if(ctrl?.active&&camera?.isPerspectiveCamera)ctrl.applyCamera(camera);
   return originalRender.call(this,scene,camera);
  };
  globalThis.__villagerThirdPersonRenderHook=true;
 }

 function applyCamera(camera){
  const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
  yaw-=sx*2.05*dt;pitch=THREE.MathUtils.clamp(pitch-sy*1.18*dt,-.10,.46);
  target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
  const horizontal=Math.cos(pitch)*distance;
  desired.set(target.x+Math.sin(yaw)*horizontal,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal);
  camera.position.lerp(desired,1-Math.exp(-dt*18));camera.lookAt(target);
  camera.fov=48;camera.updateProjectionMatrix();
  globalThis.__villagerCameraPosition={x:camera.position.x,y:camera.position.y,z:camera.position.z};

  const dx=playerRoot.position.x-lastPlayer.x,dz=playerRoot.position.z-lastPlayer.z;
  if(dx*dx+dz*dz>.000025&&!globalThis.__villagerHarvestTarget){
   const facing=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(facing-playerRoot.rotation.y),Math.cos(facing-playerRoot.rotation.y));
   playerRoot.rotation.y+=delta*(1-Math.exp(-dt*18));
  }
  lastPlayer.copy(playerRoot.position);
 }

 const api={active:true,applyCamera,get yaw(){return yaw;},get pitch(){return pitch;}};
 globalThis.__villagerThirdPersonCamera=api;
 return api;
}
