import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class KayKitPlayerVisual{
 constructor(THREE,{modelUrl,modelUrls,movementUrl,movementUrls,generalUrl,generalUrls,targetHeight=2.7,facingYaw=Math.PI}){
  this.T=THREE;
  this.modelUrls=this.normalize(modelUrls??modelUrl);
  this.movementUrls=this.normalize(movementUrls??movementUrl);
  this.generalUrls=this.normalize(generalUrls??generalUrl);
  this.targetHeight=targetHeight;
  this.facingYaw=facingYaw;
  this.root=new THREE.Group();
  this.root.name='KayKitRangerVisual';
  this.model=null;
  this.mixer=null;
  this.actions=new Map();
  this.active=null;
  this.loaded=false;
  this.jumpActionName=null;
  this.chopActionName=null;
  this.pickupActionName=null;
  this.placeActionName=null;
  this.chopDuration=.56;
  this.pickupDuration=.82;
  this.placeDuration=.72;
  this.chopTimer=0;
  this.pickupTimer=0;
  this.placeTimer=0;
  this.carryingType=null;
  this.bones=new Map();

  this.tmpV1=new THREE.Vector3();
  this.tmpV2=new THREE.Vector3();
  this.tmpV3=new THREE.Vector3();
  this.tmpQ1=new THREE.Quaternion();
  this.tmpQ2=new THREE.Quaternion();
  this.tmpQ3=new THREE.Quaternion();
 }

 normalize(value){return (Array.isArray(value)?value:[value]).filter(Boolean);}

 async loadFirst(loader,urls,label,required=true){
  let last=null;
  for(const url of urls){
   try{return await loader.loadAsync(url);}catch(err){last=err;console.warn(`[KayKit ${label}] failed`,url,err);}
  }
  if(required)throw new Error(`${label} unavailable: ${last?.message||'no working source'}`);
  return null;
 }

 async load(){
  const loader=new GLTFLoader();
  const character=await this.loadFirst(loader,this.modelUrls,'Ranger model',true);
  const model=character.scene;
  this.model=model;
  model.rotation.y=this.facingYaw;
  model.updateMatrixWorld(true);

  const box=new this.T.Box3().setFromObject(model),size=new this.T.Vector3();
  box.getSize(size);
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error('KayKit Ranger has invalid bounds');
  const scale=this.targetHeight/size.y;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const scaled=new this.T.Box3().setFromObject(model);
  model.position.y-=scaled.min.y;
  model.traverse(o=>{
   if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}
   if(o.isBone&&o.name)this.bones.set(o.name.toLowerCase(),o);
  });
  this.root.add(model);
  this.mixer=new this.T.AnimationMixer(model);

  const [movement,general]=await Promise.all([
   this.loadFirst(loader,this.movementUrls,'movement animations',false),
   this.loadFirst(loader,this.generalUrls,'general animations',false)
  ]);
  const clips=[...(character.animations||[]),...(general?.animations||[]),...(movement?.animations||[])];
  for(const clip of clips){
   if(!this.actions.has(clip.name))this.actions.set(clip.name,this.mixer.clipAction(clip));
  }

  this.jumpActionName=this.findJumpAction();
  if(this.jumpActionName){
   const jump=this.actions.get(this.jumpActionName);
   jump.setLoop(this.T.LoopOnce,1);
   jump.clampWhenFinished=true;
  }

  // The General pack supplies the full-body timing. Procedural arm targets are
  // layered afterwards so the hands line up with our actual shoulder-carried log.
  this.chopActionName=this.findPreferredAction(['interact','pickup','pick_up','pick up','attack','heavy']);
  this.pickupActionName=this.findPreferredAction(['pickup','pick_up','pick up','interact','grab','heavy']);
  this.placeActionName=this.findPreferredAction(['interact','pickup','pick_up','putdown','put_down','drop']);

  for(const name of [this.chopActionName,this.pickupActionName,this.placeActionName]){
   const action=name?this.actions.get(name):null;
   if(action){
    action.setLoop(this.T.LoopOnce,1);
    action.clampWhenFinished=false;
   }
  }

  this.loaded=true;
  const idle=this.actions.has('Idle_A')?'Idle_A':(this.actions.has('Idle')?'Idle':null);
  if(idle)this.play(idle,0);
  return this;
 }

 findPreferredAction(keywords){
  const names=[...this.actions.keys()];
  for(const keyword of keywords){
   const wanted=keyword.toLowerCase().replace(/[^a-z0-9]/g,'');
   const exact=names.find(name=>name.toLowerCase().replace(/[^a-z0-9]/g,'')===wanted);
   if(exact)return exact;
  }
  for(const keyword of keywords){
   const wanted=keyword.toLowerCase().replace(/[^a-z0-9]/g,'');
   const partial=names.find(name=>name.toLowerCase().replace(/[^a-z0-9]/g,'').includes(wanted));
   if(partial)return partial;
  }
  return null;
 }

 findJumpAction(){
  const names=[...this.actions.keys()];
  const preferred=['Jump_Full','Jump','Jump_A','Jumping','Jump_Start'];
  for(const wanted of preferred){
   const exact=names.find(name=>name.toLowerCase()===wanted.toLowerCase());
   if(exact)return exact;
  }
  return names.find(name=>name.toLowerCase().includes('jump'))||null;
 }

 play(name,fade=.16,timeScale=1,forceRestart=false){
  const next=this.actions.get(name);
  if(!next)return;
  if(next===this.active&&!forceRestart){
   next.setEffectiveTimeScale(timeScale);
   return;
  }
  if(this.active&&this.active!==next)this.active.fadeOut(fade);
  if(forceRestart||next!==this.active)next.reset();
  next.setEffectiveTimeScale(timeScale).fadeIn(fade).play();
  this.active=next;
 }

 setCarrying(type=null){this.carryingType=type||null;}

 triggerChop(){
  if(!this.loaded)return;
  this.pickupTimer=0;
  this.placeTimer=0;
  this.chopTimer=this.chopDuration;
  if(this.chopActionName)this.play(this.chopActionName,.045,1.16,true);
 }

 triggerPickup(){
  if(!this.loaded)return;
  this.chopTimer=0;
  this.placeTimer=0;
  this.pickupTimer=this.pickupDuration;
  if(this.pickupActionName)this.play(this.pickupActionName,.05,.92,true);
 }

 triggerPlace(){
  if(!this.loaded)return;
  this.chopTimer=0;
  this.pickupTimer=0;
  this.placeTimer=this.placeDuration;
  if(this.placeActionName)this.play(this.placeActionName,.05,.96,true);
 }

 bone(name){return this.bones.get(name.toLowerCase())||null;}

 playerLocalPoint(x,y,z){
  const point=this.tmpV3.set(x,y,z);
  const playerRoot=this.root.parent;
  if(playerRoot)return playerRoot.localToWorld(point);
  return this.root.localToWorld(point);
 }

 aimBoneAt(bone,child,targetWorld,weight=1){
  if(!bone||!child||weight<=0)return;
  bone.updateWorldMatrix(true,true);
  const bonePos=bone.getWorldPosition(this.tmpV1);
  const childPos=child.getWorldPosition(this.tmpV2);
  const currentDir=childPos.sub(bonePos).normalize();
  const desiredDir=targetWorld.clone().sub(bonePos).normalize();
  if(currentDir.lengthSq()<.001||desiredDir.lengthSq()<.001)return;

  const delta=this.tmpQ1.setFromUnitVectors(currentDir,desiredDir);
  const worldQ=bone.getWorldQuaternion(this.tmpQ2);
  const targetWorldQ=this.tmpQ3.copy(delta).multiply(worldQ);
  const parentQ=bone.parent?.getWorldQuaternion(new this.T.Quaternion())||new this.T.Quaternion();
  const targetLocal=parentQ.invert().multiply(targetWorldQ);
  bone.quaternion.slerp(targetLocal,Math.max(0,Math.min(1,weight)));
  bone.updateWorldMatrix(true,true);
 }

 poseArm(side,elbowLocal,handLocal,weight){
  const upper=this.bone(`upperarm.${side}`);
  const lower=this.bone(`lowerarm.${side}`);
  const wrist=this.bone(`wrist.${side}`)||this.bone(`hand.${side}`);
  if(!upper||!lower||!wrist)return;

  const elbowTarget=this.playerLocalPoint(elbowLocal.x,elbowLocal.y,elbowLocal.z).clone();
  this.aimBoneAt(upper,lower,elbowTarget,weight);
  const handTarget=this.playerLocalPoint(handLocal.x,handLocal.y,handLocal.z).clone();
  this.aimBoneAt(lower,wrist,handTarget,weight);
 }

 smooth(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
 }

 mixPoint(a,b,t){
  return {
   x:a.x+(b.x-a.x)*t,
   y:a.y+(b.y-a.y)*t,
   z:a.z+(b.z-a.z)*t
  };
 }

 applyCarryPose(weight=.98){
  // The log lies across the shoulders rather than floating in front of the chest.
  // Both hands brace it close to the shoulder line while locomotion keeps control
  // of the hips and legs underneath this upper-body pose.
  this.poseArm('l',{x:.58,y:1.73,z:.18},{x:.62,y:1.82,z:.13},weight);
  this.poseArm('r',{x:-.48,y:1.69,z:.21},{x:-.34,y:1.80,z:.14},weight);
 }

 applyPickupPose(){
  const elapsed=this.pickupDuration-this.pickupTimer;
  const t=Math.max(0,Math.min(1,elapsed/this.pickupDuration));
  const lift=this.smooth((t-.12)/.88);

  const leftElbow=this.mixPoint({x:.55,y:.94,z:.82},{x:.58,y:1.73,z:.18},lift);
  const leftHand=this.mixPoint({x:.55,y:.54,z:1.12},{x:.62,y:1.82,z:.13},lift);
  const rightElbow=this.mixPoint({x:-.55,y:.96,z:.80},{x:-.48,y:1.69,z:.21},lift);
  const rightHand=this.mixPoint({x:-.55,y:.56,z:1.08},{x:-.34,y:1.80,z:.14},lift);

  this.poseArm('l',leftElbow,leftHand,.99);
  this.poseArm('r',rightElbow,rightHand,.99);
 }

 applyPlacePose(){
  const elapsed=this.placeDuration-this.placeTimer;
  const t=Math.max(0,Math.min(1,elapsed/this.placeDuration));
  const lower=this.smooth(t);

  const leftElbow=this.mixPoint({x:.58,y:1.73,z:.18},{x:.53,y:1.03,z:.86},lower);
  const leftHand=this.mixPoint({x:.62,y:1.82,z:.13},{x:.54,y:.58,z:1.28},lower);
  const rightElbow=this.mixPoint({x:-.48,y:1.69,z:.21},{x:-.53,y:1.04,z:.84},lower);
  const rightHand=this.mixPoint({x:-.34,y:1.80,z:.14},{x:-.54,y:.60,z:1.24},lower);

  this.poseArm('l',leftElbow,leftHand,.99);
  this.poseArm('r',rightElbow,rightHand,.99);
 }

 applyChopPose(){
  const elapsed=this.chopDuration-this.chopTimer;
  const t=Math.max(0,Math.min(1,elapsed/this.chopDuration));
  // Wind up quickly, then accelerate through the strike and recover slightly.
  const strike=t<.34?0:(t<.78?(t-.34)/.44:1-(t-.78)/.22*.18);
  const s=strike*strike*(3-2*strike);

  const highY=2.18+(1-s)*.08;
  const handY=highY+(1.08-highY)*s;
  const handZ=.18+(1.02-.18)*s;
  const elbowY=1.86+(1.42-1.86)*s;
  const elbowZ=.18+(.57-.18)*s;

  this.poseArm('l',{x:.43,y:elbowY,z:elbowZ},{x:.12,y:handY,z:handZ},.98);
  this.poseArm('r',{x:-.43,y:elbowY,z:elbowZ},{x:-.12,y:handY+.07,z:handZ-.05},.98);
 }

 update(dt,moveAmount=0,locomotion={}){
  if(!this.loaded)return;

  const chopping=this.chopTimer>0;
  const pickingUp=this.pickupTimer>0;
  const placing=this.placeTimer>0;
  if(chopping)this.chopTimer=Math.max(0,this.chopTimer-dt);
  if(pickingUp)this.pickupTimer=Math.max(0,this.pickupTimer-dt);
  if(placing)this.placeTimer=Math.max(0,this.placeTimer-dt);

  const interaction=chopping||pickingUp||placing;
  const carryingLog=this.carryingType==='log';

  if(this.actions.size&&!interaction){
   if(!locomotion.isGrounded&&this.jumpActionName){
    this.play(this.jumpActionName,.08,1,!!locomotion.jumpStarted);
   }else if(carryingLog){
    // A shoulder log never uses the running cycle. Even at full stick input the
    // Ranger trudges with the walking clip at a deliberately heavy cadence.
    if(moveAmount<.06){
     this.play(this.actions.has('Idle_A')?'Idle_A':'Idle',.15,.82);
    }else{
     this.play(this.actions.has('Walking_A')?'Walking_A':'Walking',.16,.50+moveAmount*.18);
    }
   }else if(moveAmount<.06){
    this.play(this.actions.has('Idle_A')?'Idle_A':'Idle');
   }else if(moveAmount>.72&&this.actions.has('Running_A')){
    this.play('Running_A',.14,.88+moveAmount*.18);
   }else{
    this.play(this.actions.has('Walking_A')?'Walking_A':'Walking',.16,.65+moveAmount*.45);
   }
  }

  this.mixer?.update(dt);
  this.model?.updateMatrixWorld(true);

  if(chopping)this.applyChopPose();
  else if(pickingUp)this.applyPickupPose();
  else if(placing)this.applyPlacePose();
  else if(carryingLog)this.applyCarryPose();

  this.model?.updateMatrixWorld(true);
 }
}
