import { RockDressedTerrain } from './RockDressedTerrain.js?v=548';

// Lightweight grass presentation layer.
//
// IMPORTANT: terrain height sampling is deliberately NOT filtered here.
// The previous 0.5.47 pass averaged multiple neighbouring height queries for
// every terrain sample. On the 240x240 island mesh, surface colour/slope checks
// multiplied that into millions of extra terrain evaluations and could leave
// mobile devices sitting on the native loading screen before the first frame.
//
// RockDressedTerrain remains the single authority for geography, collision,
// ramps and player grounding. Visual smoothing is done only through shared
// vertex normals on the main land mesh, which keeps traversal and rendering in
// perfect agreement and has no recurring runtime cost.
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
