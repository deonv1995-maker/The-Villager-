import { WorldManager } from './WorldManager.js?v=552';
import { MobileControls } from './input/MobileControls.js?v=563';
import { PlayerController } from './player/PlayerController.js?v=552';
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js?v=529';
import { PlayerVisual } from './player/PlayerVisual.js?v=538';
import { GrassInteractionSystem } from './world/GrassInteractionSystem.js?v=552';
import { FineGrassFieldDecorator } from './world/FineGrassFieldDecorator.js?v=560';
import { GroundSurfaceDecorator } from './world/GroundSurfaceDecorator.js?v=560';
import { RenderingPerformanceSystem } from './rendering/RenderingPerformanceSystem.js?v=562';
import { InventorySystem } from './gameplay/InventorySystem.js?v=563';
import { HarvestingSystem } from './gameplay/HarvestingSystem.js?v=563';
import { BuildingSystem } from './gameplay/BuildingSystem.js?v=563';

const KAYKIT_COMMIT='8742b69b6d965f369e7b8a87cee570a81184c403';
const KAYKIT_ROOTS=[
 `https://raw.githubusercontent.com/ArtjomSchwenk/Koy/${KAYKIT_COMMIT}/Assets/Character/KayKit_Adventurers_2.0_FREE`,
 `https://cdn.jsdelivr.net/gh/ArtjomSchwenk/Koy@${KAYKIT_COMMIT}/Assets/Character/KayKit_Adventurers_2.0_FREE`
];
const kaykitUrls=path=>KAYKIT_ROOTS.map(root=>`${root}/${path}`);

export class GameBootstrap {
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

   this.groundSurface=new GroundSurfaceDecorator(T,{
    world:this.world,
    scene:this.scene
   });
   this.world.groundSurface=this.groundSurface;
   this.groundSurface.initialize();

   this.grassInteraction=new GrassInteractionSystem(T,{
    world:this.world,
    player:this.player
   });
   this.grassInteraction.initialize();

   this.fineGrassFields=new FineGrassFieldDecorator(T,{
    world:this.world,
    scene:this.scene,
    player:this.player
   });
   this.fineGrassFields.initialize();

   // Inventory owns resource quantities. Harvesting and building consume the
   // same API, keeping resource balance independent from either gameplay loop.
   this.inventory=new InventorySystem({
    hudRoot:document.getElementById('resource-hud')
   });

   this.harvesting=new HarvestingSystem(T,{
    world:this.world,
    player:this.player,
    inventory:this.inventory,
    actionButton:document.getElementById('action-button'),
    feedbackElement:document.getElementById('gameplay-feedback')
   });
   this.harvesting.initialize();

   this.building=new BuildingSystem(T,{
    world:this.world,
    scene:this.scene,
    player:this.player,
    inventory:this.inventory,
    harvesting:this.harvesting,
    actionButton:document.getElementById('action-button'),
    buildButton:document.getElementById('build-button'),
    menuRoot:document.getElementById('build-menu'),
    feedbackElement:document.getElementById('gameplay-feedback')
   });
   this.building.initialize();

   // World shadows are cached until their static window changes; the Ranger has
   // a lightweight real-time contact shadow so animation never forces an
   // expensive shadow-map render every frame.
   this.renderPerformance=new RenderingPerformanceSystem(T,{
    renderer:this.renderer,
    scene:this.scene,
    camera:this.camera,
    world:this.world,
    player:this.player,
    sun:this.sun
   });
   this.renderPerformance.initialize();

   this.cameraController.update(1/60);

   addEventListener('resize',()=>{
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
   });

   if(status)status.textContent='Clean rebuild 0.5.63 · harvesting · inventory · starter building · Ranger loading';
   const loop=()=>{
    requestAnimationFrame(loop);
    const dt=Math.min(this.clock.getDelta(),.05);
    this.playerController.update(dt);
    this.harvesting.update(dt);
    this.building.update(dt);
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
   if(status){status.textContent='0.5.63 STARTUP ERROR: '+(err?.message||err);status.style.background='#5b1818';}
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
    targetHeight:2.7,
    facingYaw:0
   });
   await ranger.load();
   const old=this.playerVisual;
   this.player.add(ranger.root);
   if(old?.root?.parent===this.player)this.player.remove(old.root);
   this.playerVisual=ranger;
   this.renderPerformance?.syncShadowCasters?.(true);
   if(status)status.textContent=ranger.actions.size
    ?'Clean rebuild 0.5.63 · Ranger · harvesting · inventory · starter building'
    :'Clean rebuild 0.5.63 · Ranger · harvesting · starter building · animations pending';
  }catch(err){
   console.error('[KayKit Ranger model load]',err);
   if(status)status.textContent='Clean rebuild 0.5.63 · harvesting · starter building · Ranger model unavailable';
  }
 }
}
