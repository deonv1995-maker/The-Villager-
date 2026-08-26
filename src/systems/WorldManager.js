import { PolishedGrassTerrain } from './world/PolishedGrassTerrain.js?v=548';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=547';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=541';
import { CliffRockDecorator } from './world/CliffRockDecorator.js?v=547';

export class WorldManager {
 constructor(THREE, scene) {
  this.THREE = THREE;
  this.scene = scene;
  this.terrain = new PolishedGrassTerrain(THREE);
  this.environment = null;
  this.features = null;
  this.cliffRocks = null;

  // Central traversal policy. Keep these rules here so the player controller,
  // future NPCs and other walkers can all use the same terrain authority.
  this.cliffPlayerClearance = 1.05;
  this.pathSampleSpacing = .13;
  this.maxSampleStepUp = .50;
  this.maxSampleStepDown = .72;
  this.maxWalkSlope = 1.75;
  this.playableCoastMetric = .985;

  // Lightweight rock collision registry. Decorative meshes remain visual-only;
  // traversal uses compact cylindrical footprints stored in a spatial grid.
  // This keeps collision predictable and mobile-friendly as the world expands.
  this.rockColliders=[];
  this.rockColliderGrid=new Map();
  this.rockColliderCellSize=6;
  this.nextRockColliderId=1;
  this.playerCollisionRadius=.42;
  this.playerCollisionHeight=2.15;
 }

 initialize() {
  const root = this.terrain.create();
  this.scene.add(root);

  this.features = new TerrainFeatures(this.THREE, { world: this, scene: this.scene });
  this.features.initialize();

  this.environment = new EnvironmentPopulation(this.THREE, { world: this, scene: this.scene });
  this.environment.initialize();
  this.environment.loadKayKit().then(()=>Promise.resolve().then(()=>{
   this.rebuildEnvironmentRockColliders();
  })).catch(err=>console.error('[Environment rock colliders]',err));

  // Visual cliff dressing is deliberately downstream of terrain authority.
  // It reuses the environment's already-loaded KayKit rock prototypes, while
  // movement/collision continues to read the stable terrain profiles plus
  // simplified rock footprints rather than raw render meshes.
  this.cliffRocks = new CliffRockDecorator(this.THREE, {
   world: this,
   scene: this.scene,
   environment: this.environment
  });
  this.cliffRocks.initialize().then(()=>{
   this.rebuildCliffRockColliders();
  }).catch(err=>console.error('[Cliff rock colliders]',err));
 }

 heightAt(x, z) {
  return this.terrain.heightAt(x, z);
 }

 surfaceHeightAt(x, z) {
  return this.terrain.heightAt(x, z);
 }

 isWithinPlayableBounds(x, z) {
  const metric=this.terrain.islandMetric?.(x,z);
  if(Number.isFinite(metric))return metric<this.playableCoastMetric;
  return Math.hypot(x,z)<(this.terrain.radius||90)-3;
 }

 cliffProfileAt(x, z) {
  return this.terrain.cliffFormationProfileAt?.(x, z) || null;
 }

 colliderCellKey(ix,iz){return `${ix}:${iz}`;}

