import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// Compatibility layer: capture the actual gameplay player and camera without changing
// the legacy movement/controller loop.
let playerRoot = null;
const originalGroupAdd = THREE.Group.prototype.add;
const originalUpdateProjectionMatrix = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;

THREE.Group.prototype.add = function (...objects) {
  const result = originalGroupAdd.apply(this, objects);
  for (const object of objects) {
    if (!(object instanceof THREE.Group)) continue;
    const scaleLooksLikePlayer = Math.abs(object.scale.x - 1.05) < 0.001 && Math.abs(object.scale.y - 1.05) < 0.001;
    const hasRigRootShape = object.children.length === 1 && object.children[0] instanceof THREE.Group;
    if (scaleLooksLikePlayer && hasRigRootShape) playerRoot = object;
  }
  return result;
};

// PerspectiveCamera's constructor calls updateProjectionMatrix(). Capture that instance
// directly because the legacy camera is not added to the scene graph.
THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function (...args) {
  globalThis.__villagerCamera = this;
  return originalUpdateProjectionMatrix.apply(this, args);
};

await import('./game-v013.js?v=087-runtime');
THREE.Group.prototype.add = originalGroupAdd;
THREE.PerspectiveCamera.prototype.updateProjectionMatrix = originalUpdateProjectionMatrix;

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
