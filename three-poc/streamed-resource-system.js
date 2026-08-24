import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createVillageMaterials } from './material-library.js?v=064';
import { WORLD_LIMIT } from './world-expansion.js?v=069';

const HARVEST_SECONDS=1.6;
const RESPAWN_SECONDS=7;
const RESPAWN_SAFE_DISTANCE=11;
const PLAYER_REACH=.72;
const CENTRAL_CLEAR_RADIUS=24;
const RESOURCE_EDGE_MARGIN=2.4;
const UI_OWNER='streamed-resource';

function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function hash(cx,cz,salt=0){return ((cx*73856093)^(cz*19349663)^(salt*83492791))>>>0;}
function mesh(parent,geometry,material,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}

function makeTree(scale=1){
 const M=createVillageMaterials(),g=new THREE.Group();g.name='VillageTreeStreamed';g.scale.setScalar(scale);
 mesh(g,new THREE.CylinderGeometry(.42,.68,4.2,7),M.bark,[0,2.1,0]);
 mesh(g,new THREE.CylinderGeometry(.27,.42,1.35,7),M.barkDark,[0,4.55,0],[0,0,.05]);
 const a=new THREE.MeshStandardMaterial({color:0x4f8f3e,roughness:1,flatShading:true}),b=new THREE.MeshStandardMaterial({color:0x73aa4e,roughness:1,flatShading:true}),c=new THREE.MeshStandardMaterial({color:0x356d34,roughness:1,flatShading:true});
 for(const [x,y,z,s,m] of [[-.95,4.5,.15,1.15,c],[.9,4.7,-.05,1.12,b],[-.25,5.45,-.25,1.28,a],[.55,5.55,.25,1.02,b],[0,6.15,0,.92,a]])mesh(g,new THREE.IcosahedronGeometry(1.2,1),m,[x,y,z],[0,(x+z)*.12,0],[s,s*.95,s]);
 return g;
}
function makeRock(scale=1){
 const M=createVillageMaterials(),g=new THREE.Group();g.name='VillageRockStreamed';g.scale.setScalar(scale);
 for(const [x,y,z,sx,sy,m] of [[-.65,.55,.05,1.05,.72,M.stoneDark],[.42,.43,.18,.82,.62,M.stone],[.08,.3,-.55,.68,.46,M.stoneLight],[.8,.23,-.38,.42,.3,M.stoneWarm]])mesh(g,new THREE.DodecahedronGeometry(.9,0),m,[x,y,z],[x*.22,z*.3,y*.14],[sx,sy,sx*.9]);
 return g;
}
function info(type){return type==='wood'?{name:'Tree',icon:'🪵',yield:3,radius:.58,collider:.56}:{name:'Rock',icon:'🪨',yield:2,radius:.72,collider:.72};}

function generateChunkSpecs(cx,cz,chunkSize){
 const rnd=seeded(hash(cx,cz,70)),centerX=cx*chunkSize,centerZ=cz*chunkSize,count=1+Math.floor(rnd()*3),placed=[],specs=[];
 for(let slot=0;slot<count;slot++){
  let x=0,z=0,ok=false;
  for(let attempt=0;attempt<12&&!ok;attempt++){
   x=centerX+(rnd()-.5)*(chunkSize-RESOURCE_EDGE_MARGIN*2);
   z=centerZ+(rnd()-.5)*(chunkSize-RESOURCE_EDGE_MARGIN*2);
   ok=Math.abs(x)<=WORLD_LIMIT-3&&Math.abs(z)<=WORLD_LIMIT-3&&Math.hypot(x,z)>=CENTRAL_CLEAR_RADIUS&&placed.every(p=>Math.hypot(x-p.x,z-p.z)>4.5);
  }
  const type=rnd()<.72?'wood':'stone';
  const scale=type==='wood'?.68+rnd()*.34:.68+rnd()*.30;
  if(!ok)continue;
  const id=`${type}:${cx}:${cz}:${slot}`;
  specs.push({id,type,x,z,scale,cx,cz,centerX,centerZ});
  placed.push({x,z});
 }
 return specs;
}

