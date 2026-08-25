import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class EnvironmentPopulation {
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;this.seed=7319;
  this.root=new THREE.Group();this.root.name='EnvironmentPopulation';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;
  this.materials=this.createMaterials();
  this.variants=this.createVariantCatalog();
 }
 createMaterials(){
  const T=this.T;
  const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.82,metalness:0,flatShading:false,...extra});
  return {
   tree:mat(0xffffff,{vertexColors:true}),
   bareTree:mat(0x755038),
   rock:mat(0x7d8681),
   bush:mat(0x4f8747),
   grass:mat(0x629b4d,{side:T.DoubleSide})
  };
 }
 createVariantCatalog(){
  return {
   tree:[{name:'natural',scale:[1,1,1]},{name:'young',scale:[.84,.88,.84]},{name:'mature',scale:[1.1,1.08,1.1]}],
   bareTree:[{name:'bare',scale:[1,1,1]},{name:'weathered',scale:[.9,1.12,.9]}],
   rock:[{name:'natural',scale:[1,1,1]},{name:'small',scale:[.7,.7,.7]},{name:'large',scale:[1.3,1.15,1.25]}],
   bush:[{name:'natural',scale:[1,1,1]},{name:'small',scale:[.75,.75,.75]},{name:'full',scale:[1.22,1.1,1.18]}],
   grass:[{name:'short',scale:[1,.78,1]},{name:'natural',scale:[1,1,1]},{name:'tall',scale:[.9,1.25,.9]}]
  };
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 slopeAt(x,z){const e=.8,h=this.world.heightAt(x,z);return Math.max(Math.abs(this.world.heightAt(x+e,z)-h),Math.abs(this.world.heightAt(x,z+e)-h))/e;}
 cliffClearance(x,z){
  const terrain=this.world.terrain;
  if(!terrain?.cliffProfileAt)return {blocked:false,profile:null};
  const profile=terrain.cliffProfileAt(x,z);
  return {blocked:profile.active&&Math.abs(profile.signed)<3.2,profile};
 }
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
  const bark=new T.Color(0x76513a),leafDark=new T.Color(0x315f3e),leafMid=new T.Color(0x3f7547),leafLight=new T.Color(0x568c53);
  let maxY=0;for(let i=0;i<p.count;i++)maxY=Math.max(maxY,p.getY(i));
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z),ny=maxY>0?y/maxY:0;
   const c=(ny<.48&&r<.46)?bark:(ny>.72?leafLight:(ny>.56?leafMid:leafDark));
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));mesh.geometry=geometry;
 }
 async loadKayKit(){
  if(this.loading)return this.loading;
  this.loading=Promise.all([
   this.loadObj('./assets/kaykit/forest/Tree_1_A_Color1.obj','tree'),
   this.loadObj('./assets/kaykit/forest/Tree_2_A_Color1.obj','tree'),
   this.loadObj('./assets/kaykit/forest/Tree_4_A_Color1.obj','tree'),
   this.loadObj('./assets/kaykit/forest/Tree_Bare_1_A_Color1.obj','bareTree'),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj','rock'),
   this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj','rock'),
   this.loadObj('./assets/kaykit/forest/Rock_3_A_Color1.obj','rock'),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj','bush'),
   this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj','bush'),
   this.loadObj('./assets/kaykit/forest/Grass_1_A_Color1.obj','grass'),
   this.loadObj('./assets/kaykit/forest/Grass_2_A_Color1.obj','grass')
  ]).then(([tree1,tree2,tree4,bare1,rock1,rock2,rock3,bush1,bush2,grass1,grass2])=>{
   this.prototypes={tree:[tree1,tree2,tree4],bareTree:[bare1],rock:[rock1,rock2,rock3],bush:[bush1,bush2],grass:[grass1,grass2]};
   return this.prototypes;
  });
  return this.loading;
 }
 clone(type,seed=0){
  const source=this.prototypes[type];
  if(Array.isArray(source)){
   if(!source.length)return null;
   const index=Math.floor(this.rand(seed)*source.length)%source.length;
   const clone=source[index].clone(true);
   clone.userData.environmentSpecies=`${type}_${index+1}`;
   return clone;
  }
  return source?.clone(true)||null;
 }
 applyVariant(o,type,index,baseScale){
  const list=this.variants[type],v=list[index%list.length];
  o.scale.set(baseScale*v.scale[0],baseScale*v.scale[1],baseScale*v.scale[2]);
  o.userData.environmentType=type;o.userData.environmentVariant=v.name;
 }
 placeObject(type,x,y,z,i,scaleMultiplier=1){
  const o=this.clone(type,i*19+7);if(!o)return false;
  let scale=(.78+this.rand(i*4+3)*.88)*scaleMultiplier;
  if(type==='tree')scale*=1.12;
  else if(type==='bareTree')scale*=1.08;
  else if(type==='rock')scale*=2.15;
  else if(type==='bush')scale*=4.15;
  else scale*=2.15;
  const variantIndex=Math.floor(this.rand(i*11+5)*this.variants[type].length);
  this.applyVariant(o,type,variantIndex,scale);
  o.rotation.y=this.rand(i*7+3)*Math.PI*2;o.position.set(x,y,z);
  this.root.add(o);return true;
 }
 populateSlopeRocks(startIndex){
  let placed=0;
  for(let i=0;i<420;i++){
   const a=this.rand(i*13+2)*Math.PI*2;
   const r=24+Math.sqrt(this.rand(i*13+3))*106;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   const clearance=this.cliffClearance(x,z);
   if(y<.1||s<.22||s>.9||Math.hypot(x,z)<15||clearance.blocked)continue;
   if(this.rand(i*13+4)>.58)continue;
   if(this.placeObject('rock',x,y-.08,z,startIndex+i,1.18+.55*Math.min(s,.7)))placed++;
  }
  return placed;
 }
 populate(){
  this.root.clear();let placed=0;
  for(let i=0;i<1100;i++){
   const a=this.rand(i*4)*Math.PI*2,r=13+Math.sqrt(this.rand(i*4+1))*116;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   const clearance=this.cliffClearance(x,z);
   if(y<.12||s>.78||Math.hypot(x,z)<12||clearance.blocked)continue;
   const forestBias=Math.max(0,1-r/125),roll=this.rand(i*4+2);let type;
   if(s>.33){type='rock';}
   else if(roll<(.44+.18*forestBias)){type=this.rand(i*17+11)<.055?'bareTree':'tree';}
   else if(roll<.68)type='rock';
   else if(roll<.86)type='bush';
   else type='grass';
   if(this.placeObject(type,x,y,z,i))placed++;
  }
  placed+=this.populateSlopeRocks(5000);
  return placed;
 }
 initialize(){
  this.scene.add(this.root);
  this.loadKayKit().then(()=>this.populate()).catch(err=>console.error('[KayKit forest load]',err));
 }
}
