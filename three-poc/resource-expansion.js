import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const HARVEST_SECONDS=1.6;
const RESPAWN_SECONDS=7;
const PLAYER_REACH=1.15;
const LEGACY_RESOURCE_POSITIONS=[[-6.6,2.7],[6.3,3]];

function isNearLegacy(x,z){return LEGACY_RESOURCE_POSITIONS.some(([lx,lz])=>Math.hypot(x-lx,z-lz)<.2);}
function resourceType(group){const n=group?.name||'';if(/^VillageTree/i.test(n))return 'wood';if(/^VillageRock/i.test(n))return 'stone';return null;}
function resourceLabel(type){return type==='wood'?'Tree':'Rock';}
function resourceIcon(type){return type==='wood'?'🪵':'🪨';}
function resourceYield(type){return type==='wood'?3:2;}
function resourceRadius(type){return type==='wood'?1.25:1.1;}

function installInventoryBridge(){
 const nodes={wood:document.getElementById('wood-count'),stone:document.getElementById('stone-count')};
 const base={wood:Number(nodes.wood?.textContent)||0,stone:Number(nodes.stone?.textContent)||0};
 const extra={wood:0,stone:0};
 let writing=false;
 function render(type){const node=nodes[type];if(!node)return;writing=true;node.textContent=String(base[type]+extra[type]);queueMicrotask(()=>{writing=false;});}
 for(const type of ['wood','stone']){
  const node=nodes[type];if(!node)continue;
  new MutationObserver(()=>{if(writing)return;const raw=Number(node.textContent);if(!Number.isFinite(raw))return;base[type]=raw;render(type);}).observe(node,{childList:true,characterData:true,subtree:true});
 }
 return {add(type,amount){extra[type]+=amount;render(type);},totals(){return{wood:base.wood+extra.wood,stone:base.stone+extra.stone};}};
}

export function installExpandedResources({playerRoot,environment}){
 if(!playerRoot||!environment?.sync)return null;
 const harvestPanel=document.getElementById('harvest'),harvestLabel=document.getElementById('harvest-label'),harvestFill=document.getElementById('harvest-fill'),hint=document.getElementById('hint'),pickup=document.getElementById('pickup');
 const inventory=installInventoryBridge();
 const resources=[];
 for(const pair of environment.sync){
  const type=resourceType(pair.repl);if(!type)continue;
  const wp=new THREE.Vector3();pair.repl.getWorldPosition(wp);
  if(isNearLegacy(wp.x,wp.z))continue; // stable runtime already owns these two starter resources.
  resources.push({type,name:resourceLabel(type),icon:resourceIcon(type),yield:resourceYield(type),radius:resourceRadius(type),old:pair.old,visual:pair.repl,x:wp.x,z:wp.z,active:true,respawn:0});
 }
 let current=null,progress=0,lastPos=playerRoot.position.clone(),pickupTimer=0,last=performance.now();
 function showPickup(text){if(!pickup)return;pickup.textContent=text;pickup.classList.remove('hidden');pickupTimer=1.4;}
 function nearest(){let best=null,dist=Infinity;for(const r of resources){if(!r.active)continue;const d=Math.hypot(playerRoot.position.x-r.x,playerRoot.position.z-r.z);if(d<dist){best=r;dist=d;}}return best&&dist<=best.radius+PLAYER_REACH?best:null;}
 function clearHarvest(){current=null;progress=0;if(harvestPanel)harvestPanel.classList.add('hidden');}
 function tick(now){
  requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;
  const moved=playerRoot.position.distanceTo(lastPos);lastPos.copy(playerRoot.position);const moving=dt>0&&moved/dt>.08;
  for(const r of resources){if(r.active)continue;r.respawn-=dt;if(r.respawn<=0){r.active=true;r.old.visible=true;showPickup(`${r.name} respawned`);}}
  const hit=nearest();
  if(!hit){clearHarvest();if(pickupTimer>0){pickupTimer-=dt;if(pickupTimer<=0)pickup?.classList.add('hidden');}return;}
  if(current!==hit){current=hit;progress=0;}
  if(moving){progress=0;if(harvestPanel)harvestPanel.classList.add('hidden');if(hint){hint.textContent=`Stop near the ${hit.name.toLowerCase()} to harvest.`;hint.classList.remove('hidden');}return;}
  if(hint)hint.classList.add('hidden');if(harvestPanel)harvestPanel.classList.remove('hidden');progress+=dt;
  if(harvestLabel)harvestLabel.textContent=`Harvesting ${hit.name}`;if(harvestFill)harvestFill.style.width=`${Math.min(100,progress/HARVEST_SECONDS*100)}%`;
  if(progress>=HARVEST_SECONDS){inventory.add(hit.type,hit.yield);hit.active=false;hit.old.visible=false;hit.respawn=RESPAWN_SECONDS;showPickup(`+${hit.yield} ${hit.icon}`);clearHarvest();}
  if(pickupTimer>0){pickupTimer-=dt;if(pickupTimer<=0)pickup?.classList.add('hidden');}
 }
 requestAnimationFrame(tick);
 const api={resources,inventory};globalThis.__villagerExpandedResources=api;return api;
}
