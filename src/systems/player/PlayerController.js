export class PlayerController {
 constructor(THREE,{player,input,cameraController,world,groundOffset=0}){
  this.T=THREE;
  this.player=player;
  this.input=input;
  this.cameraController=cameraController;
  this.world=world;
  this.groundOffset=groundOffset;

  this.moveSpeed=5.2;
  this.turnSpeed=12;
  this.maxMoveSubstep=.22;

  // Vertical locomotion is owned here so terrain traversal remains the single
  // authority for horizontal movement while jump/fall state stays independent.
  this.jumpSpeed=7.7;
  this.gravity=19.5;
  this.maxFallSpeed=24;
  this.jumpBufferDuration=.12;
  this.coyoteDuration=.10;
  this.jumpBufferTimer=0;
  this.coyoteTimer=this.coyoteDuration;
  this.verticalVelocity=0;
  this.isGrounded=true;
  this.jumpStartedThisFrame=false;
  this.landedThisFrame=false;
  this.groundLeaveTolerance=.48;

  this.forward=new THREE.Vector3();
  this.right=new THREE.Vector3();
  this.move=new THREE.Vector3();
  this.isMoving=false;
  this.moveAmount=0;
 }

 update(dt){
  this.jumpStartedThisFrame=false;
  this.landedThisFrame=false;

  if(this.input?.consumeJump?.())this.jumpBufferTimer=this.jumpBufferDuration;
  else this.jumpBufferTimer=Math.max(0,this.jumpBufferTimer-dt);

  if(this.isGrounded)this.coyoteTimer=this.coyoteDuration;
  else this.coyoteTimer=Math.max(0,this.coyoteTimer-dt);

  if(this.jumpBufferTimer>0&&this.coyoteTimer>0){
    this.startJump();
  }

  this.updateHorizontal(dt);
  this.updateVertical(dt);
 }

 startJump(){
  this.isGrounded=false;
  this.verticalVelocity=this.jumpSpeed;
  this.jumpBufferTimer=0;
  this.coyoteTimer=0;
  this.jumpStartedThisFrame=true;
 }

 updateHorizontal(dt){
  const input=this.input?.move||{x:0,y:0};
  let x=input.x,y=input.y;
  const mag=Math.hypot(x,y);
  this.moveAmount=Math.min(mag,1);

  if(mag<.06){
   this.isMoving=false;
   this.moveAmount=0;
   return;
  }

  if(mag>1){x/=mag;y/=mag;}
  this.cameraController.getForward(this.forward);
  this.cameraController.getRight(this.right);
  this.move.copy(this.right).multiplyScalar(x).addScaledVector(this.forward,-y);
  if(this.move.lengthSq()>.0001)this.move.normalize();

  const distance=this.moveSpeed*this.moveAmount*dt;
  const substeps=Math.max(1,Math.ceil(distance/this.maxMoveSubstep));
  const step=distance/substeps;

  for(let i=0;i<substeps;i++){
   if(!this.moveOneStep(step))break;
  }

  const targetYaw=Math.atan2(this.move.x,this.move.z);
  let delta=targetYaw-this.player.rotation.y;
  delta=Math.atan2(Math.sin(delta),Math.cos(delta));
  this.player.rotation.y+=delta*(1-Math.exp(-this.turnSpeed*dt));
  this.isMoving=true;
 }

 moveOneStep(step){
  const ox=this.player.position.x;
  const oz=this.player.position.z;
  const oy=this.player.position.y-this.groundOffset;
  const nx=ox+this.move.x*step;
  const nz=oz+this.move.z*step;

  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(nx,nz))return false;

  if(this.tryMove(ox,oz,oy,nx,nz))return true;

  const xOnly=ox+this.move.x*step;
  const zOnly=oz+this.move.z*step;
  const canX=Math.abs(this.move.x)>.001
   &&(!this.world?.isWithinPlayableBounds||this.world.isWithinPlayableBounds(xOnly,oz))
   &&this.canMove(ox,oz,oy,xOnly,oz);
  const canZ=Math.abs(this.move.z)>.001
   &&(!this.world?.isWithinPlayableBounds||this.world.isWithinPlayableBounds(ox,zOnly))
   &&this.canMove(ox,oz,oy,ox,zOnly);

  if(canX&&canZ){
   if(Math.abs(this.move.x)>=Math.abs(this.move.z))this.player.position.x=xOnly;
   else this.player.position.z=zOnly;
   return true;
  }
  if(canX){this.player.position.x=xOnly;return true;}
  if(canZ){this.player.position.z=zOnly;return true;}
  return false;
 }

 updateVertical(dt){
  let ground=this.groundHeight();

  if(this.isGrounded){
   const currentFootY=this.player.position.y-this.groundOffset;
   const targetFootY=ground-this.groundOffset;

   if(currentFootY-targetFootY>this.groundLeaveTolerance){
    this.isGrounded=false;
    this.verticalVelocity=Math.min(0,this.verticalVelocity);
   }else{
    this.verticalVelocity=0;
    this.player.position.y=ground;
    return;
   }
  }

  const fromFootY=this.player.position.y-this.groundOffset;
  this.verticalVelocity=Math.max(
   this.verticalVelocity-this.gravity*dt,
   -this.maxFallSpeed
  );
  const toFootY=fromFootY+this.verticalVelocity*dt;
  this.player.position.y=toFootY+this.groundOffset;

  if(this.verticalVelocity>0)return;

  // Descending uses a swept support query. If the Ranger crosses the top of a
  // registered rock between two frames, he lands on that support instead of
  // passing through it. Terrain remains the fallback surface.
  let landingFootY;
  if(this.world?.landingSurfaceHeightForSweep){
   landingFootY=this.world.landingSurfaceHeightForSweep(
    this.player.position.x,
    this.player.position.z,
    fromFootY,
    toFootY
   );
  }else{
   landingFootY=this.world?.surfaceHeightAt
    ?this.world.surfaceHeightAt(this.player.position.x,this.player.position.z)
    :this.world?.heightAt?.(this.player.position.x,this.player.position.z)??0;
  }

  if(fromFootY>=landingFootY-.06&&toFootY<=landingFootY){
   this.player.position.y=landingFootY+this.groundOffset;
   this.verticalVelocity=0;
   this.isGrounded=true;
   this.landedThisFrame=true;
   this.coyoteTimer=this.coyoteDuration;
  }
 }

 groundHeight(){
  const footY=this.player.position.y-this.groundOffset;
  let ground;
  if(this.world?.landingSurfaceHeightAt){
   ground=this.world.landingSurfaceHeightAt(
    this.player.position.x,
    this.player.position.z,
    footY,
    this.isGrounded
   );
  }else{
   ground=this.world?.surfaceHeightAt
    ?this.world.surfaceHeightAt(this.player.position.x,this.player.position.z)
    :this.world?.heightAt?.(this.player.position.x,this.player.position.z)??0;
  }
  return ground+this.groundOffset;
 }

 canMove(fromX,fromZ,currentY,toX,toZ){
  if(!this.world?.resolveMovement)return true;
  return this.world.resolveMovement(fromX,fromZ,currentY,toX,toZ).allowed;
 }

 tryMove(fromX,fromZ,currentY,toX,toZ){
  if(!this.canMove(fromX,fromZ,currentY,toX,toZ))return false;
  this.player.position.x=toX;
  this.player.position.z=toZ;
  return true;
 }

 get locomotionState(){
  return {
   isGrounded:this.isGrounded,
   isJumping:!this.isGrounded&&this.verticalVelocity>0,
   isFalling:!this.isGrounded&&this.verticalVelocity<=0,
   verticalVelocity:this.verticalVelocity,
   jumpStarted:this.jumpStartedThisFrame,
   landed:this.landedThisFrame
  };
 }
}
