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
  Object.assign(knob.style,{position:'absolute',left:'50%',top:'50%',width:'58px',height:'58px',transform:'translate(-50%,-50%)',borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#dbc27d,#8a6c3e 70%,#4c3928)',border:'4px solid #2c2118',boxSizing:'border-box',pointerEvents:'none'});
  if(!knob.dataset.eye){
    const eye=document.createElement('div');
    eye.textContent='👁';
    Object.assign(eye.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center',fontSize:'22px',pointerEvents:'none'});
    knob.appendChild(eye);
    knob.dataset.eye='1';
  }
  const old=document.getElementById('look-stick');
  if(old)old.style.display='none';
  return {look,knob};
}

export function installThirdPersonCamera({playerRoot}){
  const camera=globalThis.__villagerCamera;
  if(!playerRoot||!camera){
    console.warn('[The Villager] Third-person camera unavailable',{player:!!playerRoot,camera:!!camera});
    return null;
  }

  const {look,knob}=createLookStick();
  let yaw=0,pitch=.035,activePointer=null,lastX=0,lastY=0;
  const target=new THREE.Vector3(),desired=new THREE.Vector3();
  const distance=4.65,targetHeight=1.55,cameraLift=.48,shoulder=.32;

  function knobAt(x,y){
    const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.29;
    let dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy)||1;
    if(l>max){dx=dx/l*max;dy=dy/l*max;}
    knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  }
  function begin(e){
    if(activePointer!==null)return;
    activePointer=e.pointerId;
    lastX=e.clientX;lastY=e.clientY;
    knobAt(lastX,lastY);
    try{look.setPointerCapture(e.pointerId);}catch{}
    e.preventDefault();e.stopPropagation();
  }
  function move(e){
    if(e.pointerId!==activePointer)return;
    const dx=THREE.MathUtils.clamp(e.clientX-lastX,-60,60),dy=THREE.MathUtils.clamp(e.clientY-lastY,-60,60);
    lastX=e.clientX;lastY=e.clientY;
    yaw-=dx*.012;
    pitch=THREE.MathUtils.clamp(pitch-dy*.010,-.30,.46);
    knobAt(lastX,lastY);
    e.preventDefault();e.stopPropagation();
  }
  function end(e){
    if(e.pointerId!==activePointer)return;
    activePointer=null;
    knob.style.transform='translate(-50%,-50%)';
    e.preventDefault();e.stopPropagation();
  }

  // Pointer Events include touch on modern Android. Use one input path only so the same
  // finger cannot be processed twice by pointer + touch event streams.
  look.addEventListener('pointerdown',begin,{passive:false});
  look.addEventListener('pointermove',move,{passive:false});
  look.addEventListener('pointerup',end,{passive:false});
  look.addEventListener('pointercancel',end,{passive:false});

  function apply(cameraRef){
    target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
    const h=Math.cos(pitch)*distance,rx=Math.cos(yaw)*shoulder,rz=-Math.sin(yaw)*shoulder;
    desired.set(target.x+Math.sin(yaw)*h+rx,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*h+rz);
    cameraRef.position.copy(desired);
    cameraRef.lookAt(target);
    if(Math.abs(cameraRef.fov-54)>.01){cameraRef.fov=54;cameraRef.updateProjectionMatrix();}
    globalThis.__villagerCameraPosition={x:cameraRef.position.x,y:cameraRef.position.y,z:cameraRef.position.z};
  }

  const api={active:true,camera,apply,get yaw(){return yaw;},get pitch(){return pitch;},lookStick:look};
  globalThis.__villagerThirdPersonCamera=api;
  return api;
}
