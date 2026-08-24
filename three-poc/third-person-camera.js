import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function createLookStick(){
 let look=document.getElementById('camera-look-stick');
 if(!look){
  look=document.createElement('div');
  look.id='camera-look-stick';
  look.setAttribute('aria-label','Look around joystick');
  const knob=document.createElement('div');
  knob.id='camera-look-stick-knob';
  look.appendChild(knob);
  document.body.appendChild(look);
 }
 const knob=look.firstElementChild;
 Object.assign(look.style,{position:'fixed',right:'24px',bottom:'54px',width:'128px',height:'128px',borderRadius:'50%',border:'4px solid rgba(44,31,21,.95)',background:'rgba(39,61,35,.48)',boxShadow:'inset 0 0 0 12px rgba(132,111,61,.24)',pointerEvents:'auto',zIndex:'99999',display:'block',visibility:'visible',opacity:'1',touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none'});
 Object.assign(knob.style,{position:'absolute',left:'50%',top:'50%',width:'58px',height:'58px',transform:'translate(-50%,-50%)',borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#dbc27d,#8a6c3e 70%,#4c3928)',border:'4px solid #2c2118',boxShadow:'0 4px 8px rgba(0,0,0,.4)',boxSizing:'border-box',pointerEvents:'none'});
 if(!knob.dataset.eye){
  const eye=document.createElement('div');
  eye.textContent='👁';
  Object.assign(eye.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center',fontSize:'22px',opacity:'.78',pointerEvents:'none'});
  knob.appendChild(eye);knob.dataset.eye='1';
 }
 const old=document.getElementById('look-stick');if(old)old.style.display='none';
 return {look,knob};
}

function pointInside(el,x,y,pad=8){const r=el.getBoundingClientRect();return x>=r.left-pad&&x<=r.right+pad&&y>=r.top-pad&&y<=r.bottom+pad;}

export function installThirdPersonCamera({playerRoot}){
 if(!playerRoot)return null;
 const {look,knob}=createLookStick();
 let yaw=0,pitch=.035,lastCameraTime=performance.now();
 let activePointer=null,activeTouch=null,lastX=0,lastY=0,inputMode=null;
 const target=new THREE.Vector3(),desired=new THREE.Vector3(),lastPlayer=new THREE.Vector3().copy(playerRoot.position);
 const distance=4.65,targetHeight=1.55,cameraLift=.48,shoulderOffset=.32;

 function setKnob(clientX,clientY){
  const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.29;
  let dx=clientX-cx,dy=clientY-cy,l=Math.hypot(dx,dy)||1;
  if(l>max){dx=dx/l*max;dy=dy/l*max;}
  knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
 }
 function begin(x,y,mode,id){inputMode=mode;lastX=x;lastY=y;if(mode==='pointer')activePointer=id;else activeTouch=id;setKnob(x,y);}
 function drag(x,y){
  const dx=THREE.MathUtils.clamp(x-lastX,-60,60),dy=THREE.MathUtils.clamp(y-lastY,-60,60);
  lastX=x;lastY=y;
  yaw-=dx*.012;
  pitch=THREE.MathUtils.clamp(pitch-dy*.010,-.30,.46);
  setKnob(x,y);
 }
 function finish(){activePointer=null;activeTouch=null;inputMode=null;knob.style.transform='translate(-50%,-50%)';}

 // Capture at window level. This avoids Android/WebView losing events because another HUD element owns the target.
 window.addEventListener('pointerdown',e=>{
  if(activePointer!==null||activeTouch!==null)return;
  if(!pointInside(look,e.clientX,e.clientY))return;
  begin(e.clientX,e.clientY,'pointer',e.pointerId);
  e.preventDefault();e.stopPropagation();
 },{capture:true,passive:false});
 window.addEventListener('pointermove',e=>{
  if(inputMode!=='pointer'||e.pointerId!==activePointer)return;
  drag(e.clientX,e.clientY);e.preventDefault();e.stopPropagation();
 },{capture:true,passive:false});
 window.addEventListener('pointerup',e=>{if(inputMode==='pointer'&&e.pointerId===activePointer){finish();e.preventDefault();}},{capture:true,passive:false});
 window.addEventListener('pointercancel',e=>{if(inputMode==='pointer'&&e.pointerId===activePointer)finish();},{capture:true,passive:true});

 // Touch fallback for Android browsers that do not expose usable Pointer Events.
 window.addEventListener('touchstart',e=>{
  if(activePointer!==null||activeTouch!==null)return;
  for(const t of e.changedTouches){if(pointInside(look,t.clientX,t.clientY)){begin(t.clientX,t.clientY,'touch',t.identifier);e.preventDefault();e.stopPropagation();break;}}
 },{capture:true,passive:false});
 window.addEventListener('touchmove',e=>{
  if(inputMode!=='touch')return;
  for(const t of e.changedTouches){if(t.identifier===activeTouch){drag(t.clientX,t.clientY);e.preventDefault();e.stopPropagation();break;}}
 },{capture:true,passive:false});
 function endTouch(e){if(inputMode!=='touch')return;for(const t of e.changedTouches){if(t.identifier===activeTouch){finish();break;}}}
 window.addEventListener('touchend',endTouch,{capture:true,passive:true});
 window.addEventListener('touchcancel',endTouch,{capture:true,passive:true});

 // IMPORTANT: do not intercept playerRoot.position.set here. The legacy left joystick and collision
 // pipeline own player translation. Camera input must never modify the movement controller.

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
  const now=performance.now(),dt=Math.min((now-lastCameraTime)/1000,.05);lastCameraTime=now;
  target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
  const horizontal=Math.cos(pitch)*distance;
  const rightX=Math.cos(yaw)*shoulderOffset,rightZ=-Math.sin(yaw)*shoulderOffset;
  desired.set(target.x+Math.sin(yaw)*horizontal+rightX,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal+rightZ);
  camera.position.lerp(desired,1-Math.exp(-dt*22));
  camera.lookAt(target);
  if(Math.abs(camera.fov-54)>.01){camera.fov=54;camera.updateProjectionMatrix();}
  globalThis.__villagerCameraPosition={x:camera.position.x,y:camera.position.y,z:camera.position.z};

  const dx=playerRoot.position.x-lastPlayer.x,dz=playerRoot.position.z-lastPlayer.z;
  if(dx*dx+dz*dz>.000025&&!globalThis.__villagerHarvestTarget){
   const facing=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(facing-playerRoot.rotation.y),Math.cos(facing-playerRoot.rotation.y));
   playerRoot.rotation.y+=delta*(1-Math.exp(-dt*18));
  }
  lastPlayer.copy(playerRoot.position);
 }

 const api={active:true,applyCamera,get yaw(){return yaw;},get pitch(){return pitch;},lookStick:look};
 globalThis.__villagerThirdPersonCamera=api;
 return api;
}
