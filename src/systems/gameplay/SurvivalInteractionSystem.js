export class SurvivalInteractionSystem{
 constructor({player,materials,harvesting,reactions,buildingModes=null,actionButton=null,feedbackElement=null}){
  this.player=player;
  this.materials=materials;
  this.harvesting=harvesting;
  this.reactions=reactions;
  this.buildingModes=buildingModes;
  this.actionButton=actionButton;
  this.feedbackElement=feedbackElement;
  this.refreshTimer=0;
  this.refreshInterval=.07;
  this.current=null;
  this.pending=null;
  this.feedbackTimer=null;

  this.onAction=e=>{
   e?.preventDefault?.();
   e?.stopPropagation?.();
   this.perform();
  };
 }

 initialize(){
  this.actionButton?.addEventListener('pointerdown',this.onAction,{passive:false});
  this.updateButton();
 }

 dispose(){
  this.actionButton?.removeEventListener('pointerdown',this.onAction);
  this.setBuildModeButtonLocked(false);
 }

 showFeedback(text){
  if(!this.feedbackElement||!text)return;
  this.feedbackElement.textContent=text;
  this.feedbackElement.classList.add('show');
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>this.feedbackElement.classList.remove('show'),820);
 }

 playerVisual(){return this.materials?.world?.playerVisual||null;}

 isPlacementLocked(){
  return this.pending?.type==='place-log'&&!!this.pending.placementSnapshot;
 }

 setBuildModeButtonLocked(locked){
  if(this.buildingModes?.button)this.buildingModes.button.disabled=!!locked;
 }

 resolve(){
  if(this.pending)return {type:'busy',label:this.pending.label||'WORKING'};

  const carryPhase=this.materials?.carryAnimationPhase?.();
  if(carryPhase==='pickup')return {type:'busy',label:'LIFTING LOG'};
  if(carryPhase==='place')return {type:'busy',label:'PLACING LOG'};
  if(carryPhase==='recover')return {type:'busy',label:'RE-BRACING'};

  if(this.materials?.carried){
   if(this.materials.carried.type==='log'&&this.buildingModes){
    return {type:'place-log',label:this.buildingModes.actionLabel()};
   }
   return {type:'place',label:`PLACE ${this.materials.carried.type.toUpperCase()}`};
  }

  const loose=this.materials?.findNearestLoose?.();
  if(loose)return {type:'pickup',item:loose,label:`TAKE ${loose.type.toUpperCase()}`};

  const reaction=this.reactions?.findInteraction?.();
  if(reaction)return {type:'reaction',...reaction};

  const harvest=this.harvesting?.currentTarget;
  if(harvest)return {type:'harvest',target:harvest,label:this.harvesting.actionLabelFor(harvest)};
  return null;
 }

 updateButton(){
  const button=this.actionButton;
  if(!button)return;
  if(!this.current){
   button.textContent='USE';
   button.classList.add('hidden-action');
   button.disabled=true;
   return;
  }
  button.textContent=this.current.label;
  button.classList.remove('hidden-action');
  button.disabled=this.current.type==='busy';
 }

 beginLogPlacement(){
  if(!this.materials?.carried||this.materials.carried.type!=='log')return false;

  // The construction preview stores the already-resolved destination. Capture
  // that exact result and the Ranger's facing direction at the same instant so
  // neither the target nor his body can drift while he performs the set-down.
  const placementSnapshot=this.buildingModes?.capturePlacementSnapshot?.();
  if(!placementSnapshot||!placementSnapshot.valid){
   this.showFeedback('Cannot place here');
   return false;
  }
  const lockedRotationY=this.player?.rotation?.y;
  if(!this.materials.beginPlaceAnimation?.())return false;

  this.playerVisual()?.triggerPlace?.();
  this.pending={
   type:'place-log',
   label:'PLACING LOG',
   placementSnapshot,
   lockedRotationY:Number.isFinite(lockedRotationY)?lockedRotationY:null
  };
  this.setBuildModeButtonLocked(true);
  this.current={type:'busy',label:'PLACING LOG'};
  this.updateButton();
  return true;
 }

 finishPendingPlacement(){
  const pending=this.pending;
  if(!pending||pending.type!=='place-log')return false;

  // Keep the final animation frame on exactly the same facing direction as the
  // first frame before committing the cached construction transform.
  if(this.player&&Number.isFinite(pending.lockedRotationY)){
   this.player.rotation.y=pending.lockedRotationY;
  }

  const snapshot=pending.placementSnapshot;
  const placed=this.buildingModes?.placeCarriedLogSnapshot?.(snapshot)||null;
  this.setBuildModeButtonLocked(false);
  this.pending=null;

  if(placed){
   const mode=snapshot?.mode||this.buildingModes?.mode;
   if(mode==='raw')this.showFeedback('Log placed');
   else this.showFeedback(`${this.buildingModes.modeLabel(mode)} ${placed.snapKind?'snapped':'placed'}`);
   this.current=null;
   this.updateButton();
   return true;
  }

  this.materials?.returnCarriedToShoulder?.();
  this.showFeedback('Cannot place here');
  this.current=null;
  this.updateButton();
  return false;
 }

 perform(){
  if(this.pending)return false;
  const interaction=this.resolve();
  if(!interaction||interaction.type==='busy')return false;

  if(interaction.type==='pickup'){
   if(this.materials.pickup(interaction.item)){
    if(interaction.item.type==='log')this.playerVisual()?.triggerPickup?.();
    this.showFeedback(interaction.item.type==='log'?'Lifting log to shoulder':'Stone picked up');
    this.current=null;
    this.updateButton();
    return true;
   }
   return false;
  }

  if(interaction.type==='place-log')return this.beginLogPlacement();

  if(interaction.type==='place'){
   const placed=this.materials.placeCarried();
   if(placed){
    const label=placed.type==='log'?'Log':placed.type==='grass'?'Grass roof':'Stone';
    this.showFeedback(`${label} placed`);
    this.current=null;
    this.updateButton();
    return true;
   }
   this.showFeedback('Cannot place here');
   return false;
  }

  if(interaction.type==='reaction'){
   if(this.reactions.light(interaction.site)){
    this.showFeedback(interaction.site.type==='furnace'?'Furnace lit':'Fire lit');
    this.current=null;
    this.updateButton();
    return true;
   }
   return false;
  }

  if(interaction.type==='harvest'){
   const result=this.harvesting.perform(interaction.target);
   if(result?.message)this.showFeedback(result.message);
   this.current=null;
   this.updateButton();
   return !!result;
  }
  return false;
 }

 update(dt){
  // PlayerController runs earlier in the frame and may receive movement input.
  // Re-applying the press-time yaw here guarantees the rendered Ranger never
  // twists during the lowering animation, without freezing the camera itself.
  if(this.pending?.type==='place-log'
   &&this.player
   &&Number.isFinite(this.pending.lockedRotationY)){
   this.player.rotation.y=this.pending.lockedRotationY;
  }

  if(this.pending?.type==='place-log'&&!this.materials?.isCarryAnimating?.('place')){
   this.finishPendingPlacement();
  }

  this.refreshTimer-=dt;
  if(this.refreshTimer>0)return;
  this.refreshTimer=this.refreshInterval;
  this.current=this.resolve();
  this.updateButton();
 }
}
