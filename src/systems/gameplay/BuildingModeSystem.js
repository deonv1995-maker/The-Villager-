export class BuildingModeSystem{
 constructor(THREE,{world,scene,player,materials,button=null,feedbackElement=null}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.materials=materials;
  this.button=button;
  this.feedbackElement=feedbackElement;

  // RAW preserves free placement for fires/furnaces. The structural modes turn
  // one carried log into a useful shape and then snap it to compatible pieces.
  this.modes=['raw','floor','frame','wall','angle'];
  this.modeIndex=0;
  this.root=new THREE.Group();
  this.root.name='LogConstructionPieces';
  this.placements=[];
  this.nextPlacementId=1;
  this.placeDistance=1.90;
  this.feedbackTimer=null;

  this.logLength=2.20;
  this.floorWidth=1.12;
  this.floorHalfLength=this.logLength*.5;
  this.floorHalfWidth=this.floorWidth*.5;
  this.floorSnapRange=1.25;
  this.frameSnapRange=1.20;
  this.wallSnapRange=1.45;
  this.angleSnapRange=1.55;
  this.angleHalfProjection=this.logLength*.5*Math.SQRT1_2;

  this.onButton=e=>{
   e?.preventDefault?.();
   e?.stopPropagation?.();
   this.cycleMode();
  };
 }

 initialize(){
  this.scene.add(this.root);
  this.world.buildModes=this;
  this.button?.addEventListener('pointerdown',this.onButton,{passive:false});
  this.updateButton();
 }

 dispose(){
  this.button?.removeEventListener('pointerdown',this.onButton);
 }

 get mode(){return this.modes[this.modeIndex];}

 modeLabel(mode=this.mode){
  if(mode==='raw')return 'RAW';
  if(mode==='floor')return 'FLOOR';
  if(mode==='frame')return 'FRAME';
  if(mode==='wall')return 'WALL';
  return 'ANGLE';
 }

 cycleMode(){
  this.modeIndex=(this.modeIndex+1)%this.modes.length;
  this.updateButton();
  this.showFeedback(`Log mode: ${this.modeLabel()}`);
 }

 updateButton(){
  if(!this.button)return;
  this.button.textContent=this.modeLabel();
  this.button.dataset.buildMode=this.mode;
 }

 showFeedback(text){
  if(!this.feedbackElement||!text)return;
  this.feedbackElement.textContent=text;
  this.feedbackElement.classList.add('show');
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>this.feedbackElement.classList.remove('show'),720);
 }

 snapQuarter(value){return Math.round(value*4)/4;}
 snapYaw(yaw,step=Math.PI/4){return Math.round(yaw/step)*step;}
 yawDelta(a,b){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));}
 axisYawDelta(a,b){
  const d=this.yawDelta(a,b);
  return Math.min(d,Math.abs(Math.PI-d));
 }

 basis(yaw){
  return {
   xX:Math.cos(yaw),xZ:-Math.sin(yaw),
   zX:Math.sin(yaw),zZ:Math.cos(yaw)
  };
 }

 placementBase(distance=this.placeDistance){
  const yaw=this.snapYaw(this.player.rotation.y);
  const x=this.snapQuarter(this.player.position.x+Math.sin(yaw)*distance);
  const z=this.snapQuarter(this.player.position.z+Math.cos(yaw)*distance);
  return {x,z,ground:this.world.heightAt(x,z),yaw,snapKind:null,anchorIds:[]};
 }

 candidateDistance(base,candidate){
  return Math.hypot(candidate.x-base.x,candidate.z-base.z);
 }

 chooseCandidate(base,candidates,maxDistance){
  let best=null;
  let bestScore=maxDistance;
  for(const candidate of candidates){
   const distance=this.candidateDistance(base,candidate);
   const score=distance+(candidate.penalty||0);
   if(score<bestScore){best=candidate;bestScore=score;}
  }
  if(!best)return base;
  return {
   ...base,...best,
   ground:Number.isFinite(best.ground)?best.ground:this.world.heightAt(best.x,best.z),
   anchorIds:best.anchorIds||[]
  };
 }

 placementAllowed(x,z){
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(x,z))return false;
  if(this.world?.environment?.terrainClearance?.(x,z))return false;
  return true;
 }

 clearAuthoredGrass(x,z,radius=1.15){
  const root=this.world?.environment?.root;
  if(!root)return;
  const p=new this.T.Vector3();
  const r2=radius*radius;
  for(const object of root.children){
   if(object.userData?.environmentType!=='grass'||object.visible===false)continue;
   object.getWorldPosition(p);
   const dx=p.x-x,dz=p.z-z;
   if(dx*dx+dz*dz<r2)object.visible=false;
  }
 }

 registerStructureCollider(object,{standable=false,radiusScale=.46,standRadiusScale=.92}={}){
  if(!this.world?.registerRockColliderFromObject||!object)return null;
  object.updateWorldMatrix?.(true,true);
  return this.world.registerRockColliderFromObject(object,{
   owner:'player-construction',
   radiusScale,
   minRadius:.16,
   maxRadius:1.35,
   verticalInset:.01,
   standable,
   standRadiusScale,
   supportInsetScale:.025,
   minSupportInset:.01,
   maxSupportInset:.04
  });
 }

 recordPlacement(mode,object,base,standable=false){
  object.userData.playerConstruction=true;
  object.userData.constructionMode=mode;
  object.userData.constructionSnapKind=base.snapKind||null;
  this.root.add(object);
  object.updateWorldMatrix(true,true);

  const box=new this.T.Box3().setFromObject(object);
  const placement={
   id:this.nextPlacementId++,mode,object,
   x:base.x,z:base.z,yaw:object.rotation.y,
   minY:box.min.y,maxY:box.max.y,
   standable,
   snapKind:base.snapKind||null,
   anchorIds:[...(base.anchorIds||[])]
  };
  this.placements.push(placement);
  this.registerStructureCollider(object,{standable});
  return placement;
 }

 consumeCarriedLog(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return false;
  return this.materials.consume(item);
 }

 floorSnapBase(base){
  const candidates=[];
  for(const floor of this.placements){
   if(floor.mode!=='floor')continue;
   if(this.axisYawDelta(floor.yaw,base.yaw)>.18)continue;
   const yaw=floor.yaw;
   const b=this.basis(yaw);
   const offsets=[
    [b.xX*this.logLength,b.xZ*this.logLength],
    [-b.xX*this.logLength,-b.xZ*this.logLength],
    [b.zX*this.floorWidth,b.zZ*this.floorWidth],
    [-b.zX*this.floorWidth,-b.zZ*this.floorWidth]
   ];
   for(const [ox,oz] of offsets){
    const x=this.snapQuarter(floor.x+ox);
    const z=this.snapQuarter(floor.z+oz);
    candidates.push({
     x,z,yaw,
     ground:this.world.heightAt(x,z),
     snapKind:'floor-edge',
     anchorIds:[floor.id]
    });
   }
  }
  return this.chooseCandidate(base,candidates,this.floorSnapRange);
 }

 floorCornerCandidates(floor){
  const b=this.basis(floor.yaw);
  const result=[];
  for(const sx of [-1,1]){
   for(const sz of [-1,1]){
    result.push({
     x:floor.x+b.xX*this.floorHalfLength*sx+b.zX*this.floorHalfWidth*sz,
     z:floor.z+b.xZ*this.floorHalfLength*sx+b.zZ*this.floorHalfWidth*sz
    });
   }
  }
  return result;
 }

 frameSnapBase(base){
  const candidates=[];

  // Floor corners are natural post positions. Once one post exists, additional
  // posts can also extend at one-log spacing in straight or 45-degree directions.
  for(const placement of this.placements){
   if(placement.mode==='floor'){
    for(const corner of this.floorCornerCandidates(placement)){
     const x=this.snapQuarter(corner.x);
     const z=this.snapQuarter(corner.z);
     candidates.push({
      x,z,yaw:base.yaw,
      ground:this.world.heightAt(x,z),
      snapKind:'floor-corner',
      anchorIds:[placement.id]
     });
    }
   }

   if(placement.mode==='frame'){
    for(let i=0;i<8;i++){
     const yaw=i*Math.PI/4;
     const x=this.snapQuarter(placement.x+Math.sin(yaw)*this.logLength);
     const z=this.snapQuarter(placement.z+Math.cos(yaw)*this.logLength);
     candidates.push({
      x,z,yaw:base.yaw,
      ground:this.world.heightAt(x,z),
      snapKind:'frame-spacing',
      anchorIds:[placement.id],
      penalty:.06
     });
    }
   }
  }
  return this.chooseCandidate(base,candidates,this.frameSnapRange);
 }

 wallPairCandidates(base){
  const frames=this.placements.filter(p=>p.mode==='frame');
  const candidates=[];
  for(let i=0;i<frames.length;i++){
   const a=frames[i];
   for(let j=i+1;j<frames.length;j++){
    const b=frames[j];
    const dx=b.x-a.x,dz=b.z-a.z;
    const distance=Math.hypot(dx,dz);
    if(distance<this.logLength-.48||distance>this.logLength+.48)continue;
    if(Math.abs(a.maxY-b.maxY)>.72)continue;

    const x=(a.x+b.x)*.5;
    const z=(a.z+b.z)*.5;
    if(Math.hypot(x-base.x,z-base.z)>this.wallSnapRange)continue;
    const yaw=Math.atan2(-dz,dx);
    candidates.push({
     x,z,
     yaw:this.snapYaw(yaw),
     ground:this.world.heightAt(x,z),
     snapKind:'between-frames',
     anchorIds:[a.id,b.id],
     penalty:Math.abs(distance-this.logLength)*.35
    });
   }
  }
  return candidates;
 }

 wallSnapBase(base){
  const between=this.chooseCandidate(base,this.wallPairCandidates(base),this.wallSnapRange+.12);
  if(between.snapKind)return between;

  // If a complete frame pair is not available yet, keep wall placement useful by
  // snapping the wall centre one half-log away from a nearby frame in the chosen
  // direction. A second frame can then be snapped onto the far end afterwards.
  const candidates=[];
  const b=this.basis(base.yaw);
  for(const frame of this.placements){
   if(frame.mode!=='frame')continue;
   for(const sign of [-1,1]){
    const x=this.snapQuarter(frame.x+b.xX*this.floorHalfLength*sign);
    const z=this.snapQuarter(frame.z+b.xZ*this.floorHalfLength*sign);
    candidates.push({
     x,z,yaw:base.yaw,
     ground:this.world.heightAt(x,z),
     snapKind:'from-frame',
     anchorIds:[frame.id],
     penalty:.10
    });
   }
  }
  return this.chooseCandidate(base,candidates,this.wallSnapRange);
 }

 angleSnapBase(base){
  const candidates=[];
  const directionYaw=base.yaw;
  const forwardX=Math.sin(directionYaw);
  const forwardZ=Math.cos(directionYaw);

  for(const frame of this.placements){
   if(frame.mode!=='frame')continue;
   const x=frame.x+forwardX*this.angleHalfProjection;
   const z=frame.z+forwardZ*this.angleHalfProjection;
   candidates.push({
    x,z,
    yaw:directionYaw,
    ground:this.world.heightAt(x,z),
    centerY:frame.maxY+this.angleHalfProjection,
    snapKind:'frame-top',
    anchorIds:[frame.id]
   });
  }
  return this.chooseCandidate(base,candidates,this.angleSnapRange);
 }

 resolvedBase(mode=this.mode){
  const base=this.placementBase();
  if(mode==='floor')return this.floorSnapBase(base);
  if(mode==='frame')return this.frameSnapBase(base);
  if(mode==='wall')return this.wallSnapBase(base);
  if(mode==='angle')return this.angleSnapBase(base);
  return base;
 }

 makeFloor(base){
  const T=this.T;
  const group=new T.Group();
  group.name='SplitLogFloor';

  for(const offset of [-.28,.28]){
   const half=this.materials.makeHalfLogVisual();
   half.position.z=offset;
   group.add(half);
  }

  group.position.set(base.x,base.ground+.275,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 makeFrame(base){
  const T=this.T;
  const group=new T.Group();
  group.name='UprightLogFrame';
  const log=this.materials.makeLogVisual();
  log.rotation.z=Math.PI/2;
  group.add(log);
  group.position.set(base.x,base.ground+1.12,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 wallBaseHeight(base){
  let best=null;
  let bestDistance=.60;
  for(const placement of this.placements){
   if(placement.mode!=='wall')continue;
   if(this.axisYawDelta(placement.yaw,base.yaw)>.14)continue;
   const d=Math.hypot(placement.x-base.x,placement.z-base.z);
   if(d<bestDistance){best=placement;bestDistance=d;}
  }
  return best?best.maxY+.02:base.ground+.26;
 }

 makeWall(base){
  const T=this.T;
  const group=new T.Group();
  group.name='SplitLogWallSection';

  for(const y of [0,.50]){
   const half=this.materials.makeHalfLogVisual();
   half.rotation.x=Math.PI/2;
   half.position.y=y;
   group.add(half);
  }

  group.position.set(base.x,this.wallBaseHeight(base),base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 makeAngle(base){
  const T=this.T;
  const group=new T.Group();
  group.name='AngledLog';
  const log=this.materials.makeLogVisual();
  log.rotation.z=Math.PI/4;
  group.add(log);

  // The low end can snap directly onto the top of an upright FRAME. Free ANGLE
  // placement still starts from terrain, which keeps it useful for simple stairs.
  const centerY=Number.isFinite(base.centerY)?base.centerY:base.ground+1.02;
  group.position.set(base.x,centerY,base.z);
  group.rotation.y=base.yaw-Math.PI/2;
  return group;
 }

 actionLabel(){
  if(this.mode==='raw')return 'PLACE LOG';
  const base=this.resolvedBase(this.mode);
  return `${base.snapKind?'SNAP':'PLACE'} ${this.modeLabel()}`;
 }

 placeCarriedLog(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return null;

  if(this.mode==='raw')return this.materials.placeCarried();

  const base=this.resolvedBase(this.mode);
  if(!this.placementAllowed(base.x,base.z))return null;

  let object=null;
  let standable=false;
  if(this.mode==='floor'){
   object=this.makeFloor(base);
   standable=true;
  }else if(this.mode==='frame'){
   object=this.makeFrame(base);
  }else if(this.mode==='wall'){
   object=this.makeWall(base);
  }else if(this.mode==='angle'){
   object=this.makeAngle(base);
  }
  if(!object)return null;

  if(!this.consumeCarriedLog())return null;
  const placement=this.recordPlacement(this.mode,object,base,standable);
  this.clearAuthoredGrass(base.x,base.z,this.mode==='floor'?1.35:.85);
  return placement;
 }
}
