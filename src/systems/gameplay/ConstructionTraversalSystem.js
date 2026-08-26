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
  this.floorBodyPadding=.025;
  this.stairRailRadius=.27;
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

 stairRailPlacements(){
  return this.buildingModes?.placements?.filter(p=>
   p.mode==='angle'&&p.object?.parent&&
   (p.snapKind==='floor-stair-rail'||p.snapKind==='stair-rail-extension')
  )||[];
 }

 solidPlacements(){
  // Roof rafters stay non-blocking for now, but actual stair stringers are solid.
  // Floors are also solid from below/the side while retaining a walkable top.
  return this.buildingModes?.placements?.filter(p=>
   (
    p.mode==='frame'||p.mode==='wall'||p.mode==='support'||p.mode==='floor'||
    (p.mode==='angle'&&(p.snapKind==='floor-stair-rail'||p.snapKind==='stair-rail-extension'))
   )&&p.object?.parent
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

 floorBodyVerticalOverlap(floor,currentFootY){
  if(!Number.isFinite(floor?.minY)||!Number.isFinite(floor?.maxY))return false;

  // If the top is within normal grounded step height, let traversal climb onto it
  // instead of treating the floor edge like a vertical wall.
  if(currentFootY>=floor.maxY-this.groundedStepTolerance-.03)return false;

  const headY=currentFootY+this.playerHeight;
  return headY>floor.minY+this.floorBodyPadding&&
   currentFootY<floor.maxY-this.floorBodyPadding;
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

 stairDirectionYaw(placement){
  const stairs=this.world?.stairs;
  if(stairs?.stairDirectionYaw)return stairs.stairDirectionYaw(placement);
  return (placement.yaw||0)+Math.PI/2;
 }

 toStairLocal(placement,x,z){
  const yaw=this.stairDirectionYaw(placement);
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  const rx=fz,rz=-fx;
  const dx=x-placement.x,dz=z-placement.z;
  return {
   along:dx*fx+dz*fz,
   across:dx*rx+dz*rz
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

 stairRailVerticalOverlap(placement,x,z,currentFootY){
  const local=this.toStairLocal(placement,x,z);
  const halfProjection=this.buildingModes?.angleHalfProjection??1.025;
  const along=Math.max(-halfProjection,Math.min(halfProjection,local.along));
  const railY=(placement.centerY??0)+along;
  const radius=this.stairRailRadius;
  const headY=currentFootY+this.playerHeight;
  if(currentFootY>=railY+radius-.025)return false;
  if(headY<=railY-radius+.025)return false;
  return true;
 }

 stairRailOverlapDepth(placement,x,z,currentFootY){
  const halfProjection=(this.buildingModes?.angleHalfProjection??1.025)+this.playerRadius+this.collisionPadding;
  const halfAcross=this.stairRailRadius+this.playerRadius+this.collisionPadding;
  const p=this.toStairLocal(placement,x,z);
  if(Math.abs(p.along)>halfProjection||Math.abs(p.across)>halfAcross)return 0;
  if(!this.stairRailVerticalOverlap(placement,x,z,currentFootY))return 0;
  return Math.max(0,Math.min(
   halfProjection-Math.abs(p.along),
   halfAcross-Math.abs(p.across)
  ));
 }

 stairRailBlocks(placement,fromX,fromZ,currentFootY,toX,toZ){
  const halfProjection=(this.buildingModes?.angleHalfProjection??1.025)+this.playerRadius+this.collisionPadding;
  const halfAcross=this.stairRailRadius+this.playerRadius+this.collisionPadding;
  const fromRaw=this.toStairLocal(placement,fromX,fromZ);
  const toRaw=this.toStairLocal(placement,toX,toZ);
  const from={x:fromRaw.along,z:fromRaw.across};
  const to={x:toRaw.along,z:toRaw.across};
  if(!this.segmentHitsRect(from,to,halfProjection,halfAcross))return false;

  // Horizontal movement substeps are small, but sample the swept segment so a
  // diagonal move cannot tunnel through a stringer between frames.
  for(let i=0;i<=4;i++){
   const t=i/4;
   const x=fromX+(toX-fromX)*t;
   const z=fromZ+(toZ-fromZ)*t;
   const p=this.toStairLocal(placement,x,z);
   if(Math.abs(p.along)>halfProjection||Math.abs(p.across)>halfAcross)continue;
   if(this.stairRailVerticalOverlap(placement,x,z,currentFootY))return true;
  }
  return false;
 }

 overlapDepth(placement,x,z,currentFootY){
  if(placement.mode==='floor'){
   if(!this.floorBodyVerticalOverlap(placement,currentFootY))return 0;
   const halfX=(this.buildingModes?.floorHalfLength??1.45)+this.playerRadius+this.collisionPadding;
   const halfZ=(this.buildingModes?.floorHalfWidth??.56)+this.playerRadius+this.collisionPadding;
   const p=this.toLocal(placement,x,z);
   if(!this.pointInRect(p,halfX,halfZ))return 0;
   return Math.max(0,Math.min(halfX-Math.abs(p.x),halfZ-Math.abs(p.z)));
  }

  if(placement.mode==='angle'){
   return this.stairRailOverlapDepth(placement,x,z,currentFootY);
  }

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
  if(placement.mode==='floor'){
   if(!this.floorBodyVerticalOverlap(placement,currentFootY))return false;
   const halfX=(this.buildingModes?.floorHalfLength??1.45)+this.playerRadius+this.collisionPadding;
   const halfZ=(this.buildingModes?.floorHalfWidth??.56)+this.playerRadius+this.collisionPadding;
   const from=this.toLocal(placement,fromX,fromZ);
   const to=this.toLocal(placement,toX,toZ);
   return this.segmentHitsRect(from,to,halfX,halfZ);
  }

  if(placement.mode==='angle'){
   return this.stairRailBlocks(placement,fromX,fromZ,currentFootY,toX,toZ);
  }

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
  // Treat all nearby construction as one collision field. If the Ranger somehow
  // begins inside a newly built piece, movement that reduces penetration remains
  // legal so construction can never permanently trap the player.
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
