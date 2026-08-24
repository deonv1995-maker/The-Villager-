import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export const WORLD_LIMIT=90;
const LEGACY_LIMIT=19;

// Compatibility bridge for the old runtime's hardcoded movement clamp. Keeping the
// expanded boundary here gives us one authoritative world-size value until movement
// ownership is migrated out of the legacy runtime.
export function installExpandedWorldBounds(){
 if(THREE.MathUtils.__villagerWorldBoundsInstalled)return;
 const baseClamp=THREE.MathUtils.clamp.bind(THREE.MathUtils);
 THREE.MathUtils.clamp=(value,min,max)=>{
  if(min===-LEGACY_LIMIT&&max===LEGACY_LIMIT)return baseClamp(value,-WORLD_LIMIT,WORLD_LIMIT);
  return baseClamp(value,min,max);
 };
 THREE.MathUtils.__villagerWorldBoundsInstalled=true;
}

export function installExpandedWorld({world}){
 if(!world)return {sync:[],limit:WORLD_LIMIT};
 // Only persistent world-scale presentation belongs here. Harvestable outer resources
 // are now owned by streamed-resource-system.js and exist only inside loaded chunks.
 const ground=world.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry'&&Math.abs((o.geometry.parameters?.width||0)-100)<.01&&Math.abs((o.geometry.parameters?.height||0)-100)<.01);
 if(ground){ground.scale.x=Math.max(ground.scale.x,2);ground.scale.y=Math.max(ground.scale.y,2);ground.updateMatrixWorld(true);}
 const scene=world.parent;if(scene?.fog){scene.fog.near=42;scene.fog.far=155;}
 return {sync:[],limit:WORLD_LIMIT};
}
