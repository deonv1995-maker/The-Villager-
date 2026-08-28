import { WorldManager } from './WorldManager.js?v=584';
import { MobileControls } from './input/MobileControls.js?v=610';
import { PlayerController } from './player/PlayerController.js?v=611';
import { SprintStaminaHudSystem } from './player/SprintStaminaHudSystem.js?v=609';
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js?v=529';
import { PlayerVisual } from './player/PlayerVisual.js?v=538';
import { GrassInteractionSystem } from './world/GrassInteractionSystem.js?v=552';
import { FineGrassFieldDecorator } from './world/FineGrassFieldDecorator.js?v=560';
import { GroundSurfaceDecorator } from './world/GroundSurfaceDecorator.js?v=560';
import { RenderingPerformanceSystem } from './rendering/RenderingPerformanceSystem.js?v=594';
import { WorldMaterialSystem } from './gameplay/WorldMaterialSystem.js?v=591';
import { GrassMaterialSystem } from './gameplay/GrassMaterialSystem.js?v=603';
import { GrassCarryVisualSystem } from './gameplay/GrassCarryVisualSystem.js?v=603';
import { LogHaulingSystem } from './gameplay/LogHaulingSystem.js?v=607';
import { LogHaulingInteractionSystem } from './gameplay/LogHaulingInteractionSystem.js?v=641';
import { HarvestingSystem } from './gameplay/HarvestingSystem.js?v=587';
import { GrassHarvestingSystem } from './gameplay/GrassHarvestingSystem.js?v=603';
import { BuildingModeSystem } from './gameplay/BuildingModeSystem.js?v=594';
import { BuildDrawerSystem } from './gameplay/BuildDrawerSystem.js?v=641';
import { FrameGridSystem } from './gameplay/FrameGridSystem.js?v=597';
import { WallInteriorFacingSystem } from './gameplay/WallInteriorFacingSystem.js?v=608';
import { FoundationTerrainSystem } from './gameplay/FoundationTerrainSystem.js?v=594';
import { FloorSupportSystem } from './gameplay/FloorSupportSystem.js?v=577';
import { UpperFloorSystem } from './gameplay/UpperFloorSystem.js?v=597';
import { ConstructionTraversalSystem } from './gameplay/ConstructionTraversalSystem.js?v=583';
import { StairSystem } from './gameplay/StairSystem.js?v=582';
import { StairLandingTransitionSystem } from './gameplay/StairLandingTransitionSystem.js?v=598';
import { StairPlacementOccupancySystem } from './gameplay/StairPlacementOccupancySystem.js?v=599';
import { RoofingSystem } from './gameplay/RoofingSystem.js?v=603';
import { ThatchRoofVisualSystem } from './gameplay/ThatchRoofVisualSystem.js?v=608';
import { ConstructionReactionSystem } from './gameplay/ConstructionReactionSystem.js?v=564';
import { SurvivalInteractionSystem } from './gameplay/SurvivalInteractionSystem.js?v=603';

const KAYKIT_COMMIT='8742b69b6d965f369e7b8a87cee570a81184c403';
const KAYKIT_ROOTS=[
 `https://raw.githubusercontent.com/ArtjomSchwenk/Koy/${KAYKIT_COMMIT}/Assets/Character/KayKit_Adventurers_2.0_FREE`,
 `https://cdn.jsdelivr.net/gh/ArtjomSchwenk/Koy@${KAYKIT_COMMIT}/Assets/Character/KayKit_Adventurers_2.0_FREE`
];
const kaykitUrls=path=>KAYKIT_ROOTS.map(root=>`${root}/${path}`);

export class GameBootstrap{
 constructor(THREE){
  this.THREE=THREE;
  this.clock=new THREE.Clock();
  this.frameAccumulator=0;
  this.targetFrameInterval=1/60;
  this.presentationAccumulator=0;
  this.maintenanceAccumulator=0;
  this.fallbackVisual=null;
 }

