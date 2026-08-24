import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const mat=(c,r=.88)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,flatShading:true});
const M={
  bark:mat(0x6a4228),barkDark:mat(0x4b2d1e),leaf:mat(0x4f8f3e),leafLight:mat(0x73aa4e),leafDark:mat(0x356d34),
  stone:mat(0x777d78),stoneLight:mat(0x9ba09a),stoneDark:mat(0x5e625e),mortar:mat(0xb8ad95),
  wall:mat(0xc7a96d),plaster:mat(0xd9c58f),timber:mat(0x5a3826),timberDark:mat(0x3e291d),roof:mat(0x8d452d),roofDark:mat(0x6b3325),
  grassA:mat(0x6b9f4d),grassB:mat(0x5b8e43),grassC:mat(0x7fb35a),glass:mat(0x8fc7cf,.45),door:mat(0x4b2d1e)
};
function add(parent,g,m,p=[0,0,0],r=[0,0,0],s=[1,1,1],shadow=true){const o=new THREE.Mesh(g,m);o.position.set(...p);o.rotation.set(...r);o.scale.set(...s);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;}
function near(a,b,e=.12){return Math.abs(a-b)<=e;}
function findGroupAt(world,x,z){return world.children.find(o=>o instanceof THREE.Group&&near(o.position.x,x)&&near(o.position.z,z));}
function makeTree(s=1){const g=new THREE.Group();g.scale.setScalar(s);
  add(g,new THREE.CylinderGeometry(.46,.72,3.7,7),M.bark,[0,1.85,0]);
  add(g,new THREE.CylinderGeometry(.28,.42,1.35,6),M.barkDark,[-.38,3.15,.04],[0,0,-.58]);
  add(g,new THREE.CylinderGeometry(.24,.36,1.25,6),M.barkDark,[.42,3.25,-.05],[0,0,.62]);
  const cl=[[0,4.65,0,1.55,M.leaf],[-.95,4.35,.1,1.15,M.leafDark],[.9,4.45,-.05,1.18,M.leafLight],[-.25,5.45,-.2,1.25,M.leafLight],[.55,5.15,.35,.95,M.leaf]];
  for(const [x,y,z,sc,m] of cl)add(g,new THREE.IcosahedronGeometry(1.18,1),m,[x,y,z],[0.15*x,0.2*z,0],[sc,sc*.92,sc]);
  for(const [x,z] of [[-.55,.2],[.5,.1],[0,-.45]])add(g,new THREE.ConeGeometry(.11,.7,5),M.grassB,[x,.35,z],[0,0,(x||.1)*.22]);
  return g;
}
function makeRockCluster(s=1){const g=new THREE.Group();g.scale.setScalar(s);const pieces=[[-.42,.58,.02,1.05,.82,1.0,M.stone],[.48,.42,.24,.78,.62,.72,M.stoneLight],[.08,.3,-.52,.66,.52,.62,M.stoneDark],[-.72,.2,-.5,.38,.28,.42,M.stoneDark],[.72,.19,-.34,.32,.25,.36,M.stoneLight]];for(const [x,y,z,sx,sy,sz,m] of pieces)add(g,new THREE.DodecahedronGeometry(.8,0),m,[x,y,z],[x*.7,z*.6,(x+z)*.25],[sx,sy,sz]);return g;}
function makeCottage(){const g=new THREE.Group();
  add(g,new THREE.BoxGeometry(5.65,2.55,4.05),M.wall,[0,1.28,0]);
  add(g,new THREE.BoxGeometry(5.72,.18,4.12),M.mortar,[0,.1,0]);
  add(g,new THREE.ConeGeometry(4.1,2.55,4),M.roof,[0,3.28,0],[0,Math.PI/4,0]);
  add(g,new THREE.ConeGeometry(3.82,2.24,4),M.roofDark,[0,3.19,0],[0,Math.PI/4,0],[1,1,.985]);
  // front timber frame
  add(g,new THREE.BoxGeometry(5.72,.16,.16),M.timber,[0,.35,2.09]);
  add(g,new THREE.BoxGeometry(5.72,.16,.16),M.timber,[0,2.25,2.09]);
  for(const x of [-2.45,-1.25,0,1.25,2.45])add(g,new THREE.BoxGeometry(.16,2.05,.16),M.timber,[x,1.3,2.09]);
  add(g,new THREE.BoxGeometry(.95,1.9,.22),M.door,[0,1.0,2.13]);
  add(g,new THREE.BoxGeometry(.12,1.72,.05),M.timberDark,[0,1.0,2.27]);
  add(g,new THREE.BoxGeometry(.62,.12,.08),M.timberDark,[0,1.0,2.28]);
  for(const x of [-1.62,1.62]){add(g,new THREE.BoxGeometry(.82,.82,.18),M.glass,[x,1.48,2.14]);add(g,new THREE.BoxGeometry(.08,.84,.04),M.timberDark,[x,1.48,2.25]);add(g,new THREE.BoxGeometry(.84,.08,.04),M.timberDark,[x,1.48,2.25]);}
  add(g,new THREE.BoxGeometry(.48,1.65,.48),M.stone,[1.82,3.5,-.25]);add(g,new THREE.BoxGeometry(.58,.18,.58),M.stoneLight,[1.82,4.3,-.25]);
  // small foundation stones
  for(let i=-2;i<=2;i++)add(g,new THREE.DodecahedronGeometry(.22,0),i%2?M.stone:M.stoneLight,[i*1.05,.2,2.03],[0,i*.25,0],[1.15,.75,.75]);
  return g;
}
function addGroundDetail(world){let seed=90210;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<90;i++){const x=(rnd()-.5)*36,z=(rnd()-.5)*34;if(Math.abs(x)<3.7&&z>-9&&z<10)continue;const patch=add(world,new THREE.CircleGeometry(.28+rnd()*.52,6),i%3===0?M.grassC:M.grassB,[x,.012,z],[-Math.PI/2,0,rnd()*Math.PI],[1,.55+rnd()*.55,1],false);patch.receiveShadow=false;}for(let i=0;i<55;i++){const x=(rnd()-.5)*36,z=(rnd()-.5)*34;if(Math.abs(x)<3.5&&z>-9&&z<10)continue;const g=new THREE.Group();g.position.set(x,0,z);for(let b=0;b<3;b++){const blade=add(g,new THREE.ConeGeometry(.045,.4+rnd()*.28,4),b===1?M.grassC:M.grassB,[(b-1)*.09,.22,(b%2)*.07]);blade.rotation.z=(b-1)*.12;}world.add(g);}}
export function installEnvironmentVisuals({world}){if(!world)return null;const sync=[];
  const cottage=findGroupAt(world,0,-7.4);if(cottage){cottage.visible=false;const repl=makeCottage();repl.position.copy(cottage.position);world.add(repl);}
  const treeDefs=[[-6.6,2.7,1.05],[-11,-4,.9],[-13,7,1.05],[12,-5,.8],[14,8,1]];for(const [x,z,s] of treeDefs){const old=findGroupAt(world,x,z);if(!old)continue;old.visible=false;const repl=makeTree(s);repl.position.set(x,0,z);world.add(repl);sync.push({old,repl});}
  const rockDefs=[[6.3,3,1],[-10,10,1],[10,11,1]];for(const [x,z,s] of rockDefs){const old=findGroupAt(world,x,z);if(!old)continue;old.visible=false;const repl=makeRockCluster(s);repl.position.set(x,0,z);world.add(repl);sync.push({old,repl});}
  addGroundDetail(world);
  function tick(){for(const p of sync)p.repl.visible=p.old.visible;requestAnimationFrame(tick);}tick();
  return{sync};
}
