import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const PICKUP_RANGE=2.15;
const LOG_LENGTH=2.45;
const LOG_RADIUS=.22;
const CARRY_HEIGHT=1.18;
const CARRY_FORWARD=1.05;

export function installLogConstructionSystem({world,playerRoot}){
 if(!world||!playerRoot)return null;
 const logs=new Map();let serial=0,carried=null;
 const bark=new THREE.MeshStandardMaterial({color:0x694126,roughness:.96,flatShading:true});
 const cut=new THREE.MeshStandardMaterial({color:0xc39a61,roughness:.92,flatShading:true});
 const tmp=new THREE.Vector3();
 function createLogVisual(){const g=new THREE.Group();g.name='PhysicalLog';const trunk=new THREE.Mesh(new THREE.CylinderGeometry(LOG_RADIUS,LOG_RADIUS*.92,LOG_LENGTH,8),bark);trunk.rotation.z=Math.PI/2;trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);for(const x of [-LOG_LENGTH/2,LOG_LENGTH/2]){const end=new THREE.Mesh(new THREE.CircleGeometry(LOG_RADIUS*.92,8),cut);end.position.x=x;end.rotation.y=x<0?-Math.PI/2:Math.PI/2;g.add(end);}return g;}
 function spawnLog({x,z,rotation=0,sourceId=null}){const visual=createLogVisual(),id=`log-${++serial}`;visual.position.set(x,LOG_RADIUS,z);visual.rotation.y=rotation;world.add(visual);const log={id,sourceId,visual,state:'ground'};logs.set(id,log);return log;}
 function nearestGroundLog(){let best=null,d=Infinity;for(const log of logs.values()){if(log.state!=='ground')continue;const dist=Math.hypot(playerRoot.position.x-log.visual.position.x,playerRoot.position.z-log.visual.position.z);if(dist<d){d=dist;best=log;}}return d<=PICKUP_RANGE?best:null;}
 function pickup(log=nearestGroundLog()){if(!log||carried)return false;carried=log;log.state='carried';return true;}
 function drop(){if(!carried)return false;carried.state='ground';carried.visual.position.y=LOG_RADIUS;carried=null;return true;}
 function toggleCarry(){return carried?drop():pickup();}
 function spawnTreeLogs(resource,count=3){const angle=Math.atan2(playerRoot.position.x-resource.x,playerRoot.position.z-resource.z)+Math.PI/2;for(let i=0;i<count;i++){const side=(i-(count-1)/2)*.52;spawnLog({x:resource.x+Math.cos(angle)*side,z:resource.z-Math.sin(angle)*side,rotation:angle+(i%2?0.08:-0.08),sourceId:resource.id});}}
 function tick(){requestAnimationFrame(tick);if(!carried)return;const yaw=playerRoot.rotation.y;tmp.set(Math.sin(yaw)*CARRY_FORWARD,CARRY_HEIGHT,Math.cos(yaw)*CARRY_FORWARD).add(playerRoot.position);carried.visual.position.lerp(tmp,.28);carried.visual.rotation.y=yaw;carried.visual.rotation.z=0;}
 requestAnimationFrame(tick);
 const api={logs,spawnLog,spawnTreeLogs,pickup,drop,toggleCarry,get carried(){return carried;},get nearest(){return nearestGroundLog();}};globalThis.__villagerLogConstruction=api;return api;
}
