import { WorldManager } from './WorldManager.js';
import { MobileControls } from './input/MobileControls.js';
import { PlayerController } from './player/PlayerController.js';
import { ThirdPersonCamera } from './player/ThirdPersonCamera.js';
import { PlayerVisual } from './player/PlayerVisual.js';
import { KayKitPlayerVisual } from './player/KayKitPlayerVisual.js';

const KAYKIT_BASE='https://raw.githubusercontent.com/ArtjomSchwenk/Koy/8742b69b6d965f369e7b8a87cee570a81184c403/Assets/Character/KayKit_Adventurers_2.0_FREE';

export class GameBootstrap{
 constructor(THREE){this.THREE=THREE;this.clock=new THREE.Clock();}
 start(){
  const T=this.THREE,status=document.getElementById('status');
  this.scene=new T.Scene();this.scene.background=new T.Color(0x9bcf78);this.scene.fog=new T.Fog(0x9bcf78,90,240);
  this.camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,500);
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;document.body.appendChild(this.renderer.domElement);
  this.scene.add(new T.HemisphereLight(0xdff2ff,0x536334,2.1));const sun=new T.DirectionalLight(0xfff2cf,2.2);sun.position.set(-30,50,20);sun.castShadow=true;this.scene.add(sun);
  this.world=new WorldManager(T,this.scene);this.world.initialize();

  this.player=new T.Group();this.player.name='PlayerRoot';this.player.position.set(0,this.world.heightAt(0,0),0);this.scene.add(this.player);
  this.playerVisual=new KayKitPlayerVisual(T,{modelUrl:`${KAYKIT_BASE}/Characters/gltf/Ranger.glb`,movementUrl:`${KAYKIT_BASE}/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`,generalUrl:`${KAYKIT_BASE}/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`,targetHeight:2.7});
  this.player.add(this.playerVisual.root);
  if(status)status.textContent='Clean rebuild 0.4.0 · loading Ranger…';
  this.playerVisual.load().then(()=>{if(status)status.textContent='Clean rebuild 0.4.0 · KayKit Ranger';}).catch(err=>{console.error('[KayKit] Ranger load failed',err);this.player.remove(this.playerVisual.root);this.playerVisual=new PlayerVisual(T);this.player.add(this.playerVisual.root);if(status)status.textContent='Clean rebuild 0.4.0 · fallback visual';});

  this.input=new MobileControls({leftRoot:document.getElementById('move-stick'),leftKnob:document.getElementById('move-knob'),rightRoot:document.getElementById('look-stick'),rightKnob:document.getElementById('look-knob')});
  this.cameraController=new ThirdPersonCamera(T,{camera:this.camera,target:this.player,input:this.input});
  this.playerController=new PlayerController(T,{player:this.player,input:this.input,cameraController:this.cameraController,world:this.world,groundOffset:0});
  this.cameraController.update(1/60);
  addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);});
  const loop=()=>{requestAnimationFrame(loop);const dt=Math.min(this.clock.getDelta(),.05);this.playerController.update(dt);this.playerVisual.update(dt,this.playerController.moveAmount);this.cameraController.update(dt);this.renderer.render(this.scene,this.camera);};loop();
 }
}
