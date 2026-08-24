import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function getLookStick(){
  const look=document.getElementById('look-stick');
  const knob=document.getElementById('look-stick-knob');
  if(!look||!knob){
    console.warn('[The Villager] Look stick DOM missing');
    return null;
  }
  look.removeAttribute('aria-hidden');
  look.setAttribute('aria-label','Look around joystick');
  Object.assign(look.style,{display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto',touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',zIndex:'30'});
  knob.style.pointerEvents='none';
  return {look,knob};
}

export function installThirdPersonCamera({playerRoot}){
  if(!playerRoot){
    console.warn('[The Villager] Third-person camera unavailable: player missing');
    return null;
  }

  const stick=getLookStick();
  if(!stick)return null;
  const {look,knob}=stick;

  let camera=globalThis.__villagerCamera||null;
  let yaw=0;
  let pitch=.05;
  let pointerId=null;
  let touchId=null;
  let lastX=0,lastY=0;
  let appliedFrames=0;

  const target=new THREE.Vector3();
  const desired=new THREE.Vector3();
  const distance=5.15;
  const targetHeight=1.45;
  const cameraLift=.62;
  const shoulder=.28;

  function knobAt(clientX,clientY){
    const r=look.getBoundingClientRect();
    const cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.29;
    let dx=clientX-cx,dy=clientY-cy;
    const len=Math.hypot(dx,dy)||1;
    if(len>max){dx=dx/len*max;dy=dy/len*max;}
    knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  }

  function rotate(clientX,clientY){
    const dx=THREE.MathUtils.clamp(clientX-lastX,-80,80);
    const dy=THREE.MathUtils.clamp(clientY-lastY,-80,80);
    lastX=clientX;lastY=clientY;
    yaw-=dx*.014;
    pitch=THREE.MathUtils.clamp(pitch-dy*.011,-.34,.48);
    knobAt(clientX,clientY);
  }

  function resetStick(){
    pointerId=null;
    touchId=null;
    knob.style.transform='translate(-50%,-50%)';
  }

  // Primary path: Pointer Events. This is what current Android Chrome/WebView emits for touch.
  look.addEventListener('pointerdown',e=>{
    if(pointerId!==null)return;
    pointerId=e.pointerId;
    lastX=e.clientX;lastY=e.clientY;
    knobAt(lastX,lastY);
    try{look.setPointerCapture(e.pointerId);}catch{}
    e.preventDefault();
    e.stopPropagation();
  },{passive:false});

  look.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;
    rotate(e.clientX,e.clientY);
    e.preventDefault();
    e.stopPropagation();
  },{passive:false});

  const endPointer=e=>{
    if(e.pointerId!==pointerId)return;
    resetStick();
    e.preventDefault();
    e.stopPropagation();
  };
  look.addEventListener('pointerup',endPointer,{passive:false});
  look.addEventListener('pointercancel',endPointer,{passive:false});

  // Fallback only for browsers that do not expose PointerEvent.
  if(!('PointerEvent' in window)){
    look.addEventListener('touchstart',e=>{
      if(touchId!==null)return;
      const t=e.changedTouches[0];
      if(!t)return;
      touchId=t.identifier;
      lastX=t.clientX;lastY=t.clientY;
      knobAt(lastX,lastY);
      e.preventDefault();
      e.stopPropagation();
    },{passive:false});
    look.addEventListener('touchmove',e=>{
      for(const t of e.changedTouches){
        if(t.identifier!==touchId)continue;
        rotate(t.clientX,t.clientY);
        e.preventDefault();
        e.stopPropagation();
        break;
      }
    },{passive:false});
    const endTouch=e=>{
      for(const t of e.changedTouches){
        if(t.identifier===touchId){resetStick();break;}
      }
    };
    look.addEventListener('touchend',endTouch,{passive:true});
    look.addEventListener('touchcancel',endTouch,{passive:true});
  }

  function apply(cameraRef){
    if(!cameraRef?.isPerspectiveCamera)return;
    camera=cameraRef;
    target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
    const horizontal=Math.cos(pitch)*distance;
    const sideX=Math.cos(yaw)*shoulder;
    const sideZ=-Math.sin(yaw)*shoulder;
    desired.set(
      target.x+Math.sin(yaw)*horizontal+sideX,
      target.y+cameraLift+Math.sin(pitch)*distance,
      target.z+Math.cos(yaw)*horizontal+sideZ
    );
    cameraRef.position.copy(desired);
    cameraRef.lookAt(target);
    if(Math.abs(cameraRef.fov-52)>.01){
      cameraRef.fov=52;
      cameraRef.updateProjectionMatrix();
    }
    appliedFrames++;
    globalThis.__villagerCameraAppliedFrames=appliedFrames;
    globalThis.__villagerCameraPosition={x:cameraRef.position.x,y:cameraRef.position.y,z:cameraRef.position.z};
  }

  const api={
    active:true,
    apply,
    get camera(){return camera;},
    get yaw(){return yaw;},
    get pitch(){return pitch;},
    lookStick:look
  };
  globalThis.__villagerThirdPersonCamera=api;
  return api;
}
