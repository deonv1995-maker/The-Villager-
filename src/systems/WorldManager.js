import { IslandTerrain } from './world/IslandTerrain.js?v=516';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=515';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=518';

export class WorldManager {
 constructor(THREE, scene) {
  this.THREE = THREE;
  this.scene = scene;
  this.terrain = new IslandTerrain(THREE);
  this.environment = null;
  this.features = null;
  this.maxStepUp = .62;
  this.steepSlopeLimit = 1.28;
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

 surfaceHeightAt(x, z, currentY = null) {
  const terrainY = this.terrain.heightAt(x, z);
  if (!this.features?.walkableHeightAt) return terrainY;
  return this.features.walkableHeightAt(x, z, currentY, terrainY);
 }

 resolveMovement(fromX, fromZ, currentY, toX, toZ) {
  const ground = this.surfaceHeightAt(toX, toZ, currentY);
  const rise = ground - currentY;
  const onWalkable = this.features?.hasReachableWalkableAt?.(toX, toZ, currentY) || false;

  if (rise > this.maxStepUp) {
   return { allowed: false, ground, reason: 'step' };
  }

  const slope = this.terrain.slopeAt(toX, toZ);
  if (!onWalkable && slope > this.steepSlopeLimit && rise > .10) {
   return { allowed: false, ground, reason: 'steep' };
  }

  return { allowed: true, ground, reason: null };
 }
}
