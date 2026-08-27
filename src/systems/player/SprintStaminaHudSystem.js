export class SprintStaminaHudSystem{
 constructor({playerController,root,fill}){
  this.playerController=playerController;
  this.root=root;
  this.fill=fill;
  this.lingerDuration=1.45;
  this.lingerTimer=0;
  this.wasHeld=false;
 }

 initialize(){
  this.update(0);
 }

 update(dt){
  if(!this.root||!this.fill||!this.playerController)return;
  const pc=this.playerController;
  const held=!!pc.sprintHeld;

  if(pc.isSprinting||held){
   this.lingerTimer=this.lingerDuration;
  }else if(this.wasHeld&&!held){
   this.lingerTimer=this.lingerDuration;
  }else{
   this.lingerTimer=Math.max(0,this.lingerTimer-dt);
  }

  const visible=pc.isSprinting||held||this.lingerTimer>0;
  this.root.classList.toggle('visible',visible);
  this.root.classList.toggle('depleted',pc.staminaRatio<=.04);
  this.fill.style.transform=`scaleX(${pc.staminaRatio})`;
  this.root.setAttribute('aria-valuenow',String(Math.round(pc.stamina)));
  this.wasHeld=held;
 }
}
