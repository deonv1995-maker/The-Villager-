export class UpperFloorSystem{
 constructor({buildingModes}){
  this.buildingModes=buildingModes;
  this.snapRange=2.35;
  this.heightTolerance=.18;
  this.columnPositionTolerance=.14;
  this.perpendicularTolerance=.12;
  this.occupancyTolerance=.16;
  this.beamRadius=.27;
  this.floorBodyDepth=.26;

  this.originalFloorSnapBase=null;
  this.originalActionLabel=null;
 }

 initialize(){
  if(!this.buildingModes)return;
  this.buildingModes.world.upperFloors=this;

  this.originalFloorSnapBase=this.buildingModes.floorSnapBase.bind(this.buildingModes);
  this.buildingModes.floorSnapBase=base=>this.floorSnapBase(base);

  this.originalActionLabel=this.buildingModes.actionLabel.bind(this.buildingModes);
  this.buildingModes.actionLabel=()=>this.actionLabel();
 }

 columns(){return this.buildingModes.frameColumns();}
 beams(){
  return this.buildingModes.activePlacements('beam')
   .filter(beam=>beam.snapKind==='frame-pair-top'&&beam.anchorIds?.length>=2);
 }

 pairKey(a,b){return [a,b].sort((x,y)=>x-y).join(':');}

 beamMap(){
  const map=new Map();
  for(const beam of this.beams()){
   map.set(this.pairKey(beam.anchorIds[0],beam.anchorIds[1]),beam);
  }
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

     const d=this.findColumnNear(
      columns,
      b.x+c.x-a.x,
      b.z+c.z-a.z,
      a.maxY
     );
     if(!d||d===a||d===b||d===c)continue;
     const bd=this.connected(beams,b,d);
     const cd=this.connected(beams,c,d);
     if(!bd||!cd)continue;

     const ids=[a.topId,b.topId,c.topId,d.topId].sort((x,y)=>x-y);
     const key=ids.join(':');
     if(seen.has(key))continue;
     seen.add(key);

     const ux=ab.x/ab.length,uz=ab.z/ab.length;
     let vx=ac.x/ac.length,vz=ac.z/ac.length;
     const cross=ux*vz-uz*vx;
     if(cross<0){vx*=-1;vz*=-1;}

     const centerX=(a.x+b.x+c.x+d.x)*.25;
     const centerZ=(a.z+b.z+c.z+d.z)*.25;
     const beamCenterY=(
      this.connected(beams,a,b).centerY+
      this.connected(beams,a,c).centerY+
      bd.centerY+cd.centerY
     )*.25;
     const yaw=Math.atan2(-uz,ux);

     bays.push({
      key,centerX,centerZ,ux,uz,vx,vz,yaw,
      beamCenterY,
      beamIds:[
       this.connected(beams,a,b).id,
       this.connected(beams,a,c).id,
       bd.id,cd.id
      ]
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
   // The raw beam runs through the post centre. The upper floor rests on the
   // outside of that beam instead of replacing the lower floor beneath it.
   const centerY=bay.beamCenterY+this.beamRadius+this.floorBodyDepth;
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
