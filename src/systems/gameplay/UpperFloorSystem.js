export class UpperFloorSystem{
 constructor({buildingModes,foundationTerrain=null,floorSupports=null}){
  this.buildingModes=buildingModes;
  this.foundationTerrain=foundationTerrain;
  this.floorSupports=floorSupports;

  this.snapRange=2.45;
  this.heightTolerance=.24;
  this.sourceStoreyTolerance=.48;
  this.occupancyTolerance=.16;
  this.floorSeatInset=.10;
  this.polygonEdgeTolerance=.08;

  this.originalFloorSnapBase=null;
  this.originalActionLabel=null;
  this.originalRegisterFloor=null;
  this.originalSupportFloors=null;
 }

 initialize(){
  if(!this.buildingModes)return;
  this.buildingModes.world.upperFloors=this;

  this.originalFloorSnapBase=this.buildingModes.floorSnapBase.bind(this.buildingModes);
  this.buildingModes.floorSnapBase=base=>this.floorSnapBase(base);

  this.originalActionLabel=this.buildingModes.actionLabel.bind(this.buildingModes);
  this.buildingModes.actionLabel=()=>this.actionLabel();

  // Upper decks rest on timber framework. Never excavate terrain or generate
  // ground-to-deck support posts for these elevated floor pieces.
  if(this.foundationTerrain?.registerFloor){
   this.originalRegisterFloor=this.foundationTerrain.registerFloor.bind(this.foundationTerrain);
   this.foundationTerrain.registerFloor=floor=>{
    if(floor?.snapKind==='upper-floor-beam'){
     this.foundationTerrain.processedPlacements?.add?.(floor.id);
     return false;
    }
    return this.originalRegisterFloor(floor);
   };
  }

  if(this.floorSupports?.activeFloors){
   this.originalSupportFloors=this.floorSupports.activeFloors.bind(this.floorSupports);
   this.floorSupports.activeFloors=()=>
    this.originalSupportFloors().filter(floor=>floor.snapKind!=='upper-floor-beam');
  }
 }

 frames(){return this.buildingModes.activePlacements('frame');}
 beams(){
  return this.buildingModes.activePlacements('beam').filter(beam=>
   beam.snapKind==='frame-pair-top'&&beam.anchorIds?.length>=2
  );
 }

 frameMap(){
  const map=new Map();
  for(const frame of this.frames())map.set(frame.id,frame);
  return map;
 }

 perimeterFrameworks(){
  const frameById=this.frameMap();
  const beams=this.beams().filter(beam=>
   frameById.has(beam.anchorIds[0])&&frameById.has(beam.anchorIds[1])
  );
  const byFrame=new Map();

  for(const beam of beams){
   for(const id of beam.anchorIds.slice(0,2)){
    let list=byFrame.get(id);
    if(!list){list=[];byFrame.set(id,list);}
    list.push(beam);
   }
  }

  const visited=new Set();
  const regions=[];
  for(const seed of beams){
   if(visited.has(seed.id))continue;
   const queue=[seed];
   const component=[];
   const seedY=seed.centerY;
   visited.add(seed.id);

   while(queue.length){
    const beam=queue.pop();
    component.push(beam);
    for(const frameId of beam.anchorIds.slice(0,2)){
     for(const next of byFrame.get(frameId)||[]){
      if(visited.has(next.id))continue;
      if(Math.abs(next.centerY-seedY)>this.heightTolerance)continue;
      visited.add(next.id);
      queue.push(next);
     }
    }
   }

   const region=this.closedRegion(component,frameById);
   if(region)regions.push(region);
  }
  return regions;
 }

 closedRegion(beams,frameById){
  if(beams.length<4)return null;
  const adjacency=new Map();
  const beamIds=[];
  let beamY=0;

  const add=(a,b)=>{
   let list=adjacency.get(a);
   if(!list){list=[];adjacency.set(a,list);}
   if(!list.includes(b))list.push(b);
  };

  for(const beam of beams){
   const [a,b]=beam.anchorIds;
   if(!frameById.has(a)||!frameById.has(b))return null;
   add(a,b);add(b,a);
   beamIds.push(beam.id);
   beamY+=beam.centerY;
  }

  // A completed perimeter is one closed loop. Mid-wall posts are fine: each
  // perimeter post still has exactly two top beams attached to it.
  const ids=[...adjacency.keys()];
  if(ids.length<4||ids.some(id=>adjacency.get(id)?.length!==2))return null;

  const ordered=[];
  const start=ids[0];
  let previous=null;
  let current=start;
  for(let guard=0;guard<=ids.length;guard++){
   const frame=frameById.get(current);
   if(!frame)return null;
   ordered.push({id:current,x:frame.x,z:frame.z});
   const neighbours=adjacency.get(current);
   const next=neighbours[0]===previous?neighbours[1]:neighbours[0];
   previous=current;
   current=next;
   if(current===start)break;
  }

  if(current!==start||ordered.length!==ids.length)return null;
  return {
   polygon:ordered,
   beamCenterY:beamY/beams.length,
   beamIds
  };
 }

 pointSegmentDistanceSq(px,pz,ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az;
  const lengthSq=dx*dx+dz*dz;
  if(lengthSq<1e-8){
   const ox=px-ax,oz=pz-az;
   return ox*ox+oz*oz;
  }
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/lengthSq));
  const x=ax+dx*t,z=az+dz*t;
  const ox=px-x,oz=pz-z;
  return ox*ox+oz*oz;
 }

 pointInsideRegion(region,x,z){
  const polygon=region?.polygon;
  if(!polygon?.length)return false;
  const edgeSq=this.polygonEdgeTolerance*this.polygonEdgeTolerance;
  let inside=false;

  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[j],b=polygon[i];
   if(this.pointSegmentDistanceSq(x,z,a.x,a.z,b.x,b.z)<=edgeSq)return true;
   const crosses=((a.z>z)!==(b.z>z))&&
    (x<(b.x-a.x)*(z-a.z)/((b.z-a.z)||1e-9)+a.x);
   if(crosses)inside=!inside;
  }
  return inside;
 }

 sourceFloors(region){
  const logLength=this.buildingModes.logLength;
  return this.buildingModes.activePlacements('floor').filter(floor=>{
   if(!this.pointInsideRegion(region,floor.x,floor.z))return false;
   const rise=region.beamCenterY-floor.maxY;
   return rise>0&&Math.abs(rise-logLength)<=this.sourceStoreyTolerance;
  });
 }

 stripOccupied(x,z,centerY){
  return this.buildingModes.activePlacements('floor').some(floor=>
   floor.snapKind==='upper-floor-beam'&&
   Math.hypot(floor.x-x,floor.z-z)<=this.occupancyTolerance&&
   Math.abs(floor.centerY-centerY)<=this.heightTolerance
  );
 }

 candidates(){
  const result=[];
  for(const region of this.perimeterFrameworks()){
   const centerY=region.beamCenterY+this.floorSeatInset;

   // Mirror the real deck footprint from the storey below. This lets the outer
   // perimeter carry a large open room without inventing centre posts merely to
   // satisfy the old one-square-bay snap rule.
   for(const source of this.sourceFloors(region)){
    if(this.stripOccupied(source.x,source.z,centerY))continue;
    result.push({
     x:source.x,
     z:source.z,
     yaw:source.yaw,
     centerY,
     ground:centerY-.275,
     snapKind:'upper-floor-beam',
     anchorIds:[...region.beamIds],
     upperFloorSourceId:source.id
    });
   }
  }
  return result;
 }

 floorSnapBase(base){
  if(!base)return base;
  const upper=this.buildingModes.chooseCandidate(base,this.candidates(),this.snapRange);
  if(upper?.snapKind==='upper-floor-beam')return upper;
  return this.originalFloorSnapBase(base);
 }

 actionLabel(){
  if(this.buildingModes.mode==='floor'){
   const base=this.buildingModes.currentPreviewBase?.()
    ||this.buildingModes.resolvedBase('floor');
   if(base?.snapKind==='upper-floor-beam')return 'SNAP UPPER FLOOR';
  }
  return this.originalActionLabel();
 }
}
