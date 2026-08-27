export class StairLandingTransitionSystem{
 constructor({world,constructionTraversal,stairs,buildingModes}){
  this.world=world;
  this.traversal=constructionTraversal;
  this.stairs=stairs;
  this.buildingModes=buildingModes;

  // Keep the pass-through corridor well inside the two stair stringers. Only the
  // deck edge directly connected to a completed stair gets this exception.
  this.halfWidth=Math.max(.58,(buildingModes?.logHalfLength??1.45)-.38);
  this.outsideDepth=.62;
  this.insideDepth=.78;
  this.deckHeightBelow=.72;
  this.deckHeightAbove=.22;
  this.floorHeightTolerance=.24;
  this.insideProbe=.24;

  this.originalOverlapDepth=null;
  this.originalObstacleBlocks=null;
 }

 initialize(){
  if(!this.traversal||!this.stairs)return;

  this.originalOverlapDepth=this.traversal.overlapDepth.bind(this.traversal);
  this.traversal.overlapDepth=(placement,x,z,currentFootY)=>{
   if(placement?.mode==='floor'&&this.pointUsesLanding(placement,x,z,currentFootY))return 0;
   return this.originalOverlapDepth(placement,x,z,currentFootY);
  };

  this.originalObstacleBlocks=this.traversal.obstacleBlocks.bind(this.traversal);
  this.traversal.obstacleBlocks=(placement,fromX,fromZ,currentFootY,toX,toZ)=>{
   if(placement?.mode==='floor'&&this.segmentUsesLanding(
    placement,fromX,fromZ,currentFootY,toX,toZ
   ))return false;
   return this.originalObstacleBlocks(placement,fromX,fromZ,currentFootY,toX,toZ);
  };
 }

 completedPairs(){return this.stairs?.completedPairs?.()||[];}

 deckY(pair){
  const a=pair?.a?.stairDeckY;
  const b=pair?.b?.stairDeckY;
  if(Number.isFinite(a)&&Number.isFinite(b))return (a+b)*.5;
  if(Number.isFinite(a))return a;
  if(Number.isFinite(b))return b;
  return Number.isFinite(pair?.topY)
   ?pair.topY+(this.stairs?.railJointInset??.10)
   :NaN;
 }

 local(pair,x,z){
  const inward=pair.inward;
  const rightX=inward.z;
  const rightZ=-inward.x;
  const dx=x-pair.topMid.x;
  const dz=z-pair.topMid.z;
  return {
   inside:dx*inward.x+dz*inward.z,
   across:dx*rightX+dz*rightZ
  };
 }

 heightMatches(pair,currentFootY){
  if(!Number.isFinite(currentFootY))return false;
  const deckY=this.deckY(pair);
  return Number.isFinite(deckY)
   &&currentFootY>=deckY-this.deckHeightBelow
   &&currentFootY<=deckY+this.deckHeightAbove;
 }

 floorMatchesPair(floor,pair){
  const deckY=this.deckY(pair);
  if(!Number.isFinite(deckY)||Math.abs((floor.maxY??Infinity)-deckY)>this.floorHeightTolerance)return false;

  // The exception belongs only to the floor piece immediately inside the stair
  // opening, never to unrelated floors that merely share the same elevation.
  const probeX=pair.topMid.x+pair.inward.x*this.insideProbe;
  const probeZ=pair.topMid.z+pair.inward.z*this.insideProbe;
  return !!this.stairs?.pointInsideFloor?.(floor,probeX,probeZ,.10);
 }

 localInsideCorridor(local){
  return Math.abs(local.across)<=this.halfWidth
   &&local.inside>=-this.outsideDepth
   &&local.inside<=this.insideDepth;
 }

 pointUsesLanding(floor,x,z,currentFootY){
  for(const pair of this.completedPairs()){
   if(!this.heightMatches(pair,currentFootY)||!this.floorMatchesPair(floor,pair))continue;
   if(this.localInsideCorridor(this.local(pair,x,z)))return true;
  }
  return false;
 }

 segmentUsesLanding(floor,fromX,fromZ,currentFootY,toX,toZ){
  for(const pair of this.completedPairs()){
   if(!this.heightMatches(pair,currentFootY)||!this.floorMatchesPair(floor,pair))continue;

   const from=this.local(pair,fromX,fromZ);
   const to=this.local(pair,toX,toZ);
   if(Math.max(Math.abs(from.across),Math.abs(to.across))>this.halfWidth)continue;

   const minInside=Math.min(from.inside,to.inside);
   const maxInside=Math.max(from.inside,to.inside);
   if(maxInside<-this.outsideDepth||minInside>this.insideDepth)continue;

   // Require actual travel along the stair direction. This prevents the landing
   // opening from becoming a sideways hole through the rest of the floor edge.
   const along=Math.abs(to.inside-from.inside);
   const across=Math.abs(to.across-from.across);
   if(along<.001||along<across*.28)continue;
   return true;
  }
  return false;
 }
}
