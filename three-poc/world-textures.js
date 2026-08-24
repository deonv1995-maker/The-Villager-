import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createVillageMaterials } from './material-library.js?v=064';

const HEX={
 0x6a4228:'bark',0x4b2d1c:'barkDark',0x777d78:'stone',0x9ba09a:'stoneLight',0x5e625e:'stoneDark',0x858476:'stoneWarm',
 0x477d35:'grassA',0x5b8e43:'grassB',0x7fb35a:'grassC',0x6ca14a:'grassD',0x8f6b43:'pathEdge',0xa77d4f:'pathPatch',0xc09a64:'pathLight',
 0xd8bd83:'plaster',0x633719:'timber',0x9b3f27:'roof',0x6e2c20:'roofDark'
};

function keyFor(material){if(!material?.color)return null;return HEX[material.color.getHex()]||null;}
function texturedClone(source,template){const m=source.clone();m.map=template.map;m.roughness=template.roughness;m.metalness=0;m.needsUpdate=true;return m;}

export function installWorldTextures({world}){
 if(!world)return null;
 const library=createVillageMaterials();
 const cache=new Map();
 let applied=0,lastScan=0;
 function applyMesh(mesh){
  if(!mesh.isMesh||mesh.userData.__villageTextured)return;
  const source=mesh.material;
  const convert=m=>{
   const key=keyFor(m);if(!key||!library[key])return m;
   const cacheKey=`${m.uuid}:${key}`;if(!cache.has(cacheKey))cache.set(cacheKey,texturedClone(m,library[key]));applied++;return cache.get(cacheKey);
  };
  mesh.material=Array.isArray(source)?source.map(convert):convert(source);
  mesh.userData.__villageTextured=true;
 }
 function refresh(){world.traverse(applyMesh);lastScan=performance.now();}
 function tick(now){requestAnimationFrame(tick);if(now-lastScan>1200)refresh();}
 refresh();requestAnimationFrame(tick);
 const api={refresh,get applied(){return applied;},library};globalThis.__villagerWorldTextures=api;return api;
}
