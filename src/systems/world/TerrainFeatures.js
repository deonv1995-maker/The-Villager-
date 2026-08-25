import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures{
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;
  this.root=new THREE.Group();this.root.name='TerrainFeatures';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;
  this.material=new THREE.MeshStandardMaterial({color:0x78827d,roughness:.96,metalness:0,flatShading:true});
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
  // Follow the actual authored shelf, but use each modular piece as a short
  // cliff face rather than building one long freestanding wall.
  const angle=-.72,c=Math.cos(angle),s=Math.sin(angle);
  const tangentX=c,tangentZ=s,normalX=-s,normalZ=c;
  const scale=3.4;
  const spacing=scale*.92;
  const sampleOffset=5.5;
  const segmentCount=18;

  for(let i=0;i<segmentCount;i++){
   const u=(i-(segmentCount-1)/2)*spacing;
   const cx=-48+u*tangentX,cz=-12+u*tangentZ;
   const sideA=this.world.heightAt(cx+normalX*sampleOffset,cz+normalZ*sampleOffset);
   const sideB=this.world.heightAt(cx-normalX*sampleOffset,cz-normalZ*sampleOffset);
   const delta=sideA-sideB;
   const drop=Math.abs(delta);
   if(drop<2.0)continue;

   // Point the rock face toward the lower side and sink it into both surfaces.
   const lowSign=delta>0?-1:1;
   const lowX=cx+normalX*sampleOffset*lowSign;
   const lowZ=cz+normalZ*sampleOffset*lowSign;
   const highX=cx-normalX*sampleOffset*lowSign;
   const highZ=cz-normalZ*sampleOffset*lowSign;
   const low=this.world.heightAt(lowX,lowZ);
   const high=this.world.heightAt(highX,highZ);
   const faceX=cx+normalX*lowSign*1.35;
   const faceZ=cz+normalZ*lowSign*1.35;
   const rotationY=Math.atan2(normalX*lowSign,normalZ*lowSign)+Math.PI/2;

   // The source top mesh is ~1.2 units high. Anchor its grassy lip just below
   // the high terrain so the terrain hides the back half of the modular tile.
   const topY=high-scale*1.13;
   this.addPiece('top',faceX,topY,faceZ,rotationY,scale);

   // Only stack extra stone where the terrain genuinely has enough vertical drop.
   if(drop>scale*1.18){
    const midY=topY-scale*.88;
    this.addPiece('mid',faceX,midY,faceZ,rotationY,scale);
   }
   if(drop>scale*2.05){
    const baseY=Math.max(low-scale*.15,topY-scale*1.72);
    this.addPiece('base',faceX,baseY,faceZ,rotationY,scale);
   }
  }
 }
 initialize(){
  this.scene.add(this.root);
  this.load().then(()=>this.buildShelfCliff()).catch(err=>console.error('[Terrain features load]',err));
 }
}