export function installStreamedResourceSystem({chunkManager,playerRoot,inventory,collision}){
 if(!chunkManager||!playerRoot||!inventory)return null;
 const harvestPanel=document.getElementById('harvest'),harvestLabel=document.getElementById('harvest-label'),harvestFill=document.getElementById('harvest-fill'),hint=document.getElementById('hint'),pickup=document.getElementById('pickup'),ui=globalThis.__villagerHarvestUi||null;
 const loaded=new Map();
 const state=new Map(); // only runtime state; layout always comes from generateChunkSpecs().
 let current=null,progress=0,lastPos=playerRoot.position.clone(),last=performance.now(),pickupTimer=0,stillTime=0;

 function runtimeState(id){let s=state.get(id);if(!s){s={active:true,respawnAt:0};state.set(id,s);}return s;}
 function setTarget(r){globalThis.__villagerHarvestTarget=r?{type:r.type,name:r.name,x:r.x,z:r.z,id:r.id}:null;}
 function showPickup(text){if(!pickup)return;pickup.textContent=text;pickup.classList.remove('hidden');pickupTimer=1.4;}
 function attachCollider(r){if(r.colliderHandle||!r.visual.visible||!collision?.registerCircle)return;r.colliderHandle=collision.registerCircle({id:`resource:${r.id}`,x:r.x,z:r.z,r:r.collider,dynamicVisible:()=>r.visual.visible&&!!r.visual.parent});}
 function detachCollider(r){if(!r?.colliderHandle)return;collision?.removeCollider?.(r.colliderHandle);r.colliderHandle=null;}
 function removeLoaded(r){if(!r)return;detachCollider(r);loaded.delete(r.id);if(current?.id===r.id){current=null;progress=0;stillTime=0;setTarget(null);if(ui?.isOwner(UI_OWNER)){ui.hideHarvest();ui.release(UI_OWNER);}}}
 function setActive(r,active){r.visual.visible=active;if(active)attachCollider(r);else detachCollider(r);}

 const provider={
  createChunk({cx,cz,root,chunkSize}){
   const items=[];
   for(const spec of generateChunkSpecs(cx,cz,chunkSize)){
    const meta=info(spec.type),visual=spec.type==='wood'?makeTree(spec.scale):makeRock(spec.scale),s=runtimeState(spec.id);
    visual.position.set(spec.x-spec.centerX,0,spec.z-spec.centerZ);root.add(visual);
    const r={...spec,...meta,visual,colliderHandle:null};items.push(r);loaded.set(r.id,r);setActive(r,s.active);
   }
   return items;
  },
  disposeChunk({state:items}){for(const r of items||[])removeLoaded(r);}
 };
 chunkManager.registerProvider(provider);

 function nearest(){let best=null,dist=Infinity;for(const r of loaded.values()){if(!r.visual.visible)continue;const d=Math.hypot(playerRoot.position.x-r.x,playerRoot.position.z-r.z);if(d<dist){best=r;dist=d;}}return best&&dist<=best.radius+PLAYER_REACH?best:null;}
 function endOuterHarvest(){current=null;progress=0;stillTime=0;setTarget(null);if(ui){if(ui.isOwner(UI_OWNER)){ui.hideHarvest();ui.release(UI_OWNER);}}else harvestPanel?.classList.add('hidden');}

 function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min((now-last)/1000,.05);last=now;
  const moved=playerRoot.position.distanceTo(lastPos);lastPos.copy(playerRoot.position);const speed=dt>0?moved/dt:0,moving=speed>.16;stillTime=moving?0:stillTime+dt;

  for(const r of loaded.values()){
   const s=runtimeState(r.id);if(s.active||now<s.respawnAt)continue;
   if(Math.hypot(playerRoot.position.x-r.x,playerRoot.position.z-r.z)<RESPAWN_SAFE_DISTANCE)continue;
   s.active=true;s.respawnAt=0;setActive(r,true);
  }

  const hit=nearest();
  if(!hit){if(current)setTarget(null);if(ui?.isOwner(UI_OWNER))endOuterHarvest();else if(!ui){current=null;progress=0;stillTime=0;}if(pickupTimer>0&&(pickupTimer-=dt)<=0)pickup?.classList.add('hidden');return;}
  if(ui&&!ui.isOwner(UI_OWNER))ui.acquire(UI_OWNER);
  if(current!==hit){current=hit;progress=0;stillTime=0;setTarget(hit);}
  if(moving||stillTime<.12){progress=0;if(ui){ui.hideHarvest();ui.showHint();}else harvestPanel?.classList.add('hidden');if(hint)hint.textContent=`Stop near the ${hit.name.toLowerCase()} to harvest.`;return;}

  if(ui){ui.hideHint();ui.showHarvest();}else{hint?.classList.add('hidden');harvestPanel?.classList.remove('hidden');}
  progress+=dt;if(harvestLabel)harvestLabel.textContent=`Harvesting ${hit.name}`;if(harvestFill)harvestFill.style.width=`${Math.min(100,progress/HARVEST_SECONDS*100)}%`;
  if(progress>=HARVEST_SECONDS){
   inventory.add(hit.type,hit.yield);const s=runtimeState(hit.id);s.active=false;s.respawnAt=now+RESPAWN_SECONDS*1000;setActive(hit,false);showPickup(`+${hit.yield} ${hit.icon}`);endOuterHarvest();
  }
  if(pickupTimer>0&&(pickupTimer-=dt)<=0)pickup?.classList.add('hidden');
 }
 requestAnimationFrame(tick);
 const api={provider,loaded,state};globalThis.__villagerStreamedResources=api;return api;
}
