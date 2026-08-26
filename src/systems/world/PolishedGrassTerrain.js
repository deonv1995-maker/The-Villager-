import { RockDressedTerrain } from './RockDressedTerrain.js?v=547';

// Final grass-surface presentation layer.
//
// RockDressedTerrain remains the authority for geography, cliffs, ramps and
// traversal. This layer only removes small high-frequency height changes from
// ordinary grassy ground and switches the terrain root to smooth vertex
// normals. Cliff seams, ramps and coast transitions are deliberately protected
// so visual polish cannot soften gameplay-critical boundaries.
export class PolishedGrassTerrain extends RockDressedTerrain {
 constructor(THREE){
  super(THREE);
  this.grassSmoothRadius=1.15;
  this.grassSmoothStrength=.30;
  this.grassSmoothMaxDelta=.18;
 }

 preserveSharpTerrainAt(x,z){
  const coast=this.islandMetric(x,z);
  if(coast>.91)return true;

  const profiles=this.cliffProfilesAt?.(x,z)||[];
  for(const profile of profiles){
   if(!profile||profile.weight<.035)continue;
   const seamDistance=Math.abs(profile.signed);

   // Keep the actual cliff break exact. KayKit rocks now provide the visual
   // breakup, while this underlying edge remains the stable traversal wall.
   if(profile.drop>1.05&&profile.rampMask<.42&&seamDistance<2.7)return true;

   // Preserve authored ramp profiles so smoothing never changes their grade.
   if(profile.rampMask>.22&&seamDistance<6.2)return true;
  }
  return false;
 }

 baseHeightAt(x,z){
  return super.heightAt(x,z);
 }

 heightAt(x,z){
  const center=this.baseHeightAt(x,z);
  if(!Number.isFinite(center)||this.preserveSharpTerrainAt(x,z))return center;

  const r=this.grassSmoothRadius;
  const d=r*.72;
  const samples=[
   [x+r,z,1],[x-r,z,1],[x,z+r,1],[x,z-r,1],
   [x+d,z+d,.62],[x-d,z+d,.62],[x+d,z-d,.62],[x-d,z-d,.62]
  ];

  let total=center*4.4;
  let weight=4.4;
  for(const [sx,sz,w] of samples){
   if(this.preserveSharpTerrainAt(sx,sz))continue;
   const h=this.baseHeightAt(sx,sz);
   if(!Number.isFinite(h))continue;
   total+=h*w;
   weight+=w;
  }

  if(weight<=4.4)return center;
  const average=total/weight;
  const delta=Math.max(-this.grassSmoothMaxDelta,Math.min(this.grassSmoothMaxDelta,average-center));
  return center+delta*this.grassSmoothStrength;
 }

 create(){
  const root=super.create();

  // The terrain stays low-poly in silhouette and colour, but smooth normals
  // remove the harsh triangular lighting changes visible across broad grass.
  root.traverse(child=>{
   if(!child.isMesh)return;
   if(child.geometry?.attributes?.position){
    child.geometry.computeVertexNormals();
   }
   const materials=Array.isArray(child.material)?child.material:[child.material];
   for(const material of materials){
    if(!material)continue;
    material.flatShading=false;
    material.needsUpdate=true;
   }
  });
  return root;
 }
}
