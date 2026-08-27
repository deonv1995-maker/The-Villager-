export class LogHaulingSystem{
 constructor(THREE,{world,player,materials,playerController=null}){
  this.T=THREE;
  this.world=world;
  this.player=player;
  this.materials=materials;
  this.playerController=playerController;

  this.maxLogs=3;
  this.pickupRange=2.65;
  this.stack=[];
  this.transition=null;
  this.originalUpdateHud=null;
  this.originalMovementWeightScale=null;

  // The centre of a dragged log sits far enough behind the Ranger that its front
  // end stays clear of his legs. Two rope strands make the distance read as an
  // intentional tow rather than logs attached directly to his body.
  this.dragCenterDistance=2.62;
  this.dragSideOffset=.31;
  this.topStackLift=.44;
  this.dragFollowSpeed=14;
  this.dragTiltSpeed=16;

  this.tempWorld=new THREE.Vector3();
  this.tempWorld2=new THREE.Vector3();
  this.tempWorld3=new THREE.Vector3();
  this.tempQuat=new THREE.Quaternion();
  this.tempQuat2=new THREE.Quaternion();
  this.tempDirection=new THREE.Vector3();
  this.tempMidpoint=new THREE.Vector3();
  this.worldUp=new THREE.Vector3(0,1,0);

  this.ropeRoot=new THREE.Group();
  this.ropeRoot.name='LogTowRopes';
  this.ropeGeometry=new THREE.CylinderGeometry(.024,.024,1,6,1,false);
  this.ropeMaterial=new THREE.MeshLambertMaterial({color:0x765638});
  this.ropeLeft=new THREE.Mesh(this.ropeGeometry,this.ropeMaterial);
  this.ropeRight=new THREE.Mesh(this.ropeGeometry,this.ropeMaterial);
  for(const rope of [this.ropeLeft,this.ropeRight]){
   rope.castShadow=false;
   rope.receiveShadow=false;
   rope.visible=false;
   this.ropeRoot.add(rope);
  }
 }

 initialize(){
  if(!this.materials||!this.world)return;
  this.world.logHauling=this;
  this.materials.haulStack=this.stack;
  this.materials.root?.add?.(this.ropeRoot);

  if(this.materials.updateHud){
   this.originalUpdateHud=this.materials.updateHud.bind(this.materials);
   this.materials.updateHud=()=>this.updateHud();
  }

  if(this.playerController?.movementWeightScale){
   this.originalMovementWeightScale=this.playerController.movementWeightScale.bind(this.playerController);
   this.playerController.movementWeightScale=()=>{
    if(this.isBusy())return 0;
    if(this.stack.length>=3)return .34;
    if(this.stack.length===2)return .42;
    return this.originalMovementWeightScale();
   };
  }
  this.updateHud();
 }

 count(){return this.stack.length;}
 isDragging(){return this.stack.length>=2&&!this.transition;}
 isBusy(){return !!this.transition;}
 visualCarryType(){
  if(this.transition?.phase==='merge2')return 'haul-merge2';
  if(this.transition?.phase==='merge3')return 'haul-merge3';
  if(this.transition?.phase==='drop')return 'haul-drop';
  if(this.stack.length===2)return 'drag2';
  if(this.stack.length===3)return 'drag3';
  return null;
 }
 busyLabel(){
  if(this.transition?.phase==='merge2')return 'PAIRING LOGS';
  if(this.transition?.phase==='merge3')return 'STACKING THIRD';
  if(this.transition?.phase==='drop')return 'RELEASING STACK';
  return 'WORKING';
 }

 updateHud(){
  const hud=this.materials?.hudRoot;
  if(!hud)return;
  if(this.transition?.phase==='merge2'){
   hud.textContent='PAIRING 2 LOGS · preparing tow';
   return;
  }
  if(this.transition?.phase==='merge3'){
   hud.textContent='STACKING 3RD LOG · preparing tow';
   return;
  }
  if(this.transition?.phase==='drop'){
   hud.textContent='RELEASING LOG STACK';
   return;
  }
  if(this.stack.length>=2){
   hud.textContent=`TOWING ${this.stack.length} LOGS · rope haul`;
   return;
  }
  this.originalUpdateHud?.();
 }

 nearestLooseLog(){
  if(!this.player||this.isBusy())return null;
  const px=this.player.position.x,pz=this.player.position.z;
  const yaw=this.player.rotation.y;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  let best=null,bestScore=Infinity;

  for(const item of this.materials?.items||[]){
   if(item.type!=='log'||item.state!=='loose'||!item.object?.parent)continue;
   item.object.getWorldPosition(this.tempWorld);
   const dx=this.tempWorld.x-px,dz=this.tempWorld.z-pz;
   const distance=Math.hypot(dx,dz);
   if(distance>this.pickupRange)continue;
   const dot=(dx*fx+dz*fz)/Math.max(.001,distance);
   if(distance>1.10&&dot<-.18)continue;
   const score=distance-dot*.30;
   if(score<bestScore){best=item;bestScore=score;}
  }
  return best;
 }

 addCandidate(){
  if(this.isBusy())return null;
  const shoulderLog=this.materials?.carried?.type==='log'?this.materials.carried:null;
  if(shoulderLog&&this.stack.length===0&&!shoulderLog.carryMotion)return this.nearestLooseLog();
  if(this.stack.length>=2&&this.stack.length<this.maxLogs)return this.nearestLooseLog();
  return null;
 }

 prepareLogWorld(item){
  if(!item?.object)return false;
  if(item.physics){
   item.physics.active=false;
   item.physics.vx=item.physics.vy=item.physics.vz=0;
   item.physics.spinY=item.physics.rollSpeed=0;
   item.physics.settleTimer=0;
   item.physics.grounded=false;
  }
  this.materials.resetLogVisualRoll?.(item);
  item.carryMotion=null;
  item.state='hauled';
  item.object.updateWorldMatrix(true,false);
  this.materials.root.attach(item.object);
  return true;
 }

 smooth01(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
 }

 dragFrame(){
  const yaw=this.player.rotation.y;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  const rx=Math.cos(yaw),rz=-Math.sin(yaw);
  return {
   yaw,fx,fz,rx,rz,
   heading:yaw-Math.PI/2,
   centerX:this.player.position.x-fx*this.dragCenterDistance,
   centerZ:this.player.position.z-fz*this.dragCenterDistance
  };
 }

 terrainTarget(item,x,z,heading,lift=0){
  if(item.physics)item.physics.headingY=heading;
  const y=this.materials.computeTerrainLogPose?.(item,x,z)
   ??((this.world?.heightAt?.(x,z)??0)+(this.materials.logRadius||.27));
  const quaternion=this.materials.tempLogQuaternion?.clone?.()||new this.T.Quaternion();
  return {position:new this.T.Vector3(x,y+lift,z),quaternion};
 }

 dragTargets(){
  const frame=this.dragFrame();
  const leftX=frame.centerX-frame.rx*this.dragSideOffset;
  const leftZ=frame.centerZ-frame.rz*this.dragSideOffset;
  const rightX=frame.centerX+frame.rx*this.dragSideOffset;
  const rightZ=frame.centerZ+frame.rz*this.dragSideOffset;
  const targets=[];

  if(this.stack[0])targets[0]=this.terrainTarget(this.stack[0],leftX,leftZ,frame.heading);
  if(this.stack[1])targets[1]=this.terrainTarget(this.stack[1],rightX,rightZ,frame.heading);
  if(this.stack[2]){
   const centerTarget=this.terrainTarget(this.stack[2],frame.centerX,frame.centerZ,frame.heading);
   const lowerY=Math.max(targets[0]?.position.y??centerTarget.position.y,targets[1]?.position.y??centerTarget.position.y);
   centerTarget.position.y=Math.max(centerTarget.position.y,lowerY+this.topStackLift);
   targets[2]=centerTarget;
  }
  return {frame,targets};
 }

 transitionTargetNearSecond(item,centerX,centerZ,heading,side){
  const yaw=heading+Math.PI/2;
  const rx=Math.cos(yaw),rz=-Math.sin(yaw);
  return this.terrainTarget(item,centerX+rx*side,centerZ+rz*side,heading);
 }

 beginAdd(item){
  if(!item||item.type!=='log'||item.state!=='loose'||this.isBusy())return false;

  const shoulder=this.materials?.carried?.type==='log'?this.materials.carried:null;
  if(shoulder&&this.stack.length===0){
   item.object.getWorldPosition(this.tempWorld);
   const secondX=this.tempWorld.x,secondZ=this.tempWorld.z;
   if(!this.prepareLogWorld(shoulder)||!this.prepareLogWorld(item))return false;
   this.materials.carried=null;
   this.stack.splice(0,this.stack.length,shoulder,item);

   const frame=this.dragFrame();
   const pairFirst=this.transitionTargetNearSecond(shoulder,secondX,secondZ,frame.heading,-this.dragSideOffset);
   const pairSecond=this.transitionTargetNearSecond(item,secondX,secondZ,frame.heading,this.dragSideOffset);
   const drag=this.dragTargets();

   this.transition={
    phase:'merge2',elapsed:0,duration:1.12,lockedYaw:this.player.rotation.y,
    first:shoulder,second:item,
    firstStart:shoulder.object.position.clone(),firstStartQ:shoulder.object.quaternion.clone(),
    secondStart:item.object.position.clone(),secondStartQ:item.object.quaternion.clone(),
    pairFirst,pairSecond,
    dragFirst:drag.targets[0],dragSecond:drag.targets[1]
   };
   this.world?.playerVisual?.triggerPlace?.();
   this.setRopesVisible(false);
   this.updateHud();
   return true;
  }

  if(this.stack.length===2&&this.stack.length<this.maxLogs){
   item.object.getWorldPosition(this.tempWorld);
   if(!this.prepareLogWorld(item))return false;
   this.stack.push(item);
   const drag=this.dragTargets();
   this.transition={
    phase:'merge3',elapsed:0,duration:.92,lockedYaw:this.player.rotation.y,
    third:item,
    thirdStart:item.object.position.clone(),
    thirdStartQ:item.object.quaternion.clone(),
    thirdTarget:drag.targets[2]
   };
   this.world?.playerVisual?.triggerPickup?.();
   this.setRopesVisible(false);
   this.updateHud();
   return true;
  }
  return false;
 }

 lerpPose(item,start,startQ,target,t){
  if(!item?.object||!target)return;
  item.object.position.copy(start).lerp(target.position,t);
  item.object.quaternion.copy(startQ).slerp(target.quaternion,t);
 }

 updateMerge2(t){
  const tr=this.transition;
  if(!tr)return;
  if(t<.56){
   const lower=this.smooth01(t/.56);
   this.lerpPose(tr.first,tr.firstStart,tr.firstStartQ,tr.pairFirst,lower);
   this.lerpPose(tr.second,tr.secondStart,tr.secondStartQ,tr.pairSecond,lower);
   return;
  }

  const drag=this.smooth01((t-.56)/.44);
  this.lerpPose(tr.first,tr.pairFirst.position,tr.pairFirst.quaternion,tr.dragFirst,drag);
  this.lerpPose(tr.second,tr.pairSecond.position,tr.pairSecond.quaternion,tr.dragSecond,drag);
 }

 updateMerge3(t){
  const tr=this.transition;
  if(!tr)return;
  const stable=this.dragTargets();
  if(stable.targets[0]){
   this.stack[0].object.position.copy(stable.targets[0].position);
   this.stack[0].object.quaternion.copy(stable.targets[0].quaternion);
  }
  if(stable.targets[1]){
   this.stack[1].object.position.copy(stable.targets[1].position);
   this.stack[1].object.quaternion.copy(stable.targets[1].quaternion);
  }
  const lift=this.smooth01(t);
  this.lerpPose(tr.third,tr.thirdStart,tr.thirdStartQ,tr.thirdTarget,lift);
 }

 updateDrop(){
  this.updateDraggedStack(0,true);
 }

 finishTransition(){
  const phase=this.transition?.phase;
  if(phase==='merge2'||phase==='merge3')this.updateDraggedStack(0,true);
  else if(phase==='drop')this.releaseToWorld();
  this.transition=null;
  this.setRopesVisible(this.stack.length>=2);
  this.updateHud();
 }

 beginDrop(){
  if(this.stack.length<2||this.isBusy())return false;
  this.transition={phase:'drop',elapsed:0,duration:.42,lockedYaw:this.player.rotation.y};
  this.world?.playerVisual?.triggerPlace?.();
  this.setRopesVisible(false);
  this.updateHud();
  return true;
 }

 releaseToWorld(){
  for(const item of this.stack){
   if(!item?.object)continue;
   item.state='loose';
   item.carryMotion=null;
   if(item.physics){
    item.physics.active=false;
    item.physics.vx=item.physics.vy=item.physics.vz=0;
    item.physics.spinY=item.physics.rollSpeed=0;
    item.physics.settleTimer=0;
    item.physics.grounded=true;
   }
  }
  this.stack.length=0;
  this.setRopesVisible(false);
 }

 updateDraggedStack(dt,snap=false){
  if(this.stack.length<2)return;
  const {targets}=this.dragTargets();
  const positionBlend=snap||dt<=0?1:(1-Math.exp(-this.dragFollowSpeed*dt));
  const tiltBlend=snap||dt<=0?1:(1-Math.exp(-this.dragTiltSpeed*dt));

  for(let i=0;i<this.stack.length;i++){
   const item=this.stack[i],target=targets[i];
   if(!item?.object||!target)continue;
   item.object.position.x+=(target.position.x-item.object.position.x)*positionBlend;
   item.object.position.z+=(target.position.z-item.object.position.z)*positionBlend;

   // Height is snapped directly to terrain support every frame so a smoothed tow
   // can never sink through a crest or clip into an uphill face.
   if(i<2){
    const heading=this.dragFrame().heading;
    if(item.physics)item.physics.headingY=heading;
    const support=this.materials.computeTerrainLogPose?.(item,item.object.position.x,item.object.position.z)
     ??target.position.y;
    item.object.position.y=support;
    const groundQ=this.materials.tempLogQuaternion?.clone?.()||target.quaternion;
    item.object.quaternion.slerp(groundQ,tiltBlend);
   }else{
    const lowerY=Math.max(this.stack[0]?.object?.position?.y??target.position.y,this.stack[1]?.object?.position?.y??target.position.y);
    item.object.position.y=Math.max(target.position.y,lowerY+this.topStackLift);
    item.object.quaternion.slerp(target.quaternion,tiltBlend);
   }
  }
  this.updateRopes();
 }

 setCylinderBetween(mesh,a,b){
  if(!mesh)return;
  this.tempDirection.copy(b).sub(a);
  const length=this.tempDirection.length();
  if(length<.02){mesh.visible=false;return;}
  mesh.visible=true;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.scale.set(1,length,1);
  this.tempDirection.multiplyScalar(1/length);
  mesh.quaternion.setFromUnitVectors(this.worldUp,this.tempDirection);
 }

 setRopesVisible(visible){
  this.ropeLeft.visible=!!visible;
  this.ropeRight.visible=!!visible;
 }

 updateRopes(){
  if(this.stack.length<2||this.transition){this.setRopesVisible(false);return;}
  const frame=this.dragFrame();
  const half=this.materials.logHalfLength||1.45;
  const playerY=this.player.position.y;

  const sourceL=this.tempWorld.set(
   this.player.position.x-frame.fx*.30-frame.rx*.16,
   playerY+.78,
   this.player.position.z-frame.fz*.30-frame.rz*.16
  );
  const sourceR=this.tempWorld2.set(
   this.player.position.x-frame.fx*.30+frame.rx*.16,
   playerY+.78,
   this.player.position.z-frame.fz*.30+frame.rz*.16
  );

  const left=this.stack[0]?.object,right=this.stack[1]?.object;
  if(!left||!right){this.setRopesVisible(false);return;}
  const endL=this.tempWorld3.set(
   left.position.x+frame.fx*half,
   left.position.y+.08,
   left.position.z+frame.fz*half
  );
  const endR=new this.T.Vector3(
   right.position.x+frame.fx*half,
   right.position.y+.08,
   right.position.z+frame.fz*half
  );
  this.setCylinderBetween(this.ropeLeft,sourceL,endL);
  this.setCylinderBetween(this.ropeRight,sourceR,endR);
 }

 update(dt){
  const tr=this.transition;
  if(tr){
   if(this.player&&Number.isFinite(tr.lockedYaw))this.player.rotation.y=tr.lockedYaw;
   tr.elapsed=Math.min(tr.duration,tr.elapsed+dt);
   const t=tr.elapsed/tr.duration;

   if(tr.phase==='merge2')this.updateMerge2(t);
   else if(tr.phase==='merge3')this.updateMerge3(t);
   else if(tr.phase==='drop')this.updateDrop(t);

   if(t>=1)this.finishTransition();
   return;
  }
  if(this.stack.length>=2)this.updateDraggedStack(dt,false);
 }

 dragPoseTargets(count=this.stack.length){
  const lift=count>=3?.06:0;
  return {
   l:{elbow:{x:.48,y:1.14+lift,z:-.18},hand:{x:.24,y:.80+lift,z:-.42}},
   r:{elbow:{x:-.48,y:1.14+lift,z:-.18},hand:{x:-.24,y:.80+lift,z:-.42}}
  };
 }

 updateVisual(dt,moveAmount=0){
  const visual=this.world?.playerVisual;
  if(!visual?.loaded||!visual.poseArm)return;
  const type=this.visualCarryType();
  if(!type)return;

  const count=Math.max(2,this.stack.length);
  if((type==='drag2'||type==='drag3')&&visual.actions?.size){
   if(moveAmount<.06)visual.play?.(visual.actions.has('Idle_A')?'Idle_A':'Idle',.12,.76);
   else visual.play?.(visual.actions.has('Walking_A')?'Walking_A':'Walking',.12,count>=3?.36:.44);
  }

  const drag=this.dragPoseTargets(count);
  if(type==='haul-merge2'&&this.transition){
   const t=this.smooth01(this.transition.elapsed/this.transition.duration);
   const carry=visual.carryPoseTargets?.();
   if(carry&&visual.mixPoint){
    visual.poseArm('l',visual.mixPoint(carry.l.elbow,drag.l.elbow,t),visual.mixPoint(carry.l.hand,drag.l.hand,t),.99);
    visual.poseArm('r',visual.mixPoint(carry.r.elbow,drag.r.elbow,t),visual.mixPoint(carry.r.hand,drag.r.hand,t),.99);
   }else{
    visual.poseArm('l',drag.l.elbow,drag.l.hand,.99);
    visual.poseArm('r',drag.r.elbow,drag.r.hand,.99);
   }
  }else if(type==='haul-merge3'&&this.transition){
   const t=this.smooth01(this.transition.elapsed/this.transition.duration);
   const reachL={elbow:{x:.50,y:.98,z:.34},hand:{x:.20,y:.55,z:.60}};
   const reachR={elbow:{x:-.50,y:.98,z:.34},hand:{x:-.20,y:.55,z:.60}};
   const mix=visual.mixPoint?.bind(visual);
   visual.poseArm('l',mix?mix(reachL.elbow,drag.l.elbow,t):drag.l.elbow,mix?mix(reachL.hand,drag.l.hand,t):drag.l.hand,.99);
   visual.poseArm('r',mix?mix(reachR.elbow,drag.r.elbow,t):drag.r.elbow,mix?mix(reachR.hand,drag.r.hand,t):drag.r.hand,.99);
  }else{
   visual.poseArm('l',drag.l.elbow,drag.l.hand,.99);
   visual.poseArm('r',drag.r.elbow,drag.r.hand,.99);
  }
  visual.model?.updateMatrixWorld?.(true);
 }
}
