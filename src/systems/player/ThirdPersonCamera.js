export class ThirdPersonCamera{
  constructor(THREE,{camera,target,input}){
    this.T=THREE;this.camera=camera;this.target=target;this.input=input;
    this.yaw=0;this.pitch=.12;this.distance=8.8;this.targetHeight=1.55;this.lookSensitivity=1.9;
    this.desired=new THREE.Vector3();this.focus=new THREE.Vector3();
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
