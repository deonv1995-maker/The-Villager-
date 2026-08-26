export class ConstructionTraversalSystem{
 constructor({world,buildingModes}){
  this.world=world;
  this.buildingModes=buildingModes;

  this.floorEdgeMargin=.10;
  this.groundedStepTolerance=.52;
  this.airborneSupportTolerance=.18;
  this.sweepTopTolerance=.04;
  this.walkSampleSpacing=.16;
  this.samePlaneTolerance=.075;

  this.playerRadius=this.world?.playerCollisionRadius??.42;
  this.playerHeight=this.world?.playerCollisionHeight??2.15;
  this.frameRadius=.27;
  this.wallHalfLength=(this.buildingModes?.logLength??2.90)*.5;
  this.wallHalfThickness=.26;
  this.collisionPadding=.035;
  this.escapeEpsilon=.003;
  this.lastColliderCount=-1;
 }

 initialize(){
  this.world.constructionTraversal=this;
  this.removeLegacyConstructionColliders();
 }

 floorPlacements(){
  return this.buildingModes?.placements?.filter(p=>p.mode==='floor'&&p.object?.parent)||[];
 }

 solidPlacements(){
  // Angled pieces stay non-blocking until stairs/roof traversal gets its own shape.
  // Automatic deck supports use the same narrow-post collision as frame columns.
  return this.buildingModes?.placements?.filter(p=>
   (p.mode==='frame'||p.mode==='wall'||p.mode==='support')&&p.object?.parent
  )||[];
 }

 basis(yaw){
  return {
   xX:Math.cos(yaw),xZ:-Math.sin(yaw),
   zX:Math.sin(yaw),zZ:Math.cos(yaw)
  };
 }

 containsFloorPoint(floor,x,z,margin=this.floorEdgeMargin){
  const halfLength=(this.buildingModes?.floorHalfLength??1.45)+margin;
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

 verticalOverlap(placement,currentFootY){
  if(!Number.isFinite(placement?.minY)||!Number.isFinite(placement?.maxY))return true;
  const headY=currentFootY+this.playerHeight;
  if(currentFootY>=placement.maxY-.04)return false;
  if(headY<=placement.minY+.04)return false;
  return true;
 }

 circleContains(x,z,cx,cz,radius){
  const dx=x-cx,dz=z-cz;
  return dx*dx+dz*dz<=radius*radius;
 }

 segmentHitsCircle(ax,az,bx,bz,cx,cz,radius){
  const dx=bx-ax,dz=bz-az;
  const lenSq=dx*dx+dz*dz;
  if(lenSq<1e-8)return this.circleContains(ax,az,cx,cz,radius);
  const t=Math.max(0,Math.min(1,((cx-ax)*dx+(cz-az)*dz)/lenSq));
  const px=ax+dx*t,pz=az+dz*t;
  return this.circleContains(px,pz,cx,cz,radius);
 }

 toLocal(placement,x,z){
  const b=this.basis(placement.yaw||0);
  const dx=x-placement.x,dz=z-placement.z;
  return {
   x:dx*b.xX+dz*b.xZ,
   z:dx*b.zX+dz*b.zZ
  };
 }

 pointInRect(point,halfX,halfZ){
  return Math.abs(point.x)<=halfX&&Math.abs(point.z)<=halfZ;
 }

 segmentHitsRect(a,b,halfX,halfZ){
  let tMin=0,tMax=1;
  const dx=b.x-a.x,dz=b.z-a.z;
  const axes=[
   [a.x,dx,halfX],
   [a.z,dz,halfZ]
  ];

  for(const [p,d,h] of axes){
   if(Math.abs(d)<1e-8){
    if(p<-h||p>h)return false;
    continue;
   }
   let t1=(-h-p)/d;
   let t2=(h-p)/d;
   if(t1>t2){const tmp=t1;t1=t2;t2=tmp;}
   tMin=Math.max(tMin,t1);
   tMax=Math.min(tMax,t2);
   if(tMin>tMax)return false;
  }
  return true;
 }

 overlapDepth(placement,x,z,currentFootY){
  if(!this.verticalOverlap(placement,currentFootY))return 0;

  if(placement.mode==='frame'||placement.mode==='support'){
   const radius=this.frameRadius+this.playerRadius+this.collisionPadding;
   const d=Math.hypot(x-placement.x,z-placement.z);
   return Math.max(0,radius-d);
  }

  if(placement.mode==='wall'){
   const halfX=this.wallHalfLength+this.playerRadius+this.collisionPadding;
   const halfZ=this.wallHalfThickness+this.playerRadius+this.collisionPadding;
   const p=this.toLocal(placement,x,z);
   if(!this.pointInRect(p,halfX,halfZ))return 0;
   return Math.max(0,Math.min(halfX-Math.abs(p.x),halfZ-Math.abs(p.z)));
  }

  return 0;
 }

 totalOverlapDepth(x,z,currentFootY){
  let total=0;
  for(const placement of this.solidPlacements()){
   total+=this.overlapDepth(placement,x,z,currentFootY);
  }
  return total;
 }

 obstacleBlocks(placement,fromX,fromZ,currentFootY,toX,toZ){
  if(!this.verticalOverlap(placement,currentFootY))return false;

  if(placement.mode==='frame'||placement.mode==='support'){
   const radius=this.frameRadius+this.playerRadius+this.collisionPadding;
   return this.segmentHitsCircle(fromX,fromZ,toX,toZ,placement.x,placement.z,radius);
  }

  if(placement.mode==='wall'){
   const halfX=this.wallHalfLength+this.playerRadius+this.collisionPadding;
   const halfZ=this.wallHalfThickness+this.playerRadius+this.collisionPadding;
   const from=this.toLocal(placement,fromX,fromZ);
   const to=this.toLocal(placement,toX,toZ);
   return this.segmentHitsRect(from,to,halfX,halfZ);
  }

  return false;
 }

 blocksMovement(fromX,fromZ,currentFootY,toX,toZ){
  // If multiple posts/walls overlap around the Ranger, judge the whole cluster as
  // one collision field. While inside it, any move that does not increase total
  // penetration is allowed. This guarantees a path out of tight construction
  // corners instead of one obstacle allowing escape while its neighbour blocks it.
  const fromDepth=this.totalOverlapDepth(fromX,fromZ,currentFootY);
  if(fromDepth>0){
   const toDepth=this.totalOverlapDepth(toX,toZ,currentFootY);
   return toDepth>fromDepth+this.escapeEpsilon;
  }

  for(const placement of this.solidPlacements()){
   if(this.obstacleBlocks(placement,fromX,fromZ,currentFootY,toX,toZ))return true;
  }
  return false;
 }

 removeLegacyConstructionColliders(){
  const world=this.world;
  if(!Array.isArray(world?.rockColliders))return;

  const before=world.rockColliders.length;
  world.rockColliders=world.rockColliders.filter(collider=>
   collider.owner!=='player-construction'
  );

  if(world.rockColliders.length!==before)world.rebuildRockColliderGrid?.();
  this.lastColliderCount=world.rockColliders.length;
 }

 update(){
  const count=this.world?.rockColliders?.length??0;
  if(count!==this.lastColliderCount)this.removeLegacyConstructionColliders();
 }
}
