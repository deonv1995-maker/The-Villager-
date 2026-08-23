import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GlbPlayerVisual, PLAYER_GLB_CONTRACT } from './player-visual-glb.js';

// v0.1.5 keeps v0.1.4 as the complete gameplay runtime and layers an external
// character visual on top. The procedural character remains the fallback.
let playerRoot = null;
const originalGroupAdd = THREE.Group.prototype.add;

THREE.Group.prototype.add = function (...objects) {
  const result = originalGroupAdd.apply(this, objects);
  for (const object of objects) {
    if (!(object instanceof THREE.Group)) continue;
    const scaleLooksLikePlayer = Math.abs(object.scale.x - 1.10) < 0.01 && Math.abs(object.scale.y - 1.05) < 0.01;
    const hasRigRootShape = object.children.length === 1 && object.children[0] instanceof THREE.Group;
    if (scaleLooksLikePlayer && hasRigRootShape) playerRoot = object;
  }
  return result;
};

await import('./game-v014.js?v=015-runtime');
THREE.Group.prototype.add = originalGroupAdd;

const harvestPanel = document.getElementById('harvest');
const badge = document.querySelector('.badge');

if (playerRoot) {
  // Preserve every object created by the procedural player. These are hidden only
  // after an external GLB has successfully loaded and normalized.
  const fallbackObjects = [...playerRoot.children];

  const visual = new GlbPlayerVisual({
    playerRoot,
    fallbackObjects,
    modelUrl: `${PLAYER_GLB_CONTRACT.preferredPath}?v=015`,
    targetHeight: PLAYER_GLB_CONTRACT.targetHeight,
    localGroundOffset: -0.53,
  });

  const loaded = await visual.load();
  if (badge) badge.textContent = loaded ? '3D GLB' : '3D';

  const clock = new THREE.Clock();
  function updateExternalVisual() {
    requestAnimationFrame(updateExternalVisual);
    const dt = Math.min(clock.getDelta(), 0.05);
    const harvesting = !!harvestPanel && !harvestPanel.classList.contains('hidden');
    visual.update(dt, { harvesting });
  }
  updateExternalVisual();
}
