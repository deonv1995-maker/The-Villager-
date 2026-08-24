import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// v0.1.4 presentation compatibility layer. Capture the gameplay camera and player
// without replacing Three.js constructors; ES module namespace exports are read-only.
let playerRoot = null;
const originalGroupAdd = THREE.Group.prototype.add;

THREE.Group.prototype.add = function (...objects) {
  const result = originalGroupAdd.apply(this, objects);
  for (const object of objects) {
    if (object instanceof THREE.PerspectiveCamera) globalThis.__villagerCamera = object;
    if (!(object instanceof THREE.Group)) continue;
    const scaleLooksLikePlayer = Math.abs(object.scale.x - 1.05) < 0.001 && Math.abs(object.scale.y - 1.05) < 0.001;
    const hasRigRootShape = object.children.length === 1 && object.children[0] instanceof THREE.Group;
    if (scaleLooksLikePlayer && hasRigRootShape) playerRoot = object;
  }
  return result;
};

await import('./game-v013.js?v=079-runtime');
THREE.Group.prototype.add = originalGroupAdd;

if (playerRoot) {
  const GROUND_OFFSET = 0.53;
  const originalSet = playerRoot.position.set.bind(playerRoot.position);
  playerRoot.position.set = (x, y, z) => originalSet(x, y + GROUND_OFFSET, z);
  originalSet(playerRoot.position.x, GROUND_OFFSET, playerRoot.position.z);

  const hips = playerRoot.children[0];
  const groups = hips.children.filter(child => child instanceof THREE.Group);
  const torso = groups.find(group => group.position.y > 0.3);
  const legs = groups.filter(group => group.position.y < 0 && Math.abs(group.position.x) > 0.1);
  if (torso) { torso.scale.x = 1.08; torso.scale.y = 0.96; torso.scale.z = 1.03; }
  for (const leg of legs) { leg.scale.x = 1.12; leg.scale.z = 1.08; }
  playerRoot.scale.set(1.10, 1.05, 1.05);
  globalThis.__villagerPlayerRoot = playerRoot;
}
