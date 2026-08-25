import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures{
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;
  this.root=new THREE.Group();this.root.name='TerrainFeatures';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;
  this.material=new THREE.MeshStandardMaterial({color:0x7d8681,roughness:.96,metalness:0,flatShading:true});
 }
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
 addPiece(type,x,y,z,rotationY,scale){
  const source=this.prototypes[type];if(!source)return;
  const o=source.clone(true);o.position.set(x,y,z);o.rotation.y=rotationY;o.scale.setScalar(scale);this.root.add(o);
 }
 buildShelfCliff(){
  const angle=-.72,c=Math.cos(angle),s=Math.sin(angle);
  const rotationY=Math.PI/2-angle;
  const scale=2.25;
  const segmentSpacing=scale*.96;
  const segmentCount=27;
  for(let i=0;i<segmentCount;i++){
   const u=(i-(segmentCount-1)/2)*segmentSpacing;
   const cx=-48+u*c,cz=-12+u*s;
   const nx=-s,nz=c;
   const high=this.world.heightAt(cx+nx*4,cz+nz*4);
   const low=this.world.heightAt(cx-nx*4,cz-nz*4);
   if(high-low<1.7)continue;
   const baseY=low-.05;
   const topY=Math.max(baseY+scale*.85,high-scale*1.12);
   this.addPiece('base',cx,baseY,cz,rotationY,scale);
   if(high-low>scale*1.85)this.addPiece('mid',cx,baseY+scale*.82,cz,rotationY,scale);
   this.addPiece('top',cx,topY,cz,rotationY,scale);
  }
 }
 initialize(){
  this.scene.add(this.root);
  this.load().then(()=>this.buildShelfCliff()).catch(err=>console.error('[Terrain features load]',err));
 }
}
