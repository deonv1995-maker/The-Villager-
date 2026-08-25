import { IslandTerrain } from './world/IslandTerrain.js?v=523';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=520';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=523';

export class WorldManager {
 constructor(THREE, scene) {
  this.THREE = THREE;
  this.scene = scene;
  this.terrain = new IslandTerrain(THREE);
  this.environment = null;
  this.features = null;
  this.maxStepUp = .68;
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

 resolveMovement(fromX, fromZ, currentY, toX, toZ) {
  const ground = this.surfaceHeightAt(toX, toZ);
  const rise = ground - currentY;

  if (this.terrain.moduleFormationBlocksSegment(fromX, fromZ, toX, toZ)) {
   return { allowed: false, ground, reason: 'module-cliff' };
  }

  if (rise > this.maxStepUp) {
   return { allowed: false, ground, reason: 'step' };
  }

  return { allowed: true, ground, reason: null };
 }
}
