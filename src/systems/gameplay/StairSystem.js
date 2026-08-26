export class StairSystem{
 constructor({world,buildingModes,constructionTraversal}){
  this.world=world;
  this.buildingModes=buildingModes;
  this.traversal=constructionTraversal;

  this.edgeProbe=.18;
  this.edgeOccupancyRadius=.24;
  this.stairSurfaceOffset=.18;
  this.stairHalfWidth=.46;
  this.stairEdgeMargin=.10;
  this.walkSampleSpacing=.14;
  this.maxWalkRisePerSample=.23;

  this.originalAngleSnapBase=null;
  this.originalActionLabel=null;
  this.originalSurfaceHeightAt=null;
  this.originalSurfaceHeightForSweep=null;
  this.originalSupportsWalkSegment=null;
 }

 initialize(){
  if(!this.buildingModes||!this.traversal)return;
  this.world.stairs=this;

  this.originalAngleSnapBase=this.buildingModes.angleSnapBase.bind(this.buildingModes);
  this.buildingModes.angleSnapBase=base=>this.angleSnapBase(base);

  this.originalActionLabel=this.buildingModes.actionLabel.bind(this.buildingModes);
  this.buildingModes.actionLabel=()=>this.actionLabel();

  this.originalSurfaceHeightAt=this.traversal.surfaceHeightAt.bind(this.traversal);
  this.traversal.surfaceHeightAt=(x,z,currentFootY=Infinity,isGrounded=false)=>
   this.surfaceHeightAt(x,z,currentFootY,isGrounded);

  this.originalSurfaceHeightForSweep=this.traversal.surfaceHeightForSweep.bind(this.traversal);
  this.traversal.surfaceHeightForSweep=(x,z,fromFootY,toFootY)=>
   this.surfaceHeightForSweep(x,z,fromFootY,toFootY);

  this.originalSupportsWalkSegment=this.traversal.supportsWalkSegment.bind(this.traversal);
  this.traversal.supportsWalkSegment=(fromX,fromZ,currentFootY,toX,toZ)=>
   this.supportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ);
 }

 basis(yaw){
  return {
   xX:Math.cos(yaw),xZ:-Math.sin(yaw),
   zX:Math.sin(yaw),zZ:Math.cos(yaw)
  };
 }

 pointInsideFloor(floor,x,z,margin=.015){
  const b=this.basis(floor.yaw||0);
  const dx=x-floor.x;
  const dz=z-floor.z;
  const localX=dx*b.xX+dz*b.xZ;
  const localZ=dx*b.zX+dz*b.zZ;
  const halfLength=(this.buildingModes.floorHalfLength??1.45)+margin;
  const halfWidth=(this.buildingModes.floorHalfWidth??.48)+margin;
  return Math.abs(localX)<=halfLength&&Math.abs(localZ)<=halfWidth;
 }

 activeFloors(){
  return this.buildingModes.activePlacements('floor');
 }

 activeStairs(){
  return this.buildingModes.activePlacements('angle').filter(p=>p.snapKind==='floor-stair');
 }

 floorEdges(floor){
  const b=this.basis(floor.yaw||0);
  const halfLength=this.buildingModes.floorHalfLength??1.45;
  const halfWidth=this.buildingModes.floorHalfWidth??.48;
  return [
   {x:floor.x+b.xX*halfLength,z:floor.z+b.xZ*halfLength,ox:b.xX,oz:b.xZ},
   {x:floor.x-b.xX*halfLength,z:floor.z-b.xZ*halfLength,ox:-b.xX,oz:-b.xZ},
   {x:floor.x+b.zX*halfWidth,z:floor.z+b.zZ*halfWidth,ox:b.zX,oz:b.zZ},
   {x:floor.x-b.zX*halfWidth,z:floor.z-b.zZ*halfWidth,ox:-b.zX,oz:-b.zZ}
  ];
 }

 edgeIsExposed(floor,edge){
  const probeX=edge.x+edge.ox*this.edgeProbe;
  const probeZ=edge.z+edge.oz*this.edgeProbe;
  for(const other of this.activeFloors()){
   if(other===floor)continue;
   if(Math.abs((other.maxY??0)-(floor.maxY??0))>.10)continue;
   if(this.pointInsideFloor(other,probeX,probeZ,.02))return false;
  }
  return true;
 }

 stairTopPoint(stair){
  const halfProjection=this.buildingModes.angleHalfProjection??1.025;
  const fx=Math.sin(stair.yaw||0);
  const fz=Math.cos(stair.yaw||0);
  return {
   x:stair.x+fx*halfProjection,
   z:stair.z+fz*halfProjection
  };
 }

 edgeAlreadyHasStair(edge){
  for(const stair of this.activeStairs()){
   const top=this.stairTopPoint(stair);
   if(Math.hypot(top.x-edge.x,top.z-edge.z)<=this.edgeOccupancyRadius)return true;
  }
  return false;
 }

 floorStairCandidates(){
  const candidates=[];
  const halfProjection=this.buildingModes.angleHalfProjection??1.025;

  for(const floor of this.activeFloors()){
   for(const edge of this.floorEdges(floor)){
    if(!this.edgeIsExposed(floor,edge))continue;
    if(this.edgeAlreadyHasStair(edge))continue;

    // The angled log rises in its forward direction. For stairs, forward points
    // inward toward the deck while the centre sits outside and below the edge.
    const inwardX=-edge.ox;
    const inwardZ=-edge.oz;
    const yaw=Math.atan2(inwardX,inwardZ);
    const x=edge.x+edge.ox*halfProjection;
    const z=edge.z+edge.oz*halfProjection;
    const centerY=floor.maxY-halfProjection-this.stairSurfaceOffset;

    candidates.push({
     x,z,yaw,
     centerY,
     ground:this.world.heightAt(x,z),
     snapKind:'floor-stair',
     anchorIds:[floor.id],
     penalty:-.08
    });
   }
  }
  return candidates;
 }

 angleSnapBase(base){
  if(!base)return base;

  const candidates=this.floorStairCandidates();
  const roofCandidate=this.originalAngleSnapBase(base);
  if(roofCandidate?.snapKind)candidates.push({...roofCandidate,penalty:(roofCandidate.penalty||0)+.05});

  return this.buildingModes.chooseCandidate(
   base,
   candidates,
   (this.buildingModes.angleSnapRange??1.85)+.24
  );
 }

 actionLabel(){
  if(this.buildingModes.mode==='angle'){
   const base=this.buildingModes.resolvedBase('angle');
   if(base?.snapKind==='floor-stair')return 'SNAP STAIR';
  }
  return this.originalActionLabel();
 }

 stairSupportAt(stair,x,z){
  if(!stair||stair.snapKind!=='floor-stair')return -Infinity;

  const halfProjection=this.buildingModes.angleHalfProjection??1.025;
  const fx=Math.sin(stair.yaw||0);
  const fz=Math.cos(stair.yaw||0);
  const rx=fz;
  const rz=-fx;
  const dx=x-stair.x;
  const dz=z-stair.z;
  const along=dx*fx+dz*fz;
  const across=dx*rx+dz*rz;

  if(Math.abs(along)>halfProjection+this.stairEdgeMargin)return -Infinity;
  if(Math.abs(across)>this.stairHalfWidth)return -Infinity;

  // At 45 degrees the vertical rise equals horizontal travel. The support
  // offset places the walkable top of the round log flush with the floor edge.
  return stair.centerY+along+this.stairSurfaceOffset;
 }

 stairHeightAt(x,z){
  let best=-Infinity;
  for(const stair of this.activeStairs()){
   const support=this.stairSupportAt(stair,x,z);
   if(support>best)best=support;
  }
  return best;
 }

 staticConstructionHeightAt(x,z){
  const floor=this.originalSurfaceHeightAt(x,z,Infinity,false);
  const stair=this.stairHeightAt(x,z);
  return Math.max(floor,stair);
 }

 surfaceHeightAt(x,z,currentFootY=Infinity,isGrounded=false){
  const floor=this.originalSurfaceHeightAt(x,z,currentFootY,isGrounded);
  let stair=this.stairHeightAt(x,z);
  if(Number.isFinite(stair)&&Number.isFinite(currentFootY)){
   const tolerance=isGrounded?.58:.22;
   if(currentFootY<stair-tolerance)stair=-Infinity;
  }
  return Math.max(floor,stair);
 }

 surfaceHeightForSweep(x,z,fromFootY,toFootY){
  const floor=this.originalSurfaceHeightForSweep(x,z,fromFootY,toFootY);
  const stair=this.stairHeightAt(x,z);
  if(!Number.isFinite(stair))return floor;

  const crossed=fromFootY>=stair-.07&&toFootY<=stair+.04;
  return crossed?Math.max(floor,stair):floor;
 }

 supportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ){
  if(this.originalSupportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ))return true;

  const start=this.staticConstructionHeightAt(fromX,fromZ);
  if(!Number.isFinite(start)||Math.abs(currentFootY-start)>.60)return false;

  const distance=Math.hypot(toX-fromX,toZ-fromZ);
  const samples=Math.max(1,Math.ceil(distance/this.walkSampleSpacing));
  let previous=start;

  for(let i=1;i<=samples;i++){
   const t=i/samples;
   const x=fromX+(toX-fromX)*t;
   const z=fromZ+(toZ-fromZ)*t;
   const support=this.staticConstructionHeightAt(x,z);
   if(!Number.isFinite(support))return false;
   if(Math.abs(support-previous)>this.maxWalkRisePerSample)return false;
   previous=support;
  }
  return true;
 }
}
