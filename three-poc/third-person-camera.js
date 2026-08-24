import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function createLookStick(){
 let look=document.getElementById('camera-look-stick');
 if(!look){
  look=document.createElement('div');look.id='camera-look-stick';look.setAttribute('aria-label','Look around joystick');
  const knob=document.createElement('div');knob.id='camera-look-stick-knob';look.appendChild(knob);document.body.appendChild(look);
 }
 const knob=look.firstElementChild;
 Object.assign(look.style,{position:'fixed',right:'24px',bottom:'54px',width:'128px',height:'128px',borderRadius:'50%',border:'4px solid rgba(44,31,21,.95)',background:'rgba(39,61,35,.48)',boxShadow:'inset 0 0 0 12px rgba(132,111,61,.24)',pointerEvents:'auto',zIndex:'9999',display:'block',visibility:'visible',opacity:'1',touchAction:'none'});
 Object.assign(knob.style,{position:'absolute',left:'50%',top:'50%',width:'58px',height:'58px',transform:'translate(-50%,-50%)',borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#dbc27d,#8a6c3e 70%,#4c3928)',border:'4px solid #2c2118',boxShadow:'0 4px 8px rgba(0,0,0,.4)',boxSizing:'border-box'});
 if(!knob.dataset.eye){const eye=document.createElement('div');eye.textContent='👁';Object.assign(eye.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center',fontSize:'22px',opacity:'.78',pointerEvents:'none'});knob.appendChild(eye);knob.dataset.eye='1';}
 const old=document.getElementById('look-stick');if(old)old.style.display='none';
 return {look,knob};
}

export function installThirdPersonCamera({playerRoot}){
 if(!playerRoot)return null;
 const {look,knob}=createLookStick();
 let yaw=0,pitch=.035,pointer=null,sx=0,sy=0,last=performance.now();
 const target=new THREE.Vector3(),desired=new THREE.Vector3(),lastPlayer=new THREE.Vector3().copy(playerRoot.position);
 const distance=4.65,targetHeight=1.55,cameraLift=.48,shoulderOffset=.32;

 function updateStick(e){const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;let dx=e.clientX-cx,dy=e.clientY-cy,l=Math.hypot(dx,dy)||1;if(l>max){dx=dx/l*max;dy=dy/l*max;}sx=dx/max;sy=dy/max;knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
 look.addEventListener('pointerdown',e=>{pointer=e.pointerId;look.setPointerCapture?.(pointer);updateStick(e);e.preventDefault();e.stopPropagation();});
 addEventListener('pointermove',e=>{if(e.pointerId===pointer)updateStick(e);});
 function release(e){if(e.pointerId!==pointer)return;pointer=null;sx=sy=0;knob.style.transform='translate(-50%,-50%)';}
 addEventListener('pointerup',release);addEventListener('pointercancel',release);

 const previousSet=playerRoot.position.set.bind(playerRoot.position);
 playerRoot.position.set=(x,y,z)=>{const dx=x-playerRoot.position.x,dz=z-playerRoot.position.z,step=Math.hypot(dx,dz);if(Math.abs(y)<.001&&step>0&&step<1.0){const c=Math.cos(yaw),s=Math.sin(yaw),rx=dx*c+dz*s,rz=-dx*s+dz*c;return previousSet(playerRoot.position.x+rx,y,playerRoot.position.z+rz);}return previousSet(x,y,z);};

 const originalRender=THREE.WebGLRenderer.prototype.render;
 if(!globalThis.__villagerThirdPersonRenderHook){THREE.WebGLRenderer.prototype.render=function(scene,camera){const ctrl=globalThis.__villagerThirdPersonCamera;if(ctrl?.active&&camera?.isPerspectiveCamera)ctrl.applyCamera(camera);return originalRender.call(this,scene,camera);};globalThis.__villagerThirdPersonRenderHook=true;}

 function applyCamera(camera){
  const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;yaw-=sx*2.15*dt;pitch=THREE.MathUtils.clamp(pitch-sy*1.05*dt,-.12,.34);
  target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);const horizontal=Math.cos(pitch)*distance,rightX=Math.cos(yaw)*shoulderOffset,rightZ=-Math.sin(yaw)*shoulderOffset;
  desired.set(target.x+Math.sin(yaw)*horizontal+rightX,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal+rightZ);camera.position.lerp(desired,1-Math.exp(-dt*20));camera.lookAt(target);
  if(Math.abs(camera.fov-54)>.01){camera.fov=54;camera.updateProjectionMatrix();}
  globalThis.__villagerCameraPosition={x:camera.position.x,y:camera.position.y,z:camera.position.z};
  const dx=playerRoot.position.x-lastPlayer.x,dz=playerRoot.position.z-lastPlayer.z;if(dx*dx+dz*dz>.000025&&!globalThis.__villagerHarvestTarget){const facing=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(facing-playerRoot.rotation.y),Math.cos(facing-playerRoot.rotation.y));playerRoot.rotation.y+=delta*(1-Math.exp(-dt*18));}lastPlayer.copy(playerRoot.position);
 }

 const api={active:true,applyCamera,get yaw(){return yaw;},get pitch(){return pitch;},lookStick:look};globalThis.__villagerThirdPersonCamera=api;return api;
}
