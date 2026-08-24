import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const mat=(c,r=.88)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,flatShading:true});
const M={bark:mat(0x6a4228),leaf:mat(0x4f8f3e),leafLight:mat(0x73aa4e),leafDark:mat(0x356d34),stone:mat(0x777d78),stoneLight:mat(0x9ba09a),stoneDark:mat(0x5e625e),grassB:mat(0x5b8e43),grassC:mat(0x7fb35a),plaster:mat(0xb99b68),timber:mat(0x4c2d1d),roof:mat(0x8c432c),roofDark:mat(0x683326),door:mat(0x392419),glass:mat(0x79a7a0,.5)};
function add(p,g,m,pos=[0,0,0],r=[0,0,0],s=[1,1,1],shadow=true){const o=new THREE.Mesh(g,m);o.position.set(...pos);o.rotation.set(...r);o.scale.set(...s);o.castShadow=shadow;o.receiveShadow=true;p.add(o);return o;}
function near(a,b,e=.12){return Math.abs(a-b)<=e;}function findGroupAt(w,x,z){return w.children.find(o=>o instanceof THREE.Group&&near(o.position.x,x)&&near(o.position.z,z));}function hideLegacyMeshes(g){g.traverse(o=>{if(o!==g&&o.isMesh)o.visible=false;});}
function makeTree(s=1){const g=new THREE.Group();g.scale.setScalar(s);add(g,new THREE.CylinderGeometry(.46,.72,3.7,7),M.bark,[0,1.85,0]);const cl=[[0,4.65,0,1.55,M.leaf],[-.95,4.35,.1,1.15,M.leafDark],[.9,4.45,-.05,1.18,M.leafLight],[-.25,5.45,-.2,1.25,M.leafLight],[.55,5.15,.35,.95,M.leaf]];for(const [x,y,z,sc,m] of cl)add(g,new THREE.IcosahedronGeometry(1.18,1),m,[x,y,z],[0,0,0],[sc,sc*.92,sc]);return g;}
function makeRockCluster(s=1){const g=new THREE.Group();g.scale.setScalar(s);for(const [x,y,z,sc,m] of [[-.42,.58,.02,1,M.stone],[.48,.42,.24,.72,M.stoneLight],[.08,.3,-.52,.62,M.stoneDark]])add(g,new THREE.DodecahedronGeometry(.8,0),m,[x,y,z],[x,z,0],[sc,sc*.8,sc]);return g;}
function beam(g,x,y,z,sx,sy,sz){return add(g,new THREE.BoxGeometry(1,1,1),M.timber,[x,y,z],[0,0,0],[sx,sy,sz]);}
function windowSet(g,x,z,side=false){if(!side){add(g,new THREE.BoxGeometry(.82,.72,.08),M.glass,[x,1.62,z]);beam(g,x,1.62,z+.055,.075,.78,.07);beam(g,x,1.62,z+.055,.88,.075,.07);beam(g,x,1.18,z+.04,1.05,.12,.12);}else{add(g,new THREE.BoxGeometry(.08,.72,.82),M.glass,[x,1.62,z]);beam(g,x+.055,1.62,z,.07,.78,.075);beam(g,x+.055,1.62,z,.07,.075,.88);}}
function makeCottage(){const g=new THREE.Group();g.name='VillageCottage038';const W=5.8,D=4.35,H=2.75;
 add(g,new THREE.BoxGeometry(W,H,D),M.plaster,[0,H/2,0]);
 // timber frame gives one coherent silhouette instead of overlapping modular pieces
 beam(g,-W/2+.08,H/2,D/2+.04,.16,H,.16);beam(g,W/2-.08,H/2,D/2+.04,.16,H,.16);beam(g,0,H-.08,D/2+.04,W,.16,.16);beam(g,0,.14,D/2+.04,W,.2,.18);
 beam(g,-W/2+.08,H/2,-D/2-.04,.16,H,.16);beam(g,W/2-.08,H/2,-D/2-.04,.16,H,.16);beam(g,0,H-.08,-D/2-.04,W,.16,.16);
 for(const x of [-W/2+.08,W/2-.08]){beam(g,x,H/2,0,.16,H,D);}
 // recessed-looking central door and symmetrical windows
 add(g,new THREE.BoxGeometry(1.05,2.05,.12),M.door,[0,1.03,D/2+.08]);beam(g,-.61,1.08,D/2+.13,.13,2.22,.16);beam(g,.61,1.08,D/2+.13,.13,2.22,.16);beam(g,0,2.18,D/2+.13,1.35,.13,.16);
 windowSet(g,-1.85,D/2+.07);windowSet(g,1.85,D/2+.07);windowSet(g,-W/2-.07,0,true);windowSet(g,W/2+.07,0,true);
 // clean pitched roof made as one roof mass, aligned exactly to footprint
 const roof=add(g,new THREE.ConeGeometry(1,1,4),M.roof,[0,H+1.03,0],[0,Math.PI/4,0],[4.15,2.05,3.12]);roof.geometry.computeVertexNormals();
 // dark fascia visually locks roof to walls
 beam(g,0,H+.08,D/2+.32,W+1,.12,.16);beam(g,0,H+.08,-D/2-.32,W+1,.12,.16);
 add(g,new THREE.BoxGeometry(.48,1.55,.48),M.stone,[1.65,H+1.15,-.55]);add(g,new THREE.BoxGeometry(.58,.16,.58),M.stoneLight,[1.65,H+1.94,-.55]);
 // small front step
 add(g,new THREE.BoxGeometry(1.45,.18,.55),M.stoneLight,[0,.09,D/2+.34]);
 return g;}
function addGroundDetail(w){let seed=90210,r=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<70;i++){const x=(r()-.5)*36,z=(r()-.5)*34;if(Math.abs(x)<3.7&&z>-9&&z<10)continue;add(w,new THREE.CircleGeometry(.25+r()*.45,6),i%3?M.grassB:M.grassC,[x,.012,z],[-Math.PI/2,0,r()*Math.PI],[1,.7,1],false);}}
export function installEnvironmentVisuals({world}){if(!world)return null;const sync=[];const cottage=findGroupAt(world,0,-7.4);if(cottage){const repl=makeCottage();repl.position.copy(cottage.position);world.add(repl);hideLegacyMeshes(cottage);}
 const trees=[[-6.6,2.7,1.05],[-11,-4,.9],[-13,7,1.05],[12,-5,.8],[14,8,1]];for(const [x,z,s] of trees){const old=findGroupAt(world,x,z);if(!old)continue;hideLegacyMeshes(old);const repl=makeTree(s);repl.position.set(x,0,z);world.add(repl);sync.push({old,repl});}
 const rocks=[[6.3,3,1],[-10,10,1],[10,11,1]];for(const [x,z,s] of rocks){const old=findGroupAt(world,x,z);if(!old)continue;hideLegacyMeshes(old);const repl=makeRockCluster(s);repl.position.set(x,0,z);world.add(repl);sync.push({old,repl});}addGroundDetail(world);function tick(){for(const p of sync)p.repl.visible=p.old.visible;requestAnimationFrame(tick);}tick();return{sync};}
