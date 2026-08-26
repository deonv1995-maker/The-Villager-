import {harvestProfileForEnvironmentType,resourceDefinition} from './ResourceCatalog.js?v=563';

export class HarvestingSystem{
 constructor(THREE,{world,player,inventory,actionButton=null,feedbackElement=null}){
  this.T=THREE;
  this.world=world;
  this.player=player;
  this.inventory=inventory;
  this.actionButton=actionButton;
  this.feedbackElement=feedbackElement;

  this.enabled=true;
  this.range=3.5;
  this.nearRange=1.35;
  this.cellSize=6;
  this.grid=new Map();
  this.entries=[];
  this.currentTarget=null;
  this.targetRefreshTimer=0;
  this.targetRefreshInterval=.09;
  this.hitCooldown=.24;
  this.hitCooldownTimer=0;
  this.feedbackTimer=null;
  this.tempPosition=new THREE.Vector3();

  this.onAction=e=>{
   e?.preventDefault?.();
   e?.stopPropagation?.();
   this.tryHarvest();
  };
 }

 initialize(){
  if(this.actionButton){
   this.actionButton.addEventListener('pointerdown',this.onAction,{passive:false});
  }

  const environment=this.world?.environment;
  const rebuild=()=>setTimeout(()=>this.rebuildTargets(),0);
  if(environment?.loadKayKit){
   environment.loadKayKit().then(rebuild).catch(err=>console.error('[Harvest targets]',err));
  }else rebuild();
 }

 dispose(){
  this.actionButton?.removeEventListener('pointerdown',this.onAction);
 }

 setEnabled(enabled){
  this.enabled=!!enabled;
  if(!this.enabled){
   this.currentTarget=null;
   this.updateActionButton();
  }
 }

 key(ix,iz){return `${ix}:${iz}`;}

 addToGrid(entry){
  const ix=Math.floor(entry.x/this.cellSize);
  const iz=Math.floor(entry.z/this.cellSize);
  const key=this.key(ix,iz);
  let bucket=this.grid.get(key);
  if(!bucket){bucket=[];this.grid.set(key,bucket);}
  bucket.push(entry);
 }

 rebuildTargets(){
  this.grid.clear();
  this.entries.length=0;
  const root=this.world?.environment?.root;
  if(!root)return 0;

  for(const object of root.children){
   const profile=harvestProfileForEnvironmentType(object.userData?.environmentType);
   if(!profile)continue;
   object.getWorldPosition(this.tempPosition);
   const entry={
    object,
    profile,
    health:profile.durability,
    x:this.tempPosition.x,
    z:this.tempPosition.z,
    active:true
   };
   this.entries.push(entry);
   this.addToGrid(entry);
  }
  return this.entries.length;
 }

 nearbyEntries(x,z){
  const r=this.range;
  const minX=Math.floor((x-r)/this.cellSize);
  const maxX=Math.floor((x+r)/this.cellSize);
  const minZ=Math.floor((z-r)/this.cellSize);
  const maxZ=Math.floor((z+r)/this.cellSize);
  const result=[];
  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const bucket=this.grid.get(this.key(ix,iz));
    if(bucket)result.push(...bucket);
   }
  }
  return result;
 }

 findTarget(){
  if(!this.enabled||!this.player)return null;
  const px=this.player.position.x;
  const pz=this.player.position.z;
  const yaw=this.player.rotation.y;
  const forwardX=Math.sin(yaw);
  const forwardZ=Math.cos(yaw);
  let best=null;
  let bestScore=Infinity;

  for(const entry of this.nearbyEntries(px,pz)){
   if(!entry.active||!entry.object?.parent||entry.object.visible===false)continue;
   const dx=entry.x-px;
   const dz=entry.z-pz;
   const distance=Math.hypot(dx,dz);
   if(distance>this.range||distance<.15)continue;
   const dot=(dx*forwardX+dz*forwardZ)/Math.max(.001,distance);
   if(distance>this.nearRange&&dot<.12)continue;

   const score=distance-dot*.72;
   if(score<bestScore){best=entry;bestScore=score;}
  }
  return best;
 }

 updateActionButton(){
  const button=this.actionButton;
  if(!button)return;
  if(!this.enabled){
   button.classList.add('hidden-action');
   button.disabled=true;
   return;
  }

  const target=this.currentTarget;
  if(!target){
   button.textContent='USE';
   button.classList.add('hidden-action');
   button.disabled=true;
   return;
  }

  button.textContent=target.profile.actionLabel;
  button.classList.remove('hidden-action');
  button.disabled=false;
 }

 showFeedback(text){
  const el=this.feedbackElement;
  if(!el)return;
  el.textContent=text;
  el.classList.add('show');
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>el.classList.remove('show'),750);
 }

 pulseTarget(entry){
  const object=entry?.object;
  if(!object?.parent)return;
  object.scale.multiplyScalar(.965);
  setTimeout(()=>{
   if(object.parent)object.scale.multiplyScalar(1/.965);
  },90);
 }

 deplete(entry){
  entry.active=false;
  const object=entry.object;
  const type=object.userData?.environmentType;
  object.parent?.remove(object);

  if(type==='rock')this.world?.rebuildEnvironmentRockColliders?.();
  this.currentTarget=null;
 }

 tryHarvest(){
  if(!this.enabled||this.hitCooldownTimer>0)return false;
  const entry=this.findTarget();
  if(!entry)return false;

  this.hitCooldownTimer=this.hitCooldown;
  entry.health=Math.max(0,entry.health-1);
  this.inventory.add(entry.profile.resourceId,entry.profile.yieldPerHit);
  this.pulseTarget(entry);

  const resource=resourceDefinition(entry.profile.resourceId);
  let gained=entry.profile.yieldPerHit;
  if(entry.health<=0){
   gained+=entry.profile.depletionBonus;
   this.inventory.add(entry.profile.resourceId,entry.profile.depletionBonus);
   this.deplete(entry);
  }

  this.showFeedback(`+${gained} ${resource?.label||entry.profile.resourceId}`);
  this.updateActionButton();
  return true;
 }

 update(dt){
  this.hitCooldownTimer=Math.max(0,this.hitCooldownTimer-dt);
  if(!this.enabled)return;
  this.targetRefreshTimer-=dt;
  if(this.targetRefreshTimer>0)return;
  this.targetRefreshTimer=this.targetRefreshInterval;
  const next=this.findTarget();
  if(next!==this.currentTarget){
   this.currentTarget=next;
   this.updateActionButton();
  }
 }
}
