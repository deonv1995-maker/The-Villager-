import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const COTTAGE_NAME='VillageCottage046';
const PANEL_PREFIX='VillageCottageGable';
const RELEASE_VERSION='3D-0.6.38';

function createUpperWedge(width,rise,depth){
  const shape=new THREE.Shape();
  shape.moveTo(-width/2,0);
  shape.lineTo(width/2,0);
  shape.lineTo(0,rise);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  geometry.translate(0,0,-depth/2);
  geometry.computeVertexNormals();
  return geometry;
}

function removeOldGables(cottage){
  const stale=[];
  cottage.traverse(o=>{
    if(o!==cottage&&o.name?.startsWith(PANEL_PREFIX))stale.push(o);
    if(o!==cottage&&o.name?.startsWith('VillageCottageGablePanel'))stale.push(o);
  });
  for(const o of stale){
    o.parent?.remove(o);
    o.geometry?.dispose?.();
    if(Array.isArray(o.material))for(const m of o.material)m?.dispose?.();
    else o.material?.dispose?.();
  }
}

function installSolidUpper(cottage){
  removeOldGables(cottage);

  const width=5.72;
  const rise=2.06;
  const depth=4.48;
  const eave=4.18;
  const material=new THREE.MeshStandardMaterial({
    color:0xd8bd83,
    roughness:.88,
    metalness:0,
    flatShading:true,
    side:THREE.DoubleSide
  });

  const upper=new THREE.Mesh(createUpperWedge(width,rise,depth),material);
  upper.name=`${PANEL_PREFIX}-SolidUpper`;
  upper.position.set(0,eave,0);
  upper.castShadow=true;
  upper.receiveShadow=true;
  upper.userData.isBuildingOccluder=true;
  cottage.add(upper);
  document.getElementById('version')?.replaceChildren(RELEASE_VERSION);
  return true;
}

function findAndInstall(){
  const scene=globalThis.__villagerScene;
  if(!scene){requestAnimationFrame(findAndInstall);return;}
  const cottage=scene.getObjectByName(COTTAGE_NAME);
  if(!cottage){requestAnimationFrame(findAndInstall);return;}
  installSolidUpper(cottage);
}

findAndInstall();
