import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GlbPlayerVisual, PLAYER_GLB_CONTRACT } from './player-visual-glb.js?v=028';

await import('./game-v014.js?v=028-runtime');

const badge=document.querySelector('.badge');
const version=document.getElementById('version');
const harvestPanel=document.getElementById('harvest');
const playerRoot=globalThis.__villagerPlayerRoot||null;
if(version)version.textContent='3D-0.2.8';

if(!playerRoot){
  if(badge)badge.textContent='ROOT?';
  console.warn('[The Villager] Player root hook unavailable; gameplay fallback remains active.');
}else{
  const fallbackObjects=[...playerRoot.children];
  for(const object of fallbackObjects)object.visible=false;
  const visual=new GlbPlayerVisual({playerRoot,fallbackObjects,modelUrl:`${PLAYER_GLB_CONTRACT.preferredPath}?v=028`,targetHeight:PLAYER_GLB_CONTRACT.targetHeight,localGroundOffset:-0.53});
  if(badge)badge.textContent='GLB…';
  const loaded=await visual.load();
  if(loaded){if(badge)badge.textContent='GLB';}else{for(const object of fallbackObjects)object.visible=true;if(badge)badge.textContent='FALLBACK';}
  const visualClock=new THREE.Clock();
  function updateExternalVisual(){requestAnimationFrame(updateExternalVisual);const dt=Math.min(visualClock.getDelta(),.05);const harvesting=!!harvestPanel&&!harvestPanel.classList.contains('hidden');visual.update(dt,{harvesting});}
  updateExternalVisual();
}
