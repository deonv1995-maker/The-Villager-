import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures {
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;this.root=new THREE.Group();this.root.name='TerrainFeatures';this.loader=new OBJLoader();this.prototypes={};this.loading=null;this.seed=9137;
  this.materials={rock:new THREE.MeshStandardMaterial({color:0x78827d,roughness:.96,metalness:0,flatShading:true}),dirt:new THREE.MeshStandardMaterial({color:0x756d59,roughness:.97,metalness:0,flatShading:true}),grass:new THREE.MeshStandardMaterial({color:0x7fb64e,roughness:.95,metalness:0,flatShading:true}),bush:new THREE.MeshStandardMaterial({color:0x4f8747,roughness:.9,metalness:0,flatShading:true})};
 }
 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 materialFor(source,fallback){const n=(source?.name||'').toLowerCase();if(n.includes('grass'))return this.materials.grass;if(n.includes('dirt'))return this.materials.dirt;if(n.includes('rock'))return this.materials.rock;return fallback;}
 measure(obj){
  const box=new this.T.Box3().setFromObject(obj),size=new this.T.Vector3();box.getSize(size);
  const m={minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z,height:Math.max(.001,size.y),width:Math.max(.001,size.z),depth:Math.max(.001,size.x)};
  obj.userData.metrics=m;return m;
 }
 async loadObj(path,fallback=this.materials.rock){const res=await fetch(path,{cache:'no-store'});if(!res.ok)throw new Error(`${path}: ${res.status}`);const obj=this.loader.parse(await res.text());obj.traverse(child=>{if(!child.isMesh)return;child.material=Array.isArray(child.material)?child.material.map(m=>this.materialFor(m,fallback)):this.materialFor(child.material,fallback);child.castShadow=true;child.receiveShadow=true;});this.measure(obj);return obj;}
 async load(){
  if(this.loading)return this.loading;const A='./assets/modular-terrain/';
  this.loading=Promise.all([
   this.loadObj(`${A}Cliff_Terrain_Side_Base.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Side_Mid.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Side_Top.obj`,this.materials.rock),
   this.loadObj(`${A}Escarpment_Terrain_Side_Base.obj`,this.materials.dirt),this.loadObj(`${A}Escarpment_Terrain_Side_Mid.obj`,this.materials.dirt),this.loadObj(`${A}Escarpment_Terrain_Side_Top.obj`,this.materials.dirt),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Center.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Edge.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Base.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Mid.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Top.obj`,this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Base.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Mid.obj`,this.materials.rock),this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Top.obj`,this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj',this.materials.rock),this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj',this.materials.rock),this.loadObj('./assets/kaykit/forest/Rock_3_A_Color1.obj',this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj',this.materials.bush),this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj',this.materials.bush)
  ]).then(v=>{this.prototypes={cliff:{base:v[0],mid:v[1],top:v[2]},escarp:{base:v[3],mid:v[4],top:v[5]},falloff:{center:v[6],edge:v[7]},outer:{base:v[8],mid:v[9],top:v[10]},inner:{base:v[11],mid:v[12],top:v[13]},rocks:[v[14],v[15],v[16]],bushes:[v[17],v[18]]};return this.prototypes;});return this.loading;
 }
 metrics(source){return source?.userData?.metrics||null;}
 scaleForWidth(source,targetWidth){const m=this.metrics(source);return m?targetWidth/m.width:targetWidth;}
 addModel(source,x,y,z,yaw,sx,sy=sx,sz=sx){if(!source)return null;const o=source.clone(true);o.position.set(x,y,z);o.rotation.y=yaw;o.scale.set(sx,sy,sz);this.root.add(o);return o;}
 addNatural(list,x,y,z,yaw,scale){if(!list?.length)return;const src=list[Math.floor(this.rand((x+z)*17)*list.length)%list.length];this.addModel(src,x,y,z,yaw,scale);}
 yawForProfile(profile){return Math.atan2(profile.nz,-profile.nx);}
 alignedXZ(source,profile,anchorX,anchorZ,yaw,sx,sink=.08){
  const m=this.metrics(source);if(!m)return{x:anchorX,z:anchorZ};
  const localXx=Math.cos(yaw),localXz=-Math.sin(yaw);const xDot=localXx*profile.nx+localXz*profile.nz;
  const frontHigh=m.maxX*sx*xDot;const originHigh=sink-frontHigh;
  return{x:anchorX+profile.nx*originHigh,z:anchorZ+profile.nz*originHigh};
 }
 addCliffAligned(source,profile,anchorX,topY,anchorZ,yaw,sx,sy=sx,sz=sx,sink=.08){
  if(!source)return null;const m=this.metrics(source),p=this.alignedXZ(source,profile,anchorX,anchorZ,yaw,sx,sink);const y=m?topY-m.maxY*sy:topY;const o=this.addModel(source,p.x,y,p.z,yaw,sx,sy,sz);return{object:o,bottomY:m?y+m.minY*sy:y,x:p.x,z:p.z};
 }
 curvatureAt(t){const terrain=this.world.terrain,a=terrain.cliffFrame(Math.max(.01,t-.045)),b=terrain.cliffFrame(Math.min(.99,t+.045));return a.tx*b.tz-a.tz*b.tx;}
 placeStack(family,profile,anchorX,anchorZ,yaw,targetWidth,seed,corner=false){
  if(!family?.top)return;
  const topScale=this.scaleForWidth(family.top,targetWidth),topDepth=topScale*(corner?.68:.58)+topScale*this.rand(seed+1)*.08,topHeight=topScale*(.88+this.rand(seed+2)*.07),topWidth=topScale*(1.09+this.rand(seed+3)*.10);
  const top=this.addCliffAligned(family.top,profile,anchorX,profile.upperHeight-.20,anchorZ,yaw,topDepth,topHeight,topWidth,corner?.14:.10);if(!top)return;
  let currentBottom=top.bottomY;const lowerTarget=profile.lowerHeight-.08;let midCount=0;
  while(family.mid&&currentBottom-lowerTarget>.5&&midCount<2){
   const s=this.scaleForWidth(family.mid,targetWidth*(1.02+this.rand(seed+10+midCount)*.07)),sy=s*(.9+this.rand(seed+14+midCount)*.08),m=this.metrics(family.mid),h=m?m.height*sy:sy;if(currentBottom-lowerTarget<h*.38)break;
   const placed=this.addCliffAligned(family.mid,profile,anchorX,currentBottom+.22,anchorZ,yaw+(this.rand(seed+20+midCount)-.5)*.045,s*(.68+this.rand(seed+22+midCount)*.07),sy,s*(1.08+this.rand(seed+24+midCount)*.07),.06);if(!placed)break;currentBottom=placed.bottomY;midCount++;
  }
  if(family.base&&currentBottom-lowerTarget>.16){const s=this.scaleForWidth(family.base,targetWidth*(1.0+this.rand(seed+30)*.06));this.addCliffAligned(family.base,profile,anchorX,currentBottom+.20,anchorZ,yaw+(this.rand(seed+31)-.5)*.05,s*(.72+this.rand(seed+32)*.06),s*(.9+this.rand(seed+33)*.07),s*(1.07+this.rand(seed+34)*.06),.04);}
 }
 placeFalloff(source,profile,anchorX,anchorZ,yaw,targetWidth,seed){if(!source)return;const s=this.scaleForWidth(source,targetWidth);this.addCliffAligned(source,profile,anchorX,profile.upperHeight-.18,anchorZ,yaw,s*(.62+this.rand(seed+1)*.07),s*(.9+this.rand(seed+2)*.07),s*(1.08+this.rand(seed+3)*.08),.10);}
 buildIntegratedCliff(){
  const anchors=[.025];let t=.078,cursor=0;while(t<.94&&cursor<28){anchors.push(t);t+=.038+this.rand(cursor*41+5)*.038;cursor++;}anchors.push(.975);
  for(let i=0;i<anchors.length;i++){
   const t0=Math.min(.99,Math.max(.01,anchors[i]+(this.rand(i*23+4)-.5)*.012)),profile=this.world.terrain.cliffFeatureProfile(t0);if(profile.drop<1.15)continue;
   const end=i===0||i===anchors.length-1;if(!end&&this.rand(i*31+6)<.025)continue;
   const seed=i*101+13,along=(this.rand(i*43+7)-.5)*.55,anchorX=profile.x+profile.tx*along,anchorZ=profile.z+profile.tz*along;
   const baseYaw=this.yawForProfile(profile)+(this.rand(i*47+9)-.5)*.07,curve=this.curvatureAt(t0),absCurve=Math.abs(curve),targetWidth=4.1+this.rand(seed+2)*1.55;
   if(end)this.placeFalloff(this.prototypes.falloff.edge,profile,anchorX,anchorZ,baseYaw+(i===0?Math.PI:0),targetWidth*1.08,seed);
   else if(profile.drop<1.85&&this.rand(seed+4)>.14)this.placeFalloff(this.prototypes.falloff.center,profile,anchorX,anchorZ,baseYaw,targetWidth*1.08,seed+6);
   else if(absCurve>.07&&this.rand(seed+8)>.12){const outer=curve>0,family=outer?this.prototypes.outer:this.prototypes.inner,cornerYaw=baseYaw+(outer?-Math.PI/4:Math.PI/4)+(this.rand(seed+9)-.5)*.035;this.placeStack(family,profile,anchorX,anchorZ,cornerYaw,targetWidth*1.18,seed+10,true);}
   else if(this.rand(seed+12)<.22)this.placeFalloff(this.prototypes.falloff.center,profile,anchorX,anchorZ,baseYaw,targetWidth,seed+20);
   else this.placeStack(this.rand(seed+16)<.34?this.prototypes.escarp:this.prototypes.cliff,profile,anchorX,anchorZ,baseYaw,targetWidth,seed+30,false);

   if(this.rand(seed+50)>.3){const rx=profile.x-profile.nx*(1.2+this.rand(seed+51)*2.2)+(this.rand(seed+52)-.5)*2.2*profile.tx,rz=profile.z-profile.nz*(1.2+this.rand(seed+53)*2.2)+(this.rand(seed+54)-.5)*2.2*profile.tz;this.addNatural(this.prototypes.rocks,rx,this.world.heightAt(rx,rz)-.07,rz,this.rand(seed+55)*Math.PI*2,1+this.rand(seed+56)*1.45);}
   if(this.rand(seed+60)>.55){const bx=profile.x+profile.nx*(.8+this.rand(seed+61)*1.4)+(this.rand(seed+62)-.5)*2*profile.tx,bz=profile.z+profile.nz*(.8+this.rand(seed+63)*1.4)+(this.rand(seed+64)-.5)*2*profile.tz;this.addNatural(this.prototypes.bushes,bx,this.world.heightAt(bx,bz),bz,this.rand(seed+65)*Math.PI*2,1.25+this.rand(seed+66)*1.25);}
  }
 }
 initialize(){this.scene.add(this.root);this.load().then(()=>this.buildIntegratedCliff()).catch(err=>console.error('[Terrain features load]',err));}
}
