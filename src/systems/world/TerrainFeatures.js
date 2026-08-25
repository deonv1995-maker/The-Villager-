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
   bush:new THREE.MeshStandardMaterial({color:0x4f8747,roughness:.9,metalness:0,flatShading:true}),
   hiddenGrass:new THREE.MeshStandardMaterial({visible:false,depthWrite:false})
  };
 }

 materialFor(source,fallback,suppressGrass=false){
  const n=(source?.name||'').toLowerCase();
  if(n.includes('grass'))return suppressGrass?this.materials.hiddenGrass:this.materials.grass;
  if(n.includes('dirt'))return this.materials.dirt;
  if(n.includes('rock'))return this.materials.rock;
  return fallback;
 }

 measureHorizontalPivot(obj){
  const box=new this.T.Box3().setFromObject(obj);
  const center=box.getCenter(new this.T.Vector3());
  obj.userData.terrainPivot={x:center.x,z:center.z};
 }

 async loadObj(path,fallback=this.materials.rock,{suppressGrass=false}={}){
  const res=await fetch(path,{cache:'no-store'});
  if(!res.ok)throw new Error(`${path}: ${res.status}`);
  const obj=this.loader.parse(await res.text());
  obj.traverse(child=>{
   if(!child.isMesh)return;
   child.material=Array.isArray(child.material)
    ?child.material.map(m=>this.materialFor(m,fallback,suppressGrass))
    :this.materialFor(child.material,fallback,suppressGrass);
   child.castShadow=true;
   child.receiveShadow=true;
  });
  this.measureHorizontalPivot(obj);
  return obj;
 }

 async load(){
  if(this.loading)return this.loading;
  const A='./assets/modular-terrain/';
  const cliff={suppressGrass:true};
  this.loading=Promise.all([
   this.loadObj(`${A}Cliff_Terrain_Side_Top.obj`,this.materials.rock,cliff),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Top.obj`,this.materials.rock,cliff),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Top.obj`,this.materials.rock,cliff),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Center.obj`,this.materials.rock,cliff),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Edge.obj`,this.materials.rock,cliff),
   this.loadObj(`${A}Escarpment_Terrain_Side_Top.obj`,this.materials.rock,cliff),
   this.loadObj(`${A}Hilly_Terrain_Hill_Side_Gentle.obj`,this.materials.grass),
   this.loadObj(`${A}Hilly_Terrain_Hill_Side_Sharp.obj`,this.materials.grass),
   this.loadObj(`${A}Hilly_Terrain_Hill_Corner_Outer_3x3.obj`,this.materials.grass),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj',this.materials.bush),
   this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj',this.materials.bush)
  ]).then(([sideTop,outerTop,innerTop,falloffCenter,falloffEdge,escarpTop,hillGentle,hillSharp,hillOuter,rock1,rock2,bush1,bush2])=>{
   this.prototypes={
    sideTop,outerTop,innerTop,falloffCenter,falloffEdge,escarpTop,
    hillGentle,hillSharp,hillOuter,
    rocks:[rock1,rock2],bushes:[bush1,bush2]
   };
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
  if(!source)return null;

  const f=this.world.terrain.moduleFormation;
  const S=f.scale*scaleMultiplier;
  const p=this.toWorld(u,v);
  const originalYaw=f.yaw+relativeYaw;
  const pivot=source.userData?.terrainPivot||{x:0,z:0};
  const pivotX=pivot.x*S;
  const pivotZ=pivot.z*S;
  const c=Math.cos(originalYaw);
  const s=Math.sin(originalYaw);

  const wrapper=new this.T.Group();
  wrapper.position.set(
   p.x+c*pivotX+s*pivotZ,
   this.world.terrain.moduleFormationBaseHeight()-.2*f.scale+yOffset,
   p.z-s*pivotX+c*pivotZ
  );
  wrapper.rotation.y=originalYaw+CLIFF_YAW_FIX;
  wrapper.scale.setScalar(S);

  const visual=source.clone(true);
  visual.position.set(-pivot.x,0,-pivot.z);
  wrapper.add(visual);
  this.root.add(wrapper);
  return wrapper;
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

  // The procedural terrain stays authoritative. The modular kit now supplies
  // varied exposed geology rather than forming one repeated necklace of the
  // same grass-capped cliff tile. Grass faces on cliff-family assets are hidden
  // so the island mesh remains the continuous upper walking surface.
  this.placeCliff(this.prototypes.outerTop,0,0,0);

  // West face: each neighbouring section uses genuinely different geometry.
  this.placeCliff(this.prototypes.sideTop,0,-1.62*S,0);
  this.placeCliff(this.prototypes.escarpTop,.04*S,-2.72*S,0);
  this.placeCliff(this.prototypes.innerTop,.08*S,-3.88*S,-Math.PI/2,0,.92);
  this.placeCliff(this.prototypes.falloffCenter,0,-4.78*S,0,0,1.05);
  this.placeCliff(this.prototypes.falloffEdge,0,-5.62*S,0);

  // South face: short rock run, then it dissolves into the authored ramp.
  this.placeCliff(this.prototypes.escarpTop,1.62*S,0,Math.PI/2);
  this.placeCliff(this.prototypes.sideTop,2.68*S,0,Math.PI/2,0,.96);
  this.placeCliff(this.prototypes.falloffCenter,3.58*S,0,Math.PI/2,0,1.08);
  this.placeCliff(this.prototypes.falloffEdge,4.62*S,0,Math.PI/2);

  // The climb is intentionally mixed too: one broad curved hill, one gentle
  // connector and one sharper shoulder. The terrain below remains the actual
  // walk surface, so these can be sunk slightly without changing gameplay.
  this.place(this.prototypes.hillOuter,6.75*S,-2.05*S,-Math.PI/2,-.12);
  this.place(this.prototypes.hillGentle,7.55*S,-1.0*S,-Math.PI/2,-.08);
  this.place(this.prototypes.hillSharp,6.45*S,-3.25*S,-Math.PI/2,-.10,1.05);

  // Break the remaining joins with sparse geology/vegetation instead of
  // repeating another terrain tile.
  this.placeProp(this.prototypes.rocks,-.82*S,-2.95*S,3,1.25);
  this.placeProp(this.prototypes.rocks,-.72*S,-5.15*S,5,1.0);
  this.placeProp(this.prototypes.rocks,3.95*S,-.72*S,9,1.18);
  this.placeProp(this.prototypes.bushes,.58*S,-4.4*S,7,1.3);
  this.placeProp(this.prototypes.bushes,4.55*S,-.6*S,11,1.15);
 }

 initialize(){
  this.scene.add(this.root);
  this.load().then(()=>this.buildShowcaseFormation()).catch(err=>console.error('[Terrain module showcase load]',err));
 }
}
