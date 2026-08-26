export class HarvestingSystem{
 constructor(THREE,{world,player,materials}){
  this.T=THREE;
  this.world=world;
  this.player=player;
  this.materials=materials;

  this.enabled=true;
  this.range=3.55;
  this.nearRange=1.35;
  this.cellSize=6;
  this.grid=new Map();
  this.entries=[];
  this.currentTarget=null;
  this.targetRefreshTimer=0;
  this.targetRefreshInterval=.08;
  this.hitCooldown=.54;
  this.hitCooldownTimer=0;
  this.tempPosition=new THREE.Vector3();
  this.falling=[];
 }

 initialize(){
  const environment=this.world?.environment;
  const rebuild=()=>setTimeout(()=>this.rebuildTargets(),0);
  if(environment?.loadKayKit){
   environment.loadKayKit().then(rebuild).catch(err=>console.error('[Harvest targets]',err));
  }else rebuild();
 }

 setEnabled(enabled){
  this.enabled=!!enabled;
  if(!this.enabled)this.currentTarget=null;
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

 profileFor(type){
  if(type==='tree'||type==='bareTree')return {kind:'tree',durability:4};
  if(type==='rock')return {kind:'rock',durability:4};
  return null;
 }

 rebuildTargets(){
  this.grid.clear();
  this.entries.length=0;
  this.falling.length=0;
  const root=this.world?.environment?.root;
  if(!root)return 0;

  for(const object of root.children){
   const profile=this.profileFor(object.userData?.environmentType);
   if(!profile)continue;
   object.getWorldPosition(this.tempPosition);
   const entry={
    object,
    profile,
    state:'standing',
    health:profile.durability,
    x:this.tempPosition.x,
    z:this.tempPosition.z,
    active:true,
    fallTime:0,
    fallDuration:.98,
    fallAxis:'z',
    fallSign:1,
    fallStart:0,
    fallTarget:0
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

 actionLabelFor(entry){
  if(!entry)return 'USE';
  if(entry.profile.kind==='tree')return 'CHOP';
  if(entry.profile.kind==='rock')return 'BREAK ROCK';
  return 'USE';
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
   if(entry.state==='falling')continue;
   const dx=entry.x-px;
   const dz=entry.z-pz;
   const distance=Math.hypot(dx,dz);
   if(distance>this.range||distance<.15)continue;
   const dot=(dx*forwardX+dz*forwardZ)/Math.max(.001,distance);
   if(distance>this.nearRange&&dot<.10)continue;
   const score=distance-dot*.72;
   if(score<bestScore){best=entry;bestScore=score;}
  }
  return best;
 }

 pulse(entry){
  const object=entry?.object;
  if(!object?.parent)return;
  object.scale.multiplyScalar(.97);
  setTimeout(()=>{
   if(object.parent)object.scale.multiplyScalar(1/.97);
  },85);
 }

 deterministicSign(entry){
  const n=Math.sin(entry.x*2.17+entry.z*.93)*43758.5453;
  return (n-Math.floor(n))>.5?1:-1;
 }

 deterministicNoise(entry,index,salt=0){
  const n=Math.sin(entry.x*(1.37+salt*.07)+entry.z*(.83+salt*.11)+index*12.9898+salt*4.17)*43758.5453;
  return n-Math.floor(n);
 }

 beginTreeFall(entry){
  entry.state='falling';
  entry.health=0;
  entry.fallTime=0;
  entry.fallAxis=Math.abs(Math.sin(entry.x*.31+entry.z*.47))>.5?'z':'x';
  entry.fallSign=this.deterministicSign(entry);
  entry.fallStart=entry.object.rotation[entry.fallAxis];
  entry.fallTarget=entry.fallStart+entry.fallSign*1.48;
  this.falling.push(entry);
  if(this.currentTarget===entry)this.currentTarget=null;
 }

 fallenDirection(entry){
  const baseYaw=entry.object.rotation.y||0;
  const localYaw=entry.fallAxis==='z'?0:Math.PI/2;
  return baseYaw+localYaw+(entry.fallSign<0?Math.PI:0);
 }

 spawnLogsFromTree(entry){
  const yaw=this.fallenDirection(entry);
  const dx=Math.cos(yaw);
  const dz=-Math.sin(yaw);
  const sideX=-dz,sideZ=dx;
  const count=3;
  const logLength=this.materials?.logLength??2.90;
  const spacing=logLength*.88;

  // The three physical logs occupy consecutive sections of the fallen trunk,
  // beginning just beyond the stump. They inherit forward impact momentum and a
  // small asymmetric kick, then WorldMaterialSystem handles gravity/rolling.
  for(let i=0;i<count;i++){
   const along=(i+.58)*spacing;
   const side=(this.deterministicNoise(entry,i,1)-.5)*.34;
   const x=entry.x+dx*along+sideX*side;
   const z=entry.z+dz*along+sideZ*side;
   const ground=this.world?.heightAt?.(x,z)??0;
   const lift=.72+this.deterministicNoise(entry,i,2)*.48;
   const forwardSpeed=.92+i*.18+this.deterministicNoise(entry,i,3)*.34;
   const lateral=(this.deterministicNoise(entry,i,4)-.5)*.78;

   this.materials.spawnPhysicalLog(
    x,
    ground+(this.materials?.logRadius??.27)+lift,
    z,
    yaw+(this.deterministicNoise(entry,i,5)-.5)*.07,
    {
     vx:dx*forwardSpeed+sideX*lateral,
     vy:1.05+this.deterministicNoise(entry,i,6)*.82,
     vz:dz*forwardSpeed+sideZ*lateral,
     spinY:(this.deterministicNoise(entry,i,7)-.5)*1.15,
     rollSpeed:(this.deterministicNoise(entry,i,8)-.5)*7.2
    }
   );
  }
 }

 finishTreeFall(entry){
  this.spawnLogsFromTree(entry);
  entry.active=false;
  entry.state='depleted';
  entry.object?.parent?.remove(entry.object);
  if(this.currentTarget===entry)this.currentTarget=null;
 }

 breakRock(entry){
  entry.active=false;
  const object=entry.object;
  object?.parent?.remove(object);
  const count=4;
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2+.35;
   const r=.48+(i%2)*.16;
   this.materials.spawnStone(entry.x+Math.cos(a)*r,entry.z+Math.sin(a)*r);
  }
  this.world?.rebuildEnvironmentRockColliders?.();
  if(this.currentTarget===entry)this.currentTarget=null;
 }

 perform(target=this.currentTarget){
  if(!this.enabled||this.hitCooldownTimer>0||!target||!target.active)return null;
  if(target.state==='falling')return null;
  this.hitCooldownTimer=this.hitCooldown;

  if(target.profile.kind==='tree'){
   // Trigger the Ranger's full-body/procedural chop before applying the hit so
   // repeated taps remain paced to the visible swing rather than machine-gunning.
   this.world?.playerVisual?.triggerChop?.();
   target.health=Math.max(0,target.health-1);
   this.pulse(target);
   if(target.health<=0){
    this.beginTreeFall(target);
    return {message:'Tree falling into physical logs'};
   }
   return {message:`Tree ${target.health} chops from falling`};
  }

  if(target.profile.kind==='rock'){
   target.health=Math.max(0,target.health-1);
   this.pulse(target);
   if(target.health<=0){
    this.breakRock(target);
    return {message:'Rock broken into stones'};
   }
   return {message:`Rock ${target.health} hits from breaking`};
  }
  return null;
 }

 updateFalling(dt){
  for(let i=this.falling.length-1;i>=0;i--){
   const entry=this.falling[i];
   if(!entry.object?.parent){this.falling.splice(i,1);continue;}
   entry.fallTime=Math.min(entry.fallDuration,entry.fallTime+dt);
   let t=entry.fallTime/entry.fallDuration;
   t=1-Math.pow(1-t,3);
   entry.object.rotation[entry.fallAxis]=entry.fallStart+(entry.fallTarget-entry.fallStart)*t;
   if(entry.fallTime>=entry.fallDuration){
    entry.object.rotation[entry.fallAxis]=entry.fallTarget;
    this.finishTreeFall(entry);
    this.falling.splice(i,1);
   }
  }
 }

 update(dt){
  this.hitCooldownTimer=Math.max(0,this.hitCooldownTimer-dt);
  this.updateFalling(dt);
  if(!this.enabled)return;
  this.targetRefreshTimer-=dt;
  if(this.targetRefreshTimer>0)return;
  this.targetRefreshTimer=this.targetRefreshInterval;
  this.currentTarget=this.findTarget();
 }
}
