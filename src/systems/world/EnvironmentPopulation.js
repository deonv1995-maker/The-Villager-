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
   rock:mat(0x7d8681),
   bush:mat(0x4f8747),
   grass:mat(0x629b4d,{side:T.DoubleSide})
  };
 }
 createVariantCatalog(){
  return {
   tree:[
    {name:'standard',scale:[1,1,1]},
    {name:'tall',scale:[.82,1.34,.82]},
    {name:'broad',scale:[1.28,.9,1.18]},
    {name:'young',scale:[.7,.72,.7]},
    {name:'old',scale:[1.15,1.12,1.15],lean:.045},
    {name:'narrow',scale:[.7,1.12,.72]}
   ],
   rock:[
    {name:'boulder',scale:[1.35,1.05,1.25]},
    {name:'flat',scale:[1.7,.55,1.35]},
    {name:'tall',scale:[.82,1.5,.9]},
    {name:'small',scale:[.62,.62,.7]},
    {name:'wide',scale:[1.9,.8,1.05]},
    {name:'upright',scale:[.7,1.9,.72]}
   ],
   bush:[
    {name:'round',scale:[1,1,1]},
    {name:'wide',scale:[1.65,.72,1.25]},
    {name:'tall',scale:[.8,1.35,.82]},
    {name:'small',scale:[.62,.62,.62]},
    {name:'dense',scale:[1.28,1.08,1.22]}
   ],
   grass:[
    {name:'short',scale:[1,.72,1]},
    {name:'standard',scale:[1,1,1]},
    {name:'tall',scale:[.85,1.42,.85]},
    {name:'wide',scale:[1.45,.85,1.35]},
    {name:'tiny',scale:[.55,.5,.55]}
   ]
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
   this.loadObj('./assets/kaykit/forest/Tree_2_A_Color1.obj','tree'),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj','rock'),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj','bush'),
   this.loadObj('./assets/kaykit/forest/Grass_1_A_Color1.obj','grass')
  ]).then(([tree,rock,bush,grass])=>{this.prototypes={tree,rock,bush,grass};return this.prototypes;});
  return this.loading;
 }
 clone(type){return this.prototypes[type]?.clone(true)||null;}
 applyVariant(o,type,index,baseScale,seed){
  const list=this.variants[type],v=list[index%list.length];
  const sx=v.scale[0],sy=v.scale[1],sz=v.scale[2];
  o.scale.set(baseScale*sx,baseScale*sy,baseScale*sz);
  if(v.lean){o.rotation.z=(this.rand(seed+17)-.5)*v.lean*2;o.rotation.x=(this.rand(seed+23)-.5)*v.lean;}
  o.userData.environmentType=type;o.userData.environmentVariant=v.name;
 }
 populate(){
  this.root.clear();let placed=0;
  for(let i=0;i<1040;i++){
   const a=this.rand(i*4)*Math.PI*2,r=13+Math.sqrt(this.rand(i*4+1))*116;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   if(y<.12||s>.78||Math.hypot(x,z)<12)continue;
   const forestBias=Math.max(0,1-r/125),roll=this.rand(i*4+2);let type;
   if(roll<(.44+.18*forestBias)&&s<.48)type='tree';
   else if(roll<.68)type='rock';
   else if(roll<.86)type='bush';
   else type='grass';
   const o=this.clone(type);if(!o)continue;
   let scale=.78+this.rand(i*4+3)*.88;
   if(type==='tree')scale*=1.16;
   else if(type==='rock')scale*=2.15;
   else if(type==='bush')scale*=4.15;
   else scale*=2.15;
   const variantIndex=Math.floor(this.rand(i*11+5)*this.variants[type].length);
   this.applyVariant(o,type,variantIndex,scale,i*31);
   o.rotation.y=this.rand(i*7+3)*Math.PI*2;o.position.set(x,y,z);
   this.root.add(o);placed++;
  }
  return placed;
 }
 initialize(){
  this.scene.add(this.root);
  this.loadKayKit().then(()=>this.populate()).catch(err=>console.error('[KayKit forest load]',err));
 }
}
