import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const CLIFF_YAW_FIX=Math.PI;

export class TerrainFeatures {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.root=new THREE.Group();
  this.root.name='TerrainModuleShowcase';
  this.loader=new OBJLoader();
  this.prototypes={};
  this.loading=null;
  this.materials={
   rock:new THREE.MeshStandardMaterial({color:0x78827d,roughness:.96,metalness:0,flatShading:true}),
   dirt:new THREE.MeshStandardMaterial({color:0x756d59,roughness:.97,metalness:0,flatShading:true}),
   grass:new THREE.MeshStandardMaterial({color:0x7fb64e,roughness:.95,metalness:0,flatShading:true}),
   bush:new THREE.MeshStandardMaterial({color:0x4f8747,roughness:.9,metalness:0,flatShading:true})
  };
 }

 materialFor(source,fallback){
  const n=(source?.name||'').toLowerCase();
  if(n.includes('grass'))return this.materials.grass;
  if(n.includes('dirt'))return this.materials.dirt;
  if(n.includes('rock'))return this.materials.rock;
  return fallback;
 }

 async loadObj(path,fallback=this.materials.rock){
  const res=await fetch(path,{cache:'no-store'});
  if(!res.ok)throw new Error(`${path}: ${res.status}`);
  const obj=this.loader.parse(await res.text());
  obj.traverse(child=>{
   if(!child.isMesh)return;
   child.material=Array.isArray(child.material)
    ?child.material.map(m=>this.materialFor(m,fallback))
    :this.materialFor(child.material,fallback);
   child.castShadow=true;
   child.receiveShadow=true;
  });
  return obj;
 }

 async load(){
  if(this.loading)return this.loading;
  const A='./assets/modular-terrain/';
  this.loading=Promise.all([
   this.loadObj(`${A}Cliff_Terrain_Side_Top.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Top.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Edge.obj`,this.materials.rock),
   this.loadObj(`${A}Hilly_Terrain_Hill_Side_Gentle.obj`,this.materials.grass),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj',this.materials.bush),
   this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj',this.materials.bush)
  ]).then(([sideTop,outerTop,falloffEdge,hillGentle,rock1,rock2,bush1,bush2])=>{
   this.prototypes={sideTop,outerTop,falloffEdge,hillGentle,rocks:[rock1,rock2],bushes:[bush1,bush2]};
   return this.prototypes;
  });
  return this.loading;
 }

 toWorld(u,v){return this.world.terrain.moduleFormationWorld(u,v);}

 place(source,u,v,relativeYaw=0,yOffset=0,scaleMultiplier=1){
  if(!source)return null;
  const f=this.world.terrain.moduleFormation;
  const S=f.scale*scaleMultiplier;
  const p=this.toWorld(u,v);
  const o=source.clone(true);
  o.position.set(p.x,this.world.terrain.moduleFormationBaseHeight()-.2*f.scale+yOffset,p.z);
  o.rotation.y=f.yaw+relativeYaw;
  o.scale.setScalar(S);
  this.root.add(o);
  return o;
 }

 placeCliff(source,u,v,relativeYaw=0,yOffset=0,scaleMultiplier=1){
  return this.place(source,u,v,relativeYaw+CLIFF_YAW_FIX,yOffset,scaleMultiplier);
 }

 placeProp(list,u,v,seed,scale){
  if(!list?.length)return;
  const src=list[Math.abs(seed)%list.length];
  const p=this.toWorld(u,v);
  const o=src.clone(true);
  o.position.set(p.x,this.world.heightAt(p.x,p.z)-.05,p.z);
  o.rotation.y=(seed*.73)%6.28318530718;
  o.scale.setScalar(scale);
  this.root.add(o);
 }

 buildShowcaseFormation(){
  const S=this.world.terrain.moduleFormation.scale;

  // Preserve the 0.5.21 formation exactly. Only the cliff-family meshes are
  // yaw-corrected 180 degrees; the terrain profile and gentle hill stay put.
  this.placeCliff(this.prototypes.outerTop,0,0,0);

  for(const vUnit of [-1.62,-2.62,-3.62,-4.62]){
   this.placeCliff(this.prototypes.sideTop,0,vUnit*S,0);
  }
  this.placeCliff(this.prototypes.falloffEdge,0,-5.62*S,0);

  for(const uUnit of [1.62,2.62,3.62]){
   this.placeCliff(this.prototypes.sideTop,uUnit*S,0,Math.PI/2);
  }
  this.placeCliff(this.prototypes.falloffEdge,4.62*S,0,Math.PI/2);

  for(const vUnit of [-1,-2,-3]){
   this.place(this.prototypes.hillGentle,7.5*S,vUnit*S,-Math.PI/2);
  }

  this.placeProp(this.prototypes.rocks,-.9*S,-5.35*S,3,1.2);
  this.placeProp(this.prototypes.rocks,4.9*S,-.65*S,5,1.05);
  this.placeProp(this.prototypes.bushes,.8*S,-5.55*S,7,1.4);
 }

 initialize(){
  this.scene.add(this.root);
  this.load().then(()=>this.buildShowcaseFormation()).catch(err=>console.error('[Terrain module showcase load]',err));
 }
}
