import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const HARVEST_SECONDS=1.6,RESPAWN_SECONDS=7,RESPAWN_SAFE_DISTANCE=10,PLAYER_REACH=1.15,UI_OWNER='static-resource';
const LEGACY_RESOURCE_POSITIONS=[[-6.6,2.7],[6.3,3]];
function isNearLegacy(x,z){return LEGACY_RESOURCE_POSITIONS.some(([lx,lz])=>Math.hypot(x-lx,z-lz)<.2);}
function resourceType(group){const n=group?.name||'';if(/^VillageTree/i.test(n))return 'wood';if(/^VillageRock/i.test(n))return 'stone';return null;}
function resourceLabel(type){return type==='wood'?'Tree':'Rock';}function resourceIcon(type){return type==='wood'?'🪵':'🪨';}function resourceYield(type){return type==='wood'?3:2;}function resourceRadius(type){return type==='wood'?1.25:1.1;}
function installInventoryBridge(){const nodes={wood:document.getElementById('wood-count'),stone:document.getElementById('stone-count')},base={wood:Number(nodes.wood?.textContent)||0,stone:Number(nodes.stone?.textContent)||0},extra={wood:0,stone:0};let writing=false;function render(type){const node=nodes[type];if(!node)return;writing=true;node.textContent=String(base[type]+extra[type]);queueMicrotask(()=>{writing=false;});}for(const type of ['wood','stone']){const node=nodes[type];if(!node)continue;new MutationObserver(()=>{if(writing)return;const raw=Number(node.textContent);if(!Number.isFinite(raw))return;base[type]=raw;render(type);}).observe(node,{childList:true,characterData:true,subtree:true});}return{add(type,amount){extra[type]+=amount;render(type);},totals(){return{wood:base.wood+extra.wood,stone:base.stone+extra.stone};}};}
export function installExpandedResources({playerRoot,environment}){
 if(!playerRoot||!environment?.sync)return null;
 const harvestPanel=document.getElementById('harvest'),harvestLabel=document.getElementById('harvest-label'),harvestFill=document.getElementById('harvest-fill'),hint=document.getElementById('hint'),pickup=document.getElementById('pickup'),ui=globalThis.__villagerHarvestUi||null,inventory=installInventoryBridge(),resources=[];
 for(const pair of environment.sync){const type=resourceType(pair.repl);if(!type)continue;const wp=new THREE.Vector3();pair.repl.getWorldPosition(wp);if(isNearLegacy(wp.x,wp.z))continue;resources.push({type,name:resourceLabel(type),icon:resourceIcon(type),yield:resourceYield(type),radius:resourceRadius(type),old:pair.old,visual:pair.repl,x:wp.x,z:wp.z,active:true,respawnAt:0});}
 let current=null,progress=0,lastPos=playerRoot.position.clone(),pickupTimer=0,last=performance.now();
 function setTarget(r){globalThis.__villagerHarvestTarget=r?{type:r.type,name:r.name,x:r.x,z:r.z,id:`static:${r.x}:${r.z}`}:null;}
 function showPickup(text){if(!pickup)return;pickup.textContent=text;pickup.classList.remove('hidden');pickupTimer=1.4;}
 function nearest(){let best=null,dist=Infinity;for(const r of resources){if(!r.active)continue;const d=Math.hypot(playerRoot.position.x-r.x,playerRoot.position.z-r.z);if(d<dist){best=r;dist=d;}}return best&&dist<=best.radius+PLAYER_REACH?best:null;}
 function clearHarvest(){current=null;progress=0;setTarget(null);if(ui?.isOwner(UI_OWNER)){ui.hideHarvest();ui.release(UI_OWNER);}else if(!ui)harvestPanel?.classList.add('hidden');}
 function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;const moved=playerRoot.position.distanceTo(lastPos);lastPos.copy(playerRoot.position);const moving=dt>0&&moved/dt>.08;
  for(const r of resources){if(r.active||r.respawnAt<=0||now<r.respawnAt)continue;if(Math.hypot(playerRoot.position.x-r.x,playerRoot.position.z-r.z)<RESPAWN_SAFE_DISTANCE)continue;r.active=true;r.old.visible=true;r.visual.visible=true;r.respawnAt=0;}
  const hit=nearest();if(!hit){if(ui?.isOwner(UI_OWNER))clearHarvest();else{current=null;progress=0;setTarget(null);}if(pickupTimer>0&&(pickupTimer-=dt)<=0)pickup?.classList.add('hidden');return;}
  if(ui&&!ui.isOwner(UI_OWNER))ui.acquire(UI_OWNER);if(current!==hit){current=hit;progress=0;setTarget(hit);}if(moving){progress=0;if(ui){ui.hideHarvest();ui.showHint();}else harvestPanel?.classList.add('hidden');if(hint)hint.textContent=`Stop near the ${hit.name.toLowerCase()} to harvest.`;return;}
  if(ui){ui.hideHint();ui.showHarvest();}else{hint?.classList.add('hidden');harvestPanel?.classList.remove('hidden');}progress+=dt;if(harvestLabel)harvestLabel.textContent=`Harvesting ${hit.name}`;if(harvestFill)harvestFill.style.width=`${Math.min(100,progress/HARVEST_SECONDS*100)}%`;
  if(progress>=HARVEST_SECONDS){inventory.add(hit.type,hit.yield);hit.active=false;hit.old.visible=false;hit.visual.visible=false;hit.respawnAt=now+RESPAWN_SECONDS*1000;showPickup(`+${hit.yield} ${hit.icon}`);clearHarvest();}
  if(pickupTimer>0&&(pickupTimer-=dt)<=0)pickup?.classList.add('hidden');
 }
 requestAnimationFrame(tick);const api={resources,inventory};globalThis.__villagerExpandedResources=api;return api;
}
