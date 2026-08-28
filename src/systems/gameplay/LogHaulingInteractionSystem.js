export class LogHaulingInteractionSystem{
 constructor({interaction,hauling,materials}){
  this.interaction=interaction;
  this.hauling=hauling;
  this.materials=materials;
  this.originalResolve=null;
  this.originalPerform=null;
  this.originalUpdateButton=null;
  this.style=null;
  this.carryPlaceButton=null;
  this.drawer=null;
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
  this.interaction.dropHeldMaterial=()=>this.dropHeldMaterial();

  this.injectStyles();
  this.createCarryPlaceButton();
  this.interaction.updateButton();
 }

 injectStyles(){
  this.style=document.createElement('style');
  this.style.id='log-hauling-action-style';
  this.style.textContent=`
   /* Main contextual action sits left of JUMP. PLACE uses that slot only when
      no second hauling action is available. If ADD LOG appears, it moves above
      PLACE instead of expanding sideways across the screen. */
   #carry-place-button{right:94px;bottom:22px;background:#d2ae69dd}
   body.single-carry-place.haul-pickup-available #action-button{
    display:flex!important;right:94px!important;bottom:86px!important;
    opacity:1!important;pointer-events:auto!important;z-index:47!important;
   }
   body.build-material-in-hand.haul-pickup-available #action-button{display:flex!important}

   @media(max-width:620px){
    #carry-place-button{right:86px;bottom:20px}
    body.single-carry-place.haul-pickup-available #action-button{
     right:86px!important;bottom:80px!important;
    }
   }
  `;
  document.head.appendChild(this.style);
 }

 createCarryPlaceButton(){
  const button=document.createElement('button');
  button.id='carry-place-button';
  button.type='button';
  button.className='game-button hidden-action';
  button.dataset.gameUi='true';
  button.textContent='PLACE';
  button.setAttribute('aria-label','Place carried material');
  button.addEventListener('pointerdown',e=>{
   e.preventDefault();
   e.stopPropagation();
   if(button.disabled)return;
   const carried=this.materials?.carried;
   if(!carried)return;

   // A log can have ADD 2ND LOG as the contextual interaction at the same time.
   // Call the construction path directly so PLACE never steals the hauling tap.
   if(carried.type==='log')this.interaction.beginLogPlacement?.();
   else this.originalPerform?.();
  },{passive:false});
  document.body.appendChild(button);
  this.carryPlaceButton=button;
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

 updateCarryPlaceButton(){
  const button=this.carryPlaceButton;
  if(!button)return;
  const carried=this.materials?.carried||null;
  const show=!!carried&&this.hauling.count()===0;
  const busy=!!this.interaction?.pending
   ||this.hauling.isBusy()
   ||!!this.materials?.isCarryAnimating?.();

  document.body.classList.toggle('single-carry-place',show);
  button.classList.toggle('hidden-action',!show);
  button.disabled=!show||busy;
  button.textContent=busy?'WAIT':'PLACE';
  button.setAttribute('aria-label',carried?`Place ${carried.type}`:'Place carried material');
 }

 updateButton(){
  this.originalUpdateButton();
  const type=this.interaction?.current?.type||null;
  const addAvailable=type==='haul-add';
  const dropStack=type==='haul-drop';
  document.body.classList.toggle('haul-pickup-available',addAvailable);
  document.body.classList.toggle('haul-drop-available',dropStack);
  document.body.classList.toggle('haul-stack-active',this.hauling.count()>=2);
  this.updateCarryPlaceButton();
 }

 dropHeldMaterial(){
  if(this.interaction?.pending||this.hauling.isBusy()||this.materials?.isCarryAnimating?.())return false;
  const item=this.materials?.carried;
  const player=this.hauling?.player;
  if(!item?.object||!player)return false;

  const yaw=player.rotation.y;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  const rx=Math.cos(yaw),rz=-Math.sin(yaw);
  const x=player.position.x+rx*.82-fx*.18;
  const z=player.position.z+rz*.82-fz*.18;

  item.object.updateWorldMatrix(true,false);
  this.materials.root.attach(item.object);
  item.carryMotion=null;
  item.state='loose';

  if(item.type==='log'){
   const heading=yaw-Math.PI/2;
   if(item.physics){
    item.physics.active=false;
    item.physics.headingY=heading;
    item.physics.vx=item.physics.vy=item.physics.vz=0;
    item.physics.spinY=item.physics.rollSpeed=0;
    item.physics.settleTimer=0;
    item.physics.grounded=true;
   }
   item.object.position.x=x;
   item.object.position.z=z;
   const support=this.materials.computeTerrainLogPose?.(item,x,z)
    ??((this.materials.world?.heightAt?.(x,z)??0)+(this.materials.logRadius||.27));
   item.object.position.y=support;
   if(this.materials.tempLogQuaternion)item.object.quaternion.copy(this.materials.tempLogQuaternion);
  }else{
   const ground=this.materials.world?.heightAt?.(x,z)??0;
   const lift=(item.type==='grass') ? .34 : .24;
   item.object.position.set(x,ground+lift,z);
   if(item.type==='grass')item.object.rotation.set(.08,yaw,-1.05);
  }

  this.materials.carried=null;
  this.materials.updateHud?.();
  this.interaction.buildingModes?.destroyPreview?.();
  this.interaction.showFeedback?.(`${item.type==='log'?'Log':item.type==='grass'?'Grass bundle':'Material'} dropped`);
  this.interaction.current=null;
  this.interaction.updateButton();
  return true;
 }

 perform(){
  if(this.interaction?.pending||this.hauling.isBusy())return false;
  const current=this.interaction.resolve();
  if(!current||current.type==='busy')return false;

  if(current.type==='haul-add'){
   if(!this.hauling.beginAdd(current.item))return false;
   const count=this.hauling.count();
   this.interaction.showFeedback?.(
    count>=3?'Third log stacked for towing':'Pairing logs for towing'
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
  this.drawer=drawer||null;
 }
}
