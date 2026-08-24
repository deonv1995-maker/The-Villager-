import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createVillageMaterials } from './material-library.js?v=064';
import { WORLD_LIMIT } from './world-expansion.js?v=069';

const HARVEST_SECONDS=1.6;
const RESPAWN_SECONDS=7;
const PLAYER_REACH=1.15;
const CENTRAL_CLEAR_RADIUS=18;

function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function hash(cx,cz,salt=0){let h=(cx*73856093)^(cz*19349663)^(salt*83492791);return h>>>0;}
function mesh(parent,geometry,material,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}

function makeTree(scale=1){
 const M=createVillageMaterials(),g=new THREE.Group();g.name='VillageTreeStreamed';g.scale.setScalar(scale);
 mesh(g,new THREE.CylinderGeometry(.42,.68,4.2,7),M.bark,[0,2.1,0]);
 mesh(g,new THREE.CylinderGeometry(.27,.42,1.35,7),M.barkDark,[0,4.55,0],[0,0,.05]);
 const leafA=new THREE.MeshStandardMaterial({color:0x4f8f3e,roughness:1,flatShading:true}),leafB=new THREE.MeshStandardMaterial({color:0x73aa4e,roughness:1,flatShading:true}),leafC=new THREE.MeshStandardMaterial({color:0x356d34,roughness:1,flatShading:true});
 const foliage=[[-.95,4.5,.15,1.15,leafC],[.9,4.7,-.05,1.12,leafB],[-.25,5.45,-.25,1.28,leafA],[.55,5.55,.25,1.02,leafB],[0,6.15,0,.92,leafA]];
 for(const [x,y,z,s,m] of foliage)mesh(g,new THREE.IcosahedronGeometry(1.2,1),m,[x,y,z],[0,(x+z)*.12,0],[s,s*.95,s]);
 return g;
}
function makeRock(scale=1){
 const M=createVillageMaterials(),g=new THREE.Group();g.name='VillageRockStreamed';g.scale.setScalar(scale);
 const parts=[[-.65,.55,.05,1.05,.72,M.stoneDark],[.42,.43,.18,.82,.62,M.stone],[.08,.3,-.55,.68,.46,M.stoneLight],[.8,.23,-.38,.42,.3,M.stoneWarm]];
 for(const [x,y,z,sx,sy,m] of parts)mesh(g,new THREE.DodecahedronGeometry(.9,0),m,[x,y,z],[x*.22,z*.3,y*.14],[sx,sy,sx*.9]);
 return g;
}
function info(type){return type==='wood'?{name:'Tree',icon:'🪵',yield:3,radius:1.25}:{name:'Rock',icon:'🪨',yield:2,radius:1.1};}

export function installStreamedResourceSystem({chunkManager,playerRoot,inventory}){
 if(!chunkManager||!playerRoot||!inventory)return null;
 const harvestPanel=document.getElementById('harvest'),harvestLabel=document.getElementById('harvest-label'),harvestFill=document.getElementById('harvest-fill'),hint=document.getElementById('hint'),pickup=document.getElementById('pickup');
 const loaded=new Map(),depleted=new Map();
 let current=null,progress=0,lastPos=playerRoot.position.clone(),last=performance.now(),pickupTimer=0;
 function showPickup(text){if(!pickup)return;pickup.textContent=text;pickup.classList.remove('hidden');pickupTimer=1.4;}
 function addLoaded(r){loaded.set(r.id,r);}
 function removeLoaded(id){loaded.delete(id);if(current?.id===id){current=null;progress=0;}}
 const provider={
  createChunk({cx,cz,root,chunkSize}){
   const items=[],rnd=seeded(hash(cx,cz,69));
   const centerX=cx*chunkSize,centerZ=cz*chunkSize;
   const count=2+Math.floor(rnd()*4);
   for(let i=0;i<count;i++){
    const x=centerX+(rnd()-.5)*(chunkSize-3),z=centerZ+(rnd()-.5)*(chunkSize-3);
    if(Math.abs(x)>WORLD_LIMIT-2||Math.abs(z)>WORLD_LIMIT-2||Math.hypot(x,z)<CENTRAL_CLEAR_RADIUS)continue;
    const type=rnd()<.72?'wood':'stone',id=`${type}:${cx}:${cz}:${i}`,d=depleted.get(id);
    if(d&&d>performance.now())continue;if(d&&d<=performance.now())depleted.delete(id);
    const meta=info(type),visual=type==='wood'?makeTree(.72+rnd()*.48):makeRock(.72+rnd()*.38);
    visual.position.set(x-centerX,0,z-centerZ);root.add(visual);
    const r={id,type,x,z,visual,chunk:{cx,cz},...meta};items.push(r);addLoaded(r);
   }
   return items;
  },
  disposeChunk({state}){for(const r of state||[])removeLoaded(r.id);}
 };
 chunkManager.registerProvider(provider);
 function nearest(){let best=null,dist=Infinity;for(const r of loaded.values()){const d=Math.hypot(playerRoot.position.x-r.x,playerRoot.position.z-r.z);if(d<dist){best=r;dist=d;}}return best&&dist<=best.radius+PLAYER_REACH?best:null;}
 function clear(){current=null;progress=0;if(harvestPanel)harvestPanel.classList.add('hidden');}
 function tick(now){
  requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;
  const moved=playerRoot.position.distanceTo(lastPos);lastPos.copy(playerRoot.position);const moving=dt>0&&moved/dt>.08;
  for(const [id,until] of [...depleted])if(until<=now){depleted.delete(id);const parts=id.split(':'),cx=Number(parts[1]),cz=Number(parts[2]);chunkManager.rebuildChunk(cx,cz,provider);}
  const hit=nearest();
  if(!hit){clear();if(pickupTimer>0){pickupTimer-=dt;if(pickupTimer<=0)pickup?.classList.add('hidden');}return;}
  if(current!==hit){current=hit;progress=0;}
  if(moving){progress=0;if(harvestPanel)harvestPanel.classList.add('hidden');if(hint){hint.textContent=`Stop near the ${hit.name.toLowerCase()} to harvest.`;hint.classList.remove('hidden');}return;}
  if(hint)hint.classList.add('hidden');if(harvestPanel)harvestPanel.classList.remove('hidden');progress+=dt;
  if(harvestLabel)harvestLabel.textContent=`Harvesting ${hit.name}`;if(harvestFill)harvestFill.style.width=`${Math.min(100,progress/HARVEST_SECONDS*100)}%`;
  if(progress>=HARVEST_SECONDS){inventory.add(hit.type,hit.yield);depleted.set(hit.id,now+RESPAWN_SECONDS*1000);showPickup(`+${hit.yield} ${hit.icon}`);chunkManager.rebuildChunk(hit.chunk.cx,hit.chunk.cz,provider);clear();}
  if(pickupTimer>0){pickupTimer-=dt;if(pickupTimer<=0)pickup?.classList.add('hidden');}
 }
 requestAnimationFrame(tick);
 const api={provider,loaded,depleted};globalThis.__villagerStreamedResources=api;return api;
}
