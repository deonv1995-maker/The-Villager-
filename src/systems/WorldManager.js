import { IslandTerrain } from './world/IslandTerrain.js?v=516';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=515';
import { TerrainFeatures } from './world/TerrainFeatures.js?v=519';

export class WorldManager {
 constructor(THREE, scene) {
  this.THREE = THREE;
  this.scene = scene;
  this.terrain = new IslandTerrain(THREE);
  this.environment = null;
  this.features = null;
  this.maxStepUp = .68;
  this.cliffBarrierHalfWidth = 1.7;
  this.cliffSlopeLimit = .58;
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
  // The procedural terrain remains the single walkable-ground authority.
  // Cliff prefabs are fitted over this surface visually instead of creating
  // a second competing height source.
  return this.terrain.heightAt(x, z);
 }

 cliffMovementProfile(x, z) {
  const nearest = this.terrain.nearestCliffFrame(x, z);
  const feature = this.terrain.cliffFeatureProfile(nearest.t);
  const dx = x - feature.x;
  const dz = z - feature.z;
  return {
   signed: dx * feature.nx + dz * feature.nz,
   distance: nearest.dist,
   t: nearest.t,
   drop: feature.drop,
   active: feature.drop > 1.15 && nearest.t > .015 && nearest.t < .985
  };
 }

 resolveMovement(fromX, fromZ, currentY, toX, toZ) {
  const ground = this.surfaceHeightAt(toX, toZ);
  const rise = ground - currentY;

  if (rise > this.maxStepUp) {
   return { allowed: false, ground, reason: 'step' };
  }

  const from = this.cliffMovementProfile(fromX, fromZ);
  const to = this.cliffMovementProfile(toX, toZ);
  const deltaNormal = to.signed - from.signed;
  const enteringBarrier = Math.abs(to.signed) < this.cliffBarrierHalfWidth && Math.abs(to.signed) <= Math.abs(from.signed) + .03;

  if (
   to.active &&
   enteringBarrier &&
   Math.abs(deltaNormal) > .012 &&
   this.terrain.slopeAt(toX, toZ) > this.cliffSlopeLimit
  ) {
   return { allowed: false, ground, reason: 'cliff' };
  }

  return { allowed: true, ground, reason: null };
 }
}
