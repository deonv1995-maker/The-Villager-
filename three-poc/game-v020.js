import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GlbPlayerVisual, PLAYER_GLB_CONTRACT } from './player-visual-glb.js?v=035';
import { installEnvironmentVisuals } from './environment-visuals.js?v=044';

await import('./game-v014.js?v=044-runtime');

const badge=document.querySelector('.badge');
const version=document.getElementById('version');
const harvestPanel=document.getElementById('harvest');
const harvestLabel=document.getElementById('harvest-label');
const playerRoot=globalThis.__villagerPlayerRoot||null;
if(version)version.textContent='3D-0.4.4';
function currentResourceType(){const text=(harvestLabel?.textContent||'').toLowerCase();if(text.includes('rock')||text.includes('stone'))return 'stone';if(text.includes('tree')||text.includes('wood'))return 'wood';return null;}
if(!playerRoot){if(badge)badge.textContent='ROOT?';console.warn('[The Villager] Player root hook unavailable; gameplay fallback remains active.');}else{installEnvironmentVisuals({world:playerRoot.parent});const fallbackObjects=[...playerRoot.children];for(const object of fallbackObjects)object.visible=false;const visual=new GlbPlayerVisual({playerRoot,fallbackObjects,modelUrl:`${PLAYER_GLB_CONTRACT.preferredPath}?v=044`,targetHeight:PLAYER_GLB_CONTRACT.targetHeight,localGroundOffset:-0.53});if(badge)badge.textContent='GLB…';const loaded=await visual.load();if(loaded){if(badge)badge.textContent='GLB';}else{for(const object of fallbackObjects)object.visible=true;if(badge)badge.textContent='FALLBACK';}const visualClock=new THREE.Clock();function updateExternalVisual(){requestAnimationFrame(updateExternalVisual);const dt=Math.min(visualClock.getDelta(),.05);const harvesting=!!harvestPanel&&!harvestPanel.classList.contains('hidden');visual.update(dt,{harvesting,resourceType:harvesting?currentResourceType():null});}updateExternalVisual();}
