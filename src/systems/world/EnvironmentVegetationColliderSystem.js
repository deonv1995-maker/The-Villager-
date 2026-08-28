export class EnvironmentVegetationColliderSystem{
 constructor({world,environment,harvesting=null}){
  this.world=world;
  this.environment=environment;
  this.harvesting=harvesting;

  this.treeOwner='environment-trees';
  this.bushOwner='environment-bushes';
  this.originalPopulate=null;
  this.originalFinishTreeFall=null;
  this.initialized=false;
 }

 initialize(){
  if(this.initialized||!this.world||!this.environment)return;
  if(!this.world.registerRockCollidersFromGroup||!this.world.clearRockColliders)return;
  this.initialized=true;

  this.wrapEnvironmentPopulation();
  this.wrapTreeHarvestRemoval();

  // EnvironmentPopulation loads asynchronously. Rebuild after the shared load
  // promise settles as a safety net; the wrapped populate() call normally builds
  // the colliders first on the exact frame the forest is populated.
  const loading=this.environment.loadKayKit?.();
  if(loading?.then){
   loading.then(()=>setTimeout(()=>this.rebuild(),0))
    .catch(err=>console.error('[Vegetation colliders]',err));
  }else{
   setTimeout(()=>this.rebuild(),0);
  }
 }

 dispose(){
  if(!this.initialized)return;
  this.initialized=false;

  if(this.originalPopulate&&this.environment){
   this.environment.populate=this.originalPopulate;
   this.originalPopulate=null;
  }
  if(this.originalFinishTreeFall&&this.harvesting){
   this.harvesting.finishTreeFall=this.originalFinishTreeFall;
   this.originalFinishTreeFall=null;
  }

  this.world?.clearRockColliders?.(this.treeOwner);
  this.world?.clearRockColliders?.(this.bushOwner);
 }

 wrapEnvironmentPopulation(){
  if(!this.environment?.populate||this.originalPopulate)return;
  const original=this.environment.populate.bind(this.environment);
  this.originalPopulate=original;
  this.environment.populate=(...args)=>{
   const result=original(...args);
   this.rebuild();
   return result;
  };
 }

 wrapTreeHarvestRemoval(){
  if(!this.harvesting?.finishTreeFall||this.originalFinishTreeFall)return;
  const original=this.harvesting.finishTreeFall.bind(this.harvesting);
  this.originalFinishTreeFall=original;
  this.harvesting.finishTreeFall=(entry,...args)=>{
   const object=entry?.object||null;
   const result=original(entry,...args);
   this.removeObjectCollider(object);
   return result;
  };
 }

 removeObjectCollider(object){
  if(!object||!Array.isArray(this.world?.rockColliders))return;
  const before=this.world.rockColliders.length;
  this.world.rockColliders=this.world.rockColliders.filter(collider=>collider?.object!==object);
  if(this.world.rockColliders.length!==before)this.world.rebuildRockColliderGrid?.();
 }

 rebuild(){
  const root=this.environment?.root;
  if(!root)return {trees:0,bushes:0};

  // Trees use the existing mobile broad-phase but only a narrow body around the
  // trunk. The canopy must never behave like an invisible wall.
  const trees=this.world.registerRockCollidersFromGroup(
   root,
   this.treeOwner,
   object=>{
    const type=object.userData?.environmentType;
    return type==='tree'||type==='bareTree';
   },
   {
    radiusScale:.10,
    minRadius:.34,
    maxRadius:.72,
    verticalInset:.02,
    standable:false,
    standRadiusScale:.1,
    supportInsetScale:.02,
    minSupportInset:.02,
    maxSupportInset:.06
   }
  );

  // Bushes get a broader footprint matching their dense visible mass. They are
  // non-standable obstacles, but an airborne Ranger can still clear a low bush
  // once his feet are above its simplified collider top.
  const bushes=this.world.registerRockCollidersFromGroup(
   root,
   this.bushOwner,
   object=>object.userData?.environmentType==='bush',
   {
    radiusScale:.34,
    minRadius:.34,
    maxRadius:1.45,
    verticalInset:.03,
    standable:false,
    standRadiusScale:.1,
    supportInsetScale:.02,
    minSupportInset:.02,
    maxSupportInset:.06
   }
  );

  return {trees,bushes};
 }
}
