import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const PICKUP_RANGE=2.15;
const LOG_LENGTH=2.45;
const LOG_RADIUS=.22;
const CARRY_HEIGHT=1.18;
const CARRY_FORWARD=1.05;
const FALL_SECONDS=.9;

export function installLogConstructionSystem({world,playerRoot}){
 if(!world||!playerRoot)return null;
 const logs=new Map();let serial=0,carried=null;
 const bark=new THREE.MeshStandardMaterial({color:0x694126,roughness:.96,flatShading:true});
 const cut=new THREE.MeshStandardMaterial({color:0xc39a61,roughness:.92,flatShading:true});
 const leaf=new THREE.MeshStandardMaterial({color:0x3f7b3f,roughness:1,flatShading:true});
 const tmp=new THREE.Vector3();
 let carryButton=document.getElementById('carry-log-button');
 if(!carryButton){carryButton=document.createElement('button');carryButton.id='carry-log-button';carryButton.textContent='✋';carryButton.setAttribute('aria-label','Pick up or drop log');document.body.appendChild(carryButton);}
 Object.assign(carryButton.style,{position:'fixed',right:'36px',bottom:'178px',width:'64px',height:'64px',borderRadius:'50%',border:'4px solid #2c2118',background:'#c79a52',fontSize:'28px',zIndex:'10002',display:'none',touchAction:'none'});
 function createLogVisual(){const g=new THREE.Group();g.name='PhysicalLog';const trunk=new THREE.Mesh(new THREE.CylinderGeometry(LOG_RADIUS,LOG_RADIUS*.92,LOG_LENGTH,8),bark);trunk.rotation.z=Math.PI/2;trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);for(const x of [-LOG_LENGTH/2,LOG_LENGTH/2]){const end=new THREE.Mesh(new THREE.CircleGeometry(LOG_RADIUS*.92,8),cut);end.position.x=x;end.rotation.y=x<0?-Math.PI/2:Math.PI/2;g.add(end);}return g;}
 function createFelledTreeVisual(scale=1){const g=new THREE.Group();g.name='FelledTree';const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.34*scale,.48*scale,4.9*scale,8),bark);trunk.position.y=2.45*scale;trunk.castShadow=true;trunk.receiveShadow=true;g.add(trunk);for(const [x,y,z,s] of [[-.65,4.5,.1,.9],[.55,4.75,-.05,.95],[0,5.35,0,1]]){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.95*scale*s,1),leaf);crown.position.set(x*scale,y*scale,z*scale);crown.castShadow=true;crown.receiveShadow=true;g.add(crown);}return g;}
 function spawnLog({x,z,rotation=0,sourceId=null}){const visual=createLogVisual(),id=`log-${++serial}`;visual.position.set(x,LOG_RADIUS,z);visual.rotation.y=rotation;world.add(visual);const log={id,sourceId,visual,state:'ground'};logs.set(id,log);return log;}
 function nearestGroundLog(){let best=null,d=Infinity;for(const log of logs.values()){if(log.state!=='ground')continue;const dist=Math.hypot(playerRoot.position.x-log.visual.position.x,playerRoot.position.z-log.visual.position.z);if(dist<d){d=dist;best=log;}}return d<=PICKUP_RANGE?best:null;}
 function pickup(log=nearestGroundLog()){if(!log||carried)return false;carried=log;log.state='carried';return true;}
 function drop(){if(!carried)return false;carried.state='ground';carried.visual.position.y=LOG_RADIUS;carried=null;return true;}
 function toggleCarry(){return carried?drop():pickup();}
 function spawnLogsNow(resource,count=3){const angle=Math.atan2(playerRoot.position.x-resource.x,playerRoot.position.z-resource.z)+Math.PI/2;for(let i=0;i<count;i++){const side=(i-(count-1)/2)*.52;spawnLog({x:resource.x+Math.cos(angle)*side,z:resource.z-Math.sin(angle)*side,rotation:angle+(i%2?0.08:-0.08),sourceId:resource.id});}}
 function fellTree(resource,count=3){const visual=createFelledTreeVisual(resource.scale||1),group=new THREE.Group();group.position.set(resource.x,0,resource.z);group.add(visual);world.add(group);const awayX=resource.x-playerRoot.position.x,awayZ=resource.z-playerRoot.position.z;group.rotation.y=Math.atan2(awayX,awayZ);let elapsed=0,last=performance.now();function animateFall(now){const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;const t=Math.min(1,elapsed/FALL_SECONDS),ease=1-Math.pow(1-t,3);visual.rotation.x=ease*(Math.PI/2-.05);if(t<1){requestAnimationFrame(animateFall);return;}world.remove(group);group.traverse(o=>{o.geometry?.dispose?.();});spawnLogsNow(resource,count);}requestAnimationFrame(animateFall);}
 carryButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();toggleCarry();});
 function tick(){requestAnimationFrame(tick);const nearby=nearestGroundLog();carryButton.style.display=(carried||nearby)?'block':'none';carryButton.textContent=carried?'⬇️':'✋';if(!carried)return;const yaw=playerRoot.rotation.y;tmp.set(Math.sin(yaw)*CARRY_FORWARD,CARRY_HEIGHT,Math.cos(yaw)*CARRY_FORWARD).add(playerRoot.position);carried.visual.position.lerp(tmp,.28);carried.visual.rotation.y=yaw;carried.visual.rotation.z=0;}
 requestAnimationFrame(tick);
 // spawnTreeLogs remains the streamed-resource contract, but now means "fell tree, then create logs".
 const api={logs,spawnLog,spawnLogsNow,fellTree,spawnTreeLogs:fellTree,pickup,drop,toggleCarry,get carried(){return carried;},get nearest(){return nearestGroundLog();}};globalThis.__villagerLogConstruction=api;return api;
}
