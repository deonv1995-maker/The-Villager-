import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function ensureLookStick(){
  let look=document.getElementById('look-stick');
  let knob=document.getElementById('look-stick-knob');
  if(!look){look=document.createElement('div');look.id='look-stick';document.getElementById('hud')?.appendChild(look)??document.body.appendChild(look)}
  if(!knob){knob=document.createElement('div');knob.id='look-stick-knob';look.appendChild(knob)}
  look.classList.remove('hidden');look.removeAttribute('aria-hidden');look.setAttribute('aria-label','Look around');
  look.style.setProperty('display','block','important');look.style.setProperty('visibility','visible','important');look.style.setProperty('pointer-events','auto','important');look.style.setProperty('touch-action','none','important');look.style.setProperty('z-index','10000','important');
  return {look,knob};
}

export function installThirdPersonCamera({playerRoot,camera=null}){
  if(!playerRoot)return null;
  const {look,knob}=ensureLookStick();
  let yaw=0,pitch=.05,activeTouch=null,activePointer=null,lastX=0,lastY=0,appliedFrames=0;
  const target=new THREE.Vector3(),desired=new THREE.Vector3();
  const distance=5.15,targetHeight=1.45,cameraLift=.62,shoulder=.28;

  function liveCamera(fallback=null){return fallback||camera||globalThis.__villagerCamera||null}
  function apply(cam=liveCamera()){
    if(!cam?.isPerspectiveCamera)return;
    target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
    const horizontal=Math.cos(pitch)*distance,sideX=Math.cos(yaw)*shoulder,sideZ=-Math.sin(yaw)*shoulder;
    desired.set(target.x+Math.sin(yaw)*horizontal+sideX,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal+sideZ);
    cam.position.copy(desired);cam.lookAt(target);
    if(Math.abs(cam.fov-52)>.01){cam.fov=52;cam.updateProjectionMatrix()}
    globalThis.__villagerCameraAppliedFrames=++appliedFrames;
  }
  function knobAt(x,y){const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.30;let dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy)||1;if(l>max){dx=dx/l*max;dy=dy/l*max}knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`}
  function rotate(x,y){const dx=THREE.MathUtils.clamp(x-lastX,-100,100),dy=THREE.MathUtils.clamp(y-lastY,-100,100);lastX=x;lastY=y;yaw-=dx*.014;pitch=THREE.MathUtils.clamp(pitch-dy*.011,-.34,.48);knobAt(x,y);apply()}
  function reset(){activeTouch=null;activePointer=null;knob.style.transform='translate(-50%,-50%)'}

  // Android/WebView path. Touch events are isolated to this control and tracked on
  // document capture so the legacy left-stick pointer listeners cannot steal the drag.
  look.addEventListener('touchstart',e=>{if(activeTouch!==null)return;const t=e.changedTouches[0];if(!t)return;activeTouch=t.identifier;lastX=t.clientX;lastY=t.clientY;knobAt(lastX,lastY);e.preventDefault();e.stopImmediatePropagation()},{passive:false,capture:true});
  document.addEventListener('touchmove',e=>{if(activeTouch===null)return;const t=[...e.changedTouches].find(v=>v.identifier===activeTouch)||[...e.touches].find(v=>v.identifier===activeTouch);if(!t)return;rotate(t.clientX,t.clientY);e.preventDefault();e.stopImmediatePropagation()},{passive:false,capture:true});
  document.addEventListener('touchend',e=>{if(activeTouch===null)return;if([...e.changedTouches].some(v=>v.identifier===activeTouch)){reset();e.preventDefault();e.stopImmediatePropagation()}},{passive:false,capture:true});
  document.addEventListener('touchcancel',e=>{if(activeTouch!==null)reset()},{passive:false,capture:true});

  // Mouse/pen fallback. Ignore touch pointers because Android is handled above.
  look.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||activePointer!==null)return;activePointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;knobAt(lastX,lastY);try{look.setPointerCapture(e.pointerId)}catch{}e.preventDefault();e.stopImmediatePropagation()},{passive:false,capture:true});
  look.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||e.pointerId!==activePointer)return;rotate(e.clientX,e.clientY);e.preventDefault();e.stopImmediatePropagation()},{passive:false,capture:true});
  look.addEventListener('pointerup',e=>{if(e.pointerId===activePointer)reset()},{passive:false,capture:true});
  look.addEventListener('pointercancel',e=>{if(e.pointerId===activePointer)reset()},{passive:false,capture:true});

  const api={active:true,apply,get yaw(){return yaw},get pitch(){return pitch},lookStick:look};
  globalThis.__villagerThirdPersonCamera=api;
  apply();
  return api;
}
