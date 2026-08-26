import { IslandTerrain as BaseIslandTerrain } from './IslandTerrain.js?v=536';

// Regional shaping layer.
//
// IslandTerrain owns the stable terrain mesh, cliff geometry and height sampling.
// This class only adds large-scale geography on top of that foundation so new
// regions can be expanded without touching the cliff/seam implementation.
export class RegionalIslandTerrain extends BaseIslandTerrain {
 constructor(THREE){
  super(THREE);
  this.regionProfiles={
   westernHighland:{cx:-58,cz:35,yaw:.28,rx:38,rz:28,height:3.35},
   northernRidge:{cx:8,cz:55,yaw:-.18,rx:55,rz:12,height:2.15},
   easternShelf:{cx:54,cz:18,yaw:-.54,rx:34,rz:23,height:2.45},
   southernBasin:{cx:18,cz:-58,yaw:.20,rx:44,rz:30,height:-2.25},
   westernValley:{cx:-66,cz:-24,yaw:-.42,rx:38,rz:18,height:-1.55},
   centralSaddle:{cx:-2,cz:24,yaw:.12,rx:27,rz:18,height:-1.25}
  };
 }

 rotatedEllipseDistance(x,z,profile){
  const dx=x-profile.cx;
  const dz=z-profile.cz;
  const c=Math.cos(profile.yaw||0);
  const s=Math.sin(profile.yaw||0);
  const u=(dx*c+dz*s)/profile.rx;
  const v=(-dx*s+dz*c)/profile.rz;
  return Math.hypot(u,v);
 }

 softRegionWeight(x,z,profile,inner=.62,outer=1.12){
  const d=this.rotatedEllipseDistance(x,z,profile);
  return 1-this.smoothstep(inner,outer,d);
 }

 softPlateau(x,z,profile){
  const weight=this.softRegionWeight(x,z,profile,.58,1.14);
  if(weight<=0)return 0;

  // A very small amount of long-wave variation keeps broad elevated regions
  // from reading as artificial flat discs while preserving walkable tops.
  const detail=(Math.sin((x+profile.cx)*.045)+Math.cos((z-profile.cz)*.052))*.10;
  return (profile.height+detail*Math.sign(profile.height||1))*weight;
 }

 ridgeChain(x,z){
  let h=0;
  h+=this.rotatedGaussian(x,z,-18,62,-.22,42,9,1.35);
  h+=this.rotatedGaussian(x,z,18,55,-.08,36,8,1.05);
  h+=this.rotatedGaussian(x,z,46,47,.18,27,7,.72);
  return h;
 }

 knollField(x,z){
  let h=0;
  h+=this.gaussian(x,z,-84,6,18,15,1.45);
  h+=this.gaussian(x,z,77,42,17,14,1.25);
  h+=this.gaussian(x,z,72,-22,20,15,1.05);
  h+=this.gaussian(x,z,-38,-68,19,16,.95);
  return h;
 }

 regionalHeightAt(x,z){
  const base=super.regionalHeightAt(x,z);
  const p=this.regionProfiles;

  let sculpt=0;
  sculpt+=this.softPlateau(x,z,p.westernHighland);
  sculpt+=this.softPlateau(x,z,p.northernRidge);
  sculpt+=this.softPlateau(x,z,p.easternShelf);
  sculpt+=this.softPlateau(x,z,p.southernBasin);
  sculpt+=this.softPlateau(x,z,p.westernValley);
  sculpt+=this.softPlateau(x,z,p.centralSaddle);
  sculpt+=this.ridgeChain(x,z);
  sculpt+=this.knollField(x,z);

  // Preserve the tested spawn/traversal area while allowing the horizon and
  // outer island to become much more geographically varied.
  const r=Math.hypot(x,z);
  const spawnProtection=this.smoothstep(20,34,r);

  // Keep the existing cliff test formation visually dominant in its immediate
  // neighbourhood. Regional shaping fades in again outside that formation.
  const cliff=this.cliffFormationProfileAt(x,z);
  const cliffProtection=1-this.smoothstep(.15,.72,cliff.weight);
  const regionalBlend=Math.max(.22,cliffProtection);

  return base+sculpt*spawnProtection*regionalBlend;
 }

 terrainRegionAt(x,z){
  let best={name:'lowlands',weight:0};
  for(const [name,profile] of Object.entries(this.regionProfiles)){
   const weight=this.softRegionWeight(x,z,profile,.50,1.12);
   if(weight>best.weight)best={name,weight};
  }
  return best;
 }

 // Never remove the authoritative island ground beneath cliff detail meshes.
 // Overlap is intentional and guarantees watertight terrain at every seam.
 shouldCutGroundQuad(){return false;}
}
