import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export const CHUNK_SIZE=18;
export const ACTIVE_RADIUS=2;
export const RETAIN_RADIUS=3;

function key(cx,cz){return `${cx}:${cz}`;}
function coord(v){return Math.floor((v+CHUNK_SIZE*.5)/CHUNK_SIZE);}

export function installWorldChunkManager({world,playerRoot}){
 if(!world||!playerRoot)return null;
 const providers=new Set();
 const chunks=new Map();
 let currentX=Infinity,currentZ=Infinity;

 function ensureChunk(cx,cz){
  const k=key(cx,cz);let chunk=chunks.get(k);
  if(chunk)return chunk;
  const root=new THREE.Group();root.name=`WorldChunk:${k}`;root.userData.chunk={cx,cz,key:k};world.add(root);
  chunk={key:k,cx,cz,root,providerState:new Map()};chunks.set(k,chunk);
  for(const p of providers){const state=p.createChunk?.({cx,cz,root,chunkSize:CHUNK_SIZE})??null;chunk.providerState.set(p,state);}
  return chunk;
 }
 function unloadChunk(chunk){
  for(const p of providers)p.disposeChunk?.({cx:chunk.cx,cz:chunk.cz,root:chunk.root,state:chunk.providerState.get(p)});
  chunk.root.removeFromParent();chunks.delete(chunk.key);
 }
 function refresh(force=false){
  const cx=coord(playerRoot.position.x),cz=coord(playerRoot.position.z);
  if(!force&&cx===currentX&&cz===currentZ)return;currentX=cx;currentZ=cz;
  for(let dz=-ACTIVE_RADIUS;dz<=ACTIVE_RADIUS;dz++)for(let dx=-ACTIVE_RADIUS;dx<=ACTIVE_RADIUS;dx++)ensureChunk(cx+dx,cz+dz);
  for(const chunk of [...chunks.values()])if(Math.max(Math.abs(chunk.cx-cx),Math.abs(chunk.cz-cz))>RETAIN_RADIUS)unloadChunk(chunk);
 }
 function registerProvider(provider){
  if(!provider||providers.has(provider))return ()=>{};providers.add(provider);
  for(const chunk of chunks.values()){const state=provider.createChunk?.({cx:chunk.cx,cz:chunk.cz,root:chunk.root,chunkSize:CHUNK_SIZE})??null;chunk.providerState.set(provider,state);}
  return ()=>{providers.delete(provider);for(const chunk of chunks.values()){provider.disposeChunk?.({cx:chunk.cx,cz:chunk.cz,root:chunk.root,state:chunk.providerState.get(provider)});chunk.providerState.delete(provider);}};
 }
 function rebuildChunk(cx,cz,provider){const chunk=chunks.get(key(cx,cz));if(!chunk||!provider)return;provider.disposeChunk?.({cx,cz,root:chunk.root,state:chunk.providerState.get(provider)});const state=provider.createChunk?.({cx,cz,root:chunk.root,chunkSize:CHUNK_SIZE})??null;chunk.providerState.set(provider,state);}
 function chunksForBounds(minX,maxX,minZ,maxZ){const out=[];const a=coord(minX),b=coord(maxX),c=coord(minZ),d=coord(maxZ);for(let cz=c;cz<=d;cz++)for(let cx=a;cx<=b;cx++)out.push({cx,cz});return out;}
 function tick(){refresh();requestAnimationFrame(tick);}refresh(true);requestAnimationFrame(tick);
 const api={registerProvider,rebuildChunk,chunksForBounds,refresh,get loadedCount(){return chunks.size;},chunkSize:CHUNK_SIZE};globalThis.__villagerChunkManager=api;return api;
}
