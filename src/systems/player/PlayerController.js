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
  this.forward=new THREE.Vector3();
  this.right=new THREE.Vector3();
  this.move=new THREE.Vector3();
  this.isMoving=false;
  this.moveAmount=0;
 }

 update(dt){
  const input=this.input?.move||{x:0,y:0};
  let x=input.x,y=input.y;
  const mag=Math.hypot(x,y);
  this.moveAmount=Math.min(mag,1);

  if(mag<.06){
   this.isMoving=false;
   this.moveAmount=0;
   this.snapToGround(dt);
   return;
  }

  if(mag>1){x/=mag;y/=mag;}
  this.cameraController.getForward(this.forward);
  this.cameraController.getRight(this.right);
  this.move.copy(this.right).multiplyScalar(x).addScaledVector(this.forward,-y);
  if(this.move.lengthSq()>.0001)this.move.normalize();

  const speed=this.moveSpeed*this.moveAmount;
  const step=speed*dt;
  const ox=this.player.position.x;
  const oz=this.player.position.z;
  const oy=this.player.position.y-this.groundOffset;
  const nx=ox+this.move.x*step;
  const nz=oz+this.move.z*step;

  const radius=this.world?.terrain?.radius||90;
  const edge=radius-3;
  const dist=Math.hypot(nx*.92,nz*1.08);

  if(dist<edge){
   if(!this.tryMove(ox,oz,oy,nx,nz)){
    const xOnly=ox+this.move.x*step;
    const zOnly=oz+this.move.z*step;
    const canX=Math.abs(this.move.x)>.001&&this.canMove(ox,oz,oy,xOnly,oz);
    const canZ=Math.abs(this.move.z)>.001&&this.canMove(ox,oz,oy,ox,zOnly);

    if(canX&&canZ){
     if(Math.abs(this.move.x)>=Math.abs(this.move.z))this.player.position.x=xOnly;
     else this.player.position.z=zOnly;
    }else if(canX)this.player.position.x=xOnly;
    else if(canZ)this.player.position.z=zOnly;
   }
  }

  const targetYaw=Math.atan2(this.move.x,this.move.z);
  let delta=targetYaw-this.player.rotation.y;
  delta=Math.atan2(Math.sin(delta),Math.cos(delta));
  this.player.rotation.y+=delta*(1-Math.exp(-this.turnSpeed*dt));
  this.isMoving=true;
  this.snapToGround(dt);
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

 snapToGround(dt){
  const currentY=this.player.position.y-this.groundOffset;
  const ground=(this.world.surfaceHeightAt
   ?this.world.surfaceHeightAt(this.player.position.x,this.player.position.z,currentY)
   :this.world.heightAt(this.player.position.x,this.player.position.z))+this.groundOffset;
  this.player.position.y=this.T.MathUtils.lerp(this.player.position.y,ground,1-Math.exp(-18*dt));
 }
}
