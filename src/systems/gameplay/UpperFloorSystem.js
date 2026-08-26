export class UpperFloorSystem{
 constructor({buildingModes,foundationTerrain=null,floorSupports=null}){
  this.buildingModes=buildingModes;
  this.foundationTerrain=foundationTerrain;
  this.floorSupports=floorSupports;

  this.snapRange=2.35;
  this.heightTolerance=.18;
  this.columnPositionTolerance=.14;
  this.perpendicularTolerance=.12;
  this.occupancyTolerance=.16;
  this.floorSeatInset=.10;

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

  // Upper-storey floors rest on the timber framework. They must not excavate the
  // terrain below or spawn automatic deck posts all the way down to the ground.
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

 columns(){return this.buildingModes.frameColumns();}
 beams(){
  return this.buildingModes.activePlacements('beam')
   .filter(beam=>beam.snapKind==='frame-pair-top'&&beam.anchorIds?.length>=2);
 }

 pairKey(a,b){return [a,b].sort((x,y)=>x-y).join(':');}

 beamMap(){
  const map=new Map();
  for(const beam of this.beams())map.set(this.pairKey(beam.anchorIds[0],beam.anchorIds[1]),beam);
  return map;
 }

 connected(map,a,b){return map.get(this.pairKey(a.topId,b.topId))||null;}

 vector(a,b){
  const x=b.x-a.x,z=b.z-a.z;
  const length=Math.hypot(x,z);
  return {x,z,length};
 }

 oneLogApart(a,b){
  return Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-this.buildingModes.logLength)<=this.columnPositionTolerance;
 }

 perpendicular(a,b){
  if(a.length<.001||b.length<.001)return false;
  return Math.abs((a.x*b.x+a.z*b.z)/(a.length*b.length))<=this.perpendicularTolerance;
 }

 findColumnNear(columns,x,z,height){
  let best=null,bestDistance=this.columnPositionTolerance;
  for(const column of columns){
   if(Math.abs(column.maxY-height)>this.heightTolerance)continue;
   const distance=Math.hypot(column.x-x,column.z-z);
   if(distance<bestDistance){best=column;bestDistance=distance;}
  }
  return best;
 }

 frameworkBays(){
  const columns=this.columns();
  const beams=this.beamMap();
  const bays=[];
  const seen=new Set();

  for(const a of columns){
   const neighbours=columns.filter(b=>
    b!==a&&
    Math.abs(b.maxY-a.maxY)<=this.heightTolerance&&
    this.oneLogApart(a,b)&&
    this.connected(beams,a,b)
   );

   for(let i=0;i<neighbours.length;i++){
    const b=neighbours[i];
    const ab=this.vector(a,b);
    for(let j=i+1;j<neighbours.length;j++){
     const c=neighbours[j];
     const ac=this.vector(a,c);
     if(!this.perpendicular(ab,ac))continue;

     const d=this.findColumnNear(columns,b.x+c.x-a.x,b.z+c.z-a.z,a.maxY);
     if(!d||d===a||d===b||d===c)continue;
     const abBeam=this.connected(beams,a,b);
     const acBeam=this.connected(beams,a,c);
     const bdBeam=this.connected(beams,b,d);
     const cdBeam=this.connected(beams,c,d);
     if(!abBeam||!acBeam||!bdBeam||!cdBeam)continue;

     const ids=[a.topId,b.topId,c.topId,d.topId].sort((x,y)=>x-y);
     const key=ids.join(':');
     if(seen.has(key))continue;
     seen.add(key);

     const ux=ab.x/ab.length,uz=ab.z/ab.length;
     let vx=ac.x/ac.length,vz=ac.z/ac.length;
     if(ux*vz-uz*vx<0){vx*=-1;vz*=-1;}

     bays.push({
      key,
      centerX:(a.x+b.x+c.x+d.x)*.25,
      centerZ:(a.z+b.z+c.z+d.z)*.25,
      ux,uz,vx,vz,
      yaw:Math.atan2(-uz,ux),
      beamCenterY:(abBeam.centerY+acBeam.centerY+bdBeam.centerY+cdBeam.centerY)*.25,
      beamIds:[abBeam.id,acBeam.id,bdBeam.id,cdBeam.id]
     });
    }
   }
  }
  return bays;
 }

 stripOccupied(x,z,centerY){
  return this.buildingModes.activePlacements('floor').some(floor=>
   floor.snapKind==='upper-floor-beam'&&
   Math.hypot(floor.x-x,floor.z-z)<=this.occupancyTolerance&&
   Math.abs(floor.centerY-centerY)<=.18
  );
 }

 candidates(){
  const result=[];
  const width=this.buildingModes.floorWidth;

  for(const bay of this.frameworkBays()){
   // The split floor logs now pass into the centre zone of the horizontal beam.
   // This deliberate timber overlap removes the floating stacked-on-top look and
   // makes the upper deck read as a notched structural joint.
   const centerY=bay.beamCenterY+this.floorSeatInset;
   for(const offset of [-width,0,width]){
    const x=bay.centerX+bay.vx*offset;
    const z=bay.centerZ+bay.vz*offset;
    if(this.stripOccupied(x,z,centerY))continue;
    result.push({
     x,z,yaw:bay.yaw,
     centerY,
     ground:centerY-.275,
     snapKind:'upper-floor-beam',
     anchorIds:[...bay.beamIds],
     upperFloorBayKey:bay.key
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
   const base=this.buildingModes.resolvedBase('floor');
   if(base?.snapKind==='upper-floor-beam')return 'SNAP UPPER FLOOR';
  }
  return this.originalActionLabel();
 }
}
