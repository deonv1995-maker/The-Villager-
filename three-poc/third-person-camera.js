import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export function installThirdPersonCamera({playerRoot}){
 const camera=globalThis.__villagerCamera;
 if(!playerRoot||!camera)return null;
 const look=document.getElementById('look-stick'),knob=document.getElementById('look-stick-knob');
 let yaw=0,pitch=.24,pointer=null,sx=0,sy=0;
 const target=new THREE.Vector3(),desired=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3();
 const distance=8.2,height=2.25;
 function updateStick(e){const r=look.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;let dx=e.clientX-cx,dy=e.clientY-cy,l=Math.hypot(dx,dy)||1;if(l>max){dx=dx/l*max;dy=dy/l*max;}sx=dx/max;sy=dy/max;knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
 look?.addEventListener('pointerdown',e=>{pointer=e.pointerId;look.setPointerCapture?.(pointer);updateStick(e);e.preventDefault();});
 addEventListener('pointermove',e=>{if(e.pointerId===pointer)updateStick(e);});
 function release(e){if(e.pointerId!==pointer)return;pointer=null;sx=sy=0;if(knob)knob.style.transform='translate(-50%,-50%)';}
 addEventListener('pointerup',release);addEventListener('pointercancel',release);
 let last=performance.now();
 function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;yaw-=sx*1.9*dt;pitch=THREE.MathUtils.clamp(pitch-sy*1.15*dt,-.08,.58);target.set(playerRoot.position.x,playerRoot.position.y+1.85,playerRoot.position.z);const horizontal=Math.cos(pitch)*distance;desired.set(target.x+Math.sin(yaw)*horizontal,target.y+height+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*horizontal);camera.position.lerp(desired,1-Math.exp(-dt*12));camera.lookAt(target);}
 requestAnimationFrame(tick);
 const api={get yaw(){return yaw;},camera};globalThis.__villagerThirdPersonCamera=api;return api;
}
