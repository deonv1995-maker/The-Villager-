import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const wood=new THREE.MeshStandardMaterial({color:0x5b351b,roughness:.92,flatShading:true});
const darkWood=new THREE.MeshStandardMaterial({color:0x3f2818,roughness:.96,flatShading:true});
const plaster=new THREE.MeshStandardMaterial({color:0xc7ad73,roughness:.96,flatShading:true});
const roof=new THREE.MeshStandardMaterial({color:0x715033,roughness:.98,flatShading:true});
const thatch=new THREE.MeshStandardMaterial({color:0x9b7a45,roughness:1,flatShading:true});
const stone=new THREE.MeshStandardMaterial({color:0x777a70,roughness:.98,flatShading:true});
const moss=new THREE.MeshStandardMaterial({color:0x617b38,roughness:1,flatShading:true});
const previewValid=new THREE.MeshStandardMaterial({color:0x55d66f,transparent:true,opacity:.35,depthWrite:false,roughness:.8});
const previewInvalid=new THREE.MeshStandardMaterial({color:0xe5574f,transparent:true,opacity:.35,depthWrite:false,roughness:.8});

function add(parent,geometry,material,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function beam(g,x,y,z,sx,sy,sz,rz=0,material=wood){return add(g,new THREE.BoxGeometry(1,1,1),material,[x,y,z],[0,0,rz],[sx,sy,sz]);}
function log(g,x,y,z,length=.95,r=.14,rotY=0){return add(g,new THREE.CylinderGeometry(r,r,length,7),wood,[x,y,z],[0,rotY,Math.PI/2]);}
function setPreviewMaterial(root,valid){root.traverse(o=>{if(!o.isMesh)return;if(!o.userData.originalMaterial)o.userData.originalMaterial=o.material;o.material=valid?previewValid:previewInvalid;});}
function restoreMaterials(root){root.traverse(o=>{if(o.isMesh&&o.userData.originalMaterial)o.material=o.userData.originalMaterial;});}

function createWoodcutterHut(){
 const g=new THREE.Group();g.name='WoodcutterHut';
 add(g,new THREE.BoxGeometry(4.7,.42,3.8),stone,[0,.21,0]);
 add(g,new THREE.BoxGeometry(4.25,2.05,3.35),plaster,[0,1.43,0]);
 for(const x of [-2.05,2.05])for(const z of [-1.64,1.64])beam(g,x,1.42,z,.18,2.15,.18);
 beam(g,0,2.4,1.7,4.25,.18,.18);beam(g,0,2.4,-1.7,4.25,.18,.18);
 beam(g,-1.05,1.45,1.71,.15,1.75,.15,-.55);beam(g,1.05,1.45,1.71,.15,1.75,.15,.55);
 beam(g,-1.05,1.45,-1.71,.15,1.75,.15,.55);beam(g,1.05,1.45,-1.71,.15,1.75,.15,-.55);
 beam(g,-.52,1.03,1.73,.2,1.72,.22);beam(g,.52,1.03,1.73,.2,1.72,.22);beam(g,0,1.88,1.73,1.22,.22,.22);
 add(g,new THREE.BoxGeometry(.88,1.58,.12),darkWood,[0,1.02,1.75]);
 const half=2.75,rise=1.48,angle=Math.atan2(rise,half),slope=Math.hypot(half,rise);
 add(g,new THREE.BoxGeometry(slope,.18,4.35),roof,[-half/2,2.5+rise/2,0],[0,0,angle]);
 add(g,new THREE.BoxGeometry(slope,.18,4.35),roof,[half/2,2.5+rise/2,0],[0,0,-angle]);
 for(let i=0;i<5;i++){const y=2.67+i*.27,span=2.48-i*.34;beam(g,-span*.5,y,0,span,.07,4.42,angle,thatch);beam(g,span*.5,y,0,span,.07,4.42,-angle,thatch);}
 beam(g,0,4.02,0,.22,.22,4.55,0,darkWood);
 add(g,new THREE.BoxGeometry(.58,1.45,.58),stone,[1.18,3.48,-.55]);add(g,new THREE.BoxGeometry(.76,.16,.76),stone,[1.18,4.18,-.55]);
 beam(g,2.45,1.18,.2,.16,1.9,.16);beam(g,2.45,1.18,-1.25,.16,1.9,.16);beam(g,1.98,2.08,-.52,1.1,.14,1.85,0,darkWood);
 add(g,new THREE.BoxGeometry(1.55,.11,2.05),roof,[2.0,2.18,-.52],[0,0,-.18]);
 for(let row=0;row<3;row++)for(let i=0;i<4;i++)log(g,2.35,.22+row*.27,-1.15+i*.48,.78,.13);
 for(let row=0;row<2;row++)for(let i=0;i<4;i++)log(g,-2.35,.2+row*.27,-1.15+i*.48,.82,.14);
 add(g,new THREE.CylinderGeometry(.32,.38,.55,8),wood,[-1.75,.28,2.15]);
 log(g,-2.0,.17,2.5,1.25,.15,.25);log(g,-1.35,.16,2.62,1.05,.13,-.35);
 add(g,new THREE.BoxGeometry(.72,.045,1.15),moss,[-1.2,3.43,-1.2],[0,0,angle]);
 return g;
}

const BUILDINGS={woodcutter:{id:'woodcutter',label:'Woodcutter Hut',footprint:{hx:2.65,hz:2.25},previewDistance:5.8,pathWidth:1.6,create:createWoodcutterHut}};

export function installBuildingPlacement({world,playerRoot,pathNetwork,collision,foliage}){
 const buildButton=document.getElementById('build-button'),menu=document.getElementById('build-menu'),confirm=document.getElementById('build-confirm'),cancel=document.getElementById('build-cancel'),status=document.getElementById('build-status');
 if(!world||!playerRoot||!buildButton||!menu||!confirm||!cancel)return null;
 let activeDef=null,preview=null,valid=false,serial=0;
 const forward=new THREE.Vector3(),candidate=new THREE.Vector3();
 function closeMenu(){menu.classList.add('hidden');}
 function stopPlacement(){if(preview){world.remove(preview);preview=null;}activeDef=null;confirm.classList.add('hidden');cancel.classList.add('hidden');if(status)status.classList.add('hidden');}
 function beginPlacement(key){const def=BUILDINGS[key];if(!def)return;stopPlacement();closeMenu();activeDef=def;preview=def.create();preview.name='BuildingPlacementPreview';world.add(preview);confirm.classList.remove('hidden');cancel.classList.remove('hidden');if(status)status.classList.remove('hidden');updatePreview();}
 function updatePreview(){if(!preview||!activeDef)return;const yaw=playerRoot.rotation.y;forward.set(Math.sin(yaw),0,Math.cos(yaw));candidate.copy(playerRoot.position).addScaledVector(forward,activeDef.previewDistance);preview.position.set(candidate.x,0,candidate.z);preview.rotation.y=yaw;const fp={x:candidate.x,z:candidate.z,hx:activeDef.footprint.hx,hz:activeDef.footprint.hz};valid=!collision?.isFootprintBlocked?.(fp);setPreviewMaterial(preview,valid);confirm.classList.toggle('valid',valid);confirm.classList.toggle('invalid',!valid);confirm.disabled=!valid;if(status){status.textContent=valid?'Placement clear':'Placement blocked';status.classList.toggle('valid',valid);status.classList.toggle('invalid',!valid);}}
 function place(){if(!preview||!activeDef||!valid)return;restoreMaterials(preview);preview.traverse(o=>{if(o.isMesh){o.material=o.userData.originalMaterial||o.material;o.userData.originalMaterial=null;}});const placed=preview,def=activeDef,id=`${def.id}-${++serial}`;placed.name=id;preview=null;const yaw=placed.rotation.y,entranceOffset=2.3;const entrance={x:placed.position.x+Math.sin(yaw)*entranceOffset,z:placed.position.z+Math.cos(yaw)*entranceOffset};foliage?.clearFootprint?.({x:placed.position.x,z:placed.position.z,hx:def.footprint.hx,hz:def.footprint.hz,margin:.9});collision?.registerBox?.({id,x:placed.position.x,z:placed.position.z,hx:def.footprint.hx,hz:def.footprint.hz});pathNetwork?.registerBuilding?.({id,role:def.id,entrance});pathNetwork?.connectNearest?.(id,{width:def.pathWidth,bend:.12});activeDef=null;confirm.classList.add('hidden');cancel.classList.add('hidden');if(status)status.classList.add('hidden');}
 buildButton.addEventListener('click',()=>{if(activeDef){stopPlacement();closeMenu();return;}menu.classList.toggle('hidden');});
 menu.querySelectorAll('[data-building]').forEach(button=>button.addEventListener('click',()=>beginPlacement(button.dataset.building)));
 confirm.addEventListener('click',place);cancel.addEventListener('click',()=>{stopPlacement();closeMenu();});
 function tick(){updatePreview();requestAnimationFrame(tick);}tick();
 const api={beginPlacement,stopPlacement,get active(){return activeDef?.id||null;}};globalThis.__villagerBuildingPlacement=api;return api;
}
