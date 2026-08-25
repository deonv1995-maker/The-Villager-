import { IslandTerrain } from './world/IslandTerrain.js';
export class WorldManager{
 constructor(THREE,scene){this.THREE=THREE;this.scene=scene;this.terrain=new IslandTerrain(THREE);}
 initialize(){const root=this.terrain.create();this.scene.add(root);}
 heightAt(x,z){return this.terrain.heightAt(x,z);}
}
