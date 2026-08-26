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

 landingSurfaceHeightAt(x,z,currentFootY=Infinity,isGrounded=false){
  let best=this.heightAt(x,z);
  const candidates=this.rockColliderCandidates(x,z,x,z);
  const stepTolerance=isGrounded?.58:.18;
  for(const collider of candidates){
   if(collider?.standable===false)continue;
   const rx=collider.standRadiusX??collider.standRadius??collider.radiusX??collider.radius??0;
   const rz=collider.standRadiusZ??collider.standRadius??collider.radiusZ??collider.radius??0;
   if(!this.pointInsideEllipse(x,z,collider.x,collider.z,rx,rz))continue;
   const supportY=this.colliderSupportY(collider);
   if(!Number.isFinite(supportY))continue;
   if(Number.isFinite(currentFootY)&&currentFootY<supportY-stepTolerance)continue;
   if(supportY>best)best=supportY;
  }
  return best;
 }

 landingSurfaceHeightForSweep(x,z,fromFootY,toFootY){
  let best=this.heightAt(x,z);
  const candidates=this.rockColliderCandidates(x,z,x,z);
  for(const collider of candidates){
   if(collider?.standable===false)continue;
   const rx=collider.standRadiusX??collider.standRadius??collider.radiusX??collider.radius??0;
   const rz=collider.standRadiusZ??collider.standRadius??collider.radiusZ??collider.radius??0;
   if(!this.pointInsideEllipse(x,z,collider.x,collider.z,rx,rz))continue;
   const supportY=this.colliderSupportY(collider);
   if(!Number.isFinite(supportY))continue;
   const startedAbove=fromFootY>=supportY-.07;
   const endedAtOrBelow=toFootY<=supportY+.05;
   if(startedAbove&&endedAtOrBelow&&supportY>best)best=supportY;
  }
  return best;
 }

 isWithinPlayableBounds(x,z){
  const metric=this.terrain?.islandMetric?.(x,z);
  return Number.isFinite(metric)?metric<=this.playableCoastMetric:true;
 }

 pointInsideRockBody(collider,x,z,margin=0){
  const rx=(collider.radiusX??collider.radius??0)+margin;
  const rz=(collider.radiusZ??collider.radius??0)+margin;
  return this.pointInsideEllipse(x,z,collider.x,collider.z,rx,rz);
 }

 segmentHitsEllipse(fromX,fromZ,toX,toZ,collider,margin=0){
  const rx=Math.max(.001,(collider.radiusX??collider.radius??0)+margin);
  const rz=Math.max(.001,(collider.radiusZ??collider.radius??0)+margin);
  const ax=(fromX-collider.x)/rx;
  const az=(fromZ-collider.z)/rz;
  const bx=(toX-collider.x)/rx;
  const bz=(toZ-collider.z)/rz;
  const dx=bx-ax,dz=bz-az;
  const lenSq=dx*dx+dz*dz;
  if(lenSq<1e-8)return ax*ax+az*az<=1;
  const t=Math.max(0,Math.min(1,-(ax*dx+az*dz)/lenSq));
  const px=ax+dx*t,pz=az+dz*t;
  return px*px+pz*pz<=1;
 }

 rockColliderCandidates(fromX,fromZ,toX,toZ){
  if(!this.rockColliderGrid.size)return this.rockColliders;
  const minX=Math.floor(Math.min(fromX,toX)/this.rockColliderCellSize)-1;
  const maxX=Math.floor(Math.max(fromX,toX)/this.rockColliderCellSize)+1;
  const minZ=Math.floor(Math.min(fromZ,toZ)/this.rockColliderCellSize)-1;
  const maxZ=Math.floor(Math.max(fromZ,toZ)/this.rockColliderCellSize)+1;
  const result=[],seen=new Set();
  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const bucket=this.rockColliderGrid.get(`${ix}:${iz}`);
    if(!bucket)continue;
    for(const collider of bucket){
     if(seen.has(collider.id))continue;
     seen.add(collider.id);result.push(collider);
    }
   }
  }
  return result;
 }

 rebuildRockColliderGrid(){
  this.rockColliderGrid.clear();
  for(const collider of this.rockColliders){
   const radius=Math.max(
    collider.radiusX??collider.radius??0,
    collider.radiusZ??collider.radius??0
   );
   const minX=Math.floor((collider.x-radius)/this.rockColliderCellSize);
   const maxX=Math.floor((collider.x+radius)/this.rockColliderCellSize);
   const minZ=Math.floor((collider.z-radius)/this.rockColliderCellSize);
   const maxZ=Math.floor((collider.z+radius)/this.rockColliderCellSize);
   for(let ix=minX;ix<=maxX;ix++){
    for(let iz=minZ;iz<=maxZ;iz++){
     const key=`${ix}:${iz}`;
     let bucket=this.rockColliderGrid.get(key);
     if(!bucket){bucket=[];this.rockColliderGrid.set(key,bucket);}
     bucket.push(collider);
    }
   }
  }
 }

 clearRockColliders(owner){
  this.rockColliders=this.rockColliders.filter(collider=>collider.owner!==owner);
  this.rebuildRockColliderGrid();
 }

 registerRockColliderFromObject(object,{owner='environment-rocks',standable=true,padding=.05,standInset=.12,supportInset=.04}={}){
  if(!object?.parent)return null;
  const box=new this.THREE.Box3().setFromObject(object);
  if(box.isEmpty())return null;
  const center=new this.THREE.Vector3();box.getCenter(center);
  const size=new this.THREE.Vector3();box.getSize(size);
  if(size.x<.05||size.y<.05||size.z<.05)return null;
  const radiusX=Math.max(.18,size.x*.5+padding);
  const radiusZ=Math.max(.18,size.z*.5+padding);
  const collider={
   id:this.nextRockColliderId++,owner,object,
   x:center.x,z:center.z,
   radiusX,radiusZ,
   radius:Math.max(radiusX,radiusZ),
   bottomY:box.min.y,
   topY:box.max.y,
   supportY:box.max.y-supportInset,
   bodyHeight:size.y,
   standable,
   standRadiusX:Math.max(.12,radiusX-standInset),
   standRadiusZ:Math.max(.12,radiusZ-standInset)
  };
  this.rockColliders.push(collider);
  return collider;
 }

 rebuildEnvironmentRockColliders(){
  this.clearRockColliders('environment-rocks');
  const root=this.environment?.root;
  if(root){
   for(const object of root.children){
    if(object.userData?.environmentType!=='rock'||object.visible===false)continue;
    this.registerRockColliderFromObject(object,{
     owner:'environment-rocks',standable:true,padding:.08,standInset:.18,supportInset:.03
    });
   }
  }
  this.rebuildRockColliderGrid();
 }

 rebuildCliffRockColliders(){
  this.clearRockColliders('cliff-rocks');
  const root=this.cliffRocks?.root;
  if(root){
   for(const object of root.children){
    if(object.visible===false)continue;
    this.registerRockColliderFromObject(object,{
     owner:'cliff-rocks',standable:true,padding:.10,standInset:.22,supportInset:.02
    });
   }
  }
  this.rebuildRockColliderGrid();
 }

 rockBlocksMovement(fromX,fromZ,currentFootY,toX,toZ){
  const playerRadius=this.playerCollisionRadius;
  const headY=currentFootY+this.playerCollisionHeight;
  for(const collider of this.rockColliderCandidates(fromX,fromZ,toX,toZ)){
   if(currentFootY>=collider.topY-.04||headY<=collider.bottomY+.04)continue;
   const fromInside=this.pointInsideRockBody(collider,fromX,fromZ,playerRadius);
   const toInside=this.pointInsideRockBody(collider,toX,toZ,playerRadius);
   if(fromInside){
    const fromDx=(fromX-collider.x)/(collider.radiusX+playerRadius);
    const fromDz=(fromZ-collider.z)/(collider.radiusZ+playerRadius);
    const toDx=(toX-collider.x)/(collider.radiusX+playerRadius);
    const toDz=(toZ-collider.z)/(collider.radiusZ+playerRadius);
    const fromMetric=fromDx*fromDx+fromDz*fromDz;
    const toMetric=toDx*toDx+toDz*toDz;
    if(toMetric>=fromMetric-.002)continue;
    return true;
   }
   if(toInside||this.segmentHitsEllipse(fromX,fromZ,toX,toZ,collider,playerRadius))return true;
  }
  return false;
 }

 sampleTerrainSegment(fromX,fromZ,toX,toZ){
  const distance=Math.hypot(toX-fromX,toZ-fromZ);
  const samples=Math.max(1,Math.ceil(distance/this.pathSampleSpacing));
  const heights=[];
  for(let i=0;i<=samples;i++){
   const t=i/samples;
   const x=fromX+(toX-fromX)*t;
   const z=fromZ+(toZ-fromZ)*t;
   heights.push({x,z,y:this.heightAt(x,z)});
  }
  return heights;
 }

 resolveMovement(fromX,fromZ,currentFootY,toX,toZ){
  if(this.rockBlocksMovement(fromX,fromZ,currentFootY,toX,toZ))return {allowed:false,reason:'rock'};

  const samples=this.sampleTerrainSegment(fromX,fromZ,toX,toZ);
  const currentTerrain=this.heightAt(fromX,fromZ);
  let previousY=currentTerrain;
  for(let i=1;i<samples.length;i++){
   const sample=samples[i];
   const rise=sample.y-previousY;
   const drop=previousY-sample.y;
   if(rise>this.maxSampleStepUp)return {allowed:false,reason:'step-up'};
   if(drop>this.maxSampleStepDown)return {allowed:false,reason:'drop'};
   previousY=sample.y;
  }

  const finalY=samples[samples.length-1]?.y??this.heightAt(toX,toZ);
  const terrainDelta=finalY-currentTerrain;
  if(Math.abs(terrainDelta)>this.maxWalkSlope)return {allowed:false,reason:'slope'};

  const terrain=this.terrain;
  const cliffFrom=terrain?.cliffFormationProfileAt?.(fromX,fromZ);
  const cliffTo=terrain?.cliffFormationProfileAt?.(toX,toZ);
  if(cliffFrom&&cliffTo&&cliffFrom.formation===cliffTo.formation){
   const crossing=cliffFrom.signed*cliffTo.signed<0;
   if(crossing){
    const top=Math.max(currentTerrain,finalY);
    const airborne=currentFootY>top+this.airborneTraversalLift;
    if(!airborne)return {allowed:false,reason:'procedural-cliff'};
   }
  }

  return {allowed:true,reason:'ok'};
 }
}
