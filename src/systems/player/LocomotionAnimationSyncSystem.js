export class LocomotionAnimationSyncSystem{
 constructor({game,player=null}={}){
  this.game=game||null;
  this.player=player||game?.player||null;
  this.patchedVisual=null;
  this.frameHandle=0;
 }

 initialize(){
  if(!this.game||!this.player)return;
  const seek=()=>{
   this.frameHandle=0;
   const visual=this.game?.playerVisual;
   if(this.canPatch(visual)){
    this.patch(visual);
    return;
   }
   this.frameHandle=requestAnimationFrame(seek);
  };
  seek();
 }

 canPatch(visual){
  return !!visual
   &&visual!==this.patchedVisual
   &&visual.loaded===true
   &&visual.actions instanceof Map
   &&typeof visual.update==='function'
   &&typeof visual.play==='function';
 }

 clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
 }

 patch(visual){
  if(visual.__villagerLocomotionSync){
   this.patchedVisual=visual;
   return;
  }

  const originalUpdate=visual.update.bind(visual);
  const originalPlay=visual.play.bind(visual);
  const player=this.player;
  let lastX=player.position.x;
  let lastZ=player.position.z;
  let warmed=false;
  let groundSpeed=0;

  visual.play=(name,fade=.16,timeScale=1,forceRestart=false)=>{
   const key=String(name||'').toLowerCase();

   if(key.includes('walking')){
    // Ranger's normal free walk is about 5.2 world units/s. The stock KayKit
    // walk clip looks correct when played roughly 30% faster at that speed.
    // Carrying uses a slower reference because the controller deliberately
    // reduces translation while a log is on the shoulder.
    const carryingLog=visual.carryingType==='log';
    const referenceSpeed=carryingLog?2.9:4.0;
    const minScale=carryingLog?.55:.68;
    const maxScale=carryingLog?1.28:1.42;
    timeScale=this.clamp(groundSpeed/referenceSpeed,minScale,maxScale);
   }else if(key.includes('running')){
    // Free sprint is ~8.2 world units/s. Match the faster translation with a
    // visibly quicker run cycle instead of letting the feet slide forward.
    timeScale=this.clamp(groundSpeed/6.2,.88,1.40);
   }

   return originalPlay(name,fade,timeScale,forceRestart);
  };

  visual.update=(dt,moveAmount=0,locomotion={})=>{
   const x=player.position.x;
   const z=player.position.z;
   if(warmed&&dt>.0001){
    const measured=Math.hypot(x-lastX,z-lastZ)/dt;
    // A little smoothing prevents animation cadence jitter on uneven terrain.
    groundSpeed+=(measured-groundSpeed)*(1-Math.exp(-14*dt));
   }else{
    warmed=true;
   }
   lastX=x;
   lastZ=z;

   // If the Ranger is pushing into a collider and not actually translating,
   // transition toward idle instead of walking in place against the obstacle.
   let syncedMoveAmount=moveAmount;
   if(locomotion?.isGrounded&&groundSpeed<.055) syncedMoveAmount=0;

   return originalUpdate(dt,syncedMoveAmount,locomotion);
  };

  visual.__villagerLocomotionSync=true;
  this.patchedVisual=visual;
 }

 dispose(){
  if(this.frameHandle)cancelAnimationFrame(this.frameHandle);
  this.frameHandle=0;
 }
}
