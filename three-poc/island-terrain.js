import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export const ISLAND_RADIUS=82;
export const SEA_LEVEL=-1.15;

function smoothstep(a,b,x){const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function hash(x,z){const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return (s-Math.floor(s))*2-1;}
export function islandHeight(x,z){
 const d=Math.hypot(x*0.94,z*1.06)/ISLAND_RADIUS;
 const coast=1-smoothstep(.70,1.02,d);
 if(coast<=0)return SEA_LEVEL-.7;
 const broad=Math.sin(x*.045)*1.05+Math.cos(z*.052)*.85+Math.sin((x+z)*.033)*.7;
 const ridges=Math.max(0,Math.sin(x*.073+z*.021))*Math.max(0,Math.cos(z*.061-x*.018))*2.2;
 const centre=Math.max(0,1-d/.68);const mountain=Math.pow(centre,1.7)*10.5;
 const northRidge=Math.exp(-((x+18)*(x+18)/520+(z-17)*(z-17)/950))*5.2;
 const eastHill=Math.exp(-((x-31)*(x-31)/650+(z+10)*(z+10)/500))*3.6;
 const detail=hash(Math.floor(x/4),Math.floor(z/4))*.28;
 let h=(1.0+broad+ridges+mountain+northRidge+eastHill+detail)*coast;
 const beach=smoothstep(.72,.9,d);h=THREE.MathUtils.lerp(h,.08,beach*.82);
 return Math.max(SEA_LEVEL+.12,h);
}

export function installIslandTerrain({world,scene}){
 if(!world)return null;
 const oldGround=world.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry'&&Math.abs((o.geometry.parameters?.width||0)-100)<.01);
 if(oldGround)oldGround.visible=false;
 const size=ISLAND_RADIUS*2.12,segments=72;
 const geo=new THREE.PlaneGeometry(size,size,segments,segments);geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,islandHeight(p.getX(i),p.getZ(i)));
 geo.computeVertexNormals();
 const landMat=new THREE.MeshLambertMaterial({color:0x76a943,flatShading:true});
 const land=new THREE.Mesh(geo,landMat);land.name='island-terrain';land.receiveShadow=true;world.add(land);
 const oceanGeo=new THREE.PlaneGeometry(520,520,24,24);oceanGeo.rotateX(-Math.PI/2);
 const oceanMat=new THREE.MeshPhongMaterial({color:0x45b8d8,transparent:true,opacity:.9,shininess:70,flatShading:true});
 const ocean=new THREE.Mesh(oceanGeo,oceanMat);ocean.name='island-ocean';ocean.position.y=SEA_LEVEL;world.add(ocean);
 const sandGeo=new THREE.RingGeometry(ISLAND_RADIUS*.79,ISLAND_RADIUS*1.01,96,3);sandGeo.rotateX(-Math.PI/2);
 const sand=new THREE.Mesh(sandGeo,new THREE.MeshLambertMaterial({color:0xd9c783,side:THREE.DoubleSide,flatShading:true}));sand.position.y=.02;sand.scale.set(1,.94,1.06);sand.name='island-beach-band';world.add(sand);
 if(scene?.fog){scene.fog.near=55;scene.fog.far=180;}
 return {land,ocean,sand,heightAt:islandHeight,radius:ISLAND_RADIUS,seaLevel:SEA_LEVEL};
}
