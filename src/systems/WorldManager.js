import { RegionalIslandTerrain } from './world/RegionalIslandTerrain.js?v=541';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=542';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=541';

export class WorldManager {
 constructor(THREE, scene) {
  this.THREE = THREE;
  this.scene = scene;
  this.terrain = new RegionalIslandTerrain(THREE);
  this.environment = null;
  this.features = null;

  // Central traversal policy. Keep these rules here so the player controller,
  // future NPCs and other walkers can all use the same terrain authority.
  this.cliffPlayerClearance = 1.05;
  this.pathSampleSpacing = .13;
  this.maxSampleStepUp = .50;
  this.maxSampleStepDown = .72;
  this.maxWalkSlope = 1.75;
  this.playableCoastMetric = .985;
 }

 initialize() {
  const root = this.terrain.create();
  this.scene.add(root);
  this.features = new TerrainFeatures(this.THREE, { world: this, scene: this.scene });
  this.features.initialize();
  this.environment = new EnvironmentPopulation(this.THREE, { world: this, scene: this.scene });
  this.environment.initialize();
 }

 heightAt(x, z) {
  return this.terrain.heightAt(x, z);
 }

 surfaceHeightAt(x, z) {
  return this.terrain.heightAt(x, z);
 }

 isWithinPlayableBounds(x, z) {
  const metric=this.terrain.islandMetric?.(x,z);
  if(Number.isFinite(metric))return metric<this.playableCoastMetric;
  return Math.hypot(x,z)<(this.terrain.radius||90)-3;
 }

 cliffProfileAt(x, z) {
  return this.terrain.cliffFormationProfileAt?.(x, z) || null;
 }

 isApproachingSolidCliff(fromX, fromZ, toX, toZ) {
  const from = this.cliffProfileAt(fromX, fromZ);
  const to = this.cliffProfileAt(toX, toZ);
  if (!from || !to) return false;

  const mx=(fromX+toX)*.5;
  const mz=(fromZ+toZ)*.5;
  const mid=this.cliffProfileAt(mx,mz);

  // Every authored formation exposes a deliberate ramp through the same
  // profile API, so traversal stays data-driven as more cliffs are added.
  if((from.rampMask>.40&&to.rampMask>.40)||(mid?.rampMask>.48))return false;

  const solidProfile=[from,to,mid].some(p=>p&&p.weight>.12&&p.rampMask<.36&&p.drop>1.15);
  if(!solidProfile)return false;

  if(from.formationId===to.formationId&&from.signed*to.signed<0)return true;

  const fromDistance=Math.abs(from.signed);
  const toDistance=Math.abs(to.signed);
  if(to.formationId===from.formationId&&toDistance<this.cliffPlayerClearance&&toDistance<fromDistance-.001)return true;

  return false;
 }

 resolveMovement(fromX, fromZ, currentY, toX, toZ) {
  if(!this.isWithinPlayableBounds(toX,toZ)){
   return {allowed:false,ground:this.surfaceHeightAt(fromX,fromZ),reason:'coast'};
  }

  const dx=toX-fromX;
  const dz=toZ-fromZ;
  const distance=Math.hypot(dx,dz);
  const samples=Math.max(1,Math.ceil(distance/this.pathSampleSpacing));
  let px=fromX;
  let pz=fromZ;
  let previousGround=this.surfaceHeightAt(fromX,fromZ);

  for(let i=1;i<=samples;i++){
   const t=i/samples;
   const x=fromX+dx*t;
   const z=fromZ+dz*t;

   if(!this.isWithinPlayableBounds(x,z)){
    return {allowed:false,ground:previousGround,reason:'coast'};
   }

   if(this.isApproachingSolidCliff(px,pz,x,z)
    ||this.terrain.moduleFormationBlocksSegment(px,pz,x,z)){
    return {allowed:false,ground:previousGround,reason:'procedural-cliff'};
   }

   const ground=this.surfaceHeightAt(x,z);
   const rise=ground-previousGround;
   const sampleDistance=Math.max(.001,Math.hypot(x-px,z-pz));
   const slope=Math.abs(rise)/sampleDistance;
   const profile=this.cliffProfileAt(x,z);
   const onRamp=profile?.rampMask>.38;

   if(!onRamp&&rise>this.maxSampleStepUp){
    return {allowed:false,ground:previousGround,reason:'step-up'};
   }
   if(!onRamp&&rise<-this.maxSampleStepDown){
    return {allowed:false,ground:previousGround,reason:'drop'};
   }
   if(!onRamp&&slope>this.maxWalkSlope){
    return {allowed:false,ground:previousGround,reason:'slope'};
   }

   px=x;
   pz=z;
   previousGround=ground;
  }

  return {allowed:true,ground:previousGround,reason:null};
 }
}
