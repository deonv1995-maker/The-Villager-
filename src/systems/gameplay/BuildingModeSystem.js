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

  this.logLength=this.materials?.logLength??2.90;
  this.logHalfLength=this.logLength*.5;

  // Three split-log floor strips make one full log-width structural bay. This
  // means the frame grid can be the same width in both directions while still
  // requiring actual floor material underneath every ground-story post.
  this.floorWidth=this.logLength/3;
  this.floorHalfLength=this.logHalfLength;
  this.floorHalfWidth=this.floorWidth*.5;
  this.floorSplitOffset=this.floorWidth*.25;

  this.frameCenterOffset=this.logHalfLength+.01;
  this.floorSnapRange=1.45;
  this.frameSnapRange=1.55;
  this.wallSnapRange=1.70;
  this.angleSnapRange=1.85;
  this.rawBeamSnapRange=1.95;
  this.angleHalfProjection=this.logHalfLength*Math.SQRT1_2;

  this.frameColumnRadius=.34;
  this.frameOccupancyRadius=.28;
  this.frameSpacingTolerance=.14;
  this.wallStackRadius=.34;
  this.wallHeightTolerance=.08;

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

 activePlacements(mode=null){
  return this.placements.filter(p=>p.object?.parent&&(!mode||p.mode===mode));
 }

 frameColumns(){
  const columns=[];
  for(const frame of this.activePlacements('frame')){
   let column=null;
   for(const existing of columns){
    if(Math.hypot(existing.x-frame.x,existing.z-frame.z)<=this.frameColumnRadius){
     column=existing;
     break;
    }
   }
   if(!column){
    column={
     x:frame.x,z:frame.z,
     minY:frame.minY,maxY:frame.maxY,
     bottomId:frame.id,topId:frame.id,
     frames:[frame]
    };
    columns.push(column);
   }else{
    column.frames.push(frame);
    if(frame.minY<column.minY){column.minY=frame.minY;column.bottomId=frame.id;}
    if(frame.maxY>column.maxY){column.maxY=frame.maxY;column.topId=frame.id;}
   }
  }
  return columns;
 }

 floorCornerCandidates(floor){
  const b=this.basis(floor.yaw);
  const result=[];
  for(const sx of [-1,1]){
   for(const sz of [-1,1]){
    result.push({
     x:floor.x+b.xX*this.floorHalfLength*sx+b.zX*this.floorHalfWidth*sz,
     z:floor.z+b.xZ*this.floorHalfLength*sx+b.zZ*this.floorHalfWidth*sz,
     floor
    });
   }
  }
  return result;
 }

 foundationFrames(){
  return this.activePlacements('frame').filter(frame=>frame.snapKind==='floor-corner');
 }

 floorFrameCandidates(base){
  const candidates=[];
  const foundationFrames=this.foundationFrames();

  for(const floor of this.activePlacements('floor')){
   for(const corner of this.floorCornerCandidates(floor)){
    const occupied=this.activePlacements('frame').some(frame=>
     Math.hypot(frame.x-corner.x,frame.z-corner.z)<=this.frameOccupancyRadius&&
     Math.abs(frame.minY-floor.maxY)<=.40
    );
    if(occupied)continue;

    // The very first post may use any floor corner. After that, every foundation
    // post must be exactly one full raw-log length from an existing foundation
    // post. Because three floor strips equal one log width, the bay is square in
    // both directions instead of becoming narrow on one side.
    if(foundationFrames.length){
     const oneLogAway=foundationFrames.some(frame=>
      Math.abs(Math.hypot(frame.x-corner.x,frame.z-corner.z)-this.logLength)<=this.frameSpacingTolerance
     );
     if(!oneLogAway)continue;
    }

    candidates.push({
     x:corner.x,z:corner.z,yaw:base.yaw,
     baseY:floor.maxY,
     ground:floor.maxY,
     snapKind:'floor-corner',
     anchorIds:[floor.id]
    });
   }
  }
  return candidates;
 }

 playerClearForPlacement(mode,base){
  if(!this.player||!base)return true;
  if(mode!=='frame'&&mode!=='wall')return true;

  const px=this.player.position.x;
  const pz=this.player.position.z;
  if(mode==='frame'){
   const frameBaseY=Number.isFinite(base.baseY)?base.baseY:base.ground;
   const playerHeadY=this.player.position.y+(this.world?.playerCollisionHeight??2.15);
   if(frameBaseY>playerHeadY+.06)return true;
   const radius=this.framePlacementRadius+this.playerBuildClearance;
   return Math.hypot(px-base.x,pz-base.z)>radius;
  }

  const wallCenterY=this.wallBaseHeight(base);
  const wallBottomY=wallCenterY-.28;
  const playerHeadY=this.player.position.y+(this.world?.playerCollisionHeight??2.15);
  if(wallBottomY>playerHeadY+.06)return true;

  const b=this.basis(base.yaw||0);
  const dx=px-base.x,dz=pz-base.z;
  const localX=dx*b.xX+dz*b.xZ;
  const localZ=dx*b.zX+dz*b.zZ;
  const halfX=this.logHalfLength+this.playerBuildClearance;
  const halfZ=this.wallPlacementHalfThickness+this.playerBuildClearance;
  return Math.abs(localX)>halfX||Math.abs(localZ)>halfZ;
 }

 wallTopOffset(){
  for(const placement of this.activePlacements('wall')){
   const offset=placement.maxY-placement.object.position.y;
   if(Number.isFinite(offset)&&offset>.2)return offset;
  }
  return .78;
 }

 wallBaseHeight(base){
  let highestTop=-Infinity;
  for(const placement of this.activePlacements('wall')){
   if(this.axisYawDelta(placement.yaw,base.yaw)>.14)continue;
   if(Math.hypot(placement.x-base.x,placement.z-base.z)>this.wallStackRadius)continue;
   if(Number.isFinite(placement.maxY))highestTop=Math.max(highestTop,placement.maxY);
  }
  return Number.isFinite(highestTop)?highestTop+.02:base.ground+.26;
 }

 wallFitsFrameHeight(base){
  if(!Number.isFinite(base?.maxWallY))return false;
  const nextTop=this.wallBaseHeight(base)+this.wallTopOffset();
  return nextTop<=base.maxWallY+this.wallHeightTolerance;
 }

 placementAllowed(base,mode=this.mode){
  if(!base)return false;
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(base.x,base.z))return false;
  if(this.world?.environment?.terrainClearance?.(base.x,base.z)&&!base.snapKind)return false;

  if(mode==='frame'){
   if(base.snapKind!=='floor-corner'&&base.snapKind!=='beam-top')return false;
  }
  if(mode==='wall'&&!this.wallFitsFrameHeight(base))return false;
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
  for(const floor of this.activePlacements('floor')){
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

 beamSupportCandidates(base){
  const columns=this.frameColumns();
  const candidates=[];

  // A beam between two posts terminates at their centre lines and its own centre
  // line drops to the exact top of the posts. The logs therefore visually joint
  // into one another instead of hovering above the vertical frame.
  for(let i=0;i<columns.length;i++){
   const a=columns[i];
   for(let j=i+1;j<columns.length;j++){
    const b=columns[j];
    const dx=b.x-a.x,dz=b.z-a.z;
    const distance=Math.hypot(dx,dz);
    if(Math.abs(distance-this.logLength)>this.frameSpacingTolerance)continue;
    if(Math.abs(a.maxY-b.maxY)>.30)continue;
    const x=(a.x+b.x)*.5;
    const z=(a.z+b.z)*.5;
    const yaw=this.snapYaw(Math.atan2(-dz,dx));
    const jointY=(a.maxY+b.maxY)*.5;
    candidates.push({
     x,z,yaw,rotationY:yaw,
     centerY:jointY,y:jointY,
     ground:this.world.heightAt(x,z),
     snapKind:'frame-pair-top',
     anchorIds:[a.topId,b.topId]
    });
   }
  }

  // Single-post beam placement remains available for extensions, but pair spans
  // are preferred because they establish the clean structural bay automatically.
  for(const column of columns){
   candidates.push({
    x:column.x,z:column.z,
    yaw:base.yaw,rotationY:base.rotationY??base.yaw,
    centerY:column.maxY,y:column.maxY,
    ground:this.world.heightAt(column.x,column.z),
    snapKind:'frame-top-beam',
    anchorIds:[column.topId],
    penalty:.22
   });
  }
  return candidates;
 }

 rawSnapBase(base){
  if(!base)return null;
  return this.chooseCandidate(base,this.beamSupportCandidates(base),this.rawBeamSnapRange);
 }

 frameSnapBase(base){
  const candidates=[...this.floorFrameCandidates(base)];

  // Upper posts start at the beam centre line, not on top of the beam's outer
  // surface. The lower end of the vertical log therefore passes into the raw beam
  // and creates a seamless timber joint.
  for(const beam of this.activePlacements('beam')){
   const b=this.basis(beam.yaw);
   const points=beam.snapKind==='frame-pair-top'
    ?[
      {x:beam.x+b.xX*this.logHalfLength,z:beam.z+b.xZ*this.logHalfLength},
      {x:beam.x-b.xX*this.logHalfLength,z:beam.z-b.xZ*this.logHalfLength}
     ]
    :[{x:beam.x,z:beam.z}];

   for(const point of points){
    const occupied=this.activePlacements('frame').some(frame=>
     Math.hypot(frame.x-point.x,frame.z-point.z)<=this.frameOccupancyRadius&&
     frame.minY>=beam.centerY-.12
    );
    if(occupied)continue;
    candidates.push({
     x:point.x,z:point.z,yaw:base.yaw,
     baseY:beam.centerY,
     ground:beam.centerY,
     snapKind:'beam-top',
     anchorIds:[beam.id]
    });
   }
  }

  return this.chooseCandidate(base,candidates,this.frameSnapRange);
 }

 wallPairCandidates(base){
  const columns=this.frameColumns();
  const candidates=[];
  for(let i=0;i<columns.length;i++){
   const a=columns[i];
   for(let j=i+1;j<columns.length;j++){
    const b=columns[j];
    const dx=b.x-a.x,dz=b.z-a.z;
    const distance=Math.hypot(dx,dz);
    if(Math.abs(distance-this.logLength)>this.frameSpacingTolerance+.06)continue;

    const x=(a.x+b.x)*.5;
    const z=(a.z+b.z)*.5;
    if(Math.hypot(x-base.x,z-base.z)>this.wallSnapRange)continue;
    const yaw=Math.atan2(-dz,dx);
    candidates.push({
     x,z,
     yaw:this.snapYaw(yaw),
     ground:Math.max(a.minY,b.minY),
     maxWallY:Math.min(a.maxY,b.maxY),
     snapKind:'between-frames',
     anchorIds:[a.topId,b.topId],
     penalty:Math.abs(distance-this.logLength)*.30
    });
   }
  }
  return candidates;
 }

 wallSnapBase(base){
  const between=this.chooseCandidate(base,this.wallPairCandidates(base),this.wallSnapRange+.14);
  if(between.snapKind)return between;
  return base;
 }

 angleSnapBase(base){
  const candidates=[];
  const directionYaw=base.yaw;
  const forwardX=Math.sin(directionYaw);
  const forwardZ=Math.cos(directionYaw);

  for(const column of this.frameColumns()){
   const x=column.x+forwardX*this.angleHalfProjection;
   const z=column.z+forwardZ*this.angleHalfProjection;
   candidates.push({
    x,z,
    yaw:directionYaw,
    ground:this.world.heightAt(x,z),
    centerY:column.maxY+this.angleHalfProjection,
    snapKind:'frame-top',
    anchorIds:[column.topId]
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
  const group=new this.T.Group();
  group.name='SplitLogFloor';
  for(const offset of [-this.floorSplitOffset,this.floorSplitOffset]){
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
  const group=new this.T.Group();
  group.name='UprightLogFrame';
  const log=this.materials.makeLogVisual();
  log.rotation.z=Math.PI/2;
  group.add(log);
  const baseY=Number.isFinite(base.baseY)?base.baseY:base.ground;
  group.position.set(base.x,baseY+this.frameCenterOffset,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 makeBeam(base){
  const group=this.materials.makeLogVisual();
  group.name='StructuralRawBeam';
  const y=Number.isFinite(base.centerY)?base.centerY:base.y;
  group.position.set(base.x,y,base.z);
  group.rotation.y=base.rotationY??base.yaw??0;
  return group;
 }

 makeWall(base){
  const group=new this.T.Group();
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
  const group=new this.T.Group();
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
  if(this.mode==='raw')return this.rawSnapBase(this.rawPreviewBase());
  return this.resolvedBase(this.mode);
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
  if(mode==='raw')object=this.makeBeam(base);
  else if(mode==='floor')object=this.makeFloor(base);
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
   const y=Number.isFinite(base.centerY)?base.centerY:base.y;
   object.position.set(base.x,y,base.z);
   object.rotation.set(0,base.rotationY??base.yaw??0,0);
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
  if(this.mode==='raw'){
   const base=this.rawSnapBase(this.rawPreviewBase());
   return base?.snapKind?'SNAP BEAM':'PLACE LOG';
  }

  const base=this.resolvedBase(this.mode);
  if(this.mode==='frame'&&!base.snapKind)return 'NEEDS FLOOR/BEAM';
  if(this.mode==='wall'&&!base.snapKind)return 'NEEDS FRAMES';
  if(this.mode==='wall'&&!this.wallFitsFrameHeight(base))return 'WALL FULL';
  return `${base.snapKind?'SNAP':'PLACE'} ${this.modeLabel()}`;
 }

 placeCarriedLog(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return null;

  if(this.mode==='raw'){
   const base=this.rawSnapBase(this.rawPreviewBase());
   if(base?.snapKind){
    if(!this.placementAllowed(base,'raw'))return null;
    const object=this.makeBeam(base);
    if(!this.consumeCarriedLog())return null;
    this.destroyPreview();
    return this.recordPlacement('beam',object,base,false);
   }
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
  }else if(this.mode==='frame')object=this.makeFrame(base);
  else if(this.mode==='wall')object=this.makeWall(base);
  else if(this.mode==='angle')object=this.makeAngle(base);
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
