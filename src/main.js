import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GameBootstrap } from './systems/GameBootstrap.js?v=611';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=624';
import { ContextActionIconSystem } from './systems/input/ContextActionIconSystem.js?v=626';
import { InteriorStructureTransparencySystem } from './systems/rendering/InteriorStructureTransparencySystem.js?v=627';
import { EnvironmentVegetationColliderSystem } from './systems/world/EnvironmentVegetationColliderSystem.js?v=628';

const game=new GameBootstrap(THREE);
game.start();

const dismantleReuse=new DismantleReuseSystem({
 interaction:game.survivalInteraction,
 buildingModes:game.buildModes,
 materials:game.materials,
 player:game.player
});
dismantleReuse.initialize();
game.dismantleReuse=dismantleReuse;

const contextActionIcons=new ContextActionIconSystem({
 interaction:game.survivalInteraction,
 actionButton:document.getElementById('action-button'),
 disassemblyButton:document.getElementById('disassembly-mode-button')
});
contextActionIcons.initialize();
game.contextActionIcons=contextActionIcons;

const interiorTransparency=new InteriorStructureTransparencySystem({
 buildingModes:game.buildModes,
 player:game.player,
 camera:game.camera
});
interiorTransparency.initialize();
game.interiorTransparency=interiorTransparency;

const vegetationColliders=new EnvironmentVegetationColliderSystem({
 world:game.world,
 environment:game.world?.environment,
 harvesting:game.harvesting
});
vegetationColliders.initialize();
game.vegetationColliders=vegetationColliders;
