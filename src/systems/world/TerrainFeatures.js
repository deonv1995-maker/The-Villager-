import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures{
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;this.root=new THREE.Group();this.root.name='TerrainFeatures';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;this.seed=9137;
  this.materials={cliff:new THREE.MeshStandardMaterial({color:0x78827d,roughness:.96,metalness:0,flatShading:true}),rock:new THREE.MeshStandardMaterial({color:0x7d8681,roughness:.94,metalness:0,flatShading:true}),bush:new THREE.MeshStandardMaterial({color:0x4f8747,roughness:.9,metalness:0,flatShading:true})};
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 async loadObj(path,material){const res=await fetch(path);if(!res.ok)throw new Error(`${path}: ${res.status}`);const obj=this.loader.parse(await res.text());obj.traverse(child=>{if(!child.isMesh)return;child.material=material;child.castShadow=true;child.receiveShadow=true;});return obj;}
 async load(){if(this.loading)return this.loading;this.loading=Promise.all([
  this.loadObj('./assets/modular-terrain/Cliff_Terrain_Side_Base.obj',this.materials.cliff),
  this.loadObj('./assets/modular-terrain/Cliff_Terrain_Side_Mid.obj',this.materials.cliff),
  this.loadObj('./assets/modular-terrain/Cliff_Terrain_Side_Top.obj',this.materials.cliff),
  this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj',this.materials.rock),
  this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj',this.materials.rock),
  this.loadObj('./assets/kaykit/forest/Rock_3_A_Color1.obj',this.materials.rock),
  this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj',this.materials.bush),
  this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj',this.materials.bush)
 ]).then(([base,mid,top,r1,r2,r3,b1,b2])=>{this.prototypes={base,mid,top,rocks:[r1,r2,r3],bushes:[b1,b2]};return this.prototypes;});return this.loading;}
 addPiece(type,x,y,z,rotationY,scale,sy=1,sz=1){const source=this.prototypes[type];if(!source)return;const o=source.clone(true);o.position.set(x,y,z);o.rotation.y=rotationY;o.scale.set(scale,scale*sy,scale*sz);this.root.add(o);}
 addNatural(sourceList,x,y,z,rotationY,scale){if(!sourceList?.length)return;const src=sourceList[Math.floor(this.rand((x+z)*17)*sourceList.length)%sourceList.length],o=src.clone(true);o.position.set(x,y,z);o.rotation.y=rotationY;o.scale.setScalar(scale);this.root.add(o);}
 buildOrganicCliff(){
  const terrain=this.world.terrain;
  const anchors=[.055,.115,.19,.275,.37,.46,.545,.635,.715,.79,.865,.93];
  for(let i=0;i<anchors.length;i++){
   const t=Math.min(.97,Math.max(.03,anchors[i]+(this.rand(i*23+4)-.5)*.035));
   const f=terrain.cliffFrame(t);let nx=f.nx,nz=f.nz;
   const highA=this.world.heightAt(f.x+nx*6,f.z+nz*6),highB=this.world.heightAt(f.x-nx*6,f.z-nz*6);
   if(highA<highB){nx=-nx;nz=-nz;}
   const high=this.world.heightAt(f.x+nx*5.8,f.z+nz*5.8),low=this.world.heightAt(f.x-nx*5.8,f.z-nz*5.8),drop=high-low;
   if(drop<1.65)continue;
   const scale=3.15+this.rand(i*31+7)*1.65;
   const forward=.7+this.rand(i*37+2)*1.0;
   const x=f.x-nx*forward,z=f.z-nz*forward;
   const yaw=Math.atan2(f.tx,f.tz)+(this.rand(i*41+9)-.5)*.26;
   const topY=high-scale*(1.08+this.rand(i*43+6)*.075);
   this.addPiece('top',x,topY,z,yaw,scale,.92+this.rand(i*47)*.14,.86+this.rand(i*53)*.22);
   if(drop>scale*1.18&&this.rand(i*59+1)>.2)this.addPiece('mid',x-nx*.28,topY-scale*(.78+.08*this.rand(i*61)),z-nz*.28,yaw+(this.rand(i*67)-.5)*.12,scale*(.9+this.rand(i*71)*.12),.9+this.rand(i*73)*.12,.9+this.rand(i*79)*.16);
   if(drop>scale*1.85&&this.rand(i*83+3)>.42)this.addPiece('base',x-nx*.42,Math.max(low-.1,topY-scale*1.55),z-nz*.42,yaw+(this.rand(i*89)-.5)*.14,scale*(.86+this.rand(i*97)*.14));
   // Base debris and edge growth visually break the repeated modular silhouette.
   if(this.rand(i*101+5)>.22){const rx=x-nx*(2.0+this.rand(i*103)*2.7)+(this.rand(i*107)-.5)*2.2*f.tx,rz=z-nz*(2.0+this.rand(i*109)*2.7)+(this.rand(i*113)-.5)*2.2*f.tz;this.addNatural(this.prototypes.rocks,rx,this.world.heightAt(rx,rz),rz,this.rand(i*127)*Math.PI*2,1.2+this.rand(i*131)*1.6);}
   if(this.rand(i*137+4)>.48){const bx=x+nx*(.5+this.rand(i*139)*1.4)+(this.rand(i*149)-.5)*2.5*f.tx,bz=z+nz*(.5+this.rand(i*151)*1.4)+(this.rand(i*157)-.5)*2.5*f.tz;this.addNatural(this.prototypes.bushes,bx,this.world.heightAt(bx,bz),bz,this.rand(i*163)*Math.PI*2,1.8+this.rand(i*167)*1.5);}
  }
 }
 initialize(){this.scene.add(this.root);this.load().then(()=>this.buildOrganicCliff()).catch(err=>console.error('[Terrain features load]',err));}
}
