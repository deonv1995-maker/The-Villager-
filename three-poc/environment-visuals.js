import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const mat=(c,r=.88)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,flatShading:true});
const M={bark:mat(0x6a4228),barkDark:mat(0x4b2d1e),leaf:mat(0x4f8f3e),leafLight:mat(0x73aa4e),leafDark:mat(0x356d34),stone:mat(0x777d78),stoneLight:mat(0x9ba09a),stoneDark:mat(0x5e625e),grassB:mat(0x5b8e43),grassC:mat(0x7fb35a)};
const QUATERNIUS_BASE='https://raw.githubusercontent.com/agentkaerf/FreeModels/db3df04d1e4714298a09510b26fb6de6645138a2/Medieval%20Village%20MegaKit%5BStandard%5D/glTF/';
const loader=new GLTFLoader();
const modelCache=new Map();
function add(parent,g,m,p=[0,0,0],r=[0,0,0],s=[1,1,1],shadow=true){const o=new THREE.Mesh(g,m);o.position.set(...p);o.rotation.set(...r);o.scale.set(...s);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;}
function near(a,b,e=.12){return Math.abs(a-b)<=e;}
function findGroupAt(world,x,z){return world.children.find(o=>o instanceof THREE.Group&&near(o.position.x,x)&&near(o.position.z,z));}
function hideLegacyMeshes(group){group.traverse(o=>{if(o!==group&&o.isMesh)o.visible=false;});}
function setShadows(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
async function asset(name){if(!modelCache.has(name))modelCache.set(name,loader.loadAsync(QUATERNIUS_BASE+name+'.gltf').then(g=>g.scene));return (await modelCache.get(name)).clone(true);}
function groundAndCenter(root){root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),c=new THREE.Vector3();b.getCenter(c);root.position.x-=c.x;root.position.z-=c.z;root.position.y-=b.min.y;root.updateMatrixWorld(true);return root;}
async function module(name){const o=await asset(name);groundAndCenter(o);setShadows(o);return o;}
function makeTree(s=1){const g=new THREE.Group();g.scale.setScalar(s);add(g,new THREE.CylinderGeometry(.46,.72,3.7,7),M.bark,[0,1.85,0]);add(g,new THREE.CylinderGeometry(.28,.42,1.35,6),M.barkDark,[-.38,3.15,.04],[0,0,-.58]);add(g,new THREE.CylinderGeometry(.24,.36,1.25,6),M.barkDark,[.42,3.25,-.05],[0,0,.62]);const cl=[[0,4.65,0,1.55,M.leaf],[-.95,4.35,.1,1.15,M.leafDark],[.9,4.45,-.05,1.18,M.leafLight],[-.25,5.45,-.2,1.25,M.leafLight],[.55,5.15,.35,.95,M.leaf]];for(const [x,y,z,sc,m] of cl)add(g,new THREE.IcosahedronGeometry(1.18,1),m,[x,y,z],[0.15*x,0.2*z,0],[sc,sc*.92,sc]);return g;}
function makeRockCluster(s=1){const g=new THREE.Group();g.scale.setScalar(s);const pieces=[[-.42,.58,.02,1.05,.82,1.0,M.stone],[.48,.42,.24,.78,.62,.72,M.stoneLight],[.08,.3,-.52,.66,.52,.62,M.stoneDark],[-.72,.2,-.5,.38,.28,.42,M.stoneDark],[.72,.19,-.34,.32,.25,.36,M.stoneLight]];for(const [x,y,z,sx,sy,sz,m] of pieces)add(g,new THREE.DodecahedronGeometry(.8,0),m,[x,y,z],[x*.7,z*.6,(x+z)*.25],[sx,sy,sz]);return g;}
async function makeQuaterniusCottage(){
 const g=new THREE.Group();g.name='QuaterniusCottage';
 const frontNames=['Wall_Plaster_Window_Wide_Round','Wall_Plaster_Door_Round','Wall_Plaster_Window_Wide_Round'];
 for(let i=0;i<3;i++){const w=await module(frontNames[i]);w.position.set((i-1)*2,0,2);g.add(w);}
 for(let i=0;i<3;i++){const w=await module('Wall_Plaster_Straight');w.rotation.y=Math.PI;w.position.set((i-1)*2,0,-2);g.add(w);}
 for(const side of [-1,1])for(const z of [-1,1]){const w=await module('Wall_Plaster_Straight');w.rotation.y=side<0?Math.PI/2:-Math.PI/2;w.position.set(side*3,0,z);g.add(w);}
 const door=await module('Door_1_Round');door.position.set(0,0,2.08);g.add(door);
 for(const x of [-2,2]){const win=await module('Window_Wide_Round1');win.position.set(x,0,2.08);g.add(win);}
 const roof=await module('Roof_RoundTiles_6x4');roof.updateMatrixWorld(true);const rb=new THREE.Box3().setFromObject(roof),rs=new THREE.Vector3();rb.getSize(rs);roof.scale.set(6.55/rs.x,1,4.65/rs.z);roof.position.y=3.0;g.add(roof);
 const chimney=await module('Prop_Chimney');chimney.scale.setScalar(.72);chimney.position.set(1.65,2.8,-.45);g.add(chimney);
 g.scale.setScalar(.92);return g;
}
function addGroundDetail(world){let seed=90210;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<90;i++){const x=(rnd()-.5)*36,z=(rnd()-.5)*34;if(Math.abs(x)<3.7&&z>-9&&z<10)continue;const patch=add(world,new THREE.CircleGeometry(.28+rnd()*.52,6),i%3===0?M.grassC:M.grassB,[x,.012,z],[-Math.PI/2,0,rnd()*Math.PI],[1,.55+rnd()*.55,1],false);patch.receiveShadow=false;}for(let i=0;i<55;i++){const x=(rnd()-.5)*36,z=(rnd()-.5)*34;if(Math.abs(x)<3.5&&z>-9&&z<10)continue;const g=new THREE.Group();g.position.set(x,0,z);for(let b=0;b<3;b++){const blade=add(g,new THREE.ConeGeometry(.045,.4+rnd()*.28,4),b===1?M.grassC:M.grassB,[(b-1)*.09,.22,(b%2)*.07]);blade.rotation.z=(b-1)*.12;}world.add(g);}}
export function installEnvironmentVisuals({world}){if(!world)return null;const sync=[];
 const cottage=findGroupAt(world,0,-7.4);if(cottage){makeQuaterniusCottage().then(repl=>{repl.position.copy(cottage.position);world.add(repl);hideLegacyMeshes(cottage);}).catch(e=>console.warn('[The Villager] Quaternius cottage load failed; legacy cottage retained.',e));}
 const treeDefs=[[-6.6,2.7,1.05],[-11,-4,.9],[-13,7,1.05],[12,-5,.8],[14,8,1]];for(const [x,z,s] of treeDefs){const old=findGroupAt(world,x,z);if(!old)continue;hideLegacyMeshes(old);const repl=makeTree(s);repl.position.set(x,0,z);world.add(repl);repl.visible=old.visible;sync.push({old,repl});}
 const rockDefs=[[6.3,3,1],[-10,10,1],[10,11,1]];for(const [x,z,s] of rockDefs){const old=findGroupAt(world,x,z);if(!old)continue;hideLegacyMeshes(old);const repl=makeRockCluster(s);repl.position.set(x,0,z);world.add(repl);repl.visible=old.visible;sync.push({old,repl});}
 addGroundDetail(world);function tick(){for(const p of sync)p.repl.visible=p.old.visible;requestAnimationFrame(tick);}tick();return{sync};
}
