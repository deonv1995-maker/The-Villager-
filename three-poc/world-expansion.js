import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createVillageMaterials } from './material-library.js?v=064';

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

function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function mesh(parent,geometry,material,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}

function makeTree(scale=1){
 const M=createVillageMaterials(),g=new THREE.Group();g.name='VillageTreeExpanded';g.scale.setScalar(scale);
 mesh(g,new THREE.CylinderGeometry(.42,.68,4.2,7),M.bark,[0,2.1,0]);
 mesh(g,new THREE.CylinderGeometry(.27,.42,1.35,7),M.barkDark,[0,4.55,0],[0,0,.05]);
 const leafA=new THREE.MeshStandardMaterial({color:0x4f8f3e,roughness:1,flatShading:true}),leafB=new THREE.MeshStandardMaterial({color:0x73aa4e,roughness:1,flatShading:true}),leafC=new THREE.MeshStandardMaterial({color:0x356d34,roughness:1,flatShading:true});
 const foliage=[[-.95,4.5,.15,1.15,leafC],[.9,4.7,-.05,1.12,leafB],[-.25,5.45,-.25,1.28,leafA],[.55,5.55,.25,1.02,leafB],[0,6.15,0,.92,leafA]];
 for(const [x,y,z,s,m] of foliage)mesh(g,new THREE.IcosahedronGeometry(1.2,1),m,[x,y,z],[0,(x+z)*.12,0],[s,s*.95,s]);
 return g;
}

function makeRock(scale=1){
 const M=createVillageMaterials(),g=new THREE.Group();g.name='VillageRockExpanded';g.scale.setScalar(scale);
 const parts=[[-.65,.55,.05,1.05,.72,M.stoneDark],[.42,.43,.18,.82,.62,M.stone],[.08,.3,-.55,.68,.46,M.stoneLight],[.8,.23,-.38,.42,.3,M.stoneWarm]];
 for(const [x,y,z,sx,sy,m] of parts)mesh(g,new THREE.DodecahedronGeometry(.9,0),m,[x,y,z],[x*.22,z*.3,y*.14],[sx,sy,sx*.9]);
 return g;
}

function createStateAnchor(x,z){const g=new THREE.Group();g.name='ExpandedResourceState';g.position.set(x,0,z);return g;}

export function installExpandedWorld({world}){
 if(!world)return {sync:[]};
 const root=new THREE.Group();root.name='ExpandedWorld067';world.add(root);
 const sync=[],rnd=seeded(67021),occupied=[];
 const clear=(x,z,r=3.1)=>occupied.every(p=>Math.hypot(x-p.x,z-p.z)>r+p.r);
 const reserve=(x,z,r)=>occupied.push({x,z,r});

 // Grow the existing ground instead of layering another coplanar plane over it.
 // This keeps the central village visually stable while making the full 180x180 area walkable.
 const ground=world.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry'&&Math.abs((o.geometry.parameters?.width||0)-100)<.01&&Math.abs((o.geometry.parameters?.height||0)-100)<.01);
 if(ground){ground.scale.x=Math.max(ground.scale.x,2);ground.scale.y=Math.max(ground.scale.y,2);ground.updateMatrixWorld(true);}
 const scene=world.parent;if(scene?.fog){scene.fog.near=42;scene.fog.far=155;}

 // Keep the original village as a quieter central clearing; expansion begins outside it.
 reserve(0,0,17);
 const addResource=(type,x,z,scale)=>{
  const state=createStateAnchor(x,z);world.add(state);
  const visual=type==='tree'?makeTree(scale):makeRock(scale);visual.position.set(x,0,z);root.add(visual);
  sync.push({old:state,repl:visual});reserve(x,z,type==='tree'?2.2:1.7);
 };

 // Wider world, but still intentionally sparse enough for mobile performance.
 let trees=0,rocks=0,attempts=0;
 while((trees<78||rocks<30)&&attempts++<2600){
  const angle=rnd()*Math.PI*2,radius=18+rnd()*(WORLD_LIMIT-22),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  if(Math.abs(x)>WORLD_LIMIT-3||Math.abs(z)>WORLD_LIMIT-3||!clear(x,z))continue;
  const treeChance=rnd();
  if(trees<78&&(treeChance<.73||rocks>=30)){addResource('tree',x,z,.72+rnd()*.5);trees++;}
  else if(rocks<30){addResource('rock',x,z,.72+rnd()*.42);rocks++;}
 }

 const grassMat=new THREE.MeshStandardMaterial({color:0x517f3d,roughness:1,flatShading:true});
 for(let i=0;i<260;i++){
  const angle=rnd()*Math.PI*2,radius=16+rnd()*(WORLD_LIMIT-18),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  if(Math.abs(x)>WORLD_LIMIT||Math.abs(z)>WORLD_LIMIT)continue;
  const tuft=new THREE.Group();tuft.position.set(x,0,z);for(let b=0;b<3;b++)mesh(tuft,new THREE.ConeGeometry(.055,.35+rnd()*.28,4),grassMat,[(b-1)*.09,.2,(b%2)*.07],[0,rnd()*Math.PI,0]);root.add(tuft);
 }
 return {root,sync,limit:WORLD_LIMIT};
}
