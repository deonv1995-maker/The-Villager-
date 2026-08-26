import { RockDressedTerrain } from './RockDressedTerrain.js?v=549';

// Lightweight grass presentation layer.
//
// Terrain height sampling is deliberately NOT filtered here. RockDressedTerrain
// remains the single authority for geography, collision, ramps and player
// grounding. Visual smoothing is done only through shared vertex normals on the
// main land mesh, keeping traversal and rendering in agreement at mobile cost.
export class PolishedGrassTerrain extends RockDressedTerrain {
 constructor(THREE){
  super(THREE);
 }

 heightAt(x,z){
  return super.heightAt(x,z);
 }

 create(){
  const root=super.create();
  const land=root.getObjectByName?.('UnifiedProceduralIslandLand');

  if(land?.isMesh){
   if(land.geometry?.attributes?.position){
    land.geometry.computeVertexNormals();
    land.geometry.normalizeNormals?.();
   }

   const materials=Array.isArray(land.material)?land.material:[land.material];
   for(const material of materials){
    if(!material)continue;
    material.flatShading=false;
    material.roughness=.92;
    material.needsUpdate=true;
   }
  }

  return root;
 }
}
