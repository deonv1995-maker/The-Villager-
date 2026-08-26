export class StairSystem{
 constructor({world,buildingModes,constructionTraversal,frameGrid=null}){
  this.world=world;
  this.buildingModes=buildingModes;
  this.traversal=constructionTraversal;
  this.frameGrid=frameGrid;

  this.edgeProbe=.22;
  this.edgeOccupancyRadius=.24;
  this.stairSnapRange=2.45;
  this.railPairTolerance=.12;
  this.railDirectionTolerance=.12;
  this.railSeatLift=.20;
  this.treadSurfaceLift=.025;
  this.treadAcrossMargin=.10;
  this.treadEndMargin=.10;
  this.treadsPerLog=2;
  this.totalTreads=4;
  this.walkSampleSpacing=.12;
  this.maxWalkRisePerSample=.22;

  this.originalAngleSnapBase=null;
  this.originalFloorSnapBase=null;
  this.originalMakeFloor=null;
  this.originalRecordPlacement=null;
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

  this.originalFloorSnapBase=this.buildingModes.floorSnapBase.bind(this.buildingModes);
  this.buildingModes.floorSnapBase=base=>this.floorSnapBase(base);

  this.originalMakeFloor=this.buildingModes.makeFloor.bind(this.buildingModes);
  this.buildingModes.makeFloor=base=>this.makeFloor(base);

  this.originalRecordPlacement=this.buildingModes.recordPlacement.bind(this.buildingModes);
  this.buildingModes.recordPlacement=(mode,object,base,standable=false)=>
   this.recordPlacement(mode,object,base,standable);

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

 activeFloors(){return this.buildingModes.activePlacements('floor');}
 activeRails(){
  return this.buildingModes.activePlacements('angle')
   .filter(p=>p.snapKind==='floor-stair-rail');
 }
 activeTreads(){return this.buildingModes.activePlacements('stairTread');}

 pointInsideFloor(floor,x,z,margin=.015){
  const b=this.basis(floor.yaw||0);
  const dx=x-floor.x,dz=z-floor.z;
  const localX=dx*b.xX+dz*b.xZ;
  const localZ=dx*b.zX+dz*b.zZ;
  const halfLength=(this.buildingModes.floorHalfLength??1.45)+margin;
  const halfWidth=(this.buildingModes.floorHalfWidth??.48)+margin;
  return Math.abs(localX)<=halfLength&&Math.abs(localZ)<=halfWidth;
 }

 floorAt(x,z,y=null){
  for(const floor of this.activeFloors()){
   if(y!=null&&Math.abs((floor.maxY??0)-y)>.12)continue;
   if(this.pointInsideFloor(floor,x,z,.02))return floor;
  }
  return null;
 }

 structuralCorners(){
  if(this.frameGrid?.structuralFloorCorners)return this.frameGrid.structuralFloorCorners();
  const result=[];
  for(const floor of this.activeFloors()){
   for(const corner of this.buildingModes.floorCornerCandidates(floor)){
    if(result.some(p=>Math.hypot(p.x-corner.x,p.z-corner.z)<.10))continue;
    result.push({x:corner.x,z:corner.z,topY:floor.maxY,floorIds:[floor.id]});
   }
  }
  return result;
 }

 exposedStructuralEdges(){
  const nodes=this.structuralCorners();
  const edges=[];
  const logLength=this.buildingModes.logLength;

  for(let i=0;i<nodes.length;i++){
   for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];
    if(Math.abs(a.topY-b.topY)>.12)continue;
    const dx=b.x-a.x,dz=b.z-a.z;
    const length=Math.hypot(dx,dz);
    if(Math.abs(length-logLength)>.12)continue;

    const ux=dx/length,uz=dz/length;
    const normals=[{x:-uz,z:ux},{x:uz,z:-ux}];
    const mx=(a.x+b.x)*.5,mz=(a.z+b.z)*.5;
    const topY=(a.topY+b.topY)*.5;

    for(const outward of normals){
     const outsideX=mx+outward.x*this.edgeProbe;
     const outsideZ=mz+outward.z*this.edgeProbe;
     const insideX=mx-outward.x*this.edgeProbe;
     const insideZ=mz-outward.z*this.edgeProbe;
     if(this.floorAt(outsideX,outsideZ,topY)||!this.floorAt(insideX,insideZ,topY))continue;

     edges.push({
      a,b,topY,
      outward,
      inward:{x:-outward.x,z:-outward.z},
      floorIds:[...new Set([...(a.floorIds||[]),...(b.floorIds||[])])]
     });
    }
   }
  }
  return edges;
 }

 stairDirectionYaw(stair){return (stair.yaw||0)+Math.PI/2;}

 railTopPoint(rail){
  const halfProjection=this.buildingModes.angleHalfProjection;
  const yaw=this.stairDirectionYaw(rail);
  return {
   x:rail.x+Math.sin(yaw)*halfProjection,
   z:rail.z+Math.cos(yaw)*halfProjection,
   y:rail.centerY+halfProjection
  };
 }

 railAlreadyPlaced(node,inward){
  const targetYaw=Math.atan2(inward.x,inward.z);
  for(const rail of this.activeRails()){
   const top=this.railTopPoint(rail);
   if(Math.hypot(top.x-node.x,top.z-node.z)>this.edgeOccupancyRadius)continue;
   if(this.buildingModes.yawDelta(this.stairDirectionYaw(rail),targetYaw)<=this.railDirectionTolerance)return true;
  }
  return false;
 }

 railCandidates(){
  const candidates=[];
  const halfProjection=this.buildingModes.angleHalfProjection;

  for(const edge of this.exposedStructuralEdges()){
   const yaw=Math.atan2(edge.inward.x,edge.inward.z);
   for(const node of [edge.a,edge.b]){
    if(this.railAlreadyPlaced(node,edge.inward))continue;
    const x=node.x+edge.outward.x*halfProjection;
    const z=node.z+edge.outward.z*halfProjection;
    candidates.push({
     x,z,yaw,
     // The high end of the round log now sits on top of the floor rather than
     // terminating through the floor edge.
     centerY:edge.topY+this.railSeatLift-halfProjection,
     ground:this.world.heightAt(x,z),
     snapKind:'floor-stair-rail',
     anchorIds:[...edge.floorIds],
     stairDeckY:edge.topY
    });
   }
  }
  return candidates;
 }

 angleSnapBase(base){
  if(!base)return base;
  const rail=this.buildingModes.chooseCandidate(base,this.railCandidates(),this.stairSnapRange);
  if(rail?.snapKind==='floor-stair-rail')return rail;
  return this.originalAngleSnapBase(base);
 }

 pairKey(a,b){return [a.id,b.id].sort((x,y)=>x-y).join(':');}

 railPairs(){
  const rails=this.activeRails();
  const pairs=[];
  const logLength=this.buildingModes.logLength;

  for(let i=0;i<rails.length;i++){
   const a=rails[i];
   const aTop=this.railTopPoint(a);
   const aYaw=this.stairDirectionYaw(a);
   const afx=Math.sin(aYaw),afz=Math.cos(aYaw);

   for(let j=i+1;j<rails.length;j++){
    const b=rails[j];
    const bTop=this.railTopPoint(b);
    const bYaw=this.stairDirectionYaw(b);
    if(this.buildingModes.yawDelta(aYaw,bYaw)>this.railDirectionTolerance)continue;

    const deckAY=Number.isFinite(a.stairDeckY)?a.stairDeckY:aTop.y-this.railSeatLift;
    const deckBY=Number.isFinite(b.stairDeckY)?b.stairDeckY:bTop.y-this.railSeatLift;
    if(Math.abs(deckAY-deckBY)>.12)continue;

    const dx=bTop.x-aTop.x,dz=bTop.z-aTop.z;
    const distance=Math.hypot(dx,dz);
    if(Math.abs(distance-logLength)>this.railPairTolerance)continue;
    const dot=Math.abs((dx*afx+dz*afz)/Math.max(.001,distance));
    if(dot>.12)continue;

    pairs.push({
     a,b,
     key:this.pairKey(a,b),
     topMid:{x:(aTop.x+bTop.x)*.5,z:(aTop.z+bTop.z)*.5},
     deckY:(deckAY+deckBY)*.5,
     outward:{x:-afx,z:-afz},
     inward:{x:afx,z:afz}
    });
   }
  }
  return pairs;
 }

 treadBatchesForPair(pair){
  return this.activeTreads().filter(t=>t.stairPairKey===pair.key);
 }

 nextBatchIndex(pair){
  const used=new Set(this.treadBatchesForPair(pair).map(t=>t.stairBatchIndex));
  const batchCount=Math.ceil(this.totalTreads/this.treadsPerLog);
  for(let i=0;i<batchCount;i++)if(!used.has(i))return i;
  return -1;
 }

 pairComplete(pair){
  return this.nextBatchIndex(pair)<0;
 }

 treadCandidates(){
  const candidates=[];
  const halfProjection=this.buildingModes.angleHalfProjection;

  for(const pair of this.railPairs()){
   const batchIndex=this.nextBatchIndex(pair);
   if(batchIndex<0)continue;
   const x=pair.topMid.x+pair.outward.x*halfProjection;
   const z=pair.topMid.z+pair.outward.z*halfProjection;
   candidates.push({
    x,z,
    yaw:Math.atan2(pair.outward.x,pair.outward.z),
    centerY:pair.deckY-halfProjection,
    ground:this.world.heightAt(x,z),
    snapKind:'stair-treads',
    anchorIds:[pair.a.id,pair.b.id],
    stairPairKey:pair.key,
    stairBatchIndex:batchIndex,
    stairTopX:pair.topMid.x,
    stairTopZ:pair.topMid.z,
    stairDeckY:pair.deckY,
    stairOutX:pair.outward.x,
    stairOutZ:pair.outward.z
   });
  }
  return candidates;
 }

 floorSnapBase(base){
  if(!base)return base;
  const treads=this.buildingModes.chooseCandidate(base,this.treadCandidates(),this.stairSnapRange);
  if(treads?.snapKind==='stair-treads')return treads;
  return this.originalFloorSnapBase(base);
 }

 makeStairTreads(base){
  const group=new this.buildingModes.T.Group();
  group.name='TwoSplitLogStairTreads';

  const fullProjection=this.buildingModes.angleHalfProjection*2;
  const stepSpacing=fullProjection/this.totalTreads;
  const firstIndex=base.stairBatchIndex*this.treadsPerLog;

  for(let localIndex=0;localIndex<this.treadsPerLog;localIndex++){
   const treadIndex=firstIndex+localIndex;
   const outwardDistance=(treadIndex+.5)*stepSpacing;
   const half=this.buildingModes.materials.makeHalfLogVisual();
   half.position.set(
    0,
    this.buildingModes.angleHalfProjection-outwardDistance+this.treadSurfaceLift,
    outwardDistance-this.buildingModes.angleHalfProjection
   );
   group.add(half);
  }

  group.position.set(base.x,base.centerY,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 makeFloor(base){
  if(base?.snapKind==='stair-treads')return this.makeStairTreads(base);
  return this.originalMakeFloor(base);
 }

 recordPlacement(mode,object,base,standable=false){
  const actualMode=mode==='floor'&&base?.snapKind==='stair-treads'?'stairTread':mode;
  const placement=this.originalRecordPlacement(actualMode,object,base,actualMode==='floor'?standable:false);

  if(actualMode==='angle'&&base?.snapKind==='floor-stair-rail'){
   placement.stairDeckY=base.stairDeckY;
  }

  if(actualMode==='stairTread'){
   placement.stairPairKey=base.stairPairKey;
   placement.stairBatchIndex=base.stairBatchIndex;
   placement.stairTopX=base.stairTopX;
   placement.stairTopZ=base.stairTopZ;
   placement.stairDeckY=base.stairDeckY;
   placement.stairOutX=base.stairOutX;
   placement.stairOutZ=base.stairOutZ;
  }
  return placement;
 }

 actionLabel(){
  if(this.buildingModes.mode==='angle'){
   const base=this.buildingModes.resolvedBase('angle');
   if(base?.snapKind==='floor-stair-rail')return 'SNAP STAIR RAIL';
  }
  if(this.buildingModes.mode==='floor'){
   const base=this.buildingModes.resolvedBase('floor');
   if(base?.snapKind==='stair-treads')return 'SNAP 2 STEPS';
  }
  return this.originalActionLabel();
 }

 completedPairs(){return this.railPairs().filter(pair=>this.pairComplete(pair));}

 rampSupportAt(pair,x,z){
  const ox=pair.outward.x,oz=pair.outward.z;
  const rx=oz,rz=-ox;
  const dx=x-pair.topMid.x,dz=z-pair.topMid.z;
  const outward=dx*ox+dz*oz;
  const across=dx*rx+dz*rz;
  const fullProjection=this.buildingModes.angleHalfProjection*2;
  const halfAcross=this.buildingModes.logHalfLength+this.treadAcrossMargin;

  if(Math.abs(across)>halfAcross)return -Infinity;
  if(outward<-.06||outward>fullProjection+this.treadEndMargin)return -Infinity;

  // The visible treads are discrete, but locomotion follows their continuous
  // 45-degree envelope. This removes the hop/stutter between individual steps
  // while keeping the staircase visually constructed from four timber treads.
  const d=Math.max(0,Math.min(fullProjection,outward));
  return pair.deckY-d+this.treadSurfaceLift;
 }

 rampHeightAt(x,z){
  let best=-Infinity;
  for(const pair of this.completedPairs()){
   const support=this.rampSupportAt(pair,x,z);
   if(support>best)best=support;
  }
  return best;
 }

 staticConstructionHeightAt(x,z){
  const floor=this.originalSurfaceHeightAt(x,z,Infinity,false);
  return Math.max(floor,this.rampHeightAt(x,z));
 }

 surfaceHeightAt(x,z,currentFootY=Infinity,isGrounded=false){
  const floor=this.originalSurfaceHeightAt(x,z,currentFootY,isGrounded);
  let stair=this.rampHeightAt(x,z);
  if(Number.isFinite(stair)&&Number.isFinite(currentFootY)){
   const tolerance=isGrounded?.72:.24;
   if(currentFootY<stair-tolerance)stair=-Infinity;
  }
  return Math.max(floor,stair);
 }

 surfaceHeightForSweep(x,z,fromFootY,toFootY){
  const floor=this.originalSurfaceHeightForSweep(x,z,fromFootY,toFootY);
  const stair=this.rampHeightAt(x,z);
  if(!Number.isFinite(stair))return floor;
  const crossed=fromFootY>=stair-.07&&toFootY<=stair+.05;
  return crossed?Math.max(floor,stair):floor;
 }

 supportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ){
  if(this.originalSupportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ))return true;

  const start=this.staticConstructionHeightAt(fromX,fromZ);
  if(!Number.isFinite(start)||Math.abs(currentFootY-start)>.72)return false;

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
