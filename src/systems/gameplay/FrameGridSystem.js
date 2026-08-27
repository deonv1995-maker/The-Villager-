export class FrameGridSystem{
 constructor({buildingModes}){
  this.buildingModes=buildingModes;
  this.cornerMergeTolerance=.11;
  this.spacingTolerance=.10;
  this.perpendicularDotTolerance=.12;
  this.minimumFrameSeparationPadding=.04;
  this.perimeterProbe=.18;
  this.floorContainmentInset=.025;
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

  // Keep the proven structural spacing rule: a frame point must still connect to
  // one-log arms on both perpendicular axes. Perimeter filtering happens after
  // this so exterior walls retain the exact same bay dimensions as before.
  for(let i=0;i<arms.length;i++){
   for(let j=i+1;j<arms.length;j++){
    if(this.perpendicular(arms[i],arms[j]))return true;
   }
  }
  return false;
 }

 pointInsideFloor(floor,x,z){
  if(!floor||!this.sameFloorAxis(floor.yaw||0,floor.yaw||0))return false;
  const modes=this.buildingModes;
  const b=modes.basis(floor.yaw||0);
  const dx=x-floor.x;
  const dz=z-floor.z;
  const localX=dx*b.xX+dz*b.xZ;
  const localZ=dx*b.zX+dz*b.zZ;
  const halfX=Math.max(.01,(modes.floorHalfLength??1.45)-this.floorContainmentInset);
  const halfZ=Math.max(.01,(modes.floorHalfWidth??.48)-this.floorContainmentInset);
  return Math.abs(localX)<=halfX&&Math.abs(localZ)<=halfZ;
 }

 floorCoversPoint(node,x,z){
  for(const floor of this.buildingModes.activePlacements('floor')){
   if(!this.sameFloorAxis(node.yaw,floor.yaw||0))continue;
   if(this.pointInsideFloor(floor,x,z))return true;
  }
  return false;
 }

 quadrantCoverage(node){
  const b=this.buildingModes.basis(node.yaw||0);
  const p=this.perimeterProbe;
  let covered=0;

  // Probe a small point inside each of the four quadrants around the structural
  // node. Four covered quadrants means this post would sit completely inside the
  // floor plan; fewer than four means it lies on the building perimeter.
  for(const sx of [-1,1]){
   for(const sz of [-1,1]){
    const x=node.x+b.xX*p*sx+b.zX*p*sz;
    const z=node.z+b.xZ*p*sx+b.zZ*p*sz;
    if(this.floorCoversPoint(node,x,z))covered++;
   }
  }
  return covered;
 }

 isPerimeterCorner(node){
  const covered=this.quadrantCoverage(node);
  return covered>0&&covered<4;
 }

 structuralFloorCorners(){
  const nodes=this.uniqueFloorCorners();
  return nodes.filter(node=>
   this.isStructuralCorner(node,nodes)&&this.isPerimeterCorner(node)
  );
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

  // Only the outside boundary participates in the automatic structural grid.
  // Interior floor intersections deliberately stay open, allowing large rooms
  // without columns through the centre. The player can still add other building
  // pieces intentionally; this only removes the automatic interior requirement.
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
