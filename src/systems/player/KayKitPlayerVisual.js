import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class KayKitPlayerVisual{
 constructor(THREE,{modelUrl,modelUrls,movementUrl,movementUrls,generalUrl,generalUrls,targetHeight=2.7,facingYaw=Math.PI}){
  this.T=THREE;
  this.modelUrls=this.normalize(modelUrls??modelUrl);
  this.movementUrls=this.normalize(movementUrls??movementUrl);
  this.generalUrls=this.normalize(generalUrls??generalUrl);
  this.targetHeight=targetHeight;this.facingYaw=facingYaw;
  this.root=new THREE.Group();this.root.name='KayKitRangerVisual';this.mixer=null;this.actions=new Map();this.active=null;this.loaded=false;
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
  model.rotation.y=this.facingYaw;model.updateMatrixWorld(true);
  const box=new this.T.Box3().setFromObject(model),size=new this.T.Vector3();box.getSize(size);
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error('KayKit Ranger has invalid bounds');
  const scale=this.targetHeight/size.y;model.scale.setScalar(scale);model.updateMatrixWorld(true);
  const scaled=new this.T.Box3().setFromObject(model);model.position.y-=scaled.min.y;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  this.root.add(model);this.mixer=new this.T.AnimationMixer(model);

  const [movement,general]=await Promise.all([
   this.loadFirst(loader,this.movementUrls,'movement animations',false),
   this.loadFirst(loader,this.generalUrls,'general animations',false)
  ]);
  const clips=[...(character.animations||[]),...(general?.animations||[]),...(movement?.animations||[])];
  for(const clip of clips){if(!this.actions.has(clip.name))this.actions.set(clip.name,this.mixer.clipAction(clip));}
  this.loaded=true;
  const idle=this.actions.has('Idle_A')?'Idle_A':(this.actions.has('Idle')?'Idle':null);if(idle)this.play(idle,0);
  return this;
 }
 play(name,fade=.16,timeScale=1){const next=this.actions.get(name);if(!next||next===this.active){if(next)next.setEffectiveTimeScale(timeScale);return;}if(this.active)this.active.fadeOut(fade);next.reset().setEffectiveTimeScale(timeScale).fadeIn(fade).play();this.active=next;}
 update(dt,moveAmount=0){
  if(!this.loaded)return;
  if(this.actions.size){
   if(moveAmount<.06)this.play(this.actions.has('Idle_A')?'Idle_A':'Idle');
   else if(moveAmount>.72&&this.actions.has('Running_A'))this.play('Running_A',.14,.88+moveAmount*.18);
   else this.play(this.actions.has('Walking_A')?'Walking_A':'Walking',.16,.65+moveAmount*.45);
  }
  this.mixer?.update(dt);
 }
}
