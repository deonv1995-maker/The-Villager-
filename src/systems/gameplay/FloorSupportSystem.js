export class FloorSupportSystem{
 constructor(THREE,{world,buildingModes,foundationTerrain,materials}){
  this.T=THREE;
  this.world=world;
  this.buildingModes=buildingModes;
  this.foundationTerrain=foundationTerrain;
  this.materials=materials;

  this.minSupportGap=.44;
  this.groundEmbed=.06;
  this.floorEmbed=.07;
  this.mergeRadius=.24;
  this.segmentOverlap=.035;
  this.lastFloorSignature='';
 }

 initialize(){
  this.world.floorSupports=this;
  this.rebuild();
 }

 activeFloors(){
  return this.buildingModes?.placements?.filter(p=>
   p.mode==='floor'&&p.object?.parent
  )||[];
 }

 floorSignature(){
  return this.activeFloors()
   .map(f=>`${f.id}:${f.x.toFixed(3)}:${f.z.toFixed(3)}:${f.minY.toFixed(3)}`)
   .sort()
   .join('|');
 }

 basis(yaw){
  return {
   xX:Math.cos(yaw),xZ:-Math.sin(yaw),
   zX:Math.sin(yaw),zZ:Math.cos(yaw)
  };
 }

 floorCorners(floor){
  const halfLength=this.buildingModes?.floorHalfLength??1.45;
  const halfWidth=this.buildingModes?.floorHalfWidth??.48;
  const b=this.basis(floor.yaw||0);
  const corners=[];

  for(const sx of [-1,1]){
   for(const sz of [-1,1]){
    corners.push({
     x:floor.x+b.xX*halfLength*sx+b.zX*halfWidth*sz,
     z:floor.z+b.xZ*halfLength*sx+b.zZ*halfWidth*sz,
     floor
    });
   }
  }
  return corners;
 }

 supportGroundY(x,z){
  return this.world?.heightAt?.(x,z)??0;
 }

 collectSupportCandidates(){
  const candidates=[];

  for(const floor of this.activeFloors()){
   const topY=floor.minY+this.floorEmbed;

   for(const corner of this.floorCorners(floor)){
    const groundY=this.supportGroundY(corner.x,corner.z);
    if(!Number.isFinite(groundY)||!Number.isFinite(topY))continue;

    const bottomY=groundY-this.groundEmbed;
    const height=topY-bottomY;
    if(height<this.minSupportGap)continue;

    let merged=null;
    for(const existing of candidates){
     if(Math.hypot(existing.x-corner.x,existing.z-corner.z)<=this.mergeRadius){
      merged=existing;
      break;
     }
    }

    if(merged){
     merged.bottomY=Math.min(merged.bottomY,bottomY);
     merged.topY=Math.max(merged.topY,topY);
     if(!merged.anchorIds.includes(floor.id))merged.anchorIds.push(floor.id);
    }else{
     candidates.push({
      x:corner.x,z:corner.z,
      bottomY,topY,
      anchorIds:[floor.id]
     });
    }
   }
  }

  return candidates;
 }

 makeSupportVisual(candidate){
  const T=this.T;
  const group=new T.Group();
  group.name='AutoFloorSupportPost';
  group.userData.autoFloorSupport=true;

  const totalHeight=candidate.topY-candidate.bottomY;
  const logLength=this.materials?.logLength??2.90;
  const usableLength=Math.max(.50,logLength-this.segmentOverlap);
  const segmentCount=Math.max(1,Math.ceil(totalHeight/usableLength));
  const segmentHeight=totalHeight/segmentCount;
  const localBottom=-totalHeight*.5;

  for(let i=0;i<segmentCount;i++){
   const log=this.materials.makeLogVisual();
   log.rotation.z=Math.PI/2;
   log.scale.x=(segmentHeight+(i<segmentCount-1?this.segmentOverlap:0))/logLength;
   log.position.y=localBottom+segmentHeight*(i+.5);
   log.userData.autoFloorSupportSegment=true;
   group.add(log);
  }

  group.position.set(
   candidate.x,
   (candidate.bottomY+candidate.topY)*.5,
   candidate.z
  );
  return group;
 }

 removeGeneratedSupports(){
  const placements=this.buildingModes?.placements;
  if(!placements)return;

  for(const placement of placements){
   if(!placement.autoSupport)continue;
   placement.object?.removeFromParent?.();
  }

  this.buildingModes.placements=placements.filter(p=>!p.autoSupport);
 }

 createSupport(candidate){
  const object=this.makeSupportVisual(candidate);
  const base={
   x:candidate.x,
   z:candidate.z,
   ground:candidate.bottomY,
   yaw:0,
   snapKind:'auto-floor-support',
   anchorIds:[...candidate.anchorIds]
  };

  const placement=this.buildingModes.recordPlacement('support',object,base,false);
  placement.autoSupport=true;
  placement.supportBottomY=candidate.bottomY;
  placement.supportTopY=candidate.topY;
  placement.anchorIds=[...candidate.anchorIds];
  object.userData.autoFloorSupport=true;
  return placement;
 }

 rebuild(){
  this.removeGeneratedSupports();
  for(const candidate of this.collectSupportCandidates())this.createSupport(candidate);
  this.lastFloorSignature=this.floorSignature();
 }

 update(){
  const signature=this.floorSignature();
  if(signature===this.lastFloorSignature)return;
  this.rebuild();
 }
}
