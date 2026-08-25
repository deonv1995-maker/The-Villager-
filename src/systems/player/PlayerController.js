export class PlayerController{
  constructor(THREE,{player,input,cameraController,world}){
    this.T=THREE;this.player=player;this.input=input;this.cameraController=cameraController;this.world=world;
    this.moveSpeed=5.2;this.turnSpeed=12;this.forward=new THREE.Vector3();this.right=new THREE.Vector3();this.move=new THREE.Vector3();
    this.isMoving=false;
  }

  update(dt){
    const input=this.input?.move||{x:0,y:0};
    let x=input.x,y=input.y;
    const mag=Math.hypot(x,y);
    if(mag<.06){this.isMoving=false;this.snapToGround(dt);return;}
    if(mag>1){x/=mag;y/=mag;}

    this.cameraController.getForward(this.forward);
    this.cameraController.getRight(this.right);
    this.move.copy(this.right).multiplyScalar(x).addScaledVector(this.forward,-y);
    if(this.move.lengthSq()>.0001)this.move.normalize();

    const nx=this.player.position.x+this.move.x*this.moveSpeed*dt;
    const nz=this.player.position.z+this.move.z*this.moveSpeed*dt;
    const radius=this.world?.terrain?.radius||90;
    const edge=radius-3;
    const dist=Math.hypot(nx*.92,nz*1.08);
    if(dist<edge){this.player.position.x=nx;this.player.position.z=nz;}

    const targetYaw=Math.atan2(this.move.x,this.move.z);
    let delta=targetYaw-this.player.rotation.y;
    delta=Math.atan2(Math.sin(delta),Math.cos(delta));
    this.player.rotation.y+=delta*(1-Math.exp(-this.turnSpeed*dt));
    this.isMoving=true;
    this.snapToGround(dt);
  }

  snapToGround(dt){
    const ground=this.world.heightAt(this.player.position.x,this.player.position.z)+1.05;
    this.player.position.y=this.T.MathUtils.lerp(this.player.position.y,ground,1-Math.exp(-18*dt));
  }
}
