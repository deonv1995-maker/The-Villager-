export class ConstructionTraversalSystem{
 constructor({world,buildingModes}){
  this.world=world;
  this.buildingModes=buildingModes;

  // Floors are walkable oriented rectangles, not rock-shaped ellipses. A small
  // edge margin closes numerical seams between snapped pieces without making the
  // Ranger appear to stand far beyond the visible wood.
  this.floorEdgeMargin=.10;
  this.groundedStepTolerance=.52;
  this.airborneSupportTolerance=.18;
  this.sweepTopTolerance=.04;
  this.walkSampleSpacing=.16;
  this.samePlaneTolerance=.075;
  this.lastColliderCount=-1;
 }

 initialize(){
  this.world.constructionTraversal=this;
  this.removeLegacyFloorColliders();
 }

 floorPlacements(){
  return this.buildingModes?.placements?.filter(p=>p.mode==='floor'&&p.object?.parent)||[];
 }

 basis(yaw){
  return {
   xX:Math.cos(yaw),xZ:-Math.sin(yaw),
   zX:Math.sin(yaw),zZ:Math.cos(yaw)
  };
 }

 containsFloorPoint(floor,x,z,margin=this.floorEdgeMargin){
  const halfLength=(this.buildingModes?.floorHalfLength??1.10)+margin;
  const halfWidth=(this.buildingModes?.floorHalfWidth??.56)+margin;
  const b=this.basis(floor.yaw||0);
  const dx=x-floor.x;
  const dz=z-floor.z;
  const localX=dx*b.xX+dz*b.xZ;
  const localZ=dx*b.zX+dz*b.zZ;
  return Math.abs(localX)<=halfLength&&Math.abs(localZ)<=halfWidth;
 }

 surfaceHeightAt(x,z,currentFootY=Infinity,isGrounded=false){
  const tolerance=isGrounded?this.groundedStepTolerance:this.airborneSupportTolerance;
  let best=-Infinity;

  for(const floor of this.floorPlacements()){
   if(!this.containsFloorPoint(floor,x,z))continue;
   const supportY=floor.maxY;
   if(!Number.isFinite(supportY))continue;
   if(Number.isFinite(currentFootY)&&currentFootY<supportY-tolerance)continue;
   if(supportY>best)best=supportY;
  }
  return best;
 }

 surfaceHeightForSweep(x,z,fromFootY,toFootY){
  let best=-Infinity;
  for(const floor of this.floorPlacements()){
   if(!this.containsFloorPoint(floor,x,z))continue;
   const supportY=floor.maxY;
   if(!Number.isFinite(supportY))continue;
   const startedAbove=fromFootY>=supportY-.07;
   const endedAtOrBelow=toFootY<=supportY+this.sweepTopTolerance;
   if(startedAbove&&endedAtOrBelow&&supportY>best)best=supportY;
  }
  return best;
 }

 supportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ){
  const startY=this.surfaceHeightAt(fromX,fromZ,currentFootY,true);
  if(!Number.isFinite(startY))return false;
  if(Math.abs(currentFootY-startY)>this.groundedStepTolerance)return false;

  const distance=Math.hypot(toX-fromX,toZ-fromZ);
  const samples=Math.max(1,Math.ceil(distance/this.walkSampleSpacing));
  for(let i=1;i<=samples;i++){
   const t=i/samples;
   const x=fromX+(toX-fromX)*t;
   const z=fromZ+(toZ-fromZ)*t;
   const supportY=this.surfaceHeightAt(x,z,startY+.08,true);
   if(!Number.isFinite(supportY))return false;
   if(Math.abs(supportY-startY)>this.samePlaneTolerance)return false;
  }
  return true;
 }

 removeLegacyFloorColliders(){
  const world=this.world;
  if(!Array.isArray(world?.rockColliders))return;

  const before=world.rockColliders.length;
  world.rockColliders=world.rockColliders.filter(collider=>{
   if(collider.owner!=='player-construction')return true;
   return collider.object?.userData?.constructionMode!=='floor';
  });

  if(world.rockColliders.length!==before)world.rebuildRockColliderGrid?.();
  this.lastColliderCount=world.rockColliders.length;
 }

 update(){
  const count=this.world?.rockColliders?.length??0;
  if(count!==this.lastColliderCount)this.removeLegacyFloorColliders();
 }
}
