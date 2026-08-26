import { WorldManager } from './WorldManager.js?v=552';
import { MobileControls } from './input/MobileControls.js?v=539';
import { PlayerController } from './player/PlayerController.js?v=552';
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js?v=529';
import { PlayerVisual } from './player/PlayerVisual.js?v=538';
import { GrassInteractionSystem } from './world/GrassInteractionSystem.js?v=552';
import { FineGrassFieldDecorator } from './world/FineGrassFieldDecorator.js?v=556';

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
   this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
   this.renderer.setSize(innerWidth,innerHeight);
   document.body.insertBefore(this.renderer.domElement,document.body.firstChild);

   this.scene.add(new T.HemisphereLight(0xdff2ff,0x536334,2.1));
   const sun=new T.DirectionalLight(0xfff2cf,2.2);
   sun.position.set(-30,50,20);
   this.scene.add(sun);

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

   // Larger authored grass plants keep their existing interaction system.
   this.grassInteraction=new GrassInteractionSystem(T,{
    world:this.world,
    player:this.player
   });
   this.grassInteraction.initialize();

   // Fine instanced field grass owns its own representation-specific response.
   // Only nearby instances animate, preserving the field as a presentation layer.
   this.fineGrassFields=new FineGrassFieldDecorator(T,{
    world:this.world,
    scene:this.scene,
    player:this.player
   });
   this.fineGrassFields.initialize();

   this.cameraController.update(1/60);

   addEventListener('resize',()=>{
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
   });

   if(status)status.textContent='Clean rebuild 0.5.56 · full rock collision · reactive clumps · dense reactive grass fields · Ranger loading';
   const loop=()=>{
    requestAnimationFrame(loop);
    const dt=Math.min(this.clock.getDelta(),.05);
    this.playerController.update(dt);
    this.grassInteraction.update(dt);
    this.fineGrassFields.update(dt);
    this.playerVisual.update(dt,this.playerController.moveAmount,this.playerController.locomotionState);
    this.cameraController.update(dt);
    this.renderer.render(this.scene,this.camera);
   };
   loop();
   setTimeout(()=>this.tryKayKitRanger(status),250);
  }catch(err){
   console.error('[BOOT]',err);
   if(status){status.textContent='0.5.56 STARTUP ERROR: '+(err?.message||err);status.style.background='#5b1818';}
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
   if(status)status.textContent=ranger.actions.size
    ?'Clean rebuild 0.5.56 · Ranger · full rock collision · reactive clumps · dense reactive grass fields'
    :'Clean rebuild 0.5.56 · Ranger · full rock collision · reactive clumps · dense reactive grass fields · animations pending';
  }catch(err){
   console.error('[KayKit Ranger model load]',err);
   if(status)status.textContent='Clean rebuild 0.5.56 · dense reactive grass fields · Ranger model unavailable';
  }
 }
}
