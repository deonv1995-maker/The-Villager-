export class WeightedSprintVisualSystem{
 constructor({world,playerController,materials,hauling}){
  this.world=world;
  this.playerController=playerController;
  this.materials=materials;
  this.hauling=hauling;
  this.originalHaulUpdateVisual=null;
 }

 initialize(){
  if(this.world)this.world.weightedSprintVisual=this;
  if(this.hauling?.updateVisual&&!this.originalHaulUpdateVisual){
   this.originalHaulUpdateVisual=this.hauling.updateVisual.bind(this.hauling);
   this.hauling.updateVisual=(dt,moveAmount=0)=>{
    this.originalHaulUpdateVisual(dt,moveAmount);
    this.update();
   };
  }
 }

 walkingName(visual){
  if(visual?.actions?.has?.('Walking_A'))return 'Walking_A';
  if(visual?.actions?.has?.('Walking'))return 'Walking';
  return null;
 }

 applyTorsoLean(visual,amount){
  if(!visual?.bone||amount<=0)return;
  const used=new Set();
  const spine=visual.bone('spine');
  const chest=visual.bone('chest')||visual.bone('spine.001');
  for(const [bone,share] of [[spine,.62],[chest,.38]]){
   if(!bone||used.has(bone))continue;
   used.add(bone);
   bone.rotateX(amount*share);
   bone.updateWorldMatrix?.(true,true);
  }
 }

 applyDragPull(visual,count){
  if(!visual?.poseArm)return;
  const three=count>=3;
  const elbowY=three ? .97 : 1.02;
  const handY=three ? .63 : .69;
  const elbowZ=three ? -.29 : -.25;
  const handZ=three ? -.61 : -.56;
  visual.poseArm('l',{x:.44,y:elbowY,z:elbowZ},{x:.21,y:handY,z:handZ},.995);
  visual.poseArm('r',{x:-.44,y:elbowY,z:elbowZ},{x:-.21,y:handY,z:handZ},.995);
 }

 update(){
  const pc=this.playerController;
  if(!pc?.isSprinting)return;
  const visual=this.world?.playerVisual;
  if(!visual?.loaded)return;

  const count=this.hauling?.count?.()||0;
  const shoulder=this.materials?.carried?.type==='log'&&count===0;
  const dragging=count>=2&&!this.hauling?.isBusy?.();
  if(!shoulder&&!dragging)return;

  const walk=this.walkingName(visual);
  if(shoulder){
   if(walk&&pc.moveAmount>.06)visual.play?.(walk,.10,.78);
   this.applyTorsoLean(visual,.075);
   visual.applyCarryPose?.(.995);
  }else if(dragging){
   const three=count>=3;
   if(walk&&pc.moveAmount>.06)visual.play?.(walk,.10,three ? .58 : .66);
   this.applyTorsoLean(visual,three ? .26 : .21);
   this.applyDragPull(visual,count);
  }

  visual.model?.updateMatrixWorld?.(true);
 }
}
