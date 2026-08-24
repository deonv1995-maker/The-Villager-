import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const PLAYER_RADIUS=.48;
const EPS=.12;
const near=(a,b,e=EPS)=>Math.abs(a-b)<=e;
const findGroupAt=(world,x,z)=>world.children.find(o=>o instanceof THREE.Group&&near(o.position.x,x)&&near(o.position.z,z));

function circleBlocked(x,z,c,r=PLAYER_RADIUS){if(c.dynamicVisible&&c.dynamicVisible()===false)return false;return Math.hypot(x-c.x,z-c.z)<c.r+r;}
function boxBlocked(x,z,b,r=PLAYER_RADIUS){const dx=Math.max(Math.abs(x-b.x)-b.hx,0),dz=Math.max(Math.abs(z-b.z)-b.hz,0);return dx*dx+dz*dz<r*r;}
function boxOverlapsBox(a,b,pad=.18){return Math.abs(a.x-b.x)<a.hx+b.hx+pad&&Math.abs(a.z-b.z)<a.hz+b.hz+pad;}
function boxOverlapsCircle(b,c,pad=.18){const dx=Math.max(Math.abs(c.x-b.x)-b.hx,0),dz=Math.max(Math.abs(c.z-b.z)-b.hz,0);return dx*dx+dz*dz<(c.r+pad)*(c.r+pad);}
function segmentBlocked(x,z,s,r=PLAYER_RADIUS){const abx=s.bx-s.ax,abz=s.bz-s.az,len2=abx*abx+abz*abz||1,t=THREE.MathUtils.clamp(((x-s.ax)*abx+(z-s.az)*abz)/len2,0,1),px=s.ax+abx*t,pz=s.az+abz*t;return Math.hypot(x-px,z-pz)<r+s.r;}
function boxOverlapsSegment(b,s,pad=.18){const samples=8;for(let i=0;i<=samples;i++){const t=i/samples,x=s.ax+(s.bx-s.ax)*t,z=s.az+(s.bz-s.az)*t;if(Math.abs(x-b.x)<=b.hx+pad+s.r&&Math.abs(z-b.z)<=b.hz+pad+s.r)return true;}return false;}

export function installWorldCollision({playerRoot,world}){
 if(!playerRoot||!world)return null;
 const boxes=[{id:'cottage',x:0,z:-7.4,hx:4.05,hz:2.85}];
 const circles=[{id:'well',x:-3.3,z:-1.5,r:1.28}];
 const treeDefs=[[-6.6,2.7,.78],[-11,-4,.68],[-13,7,.78],[12,-5,.64],[14,8,.74]],rockDefs=[[6.3,3,.98],[-10,10,.95],[10,11,.95]];
 for(const [x,z,r] of treeDefs){const owner=findGroupAt(world,x,z);circles.push({x,z,r,dynamicVisible:()=>owner?.visible!==false});}
 for(const [x,z,r] of rockDefs){const owner=findGroupAt(world,x,z);circles.push({x,z,r,dynamicVisible:()=>owner?.visible!==false});}
 const fenceSegments=[{ax:-9,az:-9.8,bx:-4.2,bz:-9.8,r:.12},{ax:4.2,az:-9.8,bx:9,bz:-9.8,r:.12},{ax:-9.9,az:8,bx:-5.1,bz:8,r:.12},{ax:5.1,az:8,bx:9.9,bz:8,r:.12}];
 const service={
  boxes,circles,fenceSegments,playerRadius:PLAYER_RADIUS,
  isPointBlocked(x,z,r=PLAYER_RADIUS){return boxes.some(b=>boxBlocked(x,z,b,r))||circles.some(c=>circleBlocked(x,z,c,r))||fenceSegments.some(s=>segmentBlocked(x,z,s,r));},
  isFootprintBlocked(box){if(Math.abs(box.x)>15-box.hx||Math.abs(box.z)>14-box.hz)return true;if(boxes.some(b=>boxOverlapsBox(box,b)))return true;if(circles.some(c=>(!c.dynamicVisible||c.dynamicVisible()!==false)&&boxOverlapsCircle(box,c)))return true;if(fenceSegments.some(s=>boxOverlapsSegment(box,s)))return true;return false;},
  registerBox(def){const box={...def};boxes.push(box);return box;}
 };
 const previousSet=playerRoot.position.set.bind(playerRoot.position);
 playerRoot.position.set=(x,y,z)=>{if(service.isPointBlocked(x,z))return playerRoot.position;return previousSet(x,y,z);};
 globalThis.__villagerWorldCollision=service;return service;
}
