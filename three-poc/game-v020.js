import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GlbPlayerVisual, PLAYER_GLB_CONTRACT } from './player-visual-glb.js?v=058';
import { installEnvironmentVisuals } from './environment-visuals.js?v=057';
import { installWorldCollision } from './world-collision.js?v=057';
import { installVillagePathNetwork } from './village-path-network.js?v=057';
import { installBuildingPlacement } from './building-placement.js?v=057';

await import('./game-v014.js?v=057-runtime');

const badge=document.querySelector('.badge');
const version=document.getElementById('version');
const harvestPanel=document.getElementById('harvest');
const harvestLabel=document.getElementById('harvest-label');
const playerRoot=globalThis.__villagerPlayerRoot||null;
if(version)version.textContent='3D-0.5.8';
function currentResourceType(){const text=(harvestLabel?.textContent||'').toLowerCase();if(text.includes('rock')||text.includes('stone'))return 'stone';if(text.includes('tree')||text.includes('wood'))return 'wood';return null;}
if(!playerRoot){if(badge)badge.textContent='ROOT?';console.warn('[The Villager] Player root hook unavailable; gameplay fallback remains active.');}
else{
 const world=playerRoot.parent;
 installEnvironmentVisuals({world});
 const pathNetwork=installVillagePathNetwork({world});
 globalThis.__villagePathNetwork=pathNetwork;
 const collision=installWorldCollision({playerRoot,world});
 installBuildingPlacement({world,playerRoot,pathNetwork,collision});
 const fallbackObjects=[...playerRoot.children];for(const object of fallbackObjects)object.visible=false;
 const modelUrl=new URL('./assets/characters/villager-male.gltf',import.meta.url).href;
 const visual=new GlbPlayerVisual({playerRoot,fallbackObjects,modelUrl,targetHeight:PLAYER_GLB_CONTRACT.targetHeight,localGroundOffset:-0.53});
 if(badge)badge.textContent='GLB…';const loaded=await visual.load();if(loaded){if(badge)badge.textContent='GLB';}else{for(const object of fallbackObjects)object.visible=true;if(badge)badge.textContent='FALLBACK';}
 const visualClock=new THREE.Clock();let walkPlayback=1;
 function updateExternalVisual(){
  requestAnimationFrame(updateExternalVisual);
  const dt=Math.min(visualClock.getDelta(),.05),harvesting=!!harvestPanel&&!harvestPanel.classList.contains('hidden');
  visual.update(dt,{harvesting,resourceType:harvesting?currentResourceType():null});
  if(!harvesting&&visual.loaded&&visual.activeAction){
   const speed=dt>0?visual.velocitySample.length()/dt:0,walkAction=visual.actionFor('walk');
   if(visual.activeAction===walkAction){
    const targetPlayback=THREE.MathUtils.clamp(speed/4.35,.12,1.02);
    walkPlayback=THREE.MathUtils.lerp(walkPlayback,targetPlayback,1-Math.exp(-dt*8));
    visual.activeAction.setEffectiveTimeScale(walkPlayback);
   }else walkPlayback=1;
  }
 }
 updateExternalVisual();
}
