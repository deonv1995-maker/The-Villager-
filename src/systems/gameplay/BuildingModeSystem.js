export class BuildingModeSystem{
 constructor(THREE,{world,scene,player,materials,button=null,feedbackElement=null}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.materials=materials;
  this.button=button;
  this.feedbackElement=feedbackElement;

  this.modes=['raw','floor','frame','wall','angle'];
  this.modeIndex=0;
  this.root=new THREE.Group();
  this.root.name='LogConstructionPieces';
  this.placements=[];
  this.nextPlacementId=1;
  this.placeDistance=1.90;
  this.feedbackTimer=null;

  // Construction derives its proportions from the actual harvested log. The new
  // 2.9 m log puts a FRAME slightly above Ranger head height and gives WALL bays
  // enough width to read as a proper room instead of a cramped cage.
  this.logLength=this.materials?.logLength??2.90;
  this.logHalfLength=this.logLength*.5;
  this.floorWidth=1.12;
  this.floorHalfLength=this.logHalfLength;
  this.floorHalfWidth=this.floorWidth*.5;
  this.frameCenterOffset=this.logHalfLength+.01;
  this.floorSnapRange=1.45;
  this.frameSnapRange=1.35;
  this.wallSnapRange=1.70;
  this.angleSnapRange=1.75;
  this.angleHalfProjection=this.logHalfLength*Math.SQRT1_2;

  // Do not allow a post or wall to materialize through the Ranger. This works in
  // tandem with escape-safe traversal collision and prevents most trapping before
  // it can happen; the ghost turns red when the player is occupying the piece.
  this.playerBuildClearance=.54;
  this.framePlacementRadius=.30;
  this.wallPlacementHalfThickness=.28;

  this.preview=null;
  this.previewMode=null;
  this.previewValid=false;
  this.previewMaterial=new THREE.MeshBasicMaterial({
   color:0x65d879,
   transparent:true,
   opacity:.44,
   depthWrite:false,
   depthTest:true,
   side:THREE.DoubleSide
  });

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
  this.destroyPreview();
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
  this.destroyPreview();
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

 playerClearForPlacement(mode,base){
  if(!this.player||!base)return true;
  if(mode!=='frame'&&mode!=='wall')return true;

  const px=this.player.position.x;
  const pz=this.player.position.z;
  if(mode==='frame'){
   const radius=this.framePlacementRadius+this.playerBuildClearance;
   return Math.hypot(px-base.x,pz-base.z)>radius;
  }

  const b=this.basis(base.yaw||0);
  const dx=px-base.x,dz=pz-base.z;
  const localX=dx*b.xX+dz*b.xZ;
  const localZ=dx*b.zX+dz*b.zZ;
  const halfX=this.logHalfLength+this.playerBuildClearance;
  const halfZ=this.wallPlacementHalfThickness+this.playerBuildClearance;
  return Math.abs(localX)>halfX||Math.abs(localZ)>halfZ;
 }

 placementAllowed(base,mode=this.mode){
  if(!base)return false;
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(base.x,base.z))return false;
  if(this.world?.environment?.terrainClearance?.(base.x,base.z))return false;
  if(!this.playerClearForPlacement(mode,base))return false;
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
   centerY:object.position.y,
   minY:box.min.y,maxY:box.max.y,
   standable,
   snapKind:base.snapKind||null,
   anchorIds:[...(base.anchorIds||[])]
  };
  this.placements.push(placement);
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
     centerY:floor.centerY,
     ground:floor.centerY-.275,
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
  for(const placement of this.placements){
   if(placement.mode==='floor'){
    for(const corner of this.floorCornerCandidates(placement)){
     const x=this.snapQuarter(corner.x);
     const z=this.snapQuarter(corner.z);
     candidates.push({
      x,z,yaw:base.yaw,
      baseY:placement.maxY,
      ground:placement.maxY,
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
    if(distance<this.logLength-.62||distance>this.logLength+.62)continue;
    if(Math.abs(a.maxY-b.maxY)>.78)continue;

    const x=(a.x+b.x)*.5;
    const z=(a.z+b.z)*.5;
    if(Math.hypot(x-base.x,z-base.z)>this.wallSnapRange)continue;
    const yaw=Math.atan2(-dz,dx);
    candidates.push({
     x,z,
     yaw:this.snapYaw(yaw),
     ground:Math.max(a.minY,b.minY),
     snapKind:'between-frames',
     anchorIds:[a.id,b.id],
     penalty:Math.abs(distance-this.logLength)*.30
    });
   }
  }
  return candidates;
 }

 wallSnapBase(base){
  const between=this.chooseCandidate(base,this.wallPairCandidates(base),this.wallSnapRange+.14);
  if(between.snapKind)return between;

  const candidates=[];
  const b=this.basis(base.yaw);
  for(const frame of this.placements){
   if(frame.mode!=='frame')continue;
   for(const sign of [-1,1]){
    const x=this.snapQuarter(frame.x+b.xX*this.logHalfLength*sign);
    const z=this.snapQuarter(frame.z+b.xZ*this.logHalfLength*sign);
    candidates.push({
     x,z,yaw:base.yaw,
     ground:frame.minY,
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
  const centerY=Number.isFinite(base.centerY)?base.centerY:base.ground+.275;
  group.position.set(base.x,centerY,base.z);
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
  const baseY=Number.isFinite(base.baseY)?base.baseY:base.ground;
  group.position.set(base.x,baseY+this.frameCenterOffset,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 wallBaseHeight(base){
  let best=null;
  let bestDistance=.70;
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
  const centerY=Number.isFinite(base.centerY)
   ?base.centerY
   :base.ground+this.angleHalfProjection+.20;
  group.position.set(base.x,centerY,base.z);
  group.rotation.y=base.yaw-Math.PI/2;
  return group;
 }

 rawPreviewBase(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return null;
  const target=this.materials.placementTarget(item);
  return {
   x:target.x,z:target.z,y:target.y,
   ground:this.world.heightAt(target.x,target.z),
   yaw:target.rotationY,
   rotationY:target.rotationY,
   snapKind:null,anchorIds:[]
  };
 }

 previewBase(){
  return this.mode==='raw'?this.rawPreviewBase():this.resolvedBase(this.mode);
 }

 tintAsPreview(object){
  object.traverse?.(child=>{
   if(!child.isMesh)return;
   child.material=this.previewMaterial;
   child.castShadow=false;
   child.receiveShadow=false;
   child.renderOrder=8;
  });
 }

 createPreview(mode,base){
  let object=null;
  if(mode==='raw'){
   object=this.materials.makeLogVisual();
   object.position.set(base.x,base.y,base.z);
   object.rotation.y=base.rotationY||0;
  }else if(mode==='floor')object=this.makeFloor(base);
  else if(mode==='frame')object=this.makeFrame(base);
  else if(mode==='wall')object=this.makeWall(base);
  else if(mode==='angle')object=this.makeAngle(base);
  if(!object)return null;

  object.name='ConstructionPlacementGhost';
  object.userData.constructionGhost=true;
  this.tintAsPreview(object);
  this.scene.add(object);
  this.preview=object;
  this.previewMode=mode;
  return object;
 }

 destroyPreview(){
  if(this.preview)this.preview.removeFromParent();
  this.preview=null;
  this.previewMode=null;
 }

 applyPreviewTransform(mode,base){
  const object=this.preview;
  if(!object)return;
  if(mode==='raw'){
   object.position.set(base.x,base.y,base.z);
   object.rotation.set(0,base.rotationY||0,0);
  }else if(mode==='floor'){
   const centerY=Number.isFinite(base.centerY)?base.centerY:base.ground+.275;
   object.position.set(base.x,centerY,base.z);
   object.rotation.set(0,base.yaw,0);
  }else if(mode==='frame'){
   const baseY=Number.isFinite(base.baseY)?base.baseY:base.ground;
   object.position.set(base.x,baseY+this.frameCenterOffset,base.z);
   object.rotation.set(0,base.yaw,0);
  }else if(mode==='wall'){
   object.position.set(base.x,this.wallBaseHeight(base),base.z);
   object.rotation.set(0,base.yaw,0);
  }else if(mode==='angle'){
   const centerY=Number.isFinite(base.centerY)
    ?base.centerY
    :base.ground+this.angleHalfProjection+.20;
   object.position.set(base.x,centerY,base.z);
   object.rotation.set(0,base.yaw-Math.PI/2,0);
  }
 }

 updatePreview(){
  const carried=this.materials?.carried;
  if(!carried||carried.type!=='log'){
   this.destroyPreview();
   return;
  }

  const base=this.previewBase();
  if(!base){
   this.destroyPreview();
   return;
  }

  if(!this.preview||this.previewMode!==this.mode){
   this.destroyPreview();
   this.createPreview(this.mode,base);
  }
  if(!this.preview)return;

  this.applyPreviewTransform(this.mode,base);
  this.previewValid=this.placementAllowed(base,this.mode);
  this.previewMaterial.color.setHex(this.previewValid?0x65d879:0xd85d57);
  this.previewMaterial.opacity=this.previewValid?.44:.34;
  this.preview.visible=true;
 }

 actionLabel(){
  if(this.mode==='raw')return 'PLACE LOG';
  const base=this.resolvedBase(this.mode);
  return `${base.snapKind?'SNAP':'PLACE'} ${this.modeLabel()}`;
 }

 placeCarriedLog(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return null;

  if(this.mode==='raw'){
   const placed=this.materials.placeCarried();
   if(placed)this.destroyPreview();
   return placed;
  }

  const base=this.resolvedBase(this.mode);
  if(!this.placementAllowed(base,this.mode))return null;

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
  this.destroyPreview();
  const placement=this.recordPlacement(this.mode,object,base,standable);
  this.clearAuthoredGrass(base.x,base.z,this.mode==='floor'?1.45:.95);
  return placement;
 }

 update(){
  this.updatePreview();
 }
}
