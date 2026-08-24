import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const cache=new Map();
const mats=new Map();

function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function canvasTexture(key,{base,marks=[],size=128,repeat=[2,2],seed=1}){
 if(cache.has(key))return cache.get(key);
 const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,size,size);const r=seeded(seed);
 for(const m of marks){x.globalAlpha=m.alpha??.18;x.strokeStyle=m.color;x.fillStyle=m.color;const count=m.count??20;for(let i=0;i<count;i++){const px=r()*size,py=r()*size,w=(m.w??8)*(.45+r()),h=(m.h??3)*(.45+r());if(m.line){x.lineWidth=Math.max(1,m.lineWidth??1);x.beginPath();x.moveTo(px,py);x.lineTo(px+(r()-.5)*w,py+(r()-.5)*h);x.stroke();}else x.fillRect(px,py,w,h);}}
 x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=2;cache.set(key,t);return t;
}
function material(key,color,map,roughness=.9){if(mats.has(key))return mats.get(key);const m=new THREE.MeshStandardMaterial({color,map,roughness,metalness:0,flatShading:true});mats.set(key,m);return m;}

export function createVillageMaterials(){
 const wood=canvasTexture('wood',{base:'#6a4228',repeat:[1.4,3.5],seed:12,marks:[{color:'#3d2518',count:28,w:28,h:2,line:true,alpha:.28},{color:'#9a6940',count:16,w:22,h:2,line:true,alpha:.2}]});
 const stone=canvasTexture('stone',{base:'#858982',repeat:[2.4,2.4],seed:27,marks:[{color:'#555b57',count:32,w:14,h:7,alpha:.2},{color:'#b2b3aa',count:22,w:10,h:5,alpha:.16}]});
 const plaster=canvasTexture('plaster',{base:'#d3bb86',repeat:[2,2],seed:39,marks:[{color:'#b69b68',count:38,w:6,h:3,alpha:.13},{color:'#ead8aa',count:28,w:5,h:3,alpha:.12}]});
 const roof=canvasTexture('roof',{base:'#8e3b29',repeat:[2.4,4.4],seed:54,marks:[{color:'#5f291f',count:42,w:18,h:2,line:true,alpha:.28},{color:'#ba6545',count:24,w:12,h:2,line:true,alpha:.16}]});
 const grass=canvasTexture('grass',{base:'#5b8c43',repeat:[8,8],seed:71,marks:[{color:'#315f31',count:80,w:3,h:8,line:true,alpha:.24},{color:'#86ad55',count:65,w:3,h:7,line:true,alpha:.2}]});
 const path=canvasTexture('path',{base:'#806b4b',repeat:[4,5],seed:92,marks:[{color:'#a48a62',count:46,w:9,h:5,alpha:.18},{color:'#4f6f39',count:32,w:5,h:4,alpha:.18}]});
 return Object.freeze({
  timber:material('timber',0xffffff,wood,.94),bark:material('bark',0xd5b18f,wood,.98),barkDark:material('barkDark',0x9a725b,wood,.99),
  stone:material('stone',0xffffff,stone,.96),stoneLight:material('stoneLight',0xc8cbc3,stone,.94),stoneDark:material('stoneDark',0x7a7e79,stone,.98),stoneWarm:material('stoneWarm',0xb4aa95,stone,.96),
  plaster:material('plaster',0xffffff,plaster,.97),roof:material('roof',0xffffff,roof,.96),roofDark:material('roofDark',0xb06f5b,roof,.98),
  grassA:material('grassA',0x8aaa78,grass,1),grassB:material('grassB',0xa0bb87,grass,1),grassC:material('grassC',0xc0d59c,grass,1),grassD:material('grassD',0xacc98b,grass,1),
  pathEdge:material('pathEdge',0xc5a57d,path,.98),pathPatch:material('pathPatch',0xd2b186,path,.98),pathLight:material('pathLight',0xe2c69a,path,.97)
 });
}

export function applyVillageGroundTexture(mesh){if(!mesh?.isMesh)return;const lib=createVillageMaterials();mesh.material=lib.grassB;mesh.material.needsUpdate=true;}
