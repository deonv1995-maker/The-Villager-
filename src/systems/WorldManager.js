import { PolishedGrassTerrain } from './world/PolishedGrassTerrain.js?v=549';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=584';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=541';
import { CliffRockDecorator } from './world/CliffRockDecorator.js?v=549';

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

  // A character that has genuinely left its current support surface may cross
  // a steep terrain seam while its feet are above both sides of that seam.
  this.airborneTraversalLift = .08;
  this.airborneTerrainClearance = .05;

  // Rock collision remains intentionally lightweight: each visible rock owns an
  // AABB-derived elliptical body plus a smaller standable support cap. The broad
  // phase stays grid-based, so adding more cliffs does not introduce mesh-physics
  // cost on mobile.
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

 colliderSupportY(collider){
  return Number.isFinite(collider?.supportY)?collider.supportY:collider?.topY;
 }

 pointInsideEllipse(x,z,cx,cz,rx,rz){
  rx=Math.max(.001,rx);
  rz=Math.max(.001,rz);
  const dx=(x-cx)/rx;
  const dz=(z-cz)/rz;
  return dx*dx+dz*dz<=1;
 }

 colliderStandContains(collider,x,z){
  const rx=collider.standRadiusX??collider.standRadius??collider.radius*.72;
  const rz=collider.standRadiusZ??collider.standRadius??collider.radius*.72;
  return this.pointInsideEllipse(x,z,collider.x,collider.z,rx,rz);
 }

 // Stable support surface used for grounded snapping. Rock support remains
 // separate from the terrain height authority and only wins while the Ranger is
 // already at or above that support.
 landingSurfaceHeightAt(x,z,currentFootY=Infinity,isGrounded=false){
  const terrainY=this.terrain.heightAt(x,z);
  let surfaceY=terrainY;
  const candidates=this.rockColliderCandidates(x,z,x,z);
  if(!candidates.length)return surfaceY;

  const tolerance=isGrounded?.34:.18;
  for(const collider of candidates){
   if(!collider.standable)continue;
   const supportY=this.colliderSupportY(collider);
   if(!Number.isFinite(supportY)||supportY<=terrainY+.05)continue;
   if(!this.colliderStandContains(collider,x,z))continue;
   if(Number.isFinite(currentFootY)&&currentFootY<supportY-tolerance)continue;
   if(supportY>surfaceY)surfaceY=supportY;
  }
  return surfaceY;
 }

 // Swept landing query for airborne descent. It detects a support top crossed
 // between two vertical positions, so a frame cannot tunnel through a cliff rock.
 landingSurfaceHeightForSweep(x,z,fromFootY,toFootY){
  const terrainY=this.terrain.heightAt(x,z);
  let surfaceY=terrainY;
  const candidates=this.rockColliderCandidates(x,z,x,z);

  for(const collider of candidates){
   if(!collider.standable)continue;
   const supportY=this.colliderSupportY(collider);
   if(!Number.isFinite(supportY)||supportY<=terrainY+.05)continue;
   if(!this.colliderStandContains(collider,x,z))continue;

   const startedAbove=fromFootY>=supportY-.06;
   const endedAtOrBelow=toFootY<=supportY+.02;
   if(startedAbove&&endedAtOrBelow&&supportY>surfaceY)surfaceY=supportY;
  }
  return surfaceY;
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
  const extent=Math.max(
   collider.radius||0,
   collider.radiusX||0,
   collider.radiusZ||0
  )+this.playerCollisionRadius;
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

 registerRockCollider({
  x,z,radius,radiusX=null,radiusZ=null,bottomY,topY,supportY=null,
  owner='world',object=null,standable=true,standRadius=null,
  standRadiusX=null,standRadiusZ=null
 }){
  if(![x,z,radius,bottomY,topY].every(Number.isFinite))return null;
  if(radius<=.05||topY<=bottomY+.05)return null;

  const resolvedRadiusX=Number.isFinite(radiusX)?Math.max(.05,radiusX):radius;
  const resolvedRadiusZ=Number.isFinite(radiusZ)?Math.max(.05,radiusZ):radius;
  const resolvedSupportY=Number.isFinite(supportY)
   ?Math.max(bottomY+.06,Math.min(topY,supportY))
   :topY;
  const fallbackStand=Number.isFinite(standRadius)
   ?Math.max(.08,standRadius)
   :radius*.72;
  const resolvedStandX=Number.isFinite(standRadiusX)
   ?Math.max(.08,Math.min(resolvedRadiusX,standRadiusX))
   :Math.min(resolvedRadiusX,fallbackStand);
  const resolvedStandZ=Number.isFinite(standRadiusZ)
   ?Math.max(.08,Math.min(resolvedRadiusZ,standRadiusZ))
   :Math.min(resolvedRadiusZ,fallbackStand);

  const collider={
   id:this.nextRockColliderId++,
   x,z,radius:Math.max(radius,resolvedRadiusX,resolvedRadiusZ),
   radiusX:resolvedRadiusX,
   radiusZ:resolvedRadiusZ,
   bottomY,topY,supportY:resolvedSupportY,owner,object,
   standable:!!standable,
   standRadius:Math.max(resolvedStandX,resolvedStandZ),
   standRadiusX:resolvedStandX,
   standRadiusZ:resolvedStandZ
  };
  this.rockColliders.push(collider);
  this.addColliderToGrid(collider);
  return collider;
 }

 registerRockColliderFromObject(object,{
  owner='world',radiusScale=.36,minRadius=.30,maxRadius=2.4,verticalInset=.05,
  standable=true,standRadiusScale=.72,
  supportInsetScale=.08,minSupportInset=.04,maxSupportInset=.24
 }={}){
  if(!object)return null;
  object.updateWorldMatrix?.(true,true);
  const box=new this.THREE.Box3().setFromObject(object);
  if(box.isEmpty())return null;

  const size=new this.THREE.Vector3();
  const center=new this.THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Preserve each rock's actual world-space width/depth instead of collapsing
  // it to one centre circle. This is the key fix for the broad cliff stones.
  const radiusX=Math.max(minRadius,Math.min(maxRadius,size.x*radiusScale));
  const radiusZ=Math.max(minRadius,Math.min(maxRadius,size.z*radiusScale));
  const radius=Math.max(radiusX,radiusZ);
  const bottomY=box.min.y+verticalInset;
  const topY=Math.max(bottomY+.12,box.max.y-verticalInset);
  const supportInset=Math.max(
   minSupportInset,
   Math.min(maxSupportInset,size.y*supportInsetScale)
  );
  const supportY=Math.max(bottomY+.08,topY-supportInset);
  const standRadiusX=Math.max(.10,Math.min(radiusX,radiusX*standRadiusScale));
  const standRadiusZ=Math.max(.10,Math.min(radiusZ,radiusZ*standRadiusScale));

  return this.registerRockCollider({
   x:center.x,z:center.z,radius,radiusX,radiusZ,bottomY,topY,supportY,
   owner,object,standable,
   standRadius:Math.max(standRadiusX,standRadiusZ),
   standRadiusX,standRadiusZ
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
   {
    radiusScale:.42,minRadius:.30,maxRadius:2.8,verticalInset:.05,
    standable:true,standRadiusScale:.86,supportInsetScale:.08
   }
  );
 }

 rebuildCliffRockColliders(){
  this.clearRockColliders('cliff-rocks');
  const root=this.cliffRocks?.root;
  if(!root)return 0;
  let count=0;

  for(const object of root.children){
   if(!Number.isFinite(object.userData?.cliffRockSource))continue;
   const shape=object.userData?.cliffRockShape||'face';

   // Every visible cliff rock receives a full footprint collider. Rim rocks are
   // almost fully standable; face/base rocks keep only a small visual margin.
   const radiusScale=shape==='face'?.50:shape==='rim'?.52:.50;
   const standRadiusScale=shape==='face'?.92:shape==='rim'?.98:.95;
   const supportInsetScale=shape==='face'?.09:shape==='rim'?.07:.08;

   if(this.registerRockColliderFromObject(object,{
    owner:'cliff-rocks',
    radiusScale,
    minRadius:.38,
    maxRadius:3.6,
    verticalInset:.04,
    standable:true,
    standRadiusScale,
    supportInsetScale,
    minSupportInset:.04,
    maxSupportInset:.24
   }))count++;
  }
  return count;
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

 segmentIntersectsEllipse(fromX,fromZ,toX,toZ,cx,cz,rx,rz){
  rx=Math.max(.001,rx);
  rz=Math.max(.001,rz);
  return this.segmentPointDistanceSq(
   (fromX-cx)/rx,(fromZ-cz)/rz,
   (toX-cx)/rx,(toZ-cz)/rz,
   0,0
  )<1;
 }

 rockBlocksMovement(fromX,fromZ,toX,toZ,currentFootY){
  const candidates=this.rockColliderCandidates(fromX,fromZ,toX,toZ);
  if(!candidates.length)return false;
  const headY=currentFootY+this.playerCollisionHeight;

  for(const collider of candidates){
   const supportY=this.colliderSupportY(collider);

   // Once the feet are on/above the support cap, the same collider becomes a
   // walkable top rather than a side wall.
   if(currentFootY>=supportY-.04)continue;
   if(headY<=collider.bottomY+.04)continue;

   const bodyX=(collider.radiusX??collider.radius)+this.playerCollisionRadius;
   const bodyZ=(collider.radiusZ??collider.radius)+this.playerCollisionRadius;
   const fromInside=this.pointInsideEllipse(
    fromX,fromZ,collider.x,collider.z,bodyX,bodyZ
   );
   const toInside=this.pointInsideEllipse(
    toX,toZ,collider.x,collider.z,bodyX,bodyZ
   );

   // Never trap a character who begins just inside a simplified footprint.
   if(fromInside&&!toInside)continue;

   if(this.segmentIntersectsEllipse(
    fromX,fromZ,toX,toZ,collider.x,collider.z,bodyX,bodyZ
   ))return true;
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

  if((from.rampMask>.40&&to.rampMask>.40)||(mid?.rampMask>.48))return false;

  const solidProfile=[from,to,mid].some(p=>p&&p.weight>.12&&p.rampMask<.36&&p.drop>1.15);
  if(!solidProfile)return false;

  if(from.formationId===to.formationId&&from.signed*to.signed<0)return true;

  const fromDistance=Math.abs(from.signed);
  const toDistance=Math.abs(to.signed);
  if(to.formationId===from.formationId&&toDistance<this.cliffPlayerClearance&&toDistance<fromDistance-.001)return true;

  return false;
 }

 canAirborneClearTerrainSegment(fromX,fromZ,toX,toZ,currentFootY,fromGround,toGround){
  if(!Number.isFinite(currentFootY))return false;

  const supportY=this.landingSurfaceHeightAt(fromX,fromZ,currentFootY,true);
  if(currentFootY<=supportY+this.airborneTraversalLift)return false;

  const requiredY=Math.max(fromGround,toGround)+this.airborneTerrainClearance;
  return currentFootY>=requiredY;
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

   const ground=this.surfaceHeightAt(x,z);
   const clearsTerrain=this.canAirborneClearTerrainSegment(
    px,pz,x,z,currentY,previousGround,ground
   );

   if(this.rockBlocksMovement(px,pz,x,z,currentY)){
    return {allowed:false,ground:previousGround,reason:'rock'};
   }

   const terrainBarrier=this.isApproachingSolidCliff(px,pz,x,z)
    ||this.terrain.moduleFormationBlocksSegment(px,pz,x,z);
   if(terrainBarrier&&!clearsTerrain){
    return {allowed:false,ground:previousGround,reason:'procedural-cliff'};
   }

   const rise=ground-previousGround;
   const sampleDistance=Math.max(.001,Math.hypot(x-px,z-pz));
   const slope=Math.abs(rise)/sampleDistance;
   const profile=this.cliffProfileAt(x,z);
   const onRamp=profile?.rampMask>.38;

   if(!clearsTerrain&&!onRamp&&rise>this.maxSampleStepUp){
    return {allowed:false,ground:previousGround,reason:'step-up'};
   }
   if(!clearsTerrain&&!onRamp&&rise<-this.maxSampleStepDown){
    return {allowed:false,ground:previousGround,reason:'drop'};
   }
   if(!clearsTerrain&&!onRamp&&slope>this.maxWalkSlope){
    return {allowed:false,ground:previousGround,reason:'slope'};
   }

   px=x;
   pz=z;
   previousGround=ground;
  }

  return {allowed:true,ground:previousGround,reason:null};
 }
}
