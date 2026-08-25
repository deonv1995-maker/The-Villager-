export class ThirdPersonCamera{
  constructor(THREE,{camera,target,input,world}){
    this.T=THREE;
    this.camera=camera;
    this.target=target;
    this.input=input;
    this.world=world;
    this.yaw=0;
    this.pitch=.12;
    this.distance=8.8;
    this.targetHeight=1.55;
    this.lookSensitivity=1.9;
    this.desired=new THREE.Vector3();
    this.focus=new THREE.Vector3();
    this.cameraVector=new THREE.Vector3();
    this.samplePoint=new THREE.Vector3();
  }

  constrainToTerrain(){
    if(!this.world?.surfaceHeightAt)return;

    this.cameraVector.copy(this.desired).sub(this.focus);
    let safeT=1;
    const samples=14;
    const clearance=.62;

    // Sample from the player toward the desired camera position. If the line
    // of sight would pass into terrain, stop the camera just before that point.
    for(let i=2;i<=samples;i++){
      const t=i/samples;
      this.samplePoint.copy(this.focus).addScaledVector(this.cameraVector,t);
      const ground=this.world.surfaceHeightAt(this.samplePoint.x,this.samplePoint.z);
      if(ground+clearance>this.samplePoint.y){
        safeT=Math.max(.20,(i-2)/samples);
        break;
      }
    }

    if(safeT<1){
      this.desired.copy(this.focus).addScaledVector(this.cameraVector,safeT);
    }

    const cameraGround=this.world.surfaceHeightAt(this.desired.x,this.desired.z);
    this.desired.y=Math.max(this.desired.y,cameraGround+clearance);
  }

  update(dt){
    const look=this.input?.look||{x:0,y:0};
    this.yaw-=look.x*this.lookSensitivity*dt;
    this.pitch=this.T.MathUtils.clamp(this.pitch-look.y*this.lookSensitivity*.78*dt,-.18,.48);

    this.focus.set(this.target.position.x,this.target.position.y+this.targetHeight,this.target.position.z);
    const horizontal=Math.cos(this.pitch)*this.distance;
    this.desired.set(
      this.focus.x+Math.sin(this.yaw)*horizontal,
      this.focus.y+Math.sin(this.pitch)*this.distance+1.0,
      this.focus.z+Math.cos(this.yaw)*horizontal
    );

    this.constrainToTerrain();

    const alpha=1-Math.exp(-dt*12);
    this.camera.position.lerp(this.desired,alpha);
    this.camera.lookAt(this.focus);
  }

  getForward(out=new this.T.Vector3()){
    out.set(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    return out.normalize();
  }

  getRight(out=new this.T.Vector3()){
    out.set(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    return out.normalize();
  }
}
