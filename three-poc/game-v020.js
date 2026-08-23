import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GlbPlayerVisual, PLAYER_GLB_CONTRACT } from './player-visual-glb.js';

// v0.2.1 keeps the proven v0.1.4 gameplay controller intact and replaces only
// the visual child when the uploaded character asset loads successfully.
await import('./game-v014.js?v=021-runtime');

const badge = document.querySelector('.badge');
const version = document.getElementById('version');
const harvestPanel = document.getElementById('harvest');
const playerRoot = globalThis.__villagerPlayerRoot || null;

if (version) version.textContent = '3D-0.2.1';

if (!playerRoot) {
  if (badge) badge.textContent = 'ROOT?';
  console.warn('[The Villager] Player root hook unavailable; gameplay fallback remains active.');
} else {
  const fallbackObjects = [...playerRoot.children];
  const visual = new GlbPlayerVisual({
    playerRoot,
    fallbackObjects,
    modelUrl: `${PLAYER_GLB_CONTRACT.preferredPath}?v=021`,
    targetHeight: PLAYER_GLB_CONTRACT.targetHeight,
    localGroundOffset: -0.53,
  });

  if (badge) badge.textContent = 'GLB…';
  const loaded = await visual.load();
  if (badge) badge.textContent = loaded ? 'GLB' : 'FALLBACK';

  const visualClock = new THREE.Clock();
  function updateExternalVisual() {
    requestAnimationFrame(updateExternalVisual);
    const dt = Math.min(visualClock.getDelta(), 0.05);
    const harvesting = !!harvestPanel && !harvestPanel.classList.contains('hidden');
    visual.update(dt, { harvesting });
  }
  updateExternalVisual();
}
