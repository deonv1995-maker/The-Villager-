import { IslandTerrain } from './world/IslandTerrain.js';
import { EnvironmentPopulation } from './world/EnvironmentPopulation.js?v=505';
export class WorldManager{
 constructor(THREE,scene){this.THREE=THREE;this.scene=scene;this.terrain=new IslandTerrain(THREE);this.environment=null;}
 initialize(){const root=this.terrain.create();this.scene.add(root);this.environment=new EnvironmentPopulation(this.THREE,{world:this,scene:this.scene});this.environment.initialize();}
 heightAt(x,z){return this.terrain.heightAt(x,z);}
}
