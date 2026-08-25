import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures{
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;this.root=new THREE.Group();this.root.name='TerrainFeatures';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;this.seed=9137;
  this.materials={
   rock:new THREE.MeshStandardMaterial({color:0x78827d,roughness:.96,metalness:0,flatShading:true}),
   dirt:new THREE.MeshStandardMaterial({color:0x756d59,roughness:.97,metalness:0,flatShading:true}),
   grass:new THREE.MeshStandardMaterial({color:0x7fb64e,roughness:.95,metalness:0,flatShading:true}),
   bush:new THREE.MeshStandardMaterial({color:0x4f8747,roughness:.9,metalness:0,flatShading:true})
  };
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 materialFor(source,fallback){
  const n=(source?.name||'').toLowerCase();
  if(n.includes('grass'))return this.materials.grass;
  if(n.includes('dirt'))return this.materials.dirt;
  if(n.includes('rock'))return this.materials.rock;
  return fallback;
 }
 async loadObj(path,fallback=this.materials.rock){
  const res=await fetch(path,{cache:'no-store'});if(!res.ok)throw new Error(`${path}: ${res.status}`);
  const obj=this.loader.parse(await res.text());
  obj.traverse(child=>{
   if(!child.isMesh)return;
   child.material=Array.isArray(child.material)?child.material.map(m=>this.materialFor(m,fallback)):this.materialFor(child.material,fallback);
   child.castShadow=true;child.receiveShadow=true;
  });
  return obj;
 }
 async load(){
  if(this.loading)return this.loading;
  const A='./assets/modular-terrain/';
  this.loading=Promise.all([
   this.loadObj(`${A}Cliff_Terrain_Side_Base.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Mid.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Top.obj`,this.materials.rock),
   this.loadObj(`${A}Escarpment_Terrain_Side_Base.obj`,this.materials.dirt),
   this.loadObj(`${A}Escarpment_Terrain_Side_Mid.obj`,this.materials.dirt),
   this.loadObj(`${A}Escarpment_Terrain_Side_Top.obj`,this.materials.dirt),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Center.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Edge.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Base.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Mid.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Top.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Base.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Mid.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Top.obj`,this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_3_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj',this.materials.bush),
   this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj',this.materials.bush)
  ]).then(v=>{
   this.prototypes={
    cliff:{base:v[0],mid:v[1],top:v[2]},
    escarp:{base:v[3],mid:v[4],top:v[5]},
    falloff:{center:v[6],edge:v[7]},
    outer:{base:v[8],mid:v[9],top:v[10]},
    inner:{base:v[11],mid:v[12],top:v[13]},
    rocks:[v[14],v[15],v[16]],bushes:[v[17],v[18]]
   };
   return this.prototypes;
  });
  return this.loading;
 }
 addModel(source,x,y,z,yaw,sx,sy=sx,sz=sx){
  if(!source)return;const o=source.clone(true);o.position.set(x,y,z);o.rotation.y=yaw;o.scale.set(sx,sy,sz);this.root.add(o);
 }
 addNatural(list,x,y,z,yaw,scale){if(!list?.length)return;const src=list[Math.floor(this.rand((x+z)*17)*list.length)%list.length];this.addModel(src,x,y,z,yaw,scale);}
 curvatureAt(t){
  const terrain=this.world.terrain,a=terrain.cliffFrame(Math.max(.01,t-.045)),b=terrain.cliffFrame(Math.min(.99,t+.045));
  return a.tx*b.tz-a.tz*b.tx;
 }
 sampleCliff(t){
  const f=this.world.terrain.cliffFrame(t);let nx=f.nx,nz=f.nz;
  const a=this.world.heightAt(f.x+nx*6,f.z+nz*6),b=this.world.heightAt(f.x-nx*6,f.z-nz*6);
  if(a<b){nx=-nx;nz=-nz;}
  const high=this.world.heightAt(f.x+nx*5.7,f.z+nz*5.7),low=this.world.heightAt(f.x-nx*5.7,f.z-nz*5.7);
  return{...f,nx,nz,high,low,drop:high-low};
 }
 placeStack(family,f,x,z,yaw,scale,drop,seed,corner=false){
  const topY=f.high-scale*(corner?1.03:1.08);
  this.addModel(family.top,x,topY,z,yaw,scale,scale*(.92+this.rand(seed+1)*.12),scale*(.9+this.rand(seed+2)*.16));
  if(drop>scale*1.15&&this.rand(seed+3)>.18)this.addModel(family.mid,x-f.nx*.22,topY-scale*(.78+.08*this.rand(seed+4)),z-f.nz*.22,yaw+(this.rand(seed+5)-.5)*.11,scale*(.91+this.rand(seed+6)*.1));
  if(drop>scale*1.82&&this.rand(seed+7)>.38)this.addModel(family.base,x-f.nx*.38,Math.max(f.low-.12,topY-scale*1.55),z-f.nz*.38,yaw+(this.rand(seed+8)-.5)*.13,scale*(.88+this.rand(seed+9)*.12));
 }
 buildOrganicCliff(){
  const anchors=[.035];let t=.105,i=0;
  while(t<.91&&i<18){anchors.push(t);t+=.052+this.rand(i*41+5)*.062;i++;}anchors.push(.965);
  for(let i=0;i<anchors.length;i++){
   const t0=Math.min(.98,Math.max(.02,anchors[i]+(this.rand(i*23+4)-.5)*.018));
   const f=this.sampleCliff(t0);if(f.drop<1.45)continue;
   const end=i===0||i===anchors.length-1;
   if(!end&&this.rand(i*31+6)<.13)continue;
   const forward=.5+this.rand(i*37+2)*1.25;
   const along=(this.rand(i*43+7)-.5)*1.1;
   const x=f.x-f.nx*forward+f.tx*along,z=f.z-f.nz*forward+f.tz*along;
   const baseYaw=Math.atan2(f.tx,f.tz)+(this.rand(i*47+9)-.5)*.18;
   const curve=this.curvatureAt(t0),absCurve=Math.abs(curve);
   const seed=i*101+13;

   if(end){
    const scale=3.0+this.rand(seed)*.85;
    this.addModel(this.prototypes.falloff.edge,x,f.high-scale*1.0,z,baseYaw+(end&&i===0?Math.PI:0),scale,scale*(.92+this.rand(seed+1)*.1),scale*(.9+this.rand(seed+2)*.16));
   }else if(absCurve>.085&&this.rand(seed+3)>.18){
    const outer=curve>0,family=outer?this.prototypes.outer:this.prototypes.inner;
    const scale=1.75+this.rand(seed+4)*.65;
    const cornerYaw=baseYaw+(outer?-Math.PI/4:Math.PI/4)+(this.rand(seed+5)-.5)*.08;
    this.placeStack(family,f,x,z,cornerYaw,scale,f.drop,seed+10,true);
   }else if(this.rand(seed+6)<.17){
    const scale=2.8+this.rand(seed+7)*1.0;
    this.addModel(this.prototypes.falloff.center,x,f.high-scale*.98,z,baseYaw,scale,scale*(.9+this.rand(seed+8)*.12),scale*(.9+this.rand(seed+9)*.18));
   }else{
    const family=this.rand(seed+10)<.48?this.prototypes.escarp:this.prototypes.cliff;
    const scale=2.7+this.rand(seed+11)*1.55;
    this.placeStack(family,f,x,z,baseYaw,scale,f.drop,seed+20,false);
   }

   if(this.rand(seed+30)>.22){
    const rx=x-f.nx*(1.7+this.rand(seed+31)*3.0)+(this.rand(seed+32)-.5)*2.8*f.tx,rz=z-f.nz*(1.7+this.rand(seed+33)*3.0)+(this.rand(seed+34)-.5)*2.8*f.tz;
    this.addNatural(this.prototypes.rocks,rx,this.world.heightAt(rx,rz),rz,this.rand(seed+35)*Math.PI*2,1.0+this.rand(seed+36)*1.8);
   }
   if(this.rand(seed+40)>.45){
    const bx=x+f.nx*(.45+this.rand(seed+41)*1.8)+(this.rand(seed+42)-.5)*2.8*f.tx,bz=z+f.nz*(.45+this.rand(seed+43)*1.8)+(this.rand(seed+44)-.5)*2.8*f.tz;
    this.addNatural(this.prototypes.bushes,bx,this.world.heightAt(bx,bz),bz,this.rand(seed+45)*Math.PI*2,1.5+this.rand(seed+46)*1.7);
   }
  }
 }
 initialize(){this.scene.add(this.root);this.load().then(()=>this.buildOrganicCliff()).catch(err=>console.error('[Terrain features load]',err));}
}
