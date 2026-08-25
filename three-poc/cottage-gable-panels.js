import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const COTTAGE_NAME='VillageCottage046';
const PANEL_PREFIX='VillageCottageGablePanel';

function createGableGeometry(width,rise,depth){
  const shape=new THREE.Shape();
  shape.moveTo(-width/2,0);
  shape.lineTo(width/2,0);
  shape.lineTo(0,rise);
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  geometry.translate(0,0,-depth/2);
  return geometry;
}

function removeOldPanels(cottage){
  const stale=[];
  cottage.traverse(o=>{if(o!==cottage&&o.name?.startsWith(PANEL_PREFIX))stale.push(o);});
  for(const o of stale){o.parent?.remove(o);o.geometry?.dispose?.();}
}

function installPanels(cottage){
  removeOldPanels(cottage);

  const width=5.72;
  const houseDepth=4.15;
  const eave=4.18;
  const rise=2.06;
  const thickness=.18;
  const geometry=createGableGeometry(width,rise,thickness);
  const material=new THREE.MeshStandardMaterial({
    color:0xd8bd83,
    roughness:.88,
    metalness:0,
    flatShading:true,
    side:THREE.DoubleSide
  });

  // Put the infill just inside the timber face, but with real thickness so it cannot
  // disappear from back-face culling, camera angle, or z-fighting on mobile GPUs.
  const faceZ=houseDepth/2+.08;
  const front=new THREE.Mesh(geometry,material);
  front.name=`${PANEL_PREFIX}-Front`;
  front.position.set(0,eave,faceZ);
  front.castShadow=true;
  front.receiveShadow=true;
  front.userData.isBuildingOccluder=true;
  cottage.add(front);

  const back=new THREE.Mesh(geometry,material.clone());
  back.name=`${PANEL_PREFIX}-Back`;
  back.position.set(0,eave,-faceZ);
  back.rotation.y=Math.PI;
  back.castShadow=true;
  back.receiveShadow=true;
  back.userData.isBuildingOccluder=true;
  cottage.add(back);

  // Small side wedges close the visible gaps where the sloped roof meets the side walls.
  const sideMat=material.clone();
  const sideHeight=.95;
  const sideWidth=.42;
  for(const sx of [-1,1]){
    const side=new THREE.Mesh(new THREE.BoxGeometry(sideWidth,sideHeight,houseDepth-.05),sideMat.clone());
    side.name=`${PANEL_PREFIX}-Side-${sx}`;
    side.position.set(sx*(width/2-sideWidth/2),eave+sideHeight/2-.04,0);
    side.castShadow=true;
    side.receiveShadow=true;
    side.userData.isBuildingOccluder=true;
    cottage.add(side);
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