 start(){
  const T=this.THREE,status=document.getElementById('status');
  try{
   this.scene=new T.Scene();
   this.scene.background=new T.Color(0x9bcf78);
   this.scene.fog=new T.Fog(0x9bcf78,120,320);
   this.camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,700);
   this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
   const coarse=globalThis.matchMedia?.('(pointer: coarse)')?.matches;
   this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.15:1.20));
   this.renderer.setSize(innerWidth,innerHeight);
   document.body.insertBefore(this.renderer.domElement,document.body.firstChild);

   this.hemi=new T.HemisphereLight(0xdff2ff,0x536334,1.55);
   this.scene.add(this.hemi);
   this.sun=new T.DirectionalLight(0xfff2cf,2.35);
   this.sun.position.set(-30,50,20);
   this.scene.add(this.sun);

   this.world=new WorldManager(T,this.scene);
   this.world.initialize();
   this.player=new T.Group();
   this.player.name='PlayerRoot';
   this.player.position.set(0,this.world.heightAt(0,0),0);
   this.scene.add(this.player);

   this.fallbackVisual=new PlayerVisual(T);
   this.fallbackVisual.root.visible=false;
   this.playerVisual=this.fallbackVisual;
   this.player.add(this.fallbackVisual.root);
   this.world.playerVisual=this.playerVisual;

   this.tryKayKitRanger(status);

   this.input=new MobileControls({
    leftRoot:document.getElementById('move-stick'),
    leftKnob:document.getElementById('move-knob'),
    rightRoot:document.getElementById('look-stick'),
    rightKnob:document.getElementById('look-knob'),
    jumpRoot:document.getElementById('jump-button'),
    sprintRoot:document.getElementById('sprint-button')
   });
   this.cameraController=new ThirdPersonCamera(T,{camera:this.camera,target:this.player,input:this.input,world:this.world});
   this.playerController=new PlayerController(T,{player:this.player,input:this.input,cameraController:this.cameraController,world:this.world,groundOffset:0});
   this.sprintHud=new SprintStaminaHudSystem({
    playerController:this.playerController,
    root:document.getElementById('stamina-hud'),
    fill:document.getElementById('stamina-fill')
   });
   this.sprintHud.initialize();

   this.groundSurface=new GroundSurfaceDecorator(T,{world:this.world,scene:this.scene});
   this.world.groundSurface=this.groundSurface;
   this.groundSurface.initialize();

   this.grassInteraction=new GrassInteractionSystem(T,{world:this.world,player:this.player});
   this.grassInteraction.initialize();

   this.fineGrassFields=new FineGrassFieldDecorator(T,{world:this.world,scene:this.scene,player:this.player});
   this.fineGrassFields.initialize();

   this.materials=new WorldMaterialSystem(T,{world:this.world,scene:this.scene,player:this.player,hudRoot:document.getElementById('material-hud')});
   this.materials.initialize();

   this.grassMaterials=new GrassMaterialSystem(T,{materials:this.materials,player:this.player});
   this.grassMaterials.initialize();
   this.grassCarryVisual=new GrassCarryVisualSystem({world:this.world,materials:this.materials});

   this.logHauling=new LogHaulingSystem(T,{
    world:this.world,
    player:this.player,
    materials:this.materials,
    playerController:this.playerController
   });
   this.logHauling.initialize();

   this.buildModes=new BuildingModeSystem(T,{world:this.world,scene:this.scene,player:this.player,materials:this.materials,button:document.getElementById('build-mode-button'),feedbackElement:document.getElementById('gameplay-feedback')});
   this.buildModes.initialize();

   this.frameGrid=new FrameGridSystem({buildingModes:this.buildModes});
   this.frameGrid.initialize();

   this.wallInteriorFacing=new WallInteriorFacingSystem({buildingModes:this.buildModes});
   this.wallInteriorFacing.initialize();

   this.foundationTerrain=new FoundationTerrainSystem(T,{world:this.world,scene:this.scene,buildingModes:this.buildModes,fineGrass:this.fineGrassFields});
   this.foundationTerrain.initialize();

   this.floorSupports=new FloorSupportSystem(T,{world:this.world,buildingModes:this.buildModes,foundationTerrain:this.foundationTerrain,materials:this.materials});
   this.floorSupports.initialize();

   this.upperFloors=new UpperFloorSystem({buildingModes:this.buildModes,foundationTerrain:this.foundationTerrain,floorSupports:this.floorSupports});
   this.upperFloors.initialize();

   this.constructionTraversal=new ConstructionTraversalSystem({world:this.world,buildingModes:this.buildModes});
   this.constructionTraversal.initialize();

   this.stairs=new StairSystem({world:this.world,buildingModes:this.buildModes,constructionTraversal:this.constructionTraversal,frameGrid:this.frameGrid});
   this.stairs.initialize();

   this.stairOccupancy=new StairPlacementOccupancySystem({stairs:this.stairs,buildingModes:this.buildModes});
   this.stairOccupancy.initialize();

   this.stairLandings=new StairLandingTransitionSystem({world:this.world,constructionTraversal:this.constructionTraversal,stairs:this.stairs,buildingModes:this.buildModes});
   this.stairLandings.initialize();

   this.roofing=new RoofingSystem(T,{buildingModes:this.buildModes,materials:this.materials,upperFloors:this.upperFloors});
   this.roofing.initialize();
   this.thatchRoofVisual=new ThatchRoofVisualSystem(T,{
    roofing:this.roofing,
    buildingModes:this.buildModes,
    upperFloors:this.upperFloors
   });
   this.thatchRoofVisual.initialize();

   this.harvesting=new HarvestingSystem(T,{world:this.world,player:this.player,materials:this.materials});
   this.harvesting.initialize();
   this.grassHarvesting=new GrassHarvestingSystem({harvesting:this.harvesting,fineGrass:this.fineGrassFields,materials:this.materials,player:this.player,world:this.world});
   this.grassHarvesting.initialize();

   this.reactions=new ConstructionReactionSystem(T,{world:this.world,scene:this.scene,player:this.player,materials:this.materials});
   this.reactions.initialize();

   this.survivalInteraction=new SurvivalInteractionSystem({player:this.player,materials:this.materials,harvesting:this.harvesting,reactions:this.reactions,buildingModes:this.buildModes,actionButton:document.getElementById('action-button'),feedbackElement:document.getElementById('gameplay-feedback')});
   this.survivalInteraction.initialize();

   this.logHaulingInteraction=new LogHaulingInteractionSystem({
    interaction:this.survivalInteraction,
    hauling:this.logHauling,
    materials:this.materials
   });
   this.logHaulingInteraction.initialize();

   this.buildDrawer=new BuildDrawerSystem({
    buildingModes:this.buildModes,
    materials:this.materials,
    interaction:this.survivalInteraction,
    legacyModeButton:document.getElementById('build-mode-button')
   });
   this.buildDrawer.initialize();
   this.logHaulingInteraction.bindBuildDrawer(this.buildDrawer);

   this.renderPerformance=new RenderingPerformanceSystem(T,{renderer:this.renderer,scene:this.scene,camera:this.camera,world:this.world,player:this.player,sun:this.sun});
   this.renderPerformance.initialize();

   this.cameraController.update(1/60);

   addEventListener('resize',()=>{
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
   });

   if(status)status.textContent='0.6.11 · loading';
   const loop=()=>{
    requestAnimationFrame(loop);
    const rawDt=Math.min(this.clock.getDelta(),.05);
    this.frameAccumulator+=rawDt;
    if(this.frameAccumulator<this.targetFrameInterval*.92)return;
    const dt=Math.min(this.frameAccumulator,1/30);
    this.frameAccumulator=0;

    this.constructionTraversal.update(dt);
    this.playerController.update(dt);
    this.sprintHud.update(dt);
    this.materials.update(dt);
    this.logHauling.update(dt);
    this.harvesting.update(dt);
    this.reactions.update(dt);
    this.survivalInteraction.update(dt);
    this.buildDrawer.update();
    if(!this.survivalInteraction?.isPlacementLocked?.())this.buildModes.update(dt);

    this.presentationAccumulator+=dt;
    if(this.presentationAccumulator>=1/30){
     const presentationDt=this.presentationAccumulator;
     this.presentationAccumulator=0;
     this.grassInteraction.update(presentationDt);
     this.fineGrassFields.update(presentationDt);
    }

    this.maintenanceAccumulator+=dt;
    if(this.maintenanceAccumulator>=.12){
     this.maintenanceAccumulator=0;
     this.foundationTerrain.update();
     this.floorSupports.update();
    }

    const hauling=this.logHauling?.visualCarryType?.();
    this.playerVisual.setCarrying?.(hauling?'log':(this.materials?.carried?.type||null));
    const visualMoveAmount=this.playerController.isSprinting
     ?Math.max(.82,this.playerController.moveAmount)
     :Math.min(.68,this.playerController.moveAmount);
    this.playerVisual.update(dt,visualMoveAmount,this.playerController.locomotionState);
    this.logHauling.updateVisual(dt,this.playerController.moveAmount);
    this.grassCarryVisual.update();
    this.cameraController.update(dt);
    this.renderPerformance.update(dt);
    this.renderer.render(this.scene,this.camera);
   };
   loop();
  }catch(err){
   console.error('[BOOT]',err);
   if(status){status.textContent='0.6.11 · ERROR';status.style.background='#5b1818';}
  }
 }

 async tryKayKitRanger(status){
  const T=this.THREE;
  try{
   const {KayKitPlayerVisual}=await import('./player/KayKitPlayerVisual.js?v=591');
   const ranger=new KayKitPlayerVisual(T,{modelUrls:kaykitUrls('Characters/gltf/Ranger.glb'),movementUrls:kaykitUrls('Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb'),generalUrls:kaykitUrls('Animations/gltf/Rig_Medium/Rig_Medium_General.glb'),targetHeight:2.7,facingYaw:0});
   await ranger.load();
   const old=this.playerVisual;
   this.player.add(ranger.root);
   if(old?.root?.parent===this.player)this.player.remove(old.root);
   this.playerVisual=ranger;
   this.world.playerVisual=ranger;
   this.renderPerformance?.syncShadowCasters?.(true);
   this.renderPerformance?.configurePlayerShadow?.();
   if(status)status.textContent=ranger.actions.size?'0.6.11 · Ranger':'0.6.11 · Ranger anim…';
  }catch(err){
   console.error('[KayKit Ranger model load]',err);
   if(this.fallbackVisual){
    this.fallbackVisual.root.visible=true;
    this.playerVisual=this.fallbackVisual;
    this.world.playerVisual=this.fallbackVisual;
   }
   if(status)status.textContent='0.6.11 · fallback';
  }
 }
}
