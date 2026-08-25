import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures{
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;
  this.root=new THREE.Group();this.root.name='TerrainFeatures';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;this.seed=9137;
  this.material=new THREE.MeshStandardMaterial({color:0x78827d,roughness:.96,metalness:0,flatShading:true});
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 async loadObj(path){
  const res=await fetch(path);if(!res.ok)throw new Error(`${path}: ${res.status}`);
  const obj=this.loader.parse(await res.text());
  obj.traverse(child=>{if(!child.isMesh)return;child.material=this.material;child.castShadow=true;child.receiveShadow=true;});
  return obj;
 }
 async load(){
  if(this.loading)return this.loading;
  this.loading=Promise.all([
   this.loadObj('./assets/modular-terrain/Cliff_Terrain_Side_Base.obj'),
   this.loadObj('./assets/modular-terrain/Cliff_Terrain_Side_Mid.obj'),
   this.loadObj('./assets/modular-terrain/Cliff_Terrain_Side_Top.obj')
  ]).then(([base,mid,top])=>{this.prototypes={base,mid,top};return this.prototypes;});
  return this.loading;
 }
 addPiece(type,x,y,z,rotationY,scale,stretch=1){
  const source=this.prototypes[type];if(!source)return;
  const o=source.clone(true);o.position.set(x,y,z);o.rotation.y=rotationY;
  o.scale.set(scale,scale*(.9+stretch*.1),scale*(.92+stretch*.08));this.root.add(o);
 }
 contourPoint(t){
  // Authored shelf centreline with broad bends plus deterministic erosion noise.
  const u=(t-.5)*59;
  const baseAngle=-.72,c=Math.cos(baseAngle),s=Math.sin(baseAngle);
  const bend=Math.sin(t*Math.PI*1.7)*3.8+Math.sin(t*Math.PI*4.6+1.1)*1.55;
  const jitter=(this.rand(Math.floor(t*1000)+31)-.5)*1.2;
  const nx=-s,nz=c;
  return {x:-48+u*c+nx*(bend+jitter),z:-12+u*s+nz*(bend+jitter)};
 }
 buildShelfCliff(){
  const count=17;
  for(let i=0;i<count;i++){
   // Natural gaps stop the formation reading as a retaining wall.
   if((i===2||i===13)||this.rand(i*17+4)<.09)continue;
   const t=(i+.5)/count;
   const p=this.contourPoint(t),prev=this.contourPoint(Math.max(0,t-.018)),next=this.contourPoint(Math.min(1,t+.018));
   let tx=next.x-prev.x,tz=next.z-prev.z;const len=Math.hypot(tx,tz)||1;tx/=len;tz/=len;
   let nx=-tz,nz=tx;
   const sample=5.2;
   const a=this.world.heightAt(p.x+nx*sample,p.z+nz*sample),b=this.world.heightAt(p.x-nx*sample,p.z-nz*sample);
   if(Math.abs(a-b)<1.75)continue;
   if(a<b){nx=-nx;nz=-nz;}
   const high=this.world.heightAt(p.x+nx*sample,p.z+nz*sample),low=this.world.heightAt(p.x-nx*sample,p.z-nz*sample);
   const drop=high-low;
   const lateral=(this.rand(i*29+7)-.5)*1.45;
   const faceX=p.x-nx*(1.0+lateral),faceZ=p.z-nz*(1.0+lateral);
   const yaw=Math.atan2(tx,tz)+(this.rand(i*31+9)-.5)*.22;
   const scale=2.75+this.rand(i*37+3)*1.15;
   const topY=high-scale*(1.09+this.rand(i*41+8)*.09);
   const stretch=this.rand(i*43+5);
   this.addPiece('top',faceX,topY,faceZ,yaw,scale,stretch);
   if(drop>scale*1.28&&this.rand(i*47+2)>.22)this.addPiece('mid',faceX-nx*.18,topY-scale*(.79+.12*stretch),faceZ-nz*.18,yaw+(this.rand(i*53)-.5)*.12,scale*(.94+this.rand(i*59)*.1),stretch);
   if(drop>scale*2.05&&this.rand(i*61+1)>.35)this.addPiece('base',faceX-nx*.32,Math.max(low-.15,topY-scale*1.62),faceZ-nz*.32,yaw+(this.rand(i*67)-.5)*.16,scale*(.9+this.rand(i*71)*.12),stretch);
  }
 }
 initialize(){
  this.scene.add(this.root);
  this.load().then(()=>this.buildShelfCliff()).catch(err=>console.error('[Terrain features load]',err));
 }
}
