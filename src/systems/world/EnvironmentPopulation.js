import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class EnvironmentPopulation {
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;this.seed=7319;
  this.root=new THREE.Group();this.root.name='EnvironmentPopulation';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;
  this.materials=this.createMaterials();
 }
 createMaterials(){
  const T=this.T;
  const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.82,metalness:0,flatShading:false,...extra});
  return {
   tree:mat(0xffffff,{vertexColors:true}),
   rock:mat(0x7d8681),
   bush:mat(0x4f8747),
   grass:mat(0x629b4d,{side:T.DoubleSide})
  };
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 slopeAt(x,z){const e=.8,h=this.world.heightAt(x,z);return Math.max(Math.abs(this.world.heightAt(x+e,z)-h),Math.abs(this.world.heightAt(x,z+e)-h))/e;}
 async loadObj(path,type){
  const res=await fetch(path);if(!res.ok)throw new Error(`${path}: ${res.status}`);
  const obj=this.loader.parse(await res.text());
  obj.traverse(child=>{
   if(!child.isMesh)return;
   if(type==='tree')this.applyTreeColors(child);
   child.material=this.materials[type];child.castShadow=true;child.receiveShadow=true;
  });
  return obj;
 }
 applyTreeColors(mesh){
  const T=this.T;
  let geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  const p=geometry.attributes.position,colors=new Float32Array(p.count*3);
  const bark=new T.Color(0x76513a),leafDark=new T.Color(0x315f3e),leafLight=new T.Color(0x4f8750);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);
   const c=(y<2.45&&r<.46)?bark:(y>3.2?leafLight:leafDark);
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));mesh.geometry=geometry;
 }
 async loadKayKit(){
  if(this.loading)return this.loading;
  this.loading=Promise.all([
   this.loadObj('./assets/kaykit/forest/Tree_2_A_Color1.obj','tree'),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj','rock'),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj','bush'),
   this.loadObj('./assets/kaykit/forest/Grass_1_A_Color1.obj','grass')
  ]).then(([tree,rock,bush,grass])=>{this.prototypes={tree,rock,bush,grass};return this.prototypes;});
  return this.loading;
 }
 clone(type){return this.prototypes[type]?.clone(true)||null;}
 populate(){
  this.root.clear();let placed=0;
  for(let i=0;i<920;i++){
   const a=this.rand(i*4)*Math.PI*2,r=13+Math.sqrt(this.rand(i*4+1))*116;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   if(y<.12||s>.78||Math.hypot(x,z)<12)continue;
   const forestBias=Math.max(0,1-r/125),roll=this.rand(i*4+2);let type;
   if(roll<(.46+.17*forestBias)&&s<.48)type='tree';
   else if(roll<.70)type='rock';
   else if(roll<.88)type='bush';
   else type='grass';
   const o=this.clone(type);if(!o)continue;
   let scale=.78+this.rand(i*4+3)*.88;
   if(type==='tree')scale*=1.18;
   else if(type==='rock')scale*=2.25;
   else if(type==='bush')scale*=4.4;
   else scale*=2.2;
   o.scale.setScalar(scale);o.rotation.y=this.rand(i*7+3)*Math.PI*2;o.position.set(x,y,z);
   this.root.add(o);placed++;
  }
  return placed;
 }
 initialize(){
  this.scene.add(this.root);
  this.loadKayKit().then(()=>this.populate()).catch(err=>console.error('[KayKit forest load]',err));
 }
}
