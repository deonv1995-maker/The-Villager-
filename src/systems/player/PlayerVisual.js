export class PlayerVisual{
 constructor(T){this.T=T;this.root=new T.Group();this.root.name='PlayerVisual';this.phase=0;this.build();}
 mat(c){return new this.T.MeshLambertMaterial({color:c,flatShading:true});}
 mesh(g,m,y=0){const x=new this.T.Mesh(g,m);x.position.y=y;this.root.add(x);return x;}
 build(){const T=this.T,skin=this.mat(0xd99a62),shirt=this.mat(0x4f7d55),leather=this.mat(0x5b3926),dark=this.mat(0x263229),boot=this.mat(0x3d2a22),hair=this.mat(0x5a3828);
  this.body=this.mesh(new T.CapsuleGeometry(.42,.7,3,6),shirt,1.35);this.body.scale.set(1,.95,.75);
  this.head=this.mesh(new T.IcosahedronGeometry(.38,1),skin,2.18);this.hair=this.mesh(new T.SphereGeometry(.39,8,5,0,Math.PI*2,0,Math.PI*.55),hair,2.25);
  this.belt=this.mesh(new T.BoxGeometry(.78,.12,.5),leather,1.08);
  this.leftArm=this.mesh(new T.CapsuleGeometry(.13,.58,2,5),skin,1.43);this.leftArm.position.x=-.55;this.leftArm.rotation.z=-.08;
  this.rightArm=this.mesh(new T.CapsuleGeometry(.13,.58,2,5),skin,1.43);this.rightArm.position.x=.55;this.rightArm.rotation.z=.08;
  this.leftLeg=this.mesh(new T.CapsuleGeometry(.16,.62,2,5),dark,.55);this.leftLeg.position.x=-.22;
  this.rightLeg=this.mesh(new T.CapsuleGeometry(.16,.62,2,5),dark,.55);this.rightLeg.position.x=.22;
  this.leftBoot=this.mesh(new T.BoxGeometry(.3,.28,.48),boot,.12);this.leftBoot.position.x=-.22;this.leftBoot.position.z=.08;
  this.rightBoot=this.mesh(new T.BoxGeometry(.3,.28,.48),boot,.12);this.rightBoot.position.x=.22;this.rightBoot.position.z=.08;
 }
 update(dt,moving,locomotion={}){
  if(!locomotion.isGrounded){
   this.phase=0;
   const rising=locomotion.verticalVelocity>0;
   this.leftArm.rotation.x=this.T.MathUtils.lerp(this.leftArm.rotation.x,rising?-.55:-.25,.22);
   this.rightArm.rotation.x=this.T.MathUtils.lerp(this.rightArm.rotation.x,rising?-.55:-.25,.22);
   this.leftLeg.rotation.x=this.T.MathUtils.lerp(this.leftLeg.rotation.x,.42,.22);
   this.rightLeg.rotation.x=this.T.MathUtils.lerp(this.rightLeg.rotation.x,.42,.22);
   return;
  }
  if(!moving){this.phase=0;this.leftArm.rotation.x*=.82;this.rightArm.rotation.x*=.82;this.leftLeg.rotation.x*=.82;this.rightLeg.rotation.x*=.82;return;}
  this.phase+=dt*9;const s=Math.sin(this.phase)*.65;this.leftArm.rotation.x=s;this.rightArm.rotation.x=-s;this.leftLeg.rotation.x=-s*.65;this.rightLeg.rotation.x=s*.65;this.body.position.y=1.35+Math.abs(Math.sin(this.phase))*0.035;
 }
}
