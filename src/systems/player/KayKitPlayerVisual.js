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
  this.chopDuration=.56;
  this.chopTimer=0;
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

  // The bundled General set contains interaction-style clips but not a dedicated
  // woodcutting set. Use the closest available full-body action and layer a
  // deterministic two-arm chopping motion on the Ranger skeleton after mixing.
  this.chopActionName=this.findPreferredAction(['interact','pickup','pick_up','pick up','attack','heavy']);
  if(this.chopActionName){
   const chop=this.actions.get(this.chopActionName);
   chop.setLoop(this.T.LoopOnce,1);
   chop.clampWhenFinished=false;
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
  this.chopTimer=this.chopDuration;
  if(this.chopActionName)this.play(this.chopActionName,.045,1.16,true);
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

 applyCarryPose(weight=.94){
  // Grip a full log across the torso with both hands while leaving the mixer in
  // charge of legs, hips and locomotion. This keeps the carry pose while walking.
  this.poseArm('l',{x:.60,y:1.50,z:.42},{x:.56,y:1.24,z:.76},weight);
  this.poseArm('r',{x:-.60,y:1.50,z:.42},{x:-.56,y:1.24,z:.76},weight);
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
  if(chopping)this.chopTimer=Math.max(0,this.chopTimer-dt);

  if(this.actions.size&&!chopping){
   if(!locomotion.isGrounded&&this.jumpActionName){
    this.play(this.jumpActionName,.08,1,!!locomotion.jumpStarted);
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
  else if(this.carryingType==='log')this.applyCarryPose();

  this.model?.updateMatrixWorld(true);
 }
}
