import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export function installThirdPersonCamera({playerRoot,camera=null}){
  if(!playerRoot)return null;
  let look=document.getElementById('look-stick');
  let knob=document.getElementById('look-stick-knob');
  if(!look){look=document.createElement('div');look.id='look-stick';document.body.appendChild(look)}
  if(!knob){knob=document.createElement('div');knob.id='look-stick-knob';look.appendChild(knob)}
  look.classList.remove('hidden');
  Object.assign(look.style,{display:'block',visibility:'visible',pointerEvents:'auto',touchAction:'none',zIndex:'10000'});

  let yaw=0,pitch=.08,activeId=null;
  const target=new THREE.Vector3(),desired=new THREE.Vector3();
  const distance=5.15,targetHeight=1.45,cameraLift=.62,shoulder=.28;
  let ownedCamera=camera;

  function getCamera(fallback=null){
    if(fallback?.isPerspectiveCamera)ownedCamera=fallback;
    else if(!ownedCamera?.isPerspectiveCamera&&globalThis.__villagerCamera?.isPerspectiveCamera)ownedCamera=globalThis.__villagerCamera;
    return ownedCamera;
  }
  function apply(fallback=null){
    const cam=getCamera(fallback);if(!cam)return;
    target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
    const horizontal=Math.cos(pitch)*distance;
    desired.set(target.x+Math.sin(yaw)*horizontal+Math.cos(yaw)*shoulder,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal-Math.sin(yaw)*shoulder);
    cam.position.copy(desired);cam.lookAt(target);
    if(Math.abs(cam.fov-52)>.01){cam.fov=52;cam.updateProjectionMatrix()}
    globalThis.__villagerCameraPosition={x:cam.position.x,y:cam.position.y,z:cam.position.z};
  }
  function updateKnob(x,y){
    const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.31;
    let dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy)||1;if(l>max){dx=dx/l*max;dy=dy/l*max}
    knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    return {x:dx/max,y:dy/max};
  }
  function inside(x,y){const r=look.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom}
  function begin(id,x,y,e){if(activeId!==null||!inside(x,y))return false;activeId=id;updateKnob(x,y);e?.preventDefault?.();e?.stopPropagation?.();return true}
  function move(id,x,y,e){if(id!==activeId)return false;const v=updateKnob(x,y);yaw-=v.x*.055;pitch=THREE.MathUtils.clamp(pitch-v.y*.04,-.34,.48);apply();e?.preventDefault?.();e?.stopPropagation?.();return true}
  function end(id,e){if(id!==activeId)return false;activeId=null;knob.style.transform='translate(-50%,-50%)';e?.preventDefault?.();e?.stopPropagation?.();return true}

  // Pointer Events are the primary mobile path. Capture on window means the legacy
  // movement joystick cannot steal the second pointer, while the pointer id keeps both
  // thumbsticks independent during simultaneous movement + camera use.
  window.addEventListener('pointerdown',e=>begin(e.pointerId,e.clientX,e.clientY,e),{capture:true,passive:false});
  window.addEventListener('pointermove',e=>move(e.pointerId,e.clientX,e.clientY,e),{capture:true,passive:false});
  window.addEventListener('pointerup',e=>end(e.pointerId,e),{capture:true,passive:false});
  window.addEventListener('pointercancel',e=>end(e.pointerId,e),{capture:true,passive:false});

  // Fallback only for WebViews that expose touch but no PointerEvent implementation.
  if(!('PointerEvent' in window)){
    window.addEventListener('touchstart',e=>{for(const t of e.changedTouches)if(begin(`t${t.identifier}`,t.clientX,t.clientY,e))break},{capture:true,passive:false});
    window.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(move(`t${t.identifier}`,t.clientX,t.clientY,e))break},{capture:true,passive:false});
    window.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(end(`t${t.identifier}`,e))break},{capture:true,passive:false});
    window.addEventListener('touchcancel',e=>{for(const t of e.changedTouches)if(end(`t${t.identifier}`,e))break},{capture:true,passive:false});
  }

  const api={active:true,apply,get yaw(){return yaw},get pitch(){return pitch},lookStick:look};
  globalThis.__villagerThirdPersonCamera=api;
  apply();
  return api;
}
