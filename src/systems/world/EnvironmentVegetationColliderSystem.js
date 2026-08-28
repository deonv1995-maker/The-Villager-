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

  this.tmpSize=world?.THREE?new world.THREE.Vector3():null;
  this.tmpCenter=world?.THREE?new world.THREE.Vector3():null;
  this.tmpAnchor=world?.THREE?new world.THREE.Vector3():null;
 }

 initialize(){
  if(this.initialized||!this.world||!this.environment)return;
  if(!this.world.registerRockCollider||!this.world.clearRockColliders)return;
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

 clamp(value,min,max){return Math.max(min,Math.min(max,value));}

 boundsFor(object){
  if(!object||!this.world?.THREE)return null;
  object.updateWorldMatrix?.(true,true);
  const box=new this.world.THREE.Box3().setFromObject(object);
  if(box.isEmpty())return null;
  box.getSize(this.tmpSize);
  box.getCenter(this.tmpCenter);
  object.getWorldPosition(this.tmpAnchor);
  return {box,size:this.tmpSize,center:this.tmpCenter,anchor:this.tmpAnchor};
 }

 registerTreeCollider(object){
  const bounds=this.boundsFor(object);
  if(!bounds)return null;

  // Tree OBJ bounds include the whole canopy. Using the AABB centre shifts the
  // collider away from the actual trunk on asymmetric trees, which is what let
  // the Ranger visibly enter one side of the trunk. Keep the collider centred
  // on the model's world-space anchor (the trunk base) and only derive its width
  // from the canopy footprint.
  const footprint=Math.min(bounds.size.x,bounds.size.z);
  const variant=object.userData?.environmentVariant;
  const bare=object.userData?.environmentType==='bareTree';
  let radius=this.clamp(footprint*(bare?.145:.16),.48,.86);
  if(variant==='mature')radius=Math.min(.92,radius*1.08);
  if(variant==='young')radius=Math.max(.46,radius*.94);

  const bottomY=bounds.box.min.y+.02;
  const topY=Math.max(bottomY+.60,bounds.box.max.y-.02);

  return this.world.registerRockCollider({
   x:bounds.anchor.x,
   z:bounds.anchor.z,
   radius,
   radiusX:radius,
   radiusZ:radius,
   bottomY,
   topY,
   supportY:topY,
   owner:this.treeOwner,
   object,
   standable:false,
   standRadius:.08,
   standRadiusX:.08,
   standRadiusZ:.08
  });
 }

 registerBushCollider(object){
  const bounds=this.boundsFor(object);
  if(!bounds)return null;

  // Bushes are dense obstacles rather than trunk objects, so use their actual
  // visible AABB centre and an ellipse that follows their world-space width/depth.
  // The player's own collision radius is added later by WorldManager.
  const radiusX=this.clamp(bounds.size.x*.40,.52,1.72);
  const radiusZ=this.clamp(bounds.size.z*.40,.52,1.72);
  const radius=Math.max(radiusX,radiusZ);
  const bottomY=bounds.box.min.y+.03;
  const topY=Math.max(bottomY+.35,bounds.box.max.y-.06);

  return this.world.registerRockCollider({
   x:bounds.center.x,
   z:bounds.center.z,
   radius,
   radiusX,
   radiusZ,
   bottomY,
   topY,
   supportY:topY,
   owner:this.bushOwner,
   object,
   standable:false,
   standRadius:.08,
   standRadiusX:.08,
   standRadiusZ:.08
  });
 }

 rebuild(){
  const root=this.environment?.root;
  if(!root)return {trees:0,bushes:0};

  this.world.clearRockColliders(this.treeOwner);
  this.world.clearRockColliders(this.bushOwner);

  let trees=0;
  let bushes=0;

  for(const object of root.children){
   const type=object.userData?.environmentType;
   if(type==='tree'||type==='bareTree'){
    if(this.registerTreeCollider(object))trees++;
   }else if(type==='bush'){
    if(this.registerBushCollider(object))bushes++;
   }
  }

  // Both owner clears rebuild the shared broad-phase. Individual registrations
  // add themselves incrementally, so no extra full grid rebuild is needed here.
  return {trees,bushes};
 }
}
