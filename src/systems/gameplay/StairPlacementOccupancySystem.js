export class StairPlacementOccupancySystem{
 constructor({stairs,buildingModes}){
  this.stairs=stairs;
  this.buildingModes=buildingModes;

  this.railCenterTolerance=.42;
  this.railHeightTolerance=.46;
  this.parallelTolerance=.18;
  this.lanePadding=.24;
  this.runPadding=.16;
  this.treadCenterTolerance=.46;
  this.treadHeightTolerance=.32;

  this.originalFloorRailCandidates=null;
  this.originalExtensionRailCandidates=null;
  this.originalTreadCandidates=null;
 }

 initialize(){
  if(!this.stairs||!this.buildingModes)return;

  this.originalFloorRailCandidates=this.stairs.floorRailCandidates.bind(this.stairs);
  this.stairs.floorRailCandidates=()=>
   this.originalFloorRailCandidates().filter(candidate=>!this.railCandidateOccupied(candidate));

  this.originalExtensionRailCandidates=this.stairs.extensionRailCandidates.bind(this.stairs);
  this.stairs.extensionRailCandidates=()=>
   this.originalExtensionRailCandidates().filter(candidate=>!this.railCandidateOccupied(candidate));

  this.originalTreadCandidates=this.stairs.treadCandidates.bind(this.stairs);
  this.stairs.treadCandidates=()=>
   this.originalTreadCandidates().filter(candidate=>!this.treadCandidateOccupied(candidate));
 }

 axisYawDelta(a,b){
  let d=Math.abs((a-b)%(Math.PI*2));
  if(d>Math.PI)d=Math.PI*2-d;
  return Math.min(d,Math.abs(Math.PI-d));
 }

 railDirection(candidate){return this.stairs.stairDirectionYaw(candidate);}

 directRailOverlap(candidate){
  const direction=this.railDirection(candidate);
  for(const rail of this.stairs.activeRails()){
   if(Math.abs((rail.centerY??0)-(candidate.centerY??0))>this.railHeightTolerance)continue;
   if(Math.hypot((rail.x??0)-candidate.x,(rail.z??0)-candidate.z)>this.railCenterTolerance)continue;
   if(this.axisYawDelta(this.railDirection(rail),direction)>this.parallelTolerance)continue;
   return true;
  }
  return false;
 }

 completedLaneOverlap(candidate){
  const direction=this.railDirection(candidate);
  const halfAcross=(this.buildingModes.logHalfLength??1.45)+this.lanePadding;
  const fullRun=(this.buildingModes.angleHalfProjection??1.025)*2;

  for(const pair of this.stairs.completedPairs()){
   const pairDirection=Math.atan2(pair.outward.x,pair.outward.z);
   if(this.axisYawDelta(direction,pairDirection)>this.parallelTolerance)continue;

   const expectedCenterY=pair.topY-(this.buildingModes.angleHalfProjection??1.025);
   if(Math.abs((candidate.centerY??0)-expectedCenterY)>this.railHeightTolerance)continue;

   const rightX=pair.outward.z;
   const rightZ=-pair.outward.x;
   const dx=candidate.x-pair.topMid.x;
   const dz=candidate.z-pair.topMid.z;
   const along=dx*pair.outward.x+dz*pair.outward.z;
   const across=dx*rightX+dz*rightZ;

   if(Math.abs(across)>halfAcross)continue;
   if(along<-this.runPadding||along>fullRun+this.runPadding)continue;
   return true;
  }
  return false;
 }

 railCandidateOccupied(candidate){
  // Exact/near-exact duplicate rails are always invalid. A completed stair also
  // reserves the full lane between its stringers so another stair pair cannot be
  // authored over the same run from a different edge or structural pairing.
  return this.directRailOverlap(candidate)||this.completedLaneOverlap(candidate);
 }

 treadCandidateOccupied(candidate){
  for(const tread of this.stairs.activeTreads()){
   // A single staircase intentionally uses two tread batches at the same group
   // centre. Keep that workflow, but reject another rail pair trying to author a
   // second staircase into the same physical tread volume.
   if(tread.stairPairKey===candidate.stairPairKey)continue;
   if(Math.abs((tread.centerY??0)-(candidate.centerY??0))>this.treadHeightTolerance)continue;
   if(Math.hypot((tread.x??0)-candidate.x,(tread.z??0)-candidate.z)>this.treadCenterTolerance)continue;
   if(this.axisYawDelta(tread.yaw??0,candidate.yaw??0)>this.parallelTolerance)continue;
   return true;
  }
  return false;
 }
}
