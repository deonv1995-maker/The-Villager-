export class FrameGridSystem{
 constructor({buildingModes}){
  this.buildingModes=buildingModes;
  this.cornerMergeTolerance=.11;
  this.spacingTolerance=.10;
  this.perpendicularDotTolerance=.12;
  this.minimumFrameSeparationPadding=.04;
  this.originalFloorSnapBase=null;
  this.originalFloorFrameCandidates=null;
 }

 initialize(){
  if(!this.buildingModes)return;

  // Snapped floor pieces inherit exact spacing from the floor they connect to.
  // Avoid quarter-unit rounding here: that rounding was slowly distorting the
  // floor lattice, which then made opposite frame spans different widths.
  this.originalFloorSnapBase=this.buildingModes.floorSnapBase.bind(this.buildingModes);
  this.buildingModes.floorSnapBase=base=>this.floorSnapBase(base);

  this.originalFloorFrameCandidates=this.buildingModes.floorFrameCandidates.bind(this.buildingModes);
  this.buildingModes.floorFrameCandidates=base=>this.floorFrameCandidates(base);
 }

 sameFloorAxis(a,b){
  return this.buildingModes.axisYawDelta(a,b)<=.18;
 }

 floorSnapBase(base){
  const candidates=[];
  const modes=this.buildingModes;

  for(const floor of modes.activePlacements('floor')){
   if(modes.axisYawDelta(floor.yaw,base.yaw)>.18)continue;
   const yaw=floor.yaw;
   const b=modes.basis(yaw);
   const offsets=[
    [b.xX*modes.logLength,b.xZ*modes.logLength],
    [-b.xX*modes.logLength,-b.xZ*modes.logLength],
    [b.zX*modes.floorWidth,b.zZ*modes.floorWidth],
    [-b.zX*modes.floorWidth,-b.zZ*modes.floorWidth]
   ];

   for(const [ox,oz] of offsets){
    candidates.push({
     x:floor.x+ox,
     z:floor.z+oz,
     yaw,
     centerY:floor.centerY,
     ground:floor.centerY-.275,
     snapKind:'floor-edge',
     anchorIds:[floor.id]
    });
   }
  }
  return modes.chooseCandidate(base,candidates,modes.floorSnapRange);
 }

 mergeCorner(nodes,corner,floor){
  let node=null;
  for(const existing of nodes){
   if(!this.sameFloorAxis(existing.yaw,floor.yaw||0))continue;
   if(Math.hypot(existing.x-corner.x,existing.z-corner.z)<=this.cornerMergeTolerance){
    node=existing;
    break;
   }
  }

  if(!node){
   node={
    x:corner.x,
    z:corner.z,
    yaw:floor.yaw||0,
    topY:floor.maxY,
    floorIds:[floor.id]
   };
   nodes.push(node);
   return;
  }

  node.x=(node.x+corner.x)*.5;
  node.z=(node.z+corner.z)*.5;
  node.topY=Math.max(node.topY,floor.maxY);
  if(!node.floorIds.includes(floor.id))node.floorIds.push(floor.id);
 }

 uniqueFloorCorners(){
  const nodes=[];
  for(const floor of this.buildingModes.activePlacements('floor')){
   for(const corner of this.buildingModes.floorCornerCandidates(floor)){
    this.mergeCorner(nodes,corner,floor);
   }
  }
  return nodes;
 }

 vectorBetween(a,b){
  const x=b.x-a.x;
  const z=b.z-a.z;
  const length=Math.hypot(x,z);
  return {x,z,length};
 }

 oneLogVector(vector){
  return Math.abs(vector.length-this.buildingModes.logLength)<=this.spacingTolerance;
 }

 perpendicular(a,b){
  if(a.length<.001||b.length<.001)return false;
  const dot=(a.x*b.x+a.z*b.z)/(a.length*b.length);
  return Math.abs(dot)<=this.perpendicularDotTolerance;
 }

 isStructuralCorner(node,nodes){
  const arms=[];
  for(const other of nodes){
   if(other===node||!this.sameFloorAxis(node.yaw,other.yaw))continue;
   const vector=this.vectorBetween(node,other);
   if(this.oneLogVector(vector))arms.push(vector);
  }

  // A valid frame location belongs to a complete square floor bay: there must
  // be another structural corner one full log away along both perpendicular axes.
  for(let i=0;i<arms.length;i++){
   for(let j=i+1;j<arms.length;j++){
    if(this.perpendicular(arms[i],arms[j]))return true;
   }
  }
  return false;
 }

 structuralFloorCorners(){
  const nodes=this.uniqueFloorCorners();
  return nodes.filter(node=>this.isStructuralCorner(node,nodes));
 }

 occupied(node){
  return this.buildingModes.activePlacements('frame').some(frame=>
   Math.hypot(frame.x-node.x,frame.z-node.z)<=this.buildingModes.frameOccupancyRadius&&
   Math.abs(frame.minY-node.topY)<=.42
  );
 }

 respectsExistingFrameGrid(node,foundationFrames){
  if(!foundationFrames.length)return true;

  let connected=false;
  const minAllowed=this.buildingModes.logLength
   -this.spacingTolerance
   -this.minimumFrameSeparationPadding;

  for(const frame of foundationFrames){
   const distance=Math.hypot(frame.x-node.x,frame.z-node.z);
   if(distance<this.buildingModes.frameOccupancyRadius)return false;
   if(distance<minAllowed)return false;
   if(Math.abs(distance-this.buildingModes.logLength)<=this.spacingTolerance)connected=true;
  }
  return connected;
 }

 floorFrameCandidates(base){
  const foundationFrames=this.buildingModes.foundationFrames();
  const candidates=[];

  for(const node of this.structuralFloorCorners()){
   if(this.occupied(node))continue;
   if(!this.respectsExistingFrameGrid(node,foundationFrames))continue;

   candidates.push({
    x:node.x,
    z:node.z,
    yaw:base.yaw,
    baseY:node.topY,
    ground:node.topY,
    snapKind:'floor-corner',
    anchorIds:[...node.floorIds]
   });
  }
  return candidates;
 }
}
