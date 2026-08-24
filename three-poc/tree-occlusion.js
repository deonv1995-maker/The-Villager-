import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const FADE_OPACITY=.24;
const FADE_SPEED=11;
const CAMERA_OFFSET_XZ=new THREE.Vector2(13.2,17.2);

function isTreeGroup(o){if(!o?.isGroup)return false;if(o.userData?.isTreeOccluder)return true;return /^VillageTree/i.test(o.name||'');}
function cloneFadeMaterials(group){group.traverse(o=>{if(!o.isMesh||o.userData.__treeFadeReady)return;const source=o.material;const prep=m=>{const c=m.clone();c.transparent=true;c.userData.__baseOpacity=m.opacity??1;c.userData.__baseDepthWrite=m.depthWrite;c.userData.__lastFadeState=false;return c;};if(Array.isArray(source))o.material=source.map(prep);else if(source)o.material=prep(source);o.userData.__treeFadeReady=true;});}
function setOpacity(group,opacity){const faded=opacity<.98;group.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;const base=m.userData.__baseOpacity??1;m.opacity=base*opacity;const stateChanged=m.userData.__lastFadeState!==faded;if(stateChanged){m.transparent=faded||base<1;m.depthWrite=faded?false:(m.userData.__baseDepthWrite??true);m.needsUpdate=true;m.userData.__lastFadeState=faded;}}});}
function getTreeScreenBody(group){const box=new THREE.Box3().setFromObject(group);if(box.isEmpty())return null;const center=new THREE.Vector3();box.getCenter(center);const radius=Math.max((box.max.x-box.min.x)*.42,(box.max.z-box.min.z)*.42,.65);return{x:center.x,z:center.z,radius};}
function distancePointToSegment(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz;if(len2<1e-6)return Math.hypot(px-ax,pz-az);const t=THREE.MathUtils.clamp(((px-ax)*dx+(pz-az)*dz)/len2,0,1);return Math.hypot(px-(ax+dx*t),pz-(az+dz*t));}

export function installTreeOcclusion({world,playerRoot}){
 if(!world||!playerRoot)return null;
 const entries=new Map(),playerPos=new THREE.Vector2(),cameraPos=new THREE.Vector2();let lastScan=0,lastTime=performance.now();
 function scan(){for(const [group] of entries)if(!group.parent)entries.delete(group);world.traverse(o=>{if(!isTreeGroup(o)||entries.has(o))return;cloneFadeMaterials(o);entries.set(o,{group:o,opacity:1,body:getTreeScreenBody(o)});});}
 function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(now-lastScan>700){lastScan=now;scan();}playerPos.set(playerRoot.position.x,playerRoot.position.z);const live=globalThis.__villagerCameraPosition;if(live)cameraPos.set(live.x,live.z);else cameraPos.copy(playerPos).add(CAMERA_OFFSET_XZ);for(const entry of entries.values()){if(!entry.group.parent)continue;if(now-lastScan<40)entry.body=getTreeScreenBody(entry.group);const b=entry.body;if(!b)continue;const dist=distancePointToSegment(b.x,b.z,cameraPos.x,cameraPos.y,playerPos.x,playerPos.y),treeToPlayer=Math.hypot(b.x-playerPos.x,b.z-playerPos.y),treeToCamera=Math.hypot(b.x-cameraPos.x,b.z-cameraPos.y),cameraToPlayer=Math.hypot(cameraPos.x-playerPos.x,cameraPos.y-playerPos.y),between=treeToPlayer<cameraToPlayer&&treeToCamera<cameraToPlayer,occluding=between&&dist<b.radius,target=occluding?FADE_OPACITY:1;entry.opacity=THREE.MathUtils.lerp(entry.opacity,target,1-Math.exp(-dt*FADE_SPEED));setOpacity(entry.group,entry.opacity);}}
 scan();requestAnimationFrame(tick);return{refresh:scan,get trackedCount(){return entries.size;}};
}
