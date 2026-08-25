import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const COTTAGE_NAME='VillageCottage046';
const PANEL_NAME='VillageCottageGablePanel';

function createGableGeometry(width,rise){
  const shape=new THREE.Shape();
  shape.moveTo(-width/2,0);
  shape.lineTo(width/2,0);
  shape.lineTo(0,rise);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function installPanels(cottage){
  if(cottage.getObjectByName(PANEL_NAME))return true;

  const width=5.7;
  const depth=4.15;
  const eave=4.2;
  const rise=2.05;
  const geometry=createGableGeometry(width,rise);
  const material=new THREE.MeshStandardMaterial({
    color:0xd8bd83,
    roughness:.88,
    metalness:0,
    flatShading:true,
    side:THREE.DoubleSide
  });

  for(const z of [depth/2+.19,-depth/2-.19]){
    const panel=new THREE.Mesh(geometry,material);
    panel.name=PANEL_NAME;
    panel.position.set(0,eave,z);
    panel.castShadow=true;
    panel.receiveShadow=true;
    panel.userData.isBuildingOccluder=true;
    cottage.add(panel);
  }
  return true;
}

function findAndInstall(){
  const scene=globalThis.__villagerScene;
  if(!scene){requestAnimationFrame(findAndInstall);return;}
  const cottage=scene.getObjectByName(COTTAGE_NAME);
  if(!cottage){requestAnimationFrame(findAndInstall);return;}
  installPanels(cottage);
}

findAndInstall();
