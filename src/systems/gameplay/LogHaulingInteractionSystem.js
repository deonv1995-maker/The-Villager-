export class LogHaulingInteractionSystem{
 constructor({interaction,hauling,materials}){
  this.interaction=interaction;
  this.hauling=hauling;
  this.materials=materials;
  this.originalResolve=null;
  this.originalPerform=null;
  this.originalUpdateButton=null;
  this.style=null;
  this.drawerPlaceHandler=null;
 }

 initialize(){
  if(!this.interaction||!this.hauling)return;
  this.interaction.logHauling=this.hauling;
  this.originalResolve=this.interaction.resolve.bind(this.interaction);
  this.originalPerform=this.interaction.perform.bind(this.interaction);
  this.originalUpdateButton=this.interaction.updateButton.bind(this.interaction);

  this.interaction.resolve=()=>this.resolve();
  this.interaction.perform=()=>this.perform();
  this.interaction.updateButton=()=>this.updateButton();

  this.style=document.createElement('style');
  this.style.id='log-hauling-action-style';
  this.style.textContent=`
   body.build-material-in-hand.haul-pickup-available #action-button{display:flex!important}
  `;
  document.head.appendChild(this.style);
  this.interaction.updateButton();
 }

 resolve(){
  if(this.hauling.isBusy())return {type:'busy',label:this.hauling.busyLabel()};

  if(this.hauling.count()>=2){
   const candidate=this.hauling.addCandidate();
   if(candidate)return {
    type:'haul-add',item:candidate,
    label:this.hauling.count()===2?'ADD 3RD LOG':'ADD LOG'
   };
   return {type:'haul-drop',label:`DROP ${this.hauling.count()} LOGS`};
  }

  if(this.materials?.carried?.type==='log'){
   const candidate=this.hauling.addCandidate();
   if(candidate)return {type:'haul-add',item:candidate,label:'ADD 2ND LOG'};
  }

  return this.originalResolve();
 }

 updateButton(){
  this.originalUpdateButton();
  const available=this.interaction?.current?.type==='haul-add';
  document.body.classList.toggle('haul-pickup-available',available);
 }

 perform(){
  if(this.interaction?.pending||this.hauling.isBusy())return false;
  const current=this.interaction.resolve();
  if(!current||current.type==='busy')return false;

  if(current.type==='haul-add'){
   if(!this.hauling.beginAdd(current.item))return false;
   const count=this.hauling.count();
   this.interaction.showFeedback?.(
    count>=3?'Third log stacked for dragging':'Pairing logs for dragging'
   );
   this.interaction.current=null;
   this.interaction.updateButton();
   return true;
  }

  if(current.type==='haul-drop'){
   if(!this.hauling.beginDrop())return false;
   this.interaction.showFeedback?.('Releasing log stack');
   this.interaction.current=null;
   this.interaction.updateButton();
   return true;
  }

  return this.originalPerform();
 }

 bindBuildDrawer(drawer){
  const button=drawer?.placeButton;
  if(!button||this.drawerPlaceHandler)return;
  this.drawerPlaceHandler=e=>{
   if(this.materials?.carried?.type!=='log')return;
   if(button.disabled)return;
   e.preventDefault();
   e.stopPropagation();
   e.stopImmediatePropagation?.();
   this.interaction.beginLogPlacement?.();
  };
  button.addEventListener('pointerdown',this.drawerPlaceHandler,{capture:true,passive:false});
 }
}
