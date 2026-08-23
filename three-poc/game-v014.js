import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// v0.1.4 is a presentation-layer refinement over the stable v0.1.3 gameplay runtime.
// Capture only the completed modular player root when it is attached to the world,
// then correct its ground-contact contract without changing movement/harvesting logic.
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

await import('./game-v013.js?v=014-runtime');
THREE.Group.prototype.add = originalGroupAdd;

if (playerRoot) {
  // The v0.1.3 boot sole sits ~0.50 local units below the root. Keep the external
  // gameplay position contract at y=0 while transparently mapping it to the true
  // sole-ground height. This also survives every movement position.set(nx,0,nz).
  const GROUND_OFFSET = 0.53;
  const originalSet = playerRoot.position.set.bind(playerRoot.position);
  playerRoot.position.set = (x, y, z) => originalSet(x, y + GROUND_OFFSET, z);
  originalSet(playerRoot.position.x, GROUND_OFFSET, playerRoot.position.z);

  const hips = playerRoot.children[0];
  const groups = hips.children.filter(child => child instanceof THREE.Group);
  const torso = groups.find(group => group.position.y > 0.3);
  const legs = groups.filter(group => group.position.y < 0 && Math.abs(group.position.x) > 0.1);

  // Stronger medieval-adventurer silhouette: broader shoulders/chest, slightly
  // shorter-looking torso, fuller legs and more substantial boots. Rig pivots stay
  // unchanged, so the established walk and harvest animations remain compatible.
  if (torso) {
    torso.scale.x = 1.08;
    torso.scale.y = 0.96;
    torso.scale.z = 1.03;
  }
  for (const leg of legs) {
    leg.scale.x = 1.12;
    leg.scale.z = 1.08;
  }

  // Make the overall figure read less narrow from the isometric camera while
  // preserving height and the corrected sole contact point.
  playerRoot.scale.set(1.10, 1.05, 1.05);
}
