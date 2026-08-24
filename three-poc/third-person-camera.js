import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function createLookStick(){
 let look=document.getElementById('camera-look-stick');
 if(!look){
  look=document.createElement('div');look.id='camera-look-stick';look.setAttribute('aria-label','Look around joystick');
  const knob=document.createElement('div');knob.id='camera-look-stick-knob';look.appendChild(knob);document.body.appendChild(look);
 }
 const knob=look.firstElementChild;
 Object.assign(look.style,{position:'fixed',right:'24px',bottom:'54px',width:'128px',height:'128px',borderRadius:'50%',border:'4px solid rgba(44,31,21,.95)',background:'rgba(39,61,35,.48)',boxShadow:'inset 0 0 0 12px rgba(132,111,61,.24)',pointerEvents:'auto',zIndex:'99999',display:'block',visibility:'visible',opacity:'1',touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none'});
 Object.assign(knob.style,{position:'absolute',left:'50%',top:'50%',width:'58px',height:'58px',transform:'translate(-50%,-50%)',borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#dbc27d,#8a6c3e 70%,#4c3928)',border:'4px solid #2c2118',boxShadow:'0 4px 8px rgba(0,0,0,.4)',boxSizing:'border-box',pointerEvents:'none'});
 if(!knob.dataset.eye){const eye=document.createElement('div');eye.textContent='👁';Object.assign(eye.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center',fontSize:'22px',opacity:'.78',pointerEvents:'none'});knob.appendChild(eye);knob.dataset.eye='1';}
 const old=document.getElementById('look-stick');if(old)old.style.display='none';
 return {look,knob};
}

export function installThirdPersonCamera({playerRoot}){
 if(!playerRoot)return null;
 const {look,knob}=createLookStick();
 let yaw=0,pitch=.035,dragging=false,lastX=0,lastY=0,lastCameraTime=performance.now();
 const target=new THREE.Vector3(),desired=new THREE.Vector3(),lastPlayer=new THREE.Vector3().copy(playerRoot.position);
 const distance=4.65,targetHeight=1.55,cameraLift=.48,shoulderOffset=.32;

 function begin(x,y){dragging=true;lastX=x;lastY=y;knob.style.transform='translate(-50%,-50%) scale(1.08)';}
 function move(x,y){
  if(!dragging)return;
  let dx=x-lastX,dy=y-lastY;lastX=x;lastY=y;
  dx=THREE.MathUtils.clamp(dx,-45,45);dy=THREE.MathUtils.clamp(dy,-45,45);
  yaw-=dx*.0105;
  pitch=THREE.MathUtils.clamp(pitch-dy*.0085,-.28,.42);
  const kx=THREE.MathUtils.clamp(dx*1.3,-34,34),ky=THREE.MathUtils.clamp(dy*1.3,-34,34);
  knob.style.transform=`translate(calc(-50% + ${kx}px),calc(-50% + ${ky}px)) scale(1.08)`;
 }
 function end(){dragging=false;knob.style.transform='translate(-50%,-50%)';}

 // Native touch path is primary on Android. It updates camera angles directly from finger delta.
 look.addEventListener('touchstart',e=>{const t=e.touches[0];if(!t)return;begin(t.clientX,t.clientY);e.preventDefault();e.stopPropagation();},{passive:false});
 look.addEventListener('touchmove',e=>{const t=e.touches[0];if(!t)return;move(t.clientX,t.clientY);e.preventDefault();e.stopPropagation();},{passive:false});
 look.addEventListener('touchend',e=>{end();e.preventDefault();e.stopPropagation();},{passive:false});
 look.addEventListener('touchcancel',()=>end(),{passive:true});

 // Pointer path covers browsers/desktops without depending on global capture listeners.
 look.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;begin(e.clientX,e.clientY);try{look.setPointerCapture(e.pointerId);}catch{}e.preventDefault();e.stopPropagation();},{passive:false});
 look.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!dragging)return;move(e.clientX,e.clientY);e.preventDefault();},{passive:false});
 look.addEventListener('pointerup',e=>{if(e.pointerType==='touch')return;end();e.preventDefault();},{passive:false});
 look.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch')end();},{passive:true});

 const previousSet=playerRoot.position.set.bind(playerRoot.position);
 playerRoot.position.set=(x,y,z)=>{
  const dx=x-playerRoot.position.x,dz=z-playerRoot.position.z,step=Math.hypot(dx,dz);
  if(Math.abs(y)<.001&&step>0&&step<1.0){const c=Math.cos(yaw),s=Math.sin(yaw),rx=dx*c+dz*s,rz=-dx*s+dz*c;return previousSet(playerRoot.position.x+rx,y,playerRoot.position.z+rz);}
  return previousSet(x,y,z);
 };

 const originalRender=THREE.WebGLRenderer.prototype.render;
 if(!globalThis.__villagerThirdPersonRenderHook){
  THREE.WebGLRenderer.prototype.render=function(scene,camera){const ctrl=globalThis.__villagerThirdPersonCamera;if(ctrl?.active&&camera?.isPerspectiveCamera)ctrl.applyCamera(camera);return originalRender.call(this,scene,camera);};
  globalThis.__villagerThirdPersonRenderHook=true;
 }

 function applyCamera(camera){
  const now=performance.now(),dt=Math.min((now-lastCameraTime)/1000,.05);lastCameraTime=now;
  target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
  const horizontal=Math.cos(pitch)*distance,rightX=Math.cos(yaw)*shoulderOffset,rightZ=-Math.sin(yaw)*shoulderOffset;
  desired.set(target.x+Math.sin(yaw)*horizontal+rightX,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal+rightZ);
  camera.position.lerp(desired,1-Math.exp(-dt*22));camera.lookAt(target);
  if(Math.abs(camera.fov-54)>.01){camera.fov=54;camera.updateProjectionMatrix();}
  globalThis.__villagerCameraPosition={x:camera.position.x,y:camera.position.y,z:camera.position.z};
  const dx=playerRoot.position.x-lastPlayer.x,dz=playerRoot.position.z-lastPlayer.z;
  if(dx*dx+dz*dz>.000025&&!globalThis.__villagerHarvestTarget){const facing=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(facing-playerRoot.rotation.y),Math.cos(facing-playerRoot.rotation.y));playerRoot.rotation.y+=delta*(1-Math.exp(-dt*18));}
  lastPlayer.copy(playerRoot.position);
 }

 const api={active:true,applyCamera,get yaw(){return yaw;},get pitch(){return pitch;},lookStick:look};
 globalThis.__villagerThirdPersonCamera=api;
 return api;
}
