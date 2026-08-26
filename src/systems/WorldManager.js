import { IslandTerrain } from './world/IslandTerrain.js?v=533';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=520';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=534';

export class WorldManager {
 constructor(THREE, scene) {
  this.THREE = THREE;
  this.scene = scene;
  this.terrain = new IslandTerrain(THREE);
  this.environment = null;
  this.features = null;
  this.maxStepUp = .68;
  this.cliffPlayerClearance = 1.05;
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

 cliffProfileAt(x, z) {
  return this.terrain.cliffFormationProfileAt?.(x, z) || null;
 }

 isApproachingSolidCliff(fromX, fromZ, toX, toZ) {
  const from = this.cliffProfileAt(fromX, fromZ);
  const to = this.cliffProfileAt(toX, toZ);
  if (!from || !to) return false;

  const solid = to.weight > .12 && to.rampMask < .36 && to.drop > 1.15;
  if (!solid) return false;

  const fromDistance = Math.abs(from.signed);
  const toDistance = Math.abs(to.signed);
  const clearance = this.cliffPlayerClearance;

  if (toDistance < clearance && toDistance <= fromDistance + .001) return true;
  if (from.signed * to.signed < 0) return true;

  return false;
 }

 resolveMovement(fromX, fromZ, currentY, toX, toZ) {
  const ground = this.surfaceHeightAt(toX, toZ);
  const rise = ground - currentY;

  if (this.isApproachingSolidCliff(fromX, fromZ, toX, toZ)
   || this.terrain.moduleFormationBlocksSegment(fromX, fromZ, toX, toZ)) {
   return { allowed: false, ground, reason: 'procedural-cliff' };
  }

  if (rise > this.maxStepUp) {
   return { allowed: false, ground, reason: 'step' };
  }

  return { allowed: true, ground, reason: null };
 }
}
