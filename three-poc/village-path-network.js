import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const dirt=new THREE.MeshStandardMaterial({color:0xb58a50,roughness:.94,metalness:0,flatShading:true});
const worn=new THREE.MeshStandardMaterial({color:0xc39a60,roughness:.95,metalness:0,flatShading:true});

function mesh(parent,geometry,material,pos=[0,0,0],rot=[0,0,0]){
 const o=new THREE.Mesh(geometry,material);o.position.set(...pos);o.rotation.set(...rot);o.receiveShadow=true;parent.add(o);return o;
}
function point(x,z){return new THREE.Vector2(x,z);}
function bezier(a,c,b,t){const u=1-t;return point(u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y);}
function makeRibbon(group,a,c,b,width=.95,segments=22){
 const verts=[],indices=[];
 for(let i=0;i<=segments;i++){
  const t=i/segments,p=bezier(a,c,b,t),p0=bezier(a,c,b,Math.max(0,t-.015)),p1=bezier(a,c,b,Math.min(1,t+.015));
  const dx=p1.x-p0.x,dz=p1.y-p0.y,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
  const breathe=1+Math.sin(t*Math.PI*3.2)*.07;
  verts.push(p.x+nx*width*.5*breathe,.024,p.y+nz*width*.5*breathe,p.x-nx*width*.5*breathe,.024,p.y-nz*width*.5*breathe);
  if(i<segments){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();mesh(group,g,dirt);
 // sparse worn patches, never a regular stone border
 for(let i=3;i<segments;i+=4){const t=(i+.35)/segments,p=bezier(a,c,b,t);mesh(group,new THREE.CircleGeometry(.16+(i%3)*.035,7),worn,[p.x,.031,p.y],[-Math.PI/2,0,t*2.1]);}
}

export class VillagePathNetwork{
 constructor(world){this.world=world;this.root=new THREE.Group();this.root.name='VillagePathNetwork';world.add(this.root);this.nodes=new Map();this.connections=[];}
 registerBuilding({id,entrance,role='building'}){this.nodes.set(id,{id,entrance:point(entrance.x,entrance.z),role});return this;}
 connect(fromId,toId,{width=.95,bend=.18}={}){
  const a=this.nodes.get(fromId),b=this.nodes.get(toId);if(!a||!b)return this;
  const mid=a.entrance.clone().lerp(b.entrance,.5),dx=b.entrance.x-a.entrance.x,dz=b.entrance.y-a.entrance.y,len=Math.hypot(dx,dz)||1;
  const nx=-dz/len,nz=dx/len;mid.x+=nx*len*bend;mid.y+=nz*len*bend;
  makeRibbon(this.root,a.entrance,mid,b.entrance,width);this.connections.push({fromId,toId});return this;
 }
}

function hideLegacyPaths(world){
 // Runtime v0.1.3 creates exactly three large horizontal PlaneGeometry path meshes.
 // Hide only those geometry signatures; ground and all gameplay objects remain untouched.
 world.children.forEach(o=>{if(!o.isMesh||o.geometry?.type!=='PlaneGeometry')return;const p=o.geometry.parameters||{};const w=p.width||0,h=p.height||0;if((Math.abs(w-4.4)<.01&&Math.abs(h-24)<.01)||(Math.abs(w-21)<.01&&Math.abs(h-3.6)<.01)||(Math.abs(w-15)<.01&&Math.abs(h-3.1)<.01))o.visible=false;});
}

export function installVillagePathNetwork({world}){
 if(!world)return null;hideLegacyPaths(world);
 const network=new VillagePathNetwork(world);
 // These are settlement anchors, not arbitrary roads. Future constructed buildings register here.
 network.registerBuilding({id:'cottage',role:'home',entrance:{x:1.12,z:-3.95}})
        .registerBuilding({id:'well',role:'utility',entrance:{x:.9,z:-1.05}})
        .registerBuilding({id:'village-spine',role:'junction',entrance:{x:-.35,z:2.15}})
        .registerBuilding({id:'forest-trail',role:'future-work-zone',entrance:{x:-5.2,z:4.45}})
        .connect('cottage','well',{width:1.2,bend:-.12})
        .connect('well','village-spine',{width:1.05,bend:.13})
        .connect('village-spine','forest-trail',{width:.78,bend:-.16});
 return network;
}
