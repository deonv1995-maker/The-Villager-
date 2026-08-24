import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function ensureLookStick(){
  let look=document.getElementById('look-stick');
  let knob=document.getElementById('look-stick-knob');
  if(!look){
    look=document.createElement('div');
    look.id='look-stick';
    document.body.appendChild(look);
  }
  if(!knob){
    knob=document.createElement('div');
    knob.id='look-stick-knob';
    look.replaceChildren(knob);
  }else if(knob.parentElement!==look){
    look.appendChild(knob);
  }
  look.removeAttribute('aria-hidden');
  look.setAttribute('aria-label','Look around joystick');
  const size=Math.min(150,Math.max(118,innerWidth*.19));
  Object.assign(look.style,{position:'fixed',right:'28px',bottom:'38px',width:`${size}px`,height:`${size}px`,borderRadius:'50%',border:'4px solid rgba(44,31,21,.95)',background:'rgba(39,61,35,.48)',boxShadow:'inset 0 0 0 12px rgba(132,111,61,.24)',display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto',touchAction:'none',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',zIndex:'1000'});
  const knobSize=size*.46;
  Object.assign(knob.style,{position:'absolute',left:'50%',top:'50%',width:`${knobSize}px`,height:`${knobSize}px`,transform:'translate(-50%,-50%)',borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#dbc27d,#8a6c3e 70%,#4c3928)',border:'4px solid #2c2118',boxShadow:'0 4px 8px rgba(0,0,0,.4)',pointerEvents:'none'});
  if(!knob.querySelector('[data-look-icon]')){
    const icon=document.createElement('span');
    icon.dataset.lookIcon='1';icon.textContent='👁';
    Object.assign(icon.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center',fontSize:'24px',opacity:'.78'});
    knob.appendChild(icon);
  }
  return {look,knob};
}

export function installThirdPersonCamera({playerRoot}){
  if(!playerRoot)return null;
  const {look,knob}=ensureLookStick();
  let yaw=0,pitch=.05,pointerId=null,lastX=0,lastY=0,appliedFrames=0;
  const target=new THREE.Vector3(),desired=new THREE.Vector3();
  const distance=5.15,targetHeight=1.45,cameraLift=.62,shoulder=.28;

  function knobAt(x,y){const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.29;let dx=x-cx,dy=y-cy;const len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
  function rotate(x,y){const dx=THREE.MathUtils.clamp(x-lastX,-80,80),dy=THREE.MathUtils.clamp(y-lastY,-80,80);lastX=x;lastY=y;yaw-=dx*.014;pitch=THREE.MathUtils.clamp(pitch-dy*.011,-.34,.48);knobAt(x,y);}
  function reset(){pointerId=null;knob.style.transform='translate(-50%,-50%)';}
  look.onpointerdown=e=>{if(pointerId!==null)return;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;knobAt(lastX,lastY);try{look.setPointerCapture(e.pointerId)}catch{}e.preventDefault();e.stopPropagation();};
  look.onpointermove=e=>{if(e.pointerId!==pointerId)return;rotate(e.clientX,e.clientY);e.preventDefault();e.stopPropagation();};
  look.onpointerup=look.onpointercancel=e=>{if(e.pointerId!==pointerId)return;reset();e.preventDefault();e.stopPropagation();};

  function apply(camera){
    if(!camera?.isPerspectiveCamera)return;
    target.set(playerRoot.position.x,playerRoot.position.y+targetHeight,playerRoot.position.z);
    const horizontal=Math.cos(pitch)*distance,sideX=Math.cos(yaw)*shoulder,sideZ=-Math.sin(yaw)*shoulder;
    desired.set(target.x+Math.sin(yaw)*horizontal+sideX,target.y+cameraLift+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal+sideZ);
    camera.position.copy(desired);camera.lookAt(target);
    if(Math.abs(camera.fov-52)>.01){camera.fov=52;camera.updateProjectionMatrix()}
    globalThis.__villagerCameraAppliedFrames=++appliedFrames;
  }
  const api={active:true,apply,get yaw(){return yaw},get pitch(){return pitch},lookStick:look};
  globalThis.__villagerThirdPersonCamera=api;

  // Guard against legacy/runtime code hiding or detaching the control after startup.
  setInterval(()=>{
    const current=document.getElementById('look-stick');
    if(!current||current!==look||!look.isConnected){document.body.appendChild(look)}
    Object.assign(look.style,{display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto',zIndex:'1000'});
  },500);
  return api;
}
