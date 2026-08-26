import { WorldManager } from './WorldManager.js?v=552';
import { MobileControls } from './input/MobileControls.js?v=563';
import { PlayerController } from './player/PlayerController.js?v=569';
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js?v=529';
import { PlayerVisual } from './player/PlayerVisual.js?v=538';
import { GrassInteractionSystem } from './world/GrassInteractionSystem.js?v=552';
import { FineGrassFieldDecorator } from './world/FineGrassFieldDecorator.js?v=560';
import { GroundSurfaceDecorator } from './world/GroundSurfaceDecorator.js?v=560';
import { RenderingPerformanceSystem } from './rendering/RenderingPerformanceSystem.js?v=562';
import { WorldMaterialSystem } from './gameplay/WorldMaterialSystem.js?v=570';
import { HarvestingSystem } from './gameplay/HarvestingSystem.js?v=570';
import { BuildingModeSystem } from './gameplay/BuildingModeSystem.js?v=572';
import { ConstructionTraversalSystem } from './gameplay/ConstructionTraversalSystem.js?v=570';
import { ConstructionReactionSystem } from './gameplay/ConstructionReactionSystem.js?v=564';
import { SurvivalInteractionSystem } from './gameplay/SurvivalInteractionSystem.js?v=566';

const KAYKIT_COMMIT='8742b69b6d965f369e7b8a87cee570a81184c403';
const KAYKIT_ROOTS=[
 `https://raw.githubusercontent.com/ArtjomSchwenk/Koy/${KAYKIT_COMMIT}/Assets/Character/KayKit_Adventurers_2.0_FREE`,
 `https://cdn.jsdelivr.net/gh/ArtjomSchwenk/Koy@${KAYKIT_COMMIT}/Assets/Character/KayKit_Adventurers_2.0_FREE`
];
const kaykitUrls=path=>KAYKIT_ROOTS.map(root=>`${root}/${path}`);

export class GameBootstrap{
 constructor(THREE){this.THREE=THREE;this.clock=new THREE.Clock();}
 start(){
  const T=this.THREE,status=document.getElementById('status');
  try{
   this.scene=new T.Scene();
   this.scene.background=new T.Color(0x9bcf78);
   this.scene.fog=new T.Fog(0x9bcf78,120,320);
   this.camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,700);
   this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
   this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.20));
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
   this.playerVisual=new PlayerVisual(T);
   this.player.add(this.playerVisual.root);

   this.input=new MobileControls({
    leftRoot:document.getElementById('move-stick'),
    leftKnob:document.getElementById('move-knob'),
    rightRoot:document.getElementById('look-stick'),
    rightKnob:document.getElementById('look-knob'),
    jumpRoot:document.getElementById('jump-button')
   });
   this.cameraController=new ThirdPersonCamera(T,{camera:this.camera,target:this.player,input:this.input,world:this.world});
   this.playerController=new PlayerController(T,{player:this.player,input:this.input,cameraController:this.cameraController,world:this.world,groundOffset:0});

   this.groundSurface=new GroundSurfaceDecorator(T,{world:this.world,scene:this.scene});
   this.world.groundSurface=this.groundSurface;
   this.groundSurface.initialize();

   this.grassInteraction=new GrassInteractionSystem(T,{world:this.world,player:this.player});
   this.grassInteraction.initialize();

   this.fineGrassFields=new FineGrassFieldDecorator(T,{world:this.world,scene:this.scene,player:this.player});
   this.fineGrassFields.initialize();

   this.materials=new WorldMaterialSystem(T,{
    world:this.world,scene:this.scene,player:this.player,
    hudRoot:document.getElementById('material-hud')
   });
   this.materials.initialize();

   this.buildModes=new BuildingModeSystem(T,{
    world:this.world,scene:this.scene,player:this.player,materials:this.materials,
    button:document.getElementById('build-mode-button'),
    feedbackElement:document.getElementById('gameplay-feedback')
   });
   this.buildModes.initialize();

   this.constructionTraversal=new ConstructionTraversalSystem({
    world:this.world,buildingModes:this.buildModes
   });
   this.constructionTraversal.initialize();

   this.harvesting=new HarvestingSystem(T,{world:this.world,player:this.player,materials:this.materials});
   this.harvesting.initialize();

   this.reactions=new ConstructionReactionSystem(T,{
    world:this.world,scene:this.scene,player:this.player,materials:this.materials
   });
   this.reactions.initialize();

   this.survivalInteraction=new SurvivalInteractionSystem({
    player:this.player,materials:this.materials,harvesting:this.harvesting,
    reactions:this.reactions,buildingModes:this.buildModes,
    actionButton:document.getElementById('action-button'),
    feedbackElement:document.getElementById('gameplay-feedback')
   });
   this.survivalInteraction.initialize();

   this.renderPerformance=new RenderingPerformanceSystem(T,{
    renderer:this.renderer,scene:this.scene,camera:this.camera,
    world:this.world,player:this.player,sun:this.sun
   });
   this.renderPerformance.initialize();

   this.cameraController.update(1/60);

   addEventListener('resize',()=>{
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
   });

   if(status)status.textContent='Clean rebuild 0.5.72 · raw beams on frames · stacked frame stories · frame-capped walls · Ranger loading';
   const loop=()=>{
    requestAnimationFrame(loop);
    const dt=Math.min(this.clock.getDelta(),.05);
    this.constructionTraversal.update(dt);
    this.playerController.update(dt);
    this.buildModes.update(dt);
    this.harvesting.update(dt);
    this.reactions.update(dt);
    this.survivalInteraction.update(dt);
    this.grassInteraction.update(dt);
    this.fineGrassFields.update(dt);
    this.playerVisual.update(dt,this.playerController.moveAmount,this.playerController.locomotionState);
    this.cameraController.update(dt);
    this.renderPerformance.update(dt);
    this.renderer.render(this.scene,this.camera);
   };
   loop();
   setTimeout(()=>this.tryKayKitRanger(status),250);
  }catch(err){
   console.error('[BOOT]',err);
   if(status){status.textContent='0.5.72 STARTUP ERROR: '+(err?.message||err);status.style.background='#5b1818';}
  }
 }

 async tryKayKitRanger(status){
  const T=this.THREE;
  try{
   const {KayKitPlayerVisual}=await import('./player/KayKitPlayerVisual.js?v=538');
   const ranger=new KayKitPlayerVisual(T,{
    modelUrls:kaykitUrls('Characters/gltf/Ranger.glb'),
    movementUrls:kaykitUrls('Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb'),
    generalUrls:kaykitUrls('Animations/gltf/Rig_Medium/Rig_Medium_General.glb'),
    targetHeight:2.7,facingYaw:0
   });
   await ranger.load();
   const old=this.playerVisual;
   this.player.add(ranger.root);
   if(old?.root?.parent===this.player)this.player.remove(old.root);
   this.playerVisual=ranger;
   this.renderPerformance?.syncShadowCasters?.(true);
   if(status)status.textContent=ranger.actions.size
    ?'Clean rebuild 0.5.72 · Ranger · beam-supported upper frames · frame-height wall limits · roof-ready angles'
    :'Clean rebuild 0.5.72 · Ranger · structural story snapping · animations pending';
  }catch(err){
   console.error('[KayKit Ranger model load]',err);
   if(status)status.textContent='Clean rebuild 0.5.72 · structural story snapping · Ranger model unavailable';
  }
 }
}
