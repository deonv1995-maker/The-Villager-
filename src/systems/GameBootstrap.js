import { WorldManager } from './WorldManager.js?v=516';
import { MobileControls } from './input/MobileControls.js';
import { PlayerController } from './player/PlayerController.js';
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js';
import { PlayerVisual } from './player/PlayerVisual.js';

const KAYKIT_BASE='https://raw.githubusercontent.com/ArtjomSchwenk/Koy/8742b69b6d965f369e7b8a87cee570a81184c403/Assets/Character/KayKit_Adventurers_2.0_FREE';

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
    rightKnob:document.getElementById('look-knob')
   });
   this.cameraController=new ThirdPersonCamera(T,{camera:this.camera,target:this.player,input:this.input});
   this.playerController=new PlayerController(T,{player:this.player,input:this.input,cameraController:this.cameraController,world:this.world,groundOffset:0});
   this.cameraController.update(1/60);

   addEventListener('resize',()=>{
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
   });

   if(status)status.textContent='Clean rebuild 0.5.16 · refined cliff blend · Ranger loading';
   const loop=()=>{
    requestAnimationFrame(loop);
    const dt=Math.min(this.clock.getDelta(),.05);
    this.playerController.update(dt);
    this.playerVisual.update(dt,this.playerController.moveAmount);
    this.cameraController.update(dt);
    this.renderer.render(this.scene,this.camera);
   };
   loop();
   setTimeout(()=>this.tryKayKitRanger(status),350);
  }catch(err){
   console.error('[BOOT]',err);
   if(status){status.textContent='0.5.16 STARTUP ERROR: '+(err?.message||err);status.style.background='#5b1818';}
  }
 }

 async tryKayKitRanger(status){
  const T=this.THREE;
  try{
   const {KayKitPlayerVisual}=await import('./player/KayKitPlayerVisual.js?v=515');
   const ranger=new KayKitPlayerVisual(T,{
    modelUrl:`${KAYKIT_BASE}/Characters/gltf/Ranger.glb`,
    movementUrl:`${KAYKIT_BASE}/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`,
    generalUrl:`${KAYKIT_BASE}/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`,
    targetHeight:2.7,
    facingYaw:0
   });
   await ranger.load();
   const old=this.playerVisual;
   this.player.add(ranger.root);
   if(old?.root?.parent===this.player)this.player.remove(old.root);
   this.playerVisual=ranger;
   if(status)status.textContent='Clean rebuild 0.5.16 · Ranger · refined cliff blend';
  }catch(err){
   console.error('[KayKit Ranger optional load]',err);
   if(status)status.textContent='Clean rebuild 0.5.16 · refined cliff blend · Ranger unavailable';
  }
 }
}
