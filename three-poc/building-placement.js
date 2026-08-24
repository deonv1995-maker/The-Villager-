import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const wood=new THREE.MeshStandardMaterial({color:0x6d421f,roughness:.9,flatShading:true});
const plaster=new THREE.MeshStandardMaterial({color:0xcfb77c,roughness:.95,flatShading:true});
const roof=new THREE.MeshStandardMaterial({color:0x69432b,roughness:.96,flatShading:true});
const stone=new THREE.MeshStandardMaterial({color:0x777a70,roughness:.98,flatShading:true});
const previewValid=new THREE.MeshStandardMaterial({color:0x55d66f,transparent:true,opacity:.35,depthWrite:false,roughness:.8});
const previewInvalid=new THREE.MeshStandardMaterial({color:0xe5574f,transparent:true,opacity:.35,depthWrite:false,roughness:.8});

function add(parent,geometry,material,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function beam(g,x,y,z,sx,sy,sz,rz=0){return add(g,new THREE.BoxGeometry(1,1,1),wood,[x,y,z],[0,0,rz],[sx,sy,sz]);}
function setPreviewMaterial(root,valid){root.traverse(o=>{if(!o.isMesh)return;if(!o.userData.originalMaterial)o.userData.originalMaterial=o.material;o.material=valid?previewValid:previewInvalid;});}
function restoreMaterials(root){root.traverse(o=>{if(o.isMesh&&o.userData.originalMaterial)o.material=o.userData.originalMaterial;});}

function createWoodcutterHut(){
 const g=new THREE.Group();g.name='WoodcutterHut';
 add(g,new THREE.BoxGeometry(3.0,.38,2.5),stone,[0,.19,0]);
 add(g,new THREE.BoxGeometry(2.7,1.65,2.2),plaster,[0,1.18,0]);
 beam(g,-1.28,1.18,1.12,.14,1.7,.14);beam(g,1.28,1.18,1.12,.14,1.7,.14);beam(g,0,1.96,1.12,2.7,.14,.14);
 beam(g,-.7,1.22,1.13,.12,1.45,.12,-.55);beam(g,.7,1.22,1.13,.12,1.45,.12,.55);
 add(g,new THREE.BoxGeometry(.72,1.38,.12),wood,[0,.88,1.13]);
 const roofHalf=1.75,rise=.9,angle=Math.atan2(rise,roofHalf),slope=Math.hypot(roofHalf,rise);
 add(g,new THREE.BoxGeometry(slope,.12,2.85),roof,[-roofHalf/2,2.18+rise/2,0],[0,0,angle]);
 add(g,new THREE.BoxGeometry(slope,.12,2.85),roof,[roofHalf/2,2.18+rise/2,0],[0,0,-angle]);
 // small stacked logs give the hut an immediately readable work identity
 for(let i=0;i<4;i++)add(g,new THREE.CylinderGeometry(.12,.12,.95,7),wood,[1.72,.18+i*.19,.35],[0,0,Math.PI/2]);
 return g;
}

const BUILDINGS={woodcutter:{id:'woodcutter',label:'Woodcutter Hut',footprint:{hx:1.65,hz:1.45},previewDistance:4.3,pathWidth:1.45,create:createWoodcutterHut}};

export function installBuildingPlacement({world,playerRoot,pathNetwork,collision}){
 const buildButton=document.getElementById('build-button'),menu=document.getElementById('build-menu'),confirm=document.getElementById('build-confirm'),cancel=document.getElementById('build-cancel'),status=document.getElementById('build-status');
 if(!world||!playerRoot||!buildButton||!menu||!confirm||!cancel)return null;
 let activeDef=null,preview=null,valid=false,serial=0;
 const forward=new THREE.Vector3(),candidate=new THREE.Vector3();
 function closeMenu(){menu.classList.add('hidden');}
 function stopPlacement(){if(preview){world.remove(preview);preview=null;}activeDef=null;confirm.classList.add('hidden');cancel.classList.add('hidden');if(status)status.classList.add('hidden');}
 function beginPlacement(key){const def=BUILDINGS[key];if(!def)return;stopPlacement();closeMenu();activeDef=def;preview=def.create();preview.name='BuildingPlacementPreview';world.add(preview);confirm.classList.remove('hidden');cancel.classList.remove('hidden');if(status)status.classList.remove('hidden');updatePreview();}
 function updatePreview(){if(!preview||!activeDef)return;const yaw=playerRoot.rotation.y;forward.set(Math.sin(yaw),0,Math.cos(yaw));candidate.copy(playerRoot.position).addScaledVector(forward,activeDef.previewDistance);preview.position.set(candidate.x,0,candidate.z);preview.rotation.y=yaw;const fp={x:candidate.x,z:candidate.z,hx:activeDef.footprint.hx,hz:activeDef.footprint.hz};valid=!collision?.isFootprintBlocked?.(fp);setPreviewMaterial(preview,valid);confirm.classList.toggle('valid',valid);confirm.classList.toggle('invalid',!valid);confirm.disabled=!valid;if(status){status.textContent=valid?'Placement clear':'Placement blocked';status.classList.toggle('valid',valid);status.classList.toggle('invalid',!valid);}}
 function place(){if(!preview||!activeDef||!valid)return;restoreMaterials(preview);preview.traverse(o=>{if(o.isMesh){o.material=o.userData.originalMaterial||o.material;o.userData.originalMaterial=null;}});const placed=preview,def=activeDef,id=`${def.id}-${++serial}`;placed.name=id;preview=null;const yaw=placed.rotation.y,entranceOffset=1.55;const entrance={x:placed.position.x+Math.sin(yaw)*entranceOffset,z:placed.position.z+Math.cos(yaw)*entranceOffset};collision?.registerBox?.({id,x:placed.position.x,z:placed.position.z,hx:def.footprint.hx,hz:def.footprint.hz});pathNetwork?.registerBuilding?.({id,role:def.id,entrance});pathNetwork?.connectNearest?.(id,{width:def.pathWidth,bend:.12});activeDef=null;confirm.classList.add('hidden');cancel.classList.add('hidden');if(status)status.classList.add('hidden');}
 buildButton.addEventListener('click',()=>{if(activeDef){stopPlacement();closeMenu();return;}menu.classList.toggle('hidden');});
 menu.querySelectorAll('[data-building]').forEach(button=>button.addEventListener('click',()=>beginPlacement(button.dataset.building)));
 confirm.addEventListener('click',place);cancel.addEventListener('click',()=>{stopPlacement();closeMenu();});
 function tick(){updatePreview();requestAnimationFrame(tick);}tick();
 const api={beginPlacement,stopPlacement,get active(){return activeDef?.id||null;}};globalThis.__villagerBuildingPlacement=api;return api;
}
