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
 }

 showFeedback(text){
  if(!this.feedbackElement||!text)return;
  this.feedbackElement.textContent=text;
  this.feedbackElement.classList.add('show');
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>this.feedbackElement.classList.remove('show'),820);
 }

 resolve(){
  if(this.materials?.carried){
   if(this.materials.carried.type==='log'&&this.buildingModes){
    return {type:'place-log',label:this.buildingModes.actionLabel()};
   }
   return {type:'place',label:`PLACE ${this.materials.carried.type.toUpperCase()}`};
  }

  const loose=this.materials?.findNearestLoose?.();
  if(loose){
   return {type:'pickup',item:loose,label:`TAKE ${loose.type.toUpperCase()}`};
  }

  const reaction=this.reactions?.findInteraction?.();
  if(reaction){
   return {type:'reaction',...reaction};
  }

  const harvest=this.harvesting?.currentTarget;
  if(harvest){
   return {type:'harvest',target:harvest,label:this.harvesting.actionLabelFor(harvest)};
  }

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
  button.disabled=false;
 }

 perform(){
  const interaction=this.resolve();
  if(!interaction)return false;

  if(interaction.type==='pickup'){
   if(this.materials.pickup(interaction.item)){
    this.showFeedback(`${interaction.item.type==='log'?'Log':'Stone'} picked up`);
    this.current=null;
    this.updateButton();
    return true;
   }
   return false;
  }

  if(interaction.type==='place-log'){
   const placed=this.buildingModes.placeCarriedLog();
   if(placed){
    const mode=this.buildingModes.mode;
    this.showFeedback(mode==='raw'?'Log placed':`${this.buildingModes.modeLabel(mode)} placed`);
    this.current=null;
    this.updateButton();
    return true;
   }
   this.showFeedback('Cannot place here');
   return false;
  }

  if(interaction.type==='place'){
   const placed=this.materials.placeCarried();
   if(placed){
    this.showFeedback(`${placed.type==='log'?'Log':'Stone'} placed`);
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
  this.refreshTimer-=dt;
  if(this.refreshTimer>0)return;
  this.refreshTimer=this.refreshInterval;
  this.current=this.resolve();
  this.updateButton();
 }
}
