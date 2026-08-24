import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// Compatibility layer: capture the legacy player while keeping its movement loop intact.
let playerRoot = null;
const originalGroupAdd = THREE.Group.prototype.add;

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

// The legacy runtime writes its fixed isometric camera immediately before renderer.render().
// Own the final render boundary instead: capture the actual gameplay camera here and, once
// the third-person controller exists, apply its pose after the legacy update but before draw.
if (!globalThis.__villagerRenderBoundaryHook) {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function (scene, camera) {
    if (camera?.isPerspectiveCamera) {
      globalThis.__villagerCamera = camera;
      const controller = globalThis.__villagerThirdPersonCamera;
      if (controller?.active && typeof controller.apply === 'function') controller.apply(camera);
    }
    return originalRender.call(this, scene, camera);
  };
  globalThis.__villagerRenderBoundaryHook = true;
}

await import('./game-v013.js?v=088-runtime');
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
