import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const CAMERA_OFFSET_XZ=new THREE.Vector2(13.2,17.2);
const FADE_OPACITY=.28;
const FADE_SPEED=10;

function isBuildingGroup(o){
 if(!o?.isGroup)return false;
 if(o.userData?.isBuildingOccluder)return true;
 const n=o.name||'';
 return /^VillageCottage/i.test(n)||/^woodcutter-/i.test(n)||/^WoodcutterHut/i.test(n);
}

function segmentIntersectsAabb(ax,az,bx,bz,minX,maxX,minZ,maxZ){
 let t0=0,t1=1;
 const dx=bx-ax,dz=bz-az;
 for(const [p,qMin,qMax] of [[dx,minX-ax,maxX-ax],[dz,minZ-az,maxZ-az]]){
  if(Math.abs(p)<1e-6){if(qMin>0||qMax<0)return false;continue;}
  let a=qMin/p,b=qMax/p;if(a>b)[a,b]=[b,a];t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)return false;
 }
 return t1>.04&&t0<.985;
}

function cloneOcclusionMaterials(group){
 group.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  if(o.userData.__occlusionMaterialReady)return;
  const source=o.material;
  if(Array.isArray(source)){
   o.material=source.map(m=>{const c=m.clone();c.transparent=true;c.userData.__baseOpacity=m.opacity??1;c.userData.__baseDepthWrite=m.depthWrite;return c;});
  }else if(source){
   const c=source.clone();c.transparent=true;c.userData.__baseOpacity=source.opacity??1;c.userData.__baseDepthWrite=source.depthWrite;o.material=c;
  }
  o.userData.__occlusionMaterialReady=true;
 });
}

function setGroupOpacity(group,opacity){
 const faded=opacity<.98;
 group.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  for(const m of mats){if(!m)continue;const base=m.userData.__baseOpacity??1;m.opacity=base*opacity;m.transparent=faded||base<1;m.depthWrite=faded?false:(m.userData.__baseDepthWrite??true);m.needsUpdate=true;}
 });
}

function getFootprint(group){
 const box=new THREE.Box3().setFromObject(group);
 if(box.isEmpty())return null;
 // Slight inset prevents a roof overhang alone from triggering transparency too early.
 const insetX=Math.min(.38,(box.max.x-box.min.x)*.06),insetZ=Math.min(.38,(box.max.z-box.min.z)*.06);
 return {minX:box.min.x+insetX,maxX:box.max.x-insetX,minZ:box.min.z+insetZ,maxZ:box.max.z-insetZ};
}

export function installBuildingOcclusion({world,playerRoot}){
 if(!world||!playerRoot)return null;
 const entries=new Map();
 const cameraPos=new THREE.Vector2(),playerPos=new THREE.Vector2();
 let lastScan=0,lastTime=performance.now();

 function scan(){
  world.traverse(o=>{
   if(!isBuildingGroup(o)||entries.has(o))return;
   cloneOcclusionMaterials(o);
   entries.set(o,{group:o,opacity:1,footprint:getFootprint(o)});
  });
 }

 function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(now-lastScan>700){lastScan=now;scan();}
  playerPos.set(playerRoot.position.x,playerRoot.position.z);
  cameraPos.copy(playerPos).add(CAMERA_OFFSET_XZ);
  for(const entry of entries.values()){
   if(!entry.group.parent)continue;
   if(now-lastScan<40)entry.footprint=getFootprint(entry.group);
   const f=entry.footprint;if(!f)continue;
   const occluding=segmentIntersectsAabb(cameraPos.x,cameraPos.y,playerPos.x,playerPos.y,f.minX,f.maxX,f.minZ,f.maxZ);
   const target=occluding?FADE_OPACITY:1;
   entry.opacity=THREE.MathUtils.lerp(entry.opacity,target,1-Math.exp(-dt*FADE_SPEED));
   setGroupOpacity(entry.group,entry.opacity);
  }
 }
 scan();requestAnimationFrame(tick);
 return {refresh:scan};
}
