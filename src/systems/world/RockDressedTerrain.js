import { SafeRimTerrain } from './SafeRimTerrain.js?v=545';

// Terrain remains the authoritative continuous collision/height surface.
// Visible cliff faces are no longer generated as a stitched procedural wall;
// CliffRockDecorator dresses these same formation profiles with KayKit rocks.
export class RockDressedTerrain extends SafeRimTerrain {
 constructor(THREE){
  super(THREE);
  this.usesKayKitCliffRocks=true;
 }

 // Keep the grass shoulder and base apron, but remove the procedural rock wall.
 // The continuous island mesh underneath remains watertight and authoritative.
 appendCliffSpan(){ }
 appendCliffEndClosure(){ }

 getCliffDecorationStrips(){
  return this.cliffFormations.map((formation,index)=>({
   formation,
   index,
   spans:this.cliffWallSpansFor(formation)
  }));
 }

 cliffDecorationFrameFor(formation,u){
  return this.withCliffFormation(formation,()=>{
   const edgeV=this.cliffEdgeV(u);
   const edge=this.cliffFormationWorld(u,edgeV);
   const highProbe=this.cliffFormationWorld(u,edgeV+1.35);
   const lowProbe=this.cliffFormationWorld(u,edgeV-2.15);
   const outwardProbe=this.cliffFormationWorld(u,edgeV-1.0);

   const ua=u-.34;
   const ub=u+.34;
   const edgeA=this.cliffFormationWorld(ua,this.cliffEdgeV(ua));
   const edgeB=this.cliffFormationWorld(ub,this.cliffEdgeV(ub));
   const tx=edgeB.x-edgeA.x;
   const tz=edgeB.z-edgeA.z;
   const tangentLength=Math.max(.001,Math.hypot(tx,tz));

   let ox=outwardProbe.x-edge.x;
   let oz=outwardProbe.z-edge.z;
   const outwardLength=Math.max(.001,Math.hypot(ox,oz));
   ox/=outwardLength;
   oz/=outwardLength;

   const topY=this.heightAt(highProbe.x,highProbe.z)-.06;
   const bottomY=this.heightAt(lowProbe.x,lowProbe.z)+.04;
   const drop=Math.max(.1,topY-bottomY);
   const rampMask=this.cliffRampMask(u);

   return {
    formation,
    formationId:formation.id,
    u,
    edgeV,
    x:edge.x,
    z:edge.z,
    topY,
    bottomY,
    drop,
    rampMask,
    tangentX:tx/tangentLength,
    tangentZ:tz/tangentLength,
    tangentYaw:Math.atan2(tx,tz),
    outwardX:ox,
    outwardZ:oz
   };
  });
 }
}
