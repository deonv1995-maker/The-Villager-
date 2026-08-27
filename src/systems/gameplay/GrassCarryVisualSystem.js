export class GrassCarryVisualSystem{
 constructor({world,materials}){
  this.world=world;
  this.materials=materials;
 }

 update(){
  if(this.materials?.carried?.type!=='grass')return;
  const visual=this.world?.playerVisual;
  if(!visual?.poseArm)return;

  // Hold the bundle across the front of the torso with both hands instead of
  // letting the generic walk cycle pass through the prop.
  visual.poseArm('l',{x:.48,y:1.30,z:.36},{x:.20,y:1.21,z:.53},.97);
  visual.poseArm('r',{x:-.46,y:1.17,z:.40},{x:-.16,y:1.08,z:.60},.97);
  visual.model?.updateMatrixWorld?.(true);
 }
}
