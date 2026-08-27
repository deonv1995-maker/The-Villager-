export class DismantleReuseSystem{
 constructor({interaction,buildingModes,materials,player}){
  this.interaction=interaction;
  this.buildingModes=buildingModes;
  this.materials=materials;
  this.player=player;
  this.range=2.65;
  this.verticalRange=2.45;
  this.originalResolve=null;
  this.originalPerform=null;
  this.tmpWorld=buildingModes?.T?new buildingModes.T.Vector3():null;
 }

 initialize(){
  if(!this.interaction||!this.buildingModes||!this.materials)return;
  this.originalResolve=this.interaction.resolve.bind(this.interaction);
  this.originalPerform=this.interaction.perform.bind(this.interaction);

  this.interaction.resolve=()=>{
   const normal=this.originalResolve();
   if(normal)return normal;
   if(this.materials.carried||this.interaction.pending)return null;
   const target=this.findTarget();
   if(!target)return null;
   return {type:'dismantle',target,label:`TAKE DOWN ${this.labelFor(target)}`};
  };

  this.interaction.perform=()=>{
   if(this.interaction.pending)return false;
   const resolved=this.interaction.resolve();
   if(resolved?.type!=='dismantle')return this.originalPerform();
   const returned=this.dismantle(resolved.target);
   if(!returned)return false;
   this.interaction.showFeedback?.(`${this.labelFor(resolved.target)} dismantled`);
   this.interaction.current=null;
   this.interaction.updateButton?.();
   return true;
  };
 }

 labelFor(target){
  if(target?.kind==='raw')return target.item?.type==='log'?'LOG':'ITEM';
  const p=target?.placement;
  if(!p)return 'ITEM';
  if(p.mode==='roofClad')return p.roofMaterial==='grass'?'THATCH':'ROOF PLANKS';
  if(p.mode==='roofFrame')return p.snapKind==='roof-ridge'?'RIDGE':'RAFTER';
  if(p.mode==='stairTread')return 'STAIR TREADS';
  if(p.mode==='beam')return 'BEAM';
  if(p.mode==='frame')return 'FRAME';
  if(p.mode==='wall')return 'WALL';
  if(p.mode==='floor')return 'FLOOR';
  if(p.mode==='angle')return p.snapKind?.includes('stair')?'STAIR RAIL':'ANGLE';
  return String(p.mode||'ITEM').toUpperCase();
 }

 targetScore(x,y,z){
  const px=this.player?.position?.x??0;
  const py=this.player?.position?.y??0;
  const pz=this.player?.position?.z??0;
  const dx=x-px,dz=z-pz,dy=y-py;
  const horizontal=Math.hypot(dx,dz);
  if(horizontal>this.range||Math.abs(dy)>this.verticalRange)return Infinity;
  const yaw=this.player?.rotation?.y??0;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  const dot=horizontal>.001?(dx*fx+dz*fz)/horizontal:1;
  if(horizontal>1.05&&dot<-.30)return Infinity;
  return horizontal+Math.abs(dy)*.28-dot*.38;
 }

 findTarget(){
  let best=null,bestScore=Infinity;

  for(const item of this.materials.items||[]){
   if(item?.state!=='placed'||!item.object?.parent)continue;
   const p=this.tmpWorld?item.object.getWorldPosition(this.tmpWorld):item.object.position;
   const score=this.targetScore(p.x,p.y,p.z);
   if(score<bestScore){bestScore=score;best={kind:'raw',item};}
  }

  for(const placement of this.buildingModes.placements||[]){
   if(!placement?.object?.parent)continue;
   // The thatch ridge cap is generated automatically and costs no material.
   if(placement.snapKind==='roof-grass-ridge')continue;
   const p=this.tmpWorld?placement.object.getWorldPosition(this.tmpWorld):placement.object.position;
   const score=this.targetScore(p.x,p.y,p.z);
   if(score<bestScore){bestScore=score;best={kind:'construction',placement};}
  }
  return best;
 }

 spawnLooseGrass(x,z){
  const make=this.materials.makeGrassBundleVisual;
  if(!make)return null;
  const object=make();
  const id=this.materials.nextId++;
  const y=(this.buildingModes.world?.heightAt?.(x,z)??0)+.48;
  object.position.set(x,y,z);
  object.rotation.set(0,0,Math.PI/2);
  object.userData.rawMaterialId=id;
  this.materials.root.add(object);
  const item={id,type:'grass',object,state:'loose',radius:.34,stackHeight:.30,carryMotion:null,physics:null};
  this.materials.items.push(item);
  return item;
 }

 removeAutomaticGrassRidge(regionKey){
  if(!regionKey)return;
  const placements=this.buildingModes.placements||[];
  for(let i=placements.length-1;i>=0;i--){
   const p=placements[i];
   if(p?.snapKind!=='roof-grass-ridge'||p.roofRegionKey!==regionKey)continue;
   p.object?.removeFromParent?.();
   placements.splice(i,1);
  }
 }

 dismantle(target){
  if(target?.kind==='raw'){
   const item=target.item;
   if(!item?.object)return null;
   item.state='loose';
   if(item.physics){
    item.physics.active=false;
    item.physics.vx=item.physics.vy=item.physics.vz=0;
    item.physics.spinY=item.physics.rollSpeed=0;
    item.physics.settleTimer=0;
    item.physics.grounded=true;
   }
   return item;
  }

  const p=target?.placement;
  if(!p)return null;
  const placements=this.buildingModes.placements||[];
  const index=placements.indexOf(p);
  if(index<0)return null;

  const x=p.x??p.object?.position?.x??this.player.position.x;
  const z=p.z??p.object?.position?.z??this.player.position.z;
  const yaw=p.yaw??0;
  const grass=p.mode==='roofClad'&&p.roofMaterial==='grass';
  const roofRegionKey=p.roofRegionKey||null;

  p.object?.removeFromParent?.();
  placements.splice(index,1);

  if(grass){
   this.removeAutomaticGrassRidge(roofRegionKey);
   return this.spawnLooseGrass(x,z);
  }

  // Every authored timber placement currently consumes exactly one log. This
  // includes floors/walls (split on placement), stair tread batches, roof planks,
  // rafters/ridges, beams, frames and angled/stair rails.
  const log=this.materials.spawnLog?.(x,z,yaw)||null;
  if(log){
   log.state='loose';
   if(log.physics){log.physics.active=false;log.physics.grounded=true;}
  }
  return log;
 }
}
