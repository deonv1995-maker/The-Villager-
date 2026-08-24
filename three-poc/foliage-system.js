import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function hash(cx,cz){return ((cx*73856093)^(cz*19349663)^0x51f15e)>>>0;}
function insideRect(x,z,r){return x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ;}

const mats={
 grass:new THREE.MeshStandardMaterial({color:0x5f8f42,roughness:1,flatShading:true}),
 tallgrass:new THREE.MeshStandardMaterial({color:0x4f7d38,roughness:1,flatShading:true}),
 fern:new THREE.MeshStandardMaterial({color:0x3f7638,roughness:1,flatShading:true,side:THREE.DoubleSide}),
 bush:new THREE.MeshStandardMaterial({color:0x4b7f3c,roughness:1,flatShading:true}),
 bushLight:new THREE.MeshStandardMaterial({color:0x6a9348,roughness:1,flatShading:true}),
 flower:new THREE.MeshStandardMaterial({color:0xd7b5dd,roughness:.95,flatShading:true}),
 flowerGold:new THREE.MeshStandardMaterial({color:0xe2c45a,roughness:.95,flatShading:true}),
 clover:new THREE.MeshStandardMaterial({color:0x63974d,roughness:1,flatShading:true}),
 mushroom:new THREE.MeshStandardMaterial({color:0xb97854,roughness:.95,flatShading:true}),
 sapling:new THREE.MeshStandardMaterial({color:0x4d7f36,roughness:1,flatShading:true})
};

function grassGeometry(){const g=new THREE.ConeGeometry(.08,.52,4);g.translate(0,.26,0);return g;}
function tallGrassGeometry(){const g=new THREE.ConeGeometry(.06,.82,4);g.translate(0,.41,0);return g;}
function fernGeometry(){const shape=new THREE.BufferGeometry();const p=new Float32Array([0,0,0,-.18,.36,0,0,.18,0,.18,.36,0,0,0,0,0,.24,.15,.16,.38,.18]);shape.setAttribute('position',new THREE.BufferAttribute(p,3));shape.computeVertexNormals();return shape;}
function bushGeometry(){return new THREE.IcosahedronGeometry(.46,0);}
function flowerGeometry(){return new THREE.OctahedronGeometry(.12,0);}
function cloverGeometry(){const g=new THREE.Group();return new THREE.CircleGeometry(.18,5);}
function mushroomGeometry(){return new THREE.SphereGeometry(.15,6,3,0,Math.PI*2,0,Math.PI/2);}
function saplingGeometry(){return new THREE.ConeGeometry(.26,.85,5);}
const geo={grass:grassGeometry(),tallgrass:tallGrassGeometry(),fern:fernGeometry(),bush:bushGeometry(),bushLight:bushGeometry(),flower:flowerGeometry(),flowerGold:flowerGeometry(),clover:cloverGeometry(),mushroom:mushroomGeometry(),sapling:saplingGeometry()};

export function installFoliageSystem({chunkManager}){
 if(!chunkManager)return null;
 const cleared=[];
 const provider={
  createChunk({cx,cz,root,chunkSize}){
   const rnd=seeded(hash(cx,cz));const centerX=cx*chunkSize,centerZ=cz*chunkSize;
   const distFromVillage=Math.hypot(centerX,centerZ),region=Math.abs(hash(cx,cz))%3;
   const density=distFromVillage<15?.22:distFromVillage<32?.55:.82;
   const counts={grass:Math.floor(30*density),tallgrass:Math.floor((region===1?14:8)*density),fern:Math.floor((region===2?15:9)*density),bush:Math.floor(4*density),bushLight:Math.floor(3*density),flower:Math.floor(5*density),flowerGold:Math.floor(4*density),clover:Math.floor(10*density),mushroom:Math.floor((region===2?8:4)*density),sapling:Math.floor(4*density)};
   const state={meshes:[]};
   for(const [type,count] of Object.entries(counts)){
    if(count<=0)continue;const inst=new THREE.InstancedMesh(geo[type],mats[type],count);inst.name=`Foliage:${type}`;inst.castShadow=type==='bush'||type==='bushLight'||type==='sapling';inst.receiveShadow=true;inst.frustumCulled=true;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),pos=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);let used=0;
    for(let i=0;i<count;i++){
     const localX=(rnd()-.5)*chunkSize,localZ=(rnd()-.5)*chunkSize,worldX=centerX+localX,worldZ=centerZ+localZ;
     if(Math.hypot(worldX,worldZ)<11)continue;if(cleared.some(r=>insideRect(worldX,worldZ,r)))continue;
     const s=type==='grass'?.55+rnd()*.7:type==='tallgrass'?.65+rnd()*.7:type==='fern'?.65+rnd()*.55:type==='bush'||type==='bushLight'?.65+rnd()*.65:type==='sapling'?.65+rnd()*.55:.7+rnd()*.5;
     pos.set(localX,type==='clover'?.02:0,localZ);q.setFromAxisAngle(axis,rnd()*Math.PI*2);if(type==='clover')q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)));scale.setScalar(s);matrix.compose(pos,q,scale);inst.setMatrixAt(used++,matrix);
    }
    inst.count=used;inst.instanceMatrix.needsUpdate=true;root.add(inst);state.meshes.push(inst);
   }
   return state;
  },
  disposeChunk({state}){for(const mesh of state?.meshes||[])mesh.removeFromParent();}
 };
 chunkManager.registerProvider(provider);
 function clearFootprint({x,z,hx,hz,margin=.8}){const rect={minX:x-hx-margin,maxX:x+hx+margin,minZ:z-hz-margin,maxZ:z+hz+margin};cleared.push(rect);for(const c of chunkManager.chunksForBounds(rect.minX,rect.maxX,rect.minZ,rect.maxZ))chunkManager.rebuildChunk(c.cx,c.cz,provider);}
 const api={clearFootprint,cleared};globalThis.__villagerFoliage=api;return api;
}
