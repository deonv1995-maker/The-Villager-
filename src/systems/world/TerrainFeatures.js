import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

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
  // The terrain kit's walkable top is authored at local Y=1.2 while the
  // lower floor is local Y=.2/0. Keeping the shared -0.2 unit datum makes
  // every module meet the exact base/upper elevations used by IslandTerrain.
  o.position.set(p.x,this.world.terrain.moduleFormationBaseHeight()-.2*f.scale+yOffset,p.z);
  o.rotation.y=f.yaw+relativeYaw;
  o.scale.setScalar(S);
  this.root.add(o);
  return o;
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

  // Source-space convention verified from the OBJ geometry:
  // Cliff Side high ground is local +X, and the outer corner's high ground
  // occupies +X/-Z. Our procedural terrace uses that same +U/-V quadrant.
  this.place(this.prototypes.outerTop,0,0,0);

  // The outer 2x2 corner ends around -1.12 grid units. Starting the first
  // one-unit straight section at -1.62 closes the old visible gap instead of
  // placing pieces on arbitrary two-unit intervals.
  for(const vUnit of [-1.62,-2.62,-3.62,-4.62]){
   this.place(this.prototypes.sideTop,0,vUnit*S,0);
  }
  this.place(this.prototypes.falloffEdge,0,-5.62*S,0);

  // Same exact grid spacing after the 90° turn.
  for(const uUnit of [1.62,2.62,3.62]){
   this.place(this.prototypes.sideTop,uUnit*S,0,Math.PI/2);
  }
  this.place(this.prototypes.falloffEdge,4.62*S,0,Math.PI/2);

  // Gentle-hill source mesh is four grid units long. At -90° its high end
  // meets U=4 and its low end meets U=8; three adjacent copies form a clean
  // walkable route instead of a broad procedural slope.
  for(const vUnit of [-1,-2,-3]){
   this.place(this.prototypes.hillGentle,7.5*S,vUnit*S,-Math.PI/2);
  }

  // Minimal dressing at transition ends only. It must not hide alignment
  // errors while we validate the terrain kit as structural geometry.
  this.placeProp(this.prototypes.rocks,-.9*S,-5.35*S,3,1.2);
  this.placeProp(this.prototypes.rocks,4.9*S,-.65*S,5,1.05);
  this.placeProp(this.prototypes.bushes,.8*S,-5.55*S,7,1.4);
 }

 initialize(){
  this.scene.add(this.root);
  this.load().then(()=>this.buildShowcaseFormation()).catch(err=>console.error('[Terrain module showcase load]',err));
 }
}
