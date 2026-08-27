export class GrassHarvestingSystem{
 constructor({harvesting,fineGrass,materials,player,world}){
  this.harvesting=harvesting;
  this.fineGrass=fineGrass;
  this.materials=materials;
  this.player=player;
  this.world=world;
  this.range=2.45;
  this.nearRange=.92;
  this.cutRadius=1.02;
  this.maxCutTufts=34;

  this.originalFindTarget=null;
  this.originalActionLabel=null;
  this.originalPerform=null;
 }

 initialize(){
  if(!this.harvesting)return;
  this.originalFindTarget=this.harvesting.findTarget.bind(this.harvesting);
  this.originalActionLabel=this.harvesting.actionLabelFor.bind(this.harvesting);
  this.originalPerform=this.harvesting.perform.bind(this.harvesting);

  this.harvesting.findTarget=()=>this.findTarget();
  this.harvesting.actionLabelFor=target=>
   target?.profile?.kind==='grass'?'HARVEST GRASS':this.originalActionLabel(target);
  this.harvesting.perform=target=>
   target?.profile?.kind==='grass'?this.performGrass(target):this.originalPerform(target);
 }

 grassCandidate(){
  if(!this.player||!this.fineGrass?.entries?.length||!this.fineGrass?.mesh)return null;
  if(this.materials?.carried)return null;

  const px=this.player.position.x;
  const pz=this.player.position.z;
  const yaw=this.player.rotation.y;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  let best=null,bestScore=Infinity;

  const nearby=this.fineGrass.nearbyEntries?.(px,pz)||[];
  for(const entry of nearby){
   if(entry.harvested)continue;
   const dx=entry.x-px,dz=entry.z-pz;
   const distance=Math.hypot(dx,dz);
   if(distance<.18||distance>this.range)continue;
   const dot=(dx*fx+dz*fz)/Math.max(.001,distance);
   if(distance>this.nearRange&&dot<.12)continue;
   const score=distance-dot*.58;
   if(score<bestScore){
    bestScore=score;
    best={
     profile:{kind:'grass'},
     active:true,
     x:entry.x,z:entry.z,
     grassEntry:entry,
     grassScore:score
    };
   }
  }
  return best;
 }

 resourceScore(target){
  if(!target||!this.player)return Infinity;
  const dx=(target.x??0)-this.player.position.x;
  const dz=(target.z??0)-this.player.position.z;
  return Math.hypot(dx,dz);
 }

 findTarget(){
  const resource=this.originalFindTarget();
  const grass=this.grassCandidate();
  if(!grass)return resource;
  if(!resource)return grass;

  // Prefer a tree/rock when it is essentially the same distance, otherwise grass
  // is selectable naturally by walking close to a patch and facing it.
  return grass.grassScore+.22<this.resourceScore(resource)?grass:resource;
 }

 performGrass(target){
  if(this.harvesting.hitCooldownTimer>0||this.materials?.carried||!target?.active)return null;
  const entry=target.grassEntry;
  if(!entry||entry.harvested)return null;

  const count=this.fineGrass.harvestPatch?.(
   entry.x,entry.z,this.cutRadius,this.maxCutTufts
  )||0;
  if(count<1)return null;

  const bundle=this.materials?.createCarriedGrassBundle?.();
  if(!bundle)return null;

  this.harvesting.hitCooldownTimer=.46;
  this.harvesting.currentTarget=null;
  this.world?.playerVisual?.triggerPickup?.();
  return {message:'Grass harvested into a bundle'};
 }
}
