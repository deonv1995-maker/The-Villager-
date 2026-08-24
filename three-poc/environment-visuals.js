import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
const mat=(c,r=.88)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,flatShading:true});
const M={bark:mat(0x6a4228),barkDark:mat(0x4b2d1e),leaf:mat(0x4f8f3e),leafLight:mat(0x73aa4e),leafDark:mat(0x356d34),stone:mat(0x777d78),stoneLight:mat(0x9ba09a),stoneDark:mat(0x5e625e),grassB:mat(0x5b8e43),grassC:mat(0x7fb35a),roof:mat(0x75402f),door:mat(0x3e291d),glass:mat(0x83b7b5,.45)};
const BASE='https://raw.githubusercontent.com/agentkaerf/FreeModels/db3df04d1e4714298a09510b26fb6de6645138a2/Medieval%20Village%20MegaKit%5BStandard%5D/glTF/';
const loader=new GLTFLoader(),cache=new Map();
function add(p,g,m,pos=[0,0,0],r=[0,0,0],s=[1,1,1],shadow=true){const o=new THREE.Mesh(g,m);o.position.set(...pos);o.rotation.set(...r);o.scale.set(...s);o.castShadow=shadow;o.receiveShadow=true;p.add(o);return o;}
function near(a,b,e=.12){return Math.abs(a-b)<=e;} function findGroupAt(w,x,z){return w.children.find(o=>o instanceof THREE.Group&&near(o.position.x,x)&&near(o.position.z,z));} function hideLegacyMeshes(g){g.traverse(o=>{if(o!==g&&o.isMesh)o.visible=false;});}
async function asset(n){if(!cache.has(n))cache.set(n,loader.loadAsync(BASE+n+'.gltf').then(x=>x.scene));return (await cache.get(n)).clone(true);}
function ground(o){o.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o),c=new THREE.Vector3();b.getCenter(c);o.position.x-=c.x;o.position.z-=c.z;o.position.y-=b.min.y;o.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});return o;}
async function module(n){return ground(await asset(n));}
function makeTree(s=1){const g=new THREE.Group();g.scale.setScalar(s);add(g,new THREE.CylinderGeometry(.46,.72,3.7,7),M.bark,[0,1.85,0]);const cl=[[0,4.65,0,1.55,M.leaf],[-.95,4.35,.1,1.15,M.leafDark],[.9,4.45,-.05,1.18,M.leafLight],[-.25,5.45,-.2,1.25,M.leafLight],[.55,5.15,.35,.95,M.leaf]];for(const [x,y,z,sc,m] of cl)add(g,new THREE.IcosahedronGeometry(1.18,1),m,[x,y,z],[0,0,0],[sc,sc*.92,sc]);return g;}
function makeRockCluster(s=1){const g=new THREE.Group();g.scale.setScalar(s);for(const [x,y,z,sc,m] of [[-.42,.58,.02,1,M.stone],[.48,.42,.24,.72,M.stoneLight],[.08,.3,-.52,.62,M.stoneDark]])add(g,new THREE.DodecahedronGeometry(.8,0),m,[x,y,z],[x,z,0],[sc,sc*.8,sc]);return g;}
async function makeQuaterniusCottage(){const g=new THREE.Group();g.name='QuaterniusCottage';
 for(let i=0;i<3;i++){const n=i===1?'Wall_Plaster_Door_Round':'Wall_Plaster_Straight',w=await module(n);w.position.set((i-1)*2,0,2);g.add(w);}
 for(let i=0;i<3;i++){const w=await module('Wall_Plaster_Straight');w.rotation.y=Math.PI;w.position.set((i-1)*2,0,-2);g.add(w);}
 for(const side of [-1,1])for(const z of [-1,1]){const w=await module('Wall_Plaster_Straight');w.rotation.y=side<0?Math.PI/2:-Math.PI/2;w.position.set(side*3,0,z);g.add(w);}
 add(g,new THREE.BoxGeometry(.9,1.85,.16),M.door,[0,.93,2.18]);for(const x of [-2,2]){add(g,new THREE.BoxGeometry(.85,.8,.12),M.glass,[x,1.55,2.2]);add(g,new THREE.BoxGeometry(.08,.85,.05),M.door,[x,1.55,2.28]);add(g,new THREE.BoxGeometry(.9,.08,.05),M.door,[x,1.55,2.28]);}
 add(g,new THREE.ConeGeometry(4.15,2.3,4),M.roof,[0,4.05,0],[0,Math.PI/4,0],[1,1,.76]);add(g,new THREE.BoxGeometry(.48,1.5,.48),M.stone,[1.65,4.25,-.45]);
 g.scale.setScalar(.92);return g;}
function addGroundDetail(w){let seed=90210,r=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<70;i++){const x=(r()-.5)*36,z=(r()-.5)*34;if(Math.abs(x)<3.7&&z>-9&&z<10)continue;add(w,new THREE.CircleGeometry(.25+r()*.45,6),i%3?M.grassB:M.grassC,[x,.012,z],[-Math.PI/2,0,r()*Math.PI],[1,.7,1],false);}}
export function installEnvironmentVisuals({world}){if(!world)return null;const sync=[];const cottage=findGroupAt(world,0,-7.4);if(cottage){makeQuaterniusCottage().then(repl=>{repl.position.copy(cottage.position);world.add(repl);hideLegacyMeshes(cottage);console.info('[The Villager] Quaternius cottage installed');}).catch(e=>console.warn('[The Villager] cottage load failed',e));}
 const trees=[[-6.6,2.7,1.05],[-11,-4,.9],[-13,7,1.05],[12,-5,.8],[14,8,1]];for(const [x,z,s] of trees){const old=findGroupAt(world,x,z);if(!old)continue;hideLegacyMeshes(old);const repl=makeTree(s);repl.position.set(x,0,z);world.add(repl);sync.push({old,repl});}
 const rocks=[[6.3,3,1],[-10,10,1],[10,11,1]];for(const [x,z,s] of rocks){const old=findGroupAt(world,x,z);if(!old)continue;hideLegacyMeshes(old);const repl=makeRockCluster(s);repl.position.set(x,0,z);world.add(repl);sync.push({old,repl});}addGroundDetail(world);function tick(){for(const p of sync)p.repl.visible=p.old.visible;requestAnimationFrame(tick);}tick();return{sync};}
