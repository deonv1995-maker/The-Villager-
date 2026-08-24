import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const PLAYER_RADIUS=.48;
const EPS=.12;

const near=(a,b,e=EPS)=>Math.abs(a-b)<=e;
const findGroupAt=(world,x,z)=>world.children.find(o=>o instanceof THREE.Group&&near(o.position.x,x)&&near(o.position.z,z));

function circleBlocked(x,z,c){
  if(c.dynamicVisible&&c.dynamicVisible()===false)return false;
  return Math.hypot(x-c.x,z-c.z)<c.r+PLAYER_RADIUS;
}

function boxBlocked(x,z,b){
  const dx=Math.max(Math.abs(x-b.x)-b.hx,0);
  const dz=Math.max(Math.abs(z-b.z)-b.hz,0);
  return dx*dx+dz*dz<PLAYER_RADIUS*PLAYER_RADIUS;
}

function segmentBlocked(x,z,s){
  const ax=s.ax,az=s.az,bx=s.bx,bz=s.bz;
  const abx=bx-ax,abz=bz-az;
  const len2=abx*abx+abz*abz||1;
  const t=THREE.MathUtils.clamp(((x-ax)*abx+(z-az)*abz)/len2,0,1);
  const px=ax+abx*t,pz=az+abz*t;
  return Math.hypot(x-px,z-pz)<PLAYER_RADIUS+s.r;
}

export function installWorldCollision({playerRoot,world}){
  if(!playerRoot||!world)return null;

  // These are gameplay-space bounds, deliberately independent of rendered mesh detail.
  // Visuals can change without forcing movement code changes.
  const cottage={x:0,z:-7.4,hx:4.05,hz:2.85};
  const well={x:0,z:-1.8,r:1.28};

  const treeDefs=[[-6.6,2.7,.78],[-11,-4,.68],[-13,7,.78],[12,-5,.64],[14,8,.74]];
  const rockDefs=[[6.3,3,.98],[-10,10,.95],[10,11,.95]];

  const circles=[well];
  for(const [x,z,r] of treeDefs){
    const owner=findGroupAt(world,x,z);
    circles.push({x,z,r,dynamicVisible:()=>owner?.visible!==false});
  }
  for(const [x,z,r] of rockDefs){
    const owner=findGroupAt(world,x,z);
    circles.push({x,z,r,dynamicVisible:()=>owner?.visible!==false});
  }

  // Fence collision follows the existing gameplay fence locations and lengths.
  const fenceSegments=[
    {ax:-9,az:-9.8,bx:-4.2,bz:-9.8,r:.12},
    {ax:4.2,az:-9.8,bx:9,bz:-9.8,r:.12},
    {ax:-9.9,az:8,bx:-5.1,bz:8,r:.12},
    {ax:5.1,az:8,bx:9.9,bz:8,r:.12},
  ];

  const previousSet=playerRoot.position.set.bind(playerRoot.position);
  playerRoot.position.set=(x,y,z)=>{
    const blocked=boxBlocked(x,z,cottage)||circles.some(c=>circleBlocked(x,z,c))||fenceSegments.some(s=>segmentBlocked(x,z,s));
    if(blocked)return playerRoot.position;
    return previousSet(x,y,z);
  };

  globalThis.__villagerWorldCollision={cottage,circles,fenceSegments,playerRadius:PLAYER_RADIUS};
  return globalThis.__villagerWorldCollision;
}
