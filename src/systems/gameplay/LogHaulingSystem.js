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
  this.tempWorld=new THREE.Vector3();

  this.dragQuaternion=new THREE.Quaternion().setFromEuler(
   new THREE.Euler(0,Math.PI/2,0,'XYZ')
  );
  this.bottomLeft=new THREE.Vector3(-.29,.34,-1.30);
  this.bottomRight=new THREE.Vector3(.29,.34,-1.30);
  this.topCenter=new THREE.Vector3(0,.73,-1.30);
 }

 initialize(){
  if(!this.materials||!this.world)return;
  this.world.logHauling=this;
  this.materials.haulStack=this.stack;

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
   hud.textContent='PAIRING 2 LOGS · preparing drag';
   return;
  }
  if(this.transition?.phase==='merge3'){
   hud.textContent='STACKING 3RD LOG · preparing drag';
   return;
  }
  if(this.transition?.phase==='drop'){
   hud.textContent='RELEASING LOG STACK';
   return;
  }
  if(this.stack.length>=2){
   hud.textContent=`DRAGGING ${this.stack.length} LOGS · heavy haul`;
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

 prepareLog(item){
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
  this.player.updateWorldMatrix(true,false);
  item.object.updateWorldMatrix(true,false);
  this.player.attach(item.object);
  return true;
 }

 smooth01(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
 }

 beginAdd(item){
  if(!item||item.type!=='log'||item.state!=='loose'||this.isBusy())return false;

  const shoulder=this.materials?.carried?.type==='log'?this.materials.carried:null;
  if(shoulder&&this.stack.length===0){
   if(!this.prepareLog(shoulder)||!this.prepareLog(item))return false;
   this.materials.carried=null;
   this.stack.splice(0,this.stack.length,shoulder,item);

   const secondStart=item.object.position.clone();
   const pairY=Math.max(.30,secondStart.y);
   const pairSecond=new this.T.Vector3(secondStart.x,pairY,secondStart.z);
   const pairFirst=new this.T.Vector3(secondStart.x-.58,pairY,secondStart.z);

   this.transition={
    phase:'merge2',elapsed:0,duration:1.08,lockedYaw:this.player.rotation.y,
    first:shoulder,second:item,
    firstStart:shoulder.object.position.clone(),
    firstStartQ:shoulder.object.quaternion.clone(),
    secondStart:item.object.position.clone(),
    secondStartQ:item.object.quaternion.clone(),
    pairFirst,pairSecond,
    pairQ:item.object.quaternion.clone()
   };
   this.world?.playerVisual?.triggerPlace?.();
   this.updateHud();
   return true;
  }

  if(this.stack.length===2&&this.stack.length<this.maxLogs){
   if(!this.prepareLog(item))return false;
   this.stack.push(item);
   this.transition={
    phase:'merge3',elapsed:0,duration:.88,lockedYaw:this.player.rotation.y,
    third:item,
    thirdStart:item.object.position.clone(),
    thirdStartQ:item.object.quaternion.clone()
   };
   this.world?.playerVisual?.triggerPickup?.();
   this.updateHud();
   return true;
  }
  return false;
 }

 setPose(item,position,quaternion){
  if(!item?.object)return;
  item.object.position.copy(position);
  item.object.quaternion.copy(quaternion);
 }

 updateMerge2(t){
  const tr=this.transition;
  if(!tr)return;
  if(t<.56){
   const lower=this.smooth01(t/.56);
   tr.first.object.position.copy(tr.firstStart).lerp(tr.pairFirst,lower);
   tr.first.object.quaternion.copy(tr.firstStartQ).slerp(tr.pairQ,lower);
   tr.second.object.position.copy(tr.secondStart);
   tr.second.object.quaternion.copy(tr.secondStartQ);
   return;
  }

  const drag=this.smooth01((t-.56)/.44);
  tr.first.object.position.copy(tr.pairFirst).lerp(this.bottomLeft,drag);
  tr.first.object.quaternion.copy(tr.pairQ).slerp(this.dragQuaternion,drag);
  tr.second.object.position.copy(tr.pairSecond).lerp(this.bottomRight,drag);
  tr.second.object.quaternion.copy(tr.secondStartQ).slerp(this.dragQuaternion,drag);
 }

 updateMerge3(t){
  const tr=this.transition;
  if(!tr)return;
  this.setPose(this.stack[0],this.bottomLeft,this.dragQuaternion);
  this.setPose(this.stack[1],this.bottomRight,this.dragQuaternion);
  const lift=this.smooth01(t);
  tr.third.object.position.copy(tr.thirdStart).lerp(this.topCenter,lift);
  tr.third.object.quaternion.copy(tr.thirdStartQ).slerp(this.dragQuaternion,lift);
 }

 updateDrop(){
  if(this.stack.length>0)this.setPose(this.stack[0],this.bottomLeft,this.dragQuaternion);
  if(this.stack.length>1)this.setPose(this.stack[1],this.bottomRight,this.dragQuaternion);
  if(this.stack.length>2)this.setPose(this.stack[2],this.topCenter,this.dragQuaternion);
 }

 finishTransition(){
  const phase=this.transition?.phase;
  if(phase==='merge2'){
   this.setPose(this.stack[0],this.bottomLeft,this.dragQuaternion);
   this.setPose(this.stack[1],this.bottomRight,this.dragQuaternion);
  }else if(phase==='merge3'){
   this.setPose(this.stack[0],this.bottomLeft,this.dragQuaternion);
   this.setPose(this.stack[1],this.bottomRight,this.dragQuaternion);
   this.setPose(this.stack[2],this.topCenter,this.dragQuaternion);
  }else if(phase==='drop'){
   this.releaseToWorld();
  }
  this.transition=null;
  this.updateHud();
 }

 beginDrop(){
  if(this.stack.length<2||this.isBusy())return false;
  this.transition={phase:'drop',elapsed:0,duration:.48,lockedYaw:this.player.rotation.y};
  this.world?.playerVisual?.triggerPlace?.();
  this.updateHud();
  return true;
 }

 releaseToWorld(){
  const T=this.T;
  const worldPos=new T.Vector3();
  const worldQ=new T.Quaternion();
  const released=[...this.stack];

  for(const item of released){
   if(!item?.object)continue;
   item.object.updateWorldMatrix(true,false);
   item.object.getWorldPosition(worldPos);
   item.object.getWorldQuaternion(worldQ);
   this.materials.root.attach(item.object);
   item.object.position.copy(worldPos);
   item.object.quaternion.copy(worldQ);
   item.state='loose';
   item.carryMotion=null;
   if(item.physics){
    item.physics.active=false;
    item.physics.vx=item.physics.vy=item.physics.vz=0;
    item.physics.spinY=item.physics.rollSpeed=0;
    item.physics.settleTimer=0;
    item.physics.grounded=false;
    item.physics.headingY=item.object.rotation.y;
   }
  }
  this.stack.length=0;
 }

 update(dt){
  const tr=this.transition;
  if(!tr)return;
  if(this.player&&Number.isFinite(tr.lockedYaw))this.player.rotation.y=tr.lockedYaw;
  tr.elapsed=Math.min(tr.duration,tr.elapsed+dt);
  const t=tr.elapsed/tr.duration;

  if(tr.phase==='merge2')this.updateMerge2(t);
  else if(tr.phase==='merge3')this.updateMerge3(t);
  else if(tr.phase==='drop')this.updateDrop(t);

  if(t>=1)this.finishTransition();
 }

 dragPoseTargets(count=this.stack.length){
  const lift=count>=3?.08:0;
  return {
   l:{elbow:{x:.48,y:1.08+lift,z:-.02},hand:{x:.27,y:.72+lift,z:.08}},
   r:{elbow:{x:-.48,y:1.08+lift,z:-.02},hand:{x:-.27,y:.72+lift,z:.08}}
  };
 }

 updateVisual(dt,moveAmount=0){
  const visual=this.world?.playerVisual;
  if(!visual?.loaded||!visual.poseArm)return;
  const type=this.visualCarryType();
  if(!type)return;

  const count=Math.max(2,this.stack.length);
  if((type==='drag2'||type==='drag3')&&visual.actions?.size){
   if(moveAmount<.06)visual.play?.(visual.actions.has('Idle_A')?'Idle_A':'Idle',.12,.78);
   else visual.play?.(visual.actions.has('Walking_A')?'Walking_A':'Walking',.12,count>=3?.38:.46);
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
   const reachL={elbow:{x:.50,y:.98,z:.48},hand:{x:.20,y:.55,z:.76}};
   const reachR={elbow:{x:-.50,y:.98,z:.48},hand:{x:-.20,y:.55,z:.76}};
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
