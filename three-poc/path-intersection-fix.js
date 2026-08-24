import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const pathMat=new THREE.MeshStandardMaterial({
  color:0xb79058,
  roughness:.88,
  metalness:0,
  flatShading:true
});

function addMask(world,x,z,w,h){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),pathMat);
  mesh.position.set(x,.064,z);
  mesh.rotation.x=-Math.PI/2;
  mesh.receiveShadow=true;
  mesh.castShadow=false;
  mesh.renderOrder=3;
  world.add(mesh);
  return mesh;
}

export function installPathIntersectionFix({world}){
  if(!world)return null;
  const masks=[];
  // The vertical path crosses the horizontal path centered at z=-2.6.
  // Cover only the narrow decorative edge strips inside the shared path area.
  masks.push(addMask(world,0,-2.6,5.15,3.05));
  // The vertical path also crosses the horizontal path centered at z=4.
  masks.push(addMask(world,0,4,5.15,2.55));
  return {masks};
}
