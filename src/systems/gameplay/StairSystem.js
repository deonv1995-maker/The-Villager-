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
  this.treadLift=.24;
  this.treadAcrossMargin=.10;
  this.treadEndMargin=.12;
  this.walkSampleSpacing=.12;
  this.maxWalkRisePerSample=.78;

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
  const dx=x-floor.x;
  const dz=z-floor.z;
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
     const outsideFloor=this.floorAt(outsideX,outsideZ,topY);
     const insideFloor=this.floorAt(insideX,insideZ,topY);
     if(outsideFloor||!insideFloor)continue;

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
   const yaw=this.stairDirectionYaw(rail);
   if(this.buildingModes.yawDelta(yaw,targetYaw)<=this.railDirectionTolerance)return true;
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
    candidates.push({
     x:node.x+edge.outward.x*halfProjection,
     z:node.z+edge.outward.z*halfProjection,
     yaw,
     centerY:edge.topY-halfProjection,
     ground:this.world.heightAt(
      node.x+edge.outward.x*halfProjection,
      node.z+edge.outward.z*halfProjection
     ),
     snapKind:'floor-stair-rail',
     anchorIds:[...edge.floorIds]
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
    if(Math.abs(aTop.y-bTop.y)>.12)continue;

    const dx=bTop.x-aTop.x,dz=bTop.z-aTop.z;
    const distance=Math.hypot(dx,dz);
    if(Math.abs(distance-logLength)>this.railPairTolerance)continue;
    const dot=Math.abs((dx*afx+dz*afz)/Math.max(.001,distance));
    if(dot>.12)continue;

    const topMid={x:(aTop.x+bTop.x)*.5,z:(aTop.z+bTop.z)*.5,y:(aTop.y+bTop.y)*.5};
    const outward={x:-afx,z:-afz};
    pairs.push({a,b,topMid,outward,inward:{x:afx,z:afz}});
   }
  }
  return pairs;
 }

 pairAlreadyHasTreads(pair){
  const ids=[pair.a.id,pair.b.id].sort((a,b)=>a-b).join(':');
  return this.activeTreads().some(p=>p.stairPairKey===ids);
 }

 treadCandidates(){
  const candidates=[];
  const halfProjection=this.buildingModes.angleHalfProjection;

  for(const pair of this.railPairs()){
   if(this.pairAlreadyHasTreads(pair))continue;
   const key=[pair.a.id,pair.b.id].sort((a,b)=>a-b).join(':');
   const x=pair.topMid.x+pair.outward.x*halfProjection;
   const z=pair.topMid.z+pair.outward.z*halfProjection;
   const yaw=Math.atan2(pair.outward.x,pair.outward.z);
   candidates.push({
    x,z,yaw,
    centerY:pair.topMid.y-halfProjection+this.treadLift,
    ground:this.world.heightAt(x,z),
    snapKind:'stair-treads',
    anchorIds:[pair.a.id,pair.b.id],
    stairPairKey:key,
    stairTopX:pair.topMid.x,
    stairTopZ:pair.topMid.z,
    stairTopY:pair.topMid.y,
    stairOutX:pair.outward.x,
    stairOutZ:pair.outward.z
   });
  }
  return candidates;
 }

 floorSnapBase(base){
  if(!base)return base;
  const treads=this.buildingModes.chooseCandidate(
   base,
   this.treadCandidates(),
   this.stairSnapRange
  );
  if(treads?.snapKind==='stair-treads')return treads;
  return this.originalFloorSnapBase(base);
 }

 makeStairTreads(base){
  const group=new this.buildingModes.T.Group();
  group.name='TwoSplitLogStairTreads';
  const fullProjection=this.buildingModes.angleHalfProjection*2;
  const offset=fullProjection/6;

  const upper=this.buildingModes.materials.makeHalfLogVisual();
  upper.position.set(0,offset,-offset);
  group.add(upper);

  const lower=this.buildingModes.materials.makeHalfLogVisual();
  lower.position.set(0,-offset,offset);
  group.add(lower);

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
  if(actualMode==='stairTread'){
   placement.stairPairKey=base.stairPairKey;
   placement.stairTopX=base.stairTopX;
   placement.stairTopZ=base.stairTopZ;
   placement.stairTopY=base.stairTopY;
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

 treadSupportAt(tread,x,z){
  if(!tread||tread.mode!=='stairTread')return -Infinity;
  const ox=tread.stairOutX,oz=tread.stairOutZ;
  if(!Number.isFinite(ox)||!Number.isFinite(oz))return -Infinity;

  const rx=oz,rz=-ox;
  const dx=x-tread.stairTopX;
  const dz=z-tread.stairTopZ;
  const outward=dx*ox+dz*oz;
  const across=dx*rx+dz*rz;
  const fullProjection=this.buildingModes.angleHalfProjection*2;
  const halfAcross=this.buildingModes.logHalfLength+this.treadAcrossMargin;

  if(Math.abs(across)>halfAcross)return -Infinity;
  if(outward<-.08||outward>fullProjection+this.treadEndMargin)return -Infinity;

  // One floor log is split into its two halves. Those halves become two broad,
  // flat stair treads resting across the paired 45-degree side rails.
  if(outward<=fullProjection*.50){
   return tread.stairTopY-fullProjection/3+this.treadLift+.02;
  }
  return tread.stairTopY-fullProjection*2/3+this.treadLift+.02;
 }

 treadHeightAt(x,z){
  let best=-Infinity;
  for(const tread of this.activeTreads()){
   const support=this.treadSupportAt(tread,x,z);
   if(support>best)best=support;
  }
  return best;
 }

 staticConstructionHeightAt(x,z){
  const floor=this.originalSurfaceHeightAt(x,z,Infinity,false);
  const tread=this.treadHeightAt(x,z);
  return Math.max(floor,tread);
 }

 surfaceHeightAt(x,z,currentFootY=Infinity,isGrounded=false){
  const floor=this.originalSurfaceHeightAt(x,z,currentFootY,isGrounded);
  let tread=this.treadHeightAt(x,z);
  if(Number.isFinite(tread)&&Number.isFinite(currentFootY)){
   const tolerance=isGrounded?.82:.24;
   if(currentFootY<tread-tolerance)tread=-Infinity;
  }
  return Math.max(floor,tread);
 }

 surfaceHeightForSweep(x,z,fromFootY,toFootY){
  const floor=this.originalSurfaceHeightForSweep(x,z,fromFootY,toFootY);
  const tread=this.treadHeightAt(x,z);
  if(!Number.isFinite(tread))return floor;
  const crossed=fromFootY>=tread-.07&&toFootY<=tread+.05;
  return crossed?Math.max(floor,tread):floor;
 }

 supportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ){
  if(this.originalSupportsWalkSegment(fromX,fromZ,currentFootY,toX,toZ))return true;

  const start=this.staticConstructionHeightAt(fromX,fromZ);
  if(!Number.isFinite(start)||Math.abs(currentFootY-start)>.84)return false;

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
