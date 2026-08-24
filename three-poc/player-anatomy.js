import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function findByName(root,name){
  let found=null;
  root.traverse(object=>{if(!found&&object.name===name)found=object;});
  return found;
}

function material(color,roughness=.9){
  return new THREE.MeshStandardMaterial({color,roughness,metalness:0,flatShading:true});
}

function addMesh(parent,geometry,mat,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],name=''){
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  if(name)mesh.name=name;
  parent.add(mesh);
  return mesh;
}

export function refineVillagerAnatomy(root){
  if(!root)return false;
  const headBone=findByName(root,'Head');
  if(!headBone)return false;

  const previous=findByName(root,'RefinedHeadVisual');
  if(previous)return true;

  const temporary=findByName(root,'TemporaryHeadVisual');
  if(temporary)temporary.visible=false;

  const skin=material(0xc98762);
  const skinShadow=material(0xad6f50);
  const hair=material(0x35241c);
  const beard=material(0x2b1d17);

  const anatomy=new THREE.Group();
  anatomy.name='RefinedHeadVisual';
  headBone.add(anatomy);

  // Neck: deliberately exposed below the jaw so the head no longer sits directly on the shoulders.
  addMesh(anatomy,new THREE.CylinderGeometry(.052,.064,.13,7),skinShadow,[0,.018,0],[0,0,0],[1,1,.92],'NeckVisual');

  // Cranium: taller and slightly narrower/deeper than a sphere for a human silhouette.
  addMesh(anatomy,new THREE.IcosahedronGeometry(.118,2),skin,[0,.151,.004],[0,0,0],[.82,1.05,.88],'HeadCranium');

  // Lower face and jaw give the head a clear taper instead of a round ball.
  addMesh(anatomy,new THREE.DodecahedronGeometry(.09,1),skin,[0,.097,.018],[0,0,0],[.82,.72,.83],'FaceLower');
  addMesh(anatomy,new THREE.BoxGeometry(.105,.042,.085),skin,[0,.058,.018],[0,0,0],[.88,.9,.86],'Jaw');
  addMesh(anatomy,new THREE.DodecahedronGeometry(.042,0),skin,[0,.037,.027],[0,0,0],[1,.72,.9],'Chin');

  // Small ears and a modest projecting nose help the profile read from the gameplay camera.
  addMesh(anatomy,new THREE.DodecahedronGeometry(.024,0),skin,[-.101,.127,.005],[0,0,0],[.55,1,.48],'EarL');
  addMesh(anatomy,new THREE.DodecahedronGeometry(.024,0),skin,[.101,.127,.005],[0,0,0],[.55,1,.48],'EarR');
  addMesh(anatomy,new THREE.ConeGeometry(.024,.055,5),skin,[0,.118,.101],[Math.PI/2,0,0],[1,.95,.9],'Nose');

  // Hair follows the skull rather than forming a separate spherical cap.
  const hairCap=addMesh(anatomy,new THREE.SphereGeometry(.122,8,5,0,Math.PI*2,0,Math.PI*.58),hair,[0,.177,-.003],[0,0,0],[.84,.9,.9],'HairCap');
  hairCap.rotation.y=Math.PI/8;
  addMesh(anatomy,new THREE.BoxGeometry(.16,.045,.045),hair,[0,.137,-.096],[0,0,0],[1,.9,1],'HairBack');

  // Short shaped beard keeps the existing rugged villager identity without hiding the new jaw and neck.
  addMesh(anatomy,new THREE.ConeGeometry(.078,.09,7),beard,[0,.059,.067],[Math.PI,0,0],[.92,.82,.68],'Beard');

  return true;
}