 addColliderToGrid(collider){
  const cell=this.rockColliderCellSize;
  const extent=collider.radius+this.playerCollisionRadius;
  const minX=Math.floor((collider.x-extent)/cell);
  const maxX=Math.floor((collider.x+extent)/cell);
  const minZ=Math.floor((collider.z-extent)/cell);
  const maxZ=Math.floor((collider.z+extent)/cell);
  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const key=this.colliderCellKey(ix,iz);
    let bucket=this.rockColliderGrid.get(key);
    if(!bucket){bucket=[];this.rockColliderGrid.set(key,bucket);}
    bucket.push(collider);
   }
  }
 }

 rebuildRockColliderGrid(){
  this.rockColliderGrid.clear();
  for(const collider of this.rockColliders)this.addColliderToGrid(collider);
 }

 clearRockColliders(owner=null){
  if(owner==null)this.rockColliders.length=0;
  else this.rockColliders=this.rockColliders.filter(c=>c.owner!==owner);
  this.rebuildRockColliderGrid();
 }

 registerRockCollider({x,z,radius,bottomY,topY,owner='world',object=null}){
  if(![x,z,radius,bottomY,topY].every(Number.isFinite))return null;
  if(radius<=.05||topY<=bottomY+.05)return null;
  const collider={
   id:this.nextRockColliderId++,x,z,radius,bottomY,topY,owner,object
  };
  this.rockColliders.push(collider);
  this.addColliderToGrid(collider);
  return collider;
 }

 registerRockColliderFromObject(object,{
  owner='world',radiusScale=.36,minRadius=.30,maxRadius=2.4,verticalInset=.05
 }={}){
  if(!object)return null;
  object.updateWorldMatrix?.(true,true);
  const box=new this.THREE.Box3().setFromObject(object);
  if(box.isEmpty())return null;
  const size=new this.THREE.Vector3();
  const center=new this.THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const radius=Math.max(minRadius,Math.min(maxRadius,Math.max(size.x,size.z)*radiusScale));
  const bottomY=box.min.y+verticalInset;
  const topY=Math.max(bottomY+.12,box.max.y-verticalInset);
  return this.registerRockCollider({
   x:center.x,z:center.z,radius,bottomY,topY,owner,object
  });
 }

 registerRockCollidersFromGroup(root,owner,filter,options={}){
  this.clearRockColliders(owner);
  if(!root)return 0;
  let count=0;
  for(const object of root.children){
   if(filter&&!filter(object))continue;
   if(this.registerRockColliderFromObject(object,{owner,...options}))count++;
  }
  return count;
 }

 rebuildEnvironmentRockColliders(){
  return this.registerRockCollidersFromGroup(
   this.environment?.root,
   'environment-rocks',
   object=>object.userData?.environmentType==='rock',
   {radiusScale:.36,minRadius:.30,maxRadius:2.35,verticalInset:.06}
  );
 }

 rebuildCliffRockColliders(){
  return this.registerRockCollidersFromGroup(
   this.cliffRocks?.root,
   'cliff-rocks',
   object=>Number.isFinite(object.userData?.cliffRockSource),
   {radiusScale:.29,minRadius:.32,maxRadius:2.20,verticalInset:.08}
  );
 }

 rockColliderCandidates(fromX,fromZ,toX,toZ){
  if(!this.rockColliderGrid.size)return [];
  const cell=this.rockColliderCellSize;
  const pad=this.playerCollisionRadius+.08;
  const minX=Math.floor((Math.min(fromX,toX)-pad)/cell);
  const maxX=Math.floor((Math.max(fromX,toX)+pad)/cell);
  const minZ=Math.floor((Math.min(fromZ,toZ)-pad)/cell);
  const maxZ=Math.floor((Math.max(fromZ,toZ)+pad)/cell);
  const found=[];
  const seen=new Set();
  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const bucket=this.rockColliderGrid.get(this.colliderCellKey(ix,iz));
    if(!bucket)continue;
    for(const collider of bucket){
     if(seen.has(collider.id))continue;
     seen.add(collider.id);
     found.push(collider);
    }
   }
  }
  return found;
 }

 segmentPointDistanceSq(ax,az,bx,bz,px,pz){
  const dx=bx-ax;
  const dz=bz-az;
  const lenSq=dx*dx+dz*dz;
  if(lenSq<1e-8){
   const ox=px-ax,oz=pz-az;
   return ox*ox+oz*oz;
  }
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/lenSq));
  const cx=ax+dx*t;
  const cz=az+dz*t;
  const ox=px-cx,oz=pz-cz;
  return ox*ox+oz*oz;
 }

 rockBlocksMovement(fromX,fromZ,toX,toZ,currentFootY){
  const candidates=this.rockColliderCandidates(fromX,fromZ,toX,toZ);
  if(!candidates.length)return false;
  const headY=currentFootY+this.playerCollisionHeight;

  for(const collider of candidates){
   // Allow jumping cleanly over low rocks and walking beneath geometry that is
   // genuinely above the character, such as some cliff-face decoration.
   if(currentFootY>=collider.topY-.04)continue;
   if(headY<=collider.bottomY+.04)continue;

   const combined=collider.radius+this.playerCollisionRadius;
   const combinedSq=combined*combined;
   const fromDx=fromX-collider.x,fromDz=fromZ-collider.z;
   const toDx=toX-collider.x,toDz=toZ-collider.z;
   const fromSq=fromDx*fromDx+fromDz*fromDz;
   const toSq=toDx*toDx+toDz*toDz;

   // Never trap a character that starts marginally inside a footprint. Moving
   // outward is allowed; moving deeper or crossing into a rock is rejected.
   if(fromSq<combinedSq&&toSq>fromSq+1e-5)continue;

   if(this.segmentPointDistanceSq(fromX,fromZ,toX,toZ,collider.x,collider.z)<combinedSq){
    return true;
   }
  }
  return false;
 }

 isApproachingSolidCliff(fromX, fromZ, toX, toZ) {
  const from = this.cliffProfileAt(fromX, fromZ);
  const to = this.cliffProfileAt(toX, toZ);
  if (!from || !to) return false;

  const mx=(fromX+toX)*.5;
  const mz=(fromZ+toZ)*.5;
  const mid=this.cliffProfileAt(mx,mz);

  // Every authored formation exposes a deliberate ramp through the same
  // profile API, so traversal stays data-driven as more cliffs are added.
  if((from.rampMask>.40&&to.rampMask>.40)||(mid?.rampMask>.48))return false;

  const solidProfile=[from,to,mid].some(p=>p&&p.weight>.12&&p.rampMask<.36&&p.drop>1.15);
  if(!solidProfile)return false;

  if(from.formationId===to.formationId&&from.signed*to.signed<0)return true;

  const fromDistance=Math.abs(from.signed);
  const toDistance=Math.abs(to.signed);
  if(to.formationId===from.formationId&&toDistance<this.cliffPlayerClearance&&toDistance<fromDistance-.001)return true;

  return false;
 }

 resolveMovement(fromX, fromZ, currentY, toX, toZ) {
  if(!this.isWithinPlayableBounds(toX,toZ)){
   return {allowed:false,ground:this.surfaceHeightAt(fromX,fromZ),reason:'coast'};
  }

  const dx=toX-fromX;
  const dz=toZ-fromZ;
  const distance=Math.hypot(dx,dz);
  const samples=Math.max(1,Math.ceil(distance/this.pathSampleSpacing));
  let px=fromX;
  let pz=fromZ;
  let previousGround=this.surfaceHeightAt(fromX,fromZ);

  for(let i=1;i<=samples;i++){
   const t=i/samples;
   const x=fromX+dx*t;
   const z=fromZ+dz*t;

   if(!this.isWithinPlayableBounds(x,z)){
    return {allowed:false,ground:previousGround,reason:'coast'};
   }

   if(this.rockBlocksMovement(px,pz,x,z,currentY)){
    return {allowed:false,ground:previousGround,reason:'rock'};
   }

   if(this.isApproachingSolidCliff(px,pz,x,z)
    ||this.terrain.moduleFormationBlocksSegment(px,pz,x,z)){
    return {allowed:false,ground:previousGround,reason:'procedural-cliff'};
   }

   const ground=this.surfaceHeightAt(x,z);
   const rise=ground-previousGround;
   const sampleDistance=Math.max(.001,Math.hypot(x-px,z-pz));
   const slope=Math.abs(rise)/sampleDistance;
   const profile=this.cliffProfileAt(x,z);
   const onRamp=profile?.rampMask>.38;

   if(!onRamp&&rise>this.maxSampleStepUp){
    return {allowed:false,ground:previousGround,reason:'step-up'};
   }
   if(!onRamp&&rise<-this.maxSampleStepDown){
    return {allowed:false,ground:previousGround,reason:'drop'};
   }
   if(!onRamp&&slope>this.maxWalkSlope){
    return {allowed:false,ground:previousGround,reason:'slope'};
   }

   px=x;
   pz=z;
   previousGround=ground;
  }

  return {allowed:true,ground:previousGround,reason:null};
 }
}
