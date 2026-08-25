import { WorldManager } from './WorldManager.js';
export class GameBootstrap{
 constructor(THREE){this.THREE=THREE;}
 start(){
  const T=this.THREE;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x9bcf78);this.scene.fog=new T.Fog(0x9bcf78,90,240);
  this.camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,500);
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);document.body.appendChild(this.renderer.domElement);
  this.scene.add(new T.HemisphereLight(0xdff2ff,0x536334,2.1));const sun=new T.DirectionalLight(0xfff2cf,2.2);sun.position.set(-30,50,20);this.scene.add(sun);
  this.world=new WorldManager(T,this.scene);this.world.initialize();
  this.player=new T.Mesh(new T.CapsuleGeometry(.45,1.2,4,8),new T.MeshLambertMaterial({color:0x72563b}));this.player.position.set(0,this.world.heightAt(0,0)+1.05,0);this.scene.add(this.player);
  this.camera.position.set(0,5.2,8.5);this.camera.lookAt(this.player.position);
  addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);});
  const loop=()=>{requestAnimationFrame(loop);this.renderer.render(this.scene,this.camera);};loop();
 }
}
