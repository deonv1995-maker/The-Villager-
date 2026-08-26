import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class EnvironmentPopulation {
 constructor(THREE,{world,scene}){
  this.T=THREE;this.world=world;this.scene=scene;this.seed=7319;
  this.root=new THREE.Group();this.root.name='EnvironmentPopulation';
  this.loader=new OBJLoader();this.prototypes={};this.loading=null;
  this.materials=this.createMaterials();
  this.variants=this.createVariantCatalog();
  this.regionRules=this.createRegionRules();
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
   // Harvestable trees are intentionally kept substantial relative to the
   // 2.7 m Ranger and the 2.9 m logs they produce. Even the young variant now
   // reads as a real tree rather than a shrub-sized prop.
   tree:[
    {name:'natural',scale:[1,1,1]},
    {name:'young',scale:[.94,.98,.94]},
    {name:'mature',scale:[1.14,1.18,1.14]}
   ],
   bareTree:[{name:'bare',scale:[1,1.04,1]},{name:'weathered',scale:[.94,1.16,.94]}],
   rock:[{name:'natural',scale:[1,1,1]},{name:'small',scale:[.7,.7,.7]},{name:'large',scale:[1.3,1.15,1.25]}],
   bush:[{name:'natural',scale:[1,1,1]},{name:'small',scale:[.75,.75,.75]},{name:'full',scale:[1.22,1.1,1.18]}],
   grass:[{name:'short',scale:[1,.78,1]},{name:'natural',scale:[1,1,1]},{name:'tall',scale:[.9,1.25,.9]}]
  };
 }

 createRegionRules(){
  // These values only control ecology distribution. Terrain elevation and
  // traversal stay owned by RegionalIslandTerrain/WorldManager.
  return {
   lowlands:{density:.78,tree:.48,rock:.18,bush:.18,grass:.16,scale:1.00},
   westernHighland:{density:.82,tree:.57,rock:.18,bush:.15,grass:.10,scale:1.08},
   northernRidge:{density:.68,tree:.48,rock:.25,bush:.14,grass:.13,scale:.96},
   easternShelf:{density:.72,tree:.39,rock:.22,bush:.22,grass:.17,scale:.98},
   southernBasin:{density:.90,tree:.35,rock:.10,bush:.31,grass:.24,scale:.92},
   westernValley:{density:.96,tree:.61,rock:.10,bush:.18,grass:.11,scale:1.04},
   centralSaddle:{density:.56,tree:.28,rock:.18,bush:.22,grass:.32,scale:.92}
  };
 }

 rand(i){const x=Math.sin(i*12.9898+this.seed)*43758.5453;return x-Math.floor(x);}
 slopeAt(x,z){const e=.8,h=this.world.heightAt(x,z);return Math.max(Math.abs(this.world.heightAt(x+e,z)-h),Math.abs(this.world.heightAt(x,z+e)-h))/e;}

 habitatNoise(x,z){
  const n=Math.sin(x*.071+z*.019)+Math.cos(z*.063-x*.014)+Math.sin((x+z)*.036+.8);
  return Math.max(0,Math.min(1,.5+n/6));
 }

 regionAt(x,z){
  return this.world.terrain?.terrainRegionAt?.(x,z)||{name:'lowlands',weight:0};
 }

 cliffInfoAt(x,z){
  const terrain=this.world.terrain;
  const profiles=terrain?.cliffProfilesAt?.(x,z)
   ||(terrain?.cliffFormationProfileAt?[terrain.cliffFormationProfileAt(x,z)]:[]);
  let best=null;
  for(const profile of profiles){
   if(!profile||profile.weight<.025)continue;
   const f=profile.formation||terrain.cliffFormation;
   if(!f)continue;
   if(profile.u<f.uMin-2.5||profile.u>f.uMax+2.5)continue;
   const distance=Math.abs(profile.signed);
   if(!best||distance<best.distance)best={profile,formation:f,distance};
  }
  return best;
 }

 terrainClearance(x,z){
  const cliff=this.cliffInfoAt(x,z);
  if(!cliff)return false;
  const p=cliff.profile;
  // Keep the actual rock face and the authored ramp corridor readable, but do
  // not sterilise the whole formation rectangle like the older implementation.
  const solidClearance=p.rampMask<.42?2.35:1.25;
  return cliff.distance<solidClearance;
 }

 ecologyAt(x,z,slope){
  const region=this.regionAt(x,z);
  const rule=this.regionRules[region.name]||this.regionRules.lowlands;
  const cliff=this.cliffInfoAt(x,z);
  const noise=this.habitatNoise(x,z);

  let density=rule.density*(.72+noise*.48);
  let weights={tree:rule.tree,rock:rule.rock,bush:rule.bush,grass:rule.grass};
  let scale=rule.scale;

  if(cliff){
   const edgeInfluence=1-this.world.terrain.smoothstep(2.4,10.5,cliff.distance);
   if(edgeInfluence>0){
    // Exposed cliff rims and bases are naturally more open and rocky.
    density*=1-edgeInfluence*.24;
    weights={
     tree:weights.tree*(1-edgeInfluence*.74),
     rock:weights.rock+edgeInfluence*.26,
     bush:weights.bush+edgeInfluence*.10,
     grass:weights.grass+edgeInfluence*.14
    };
    scale*=1-edgeInfluence*.08;
   }
  }

  if(slope>.28){
   const steep=Math.min(1,(slope-.28)/.42);
   weights.tree*=1-steep*.68;
   weights.rock+=steep*.34;
   weights.bush*=1-steep*.18;
   density*=1-steep*.20;
  }

  const total=Math.max(.001,weights.tree+weights.rock+weights.bush+weights.grass);
  return {region,rule,density,scale,weights,total,noise,cliff};
 }

 pickType(ecology,roll,seed){
  const w=ecology.weights;
  let cursor=w.tree/ecology.total;
  if(roll<cursor)return this.rand(seed)<.055?'bareTree':'tree';
  cursor+=w.rock/ecology.total;
  if(roll<cursor)return 'rock';
  cursor+=w.bush/ecology.total;
  if(roll<cursor)return 'bush';
  return 'grass';
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

 placeObject(type,x,y,z,i,scaleMultiplier=1,regionName='lowlands'){
  const o=this.clone(type,i*19+7);if(!o)return false;
  let scale=(.78+this.rand(i*4+3)*.88)*scaleMultiplier;
  // The previous tree multiplier made several harvestable trees barely taller
  // than the Ranger while still producing three 2.9 m construction logs. Scale
  // the entire tree uniformly so trunk thickness and canopy size grow together.
  if(type==='tree')scale*=1.68;
  else if(type==='bareTree')scale*=1.58;
  else if(type==='rock')scale*=2.15;
  else if(type==='bush')scale*=4.15;
  else scale*=2.15;
  const variantIndex=Math.floor(this.rand(i*11+5)*this.variants[type].length);
  this.applyVariant(o,type,variantIndex,scale);
  o.rotation.y=this.rand(i*7+3)*Math.PI*2;o.position.set(x,y,z);
  o.userData.terrainRegion=regionName;
  this.root.add(o);return true;
 }

 populateSlopeRocks(startIndex){
  let placed=0;
  for(let i=0;i<460;i++){
   const a=this.rand(i*13+2)*Math.PI*2;
   const r=24+Math.sqrt(this.rand(i*13+3))*106;
   const x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   if(y<.1||s<.22||s>.92||Math.hypot(x,z)<15||this.terrainClearance(x,z))continue;
   const ecology=this.ecologyAt(x,z,s);
   if(this.rand(i*13+4)>.48*ecology.density)continue;
   if(this.placeObject('rock',x,y-.08,z,startIndex+i,(1.08+.62*Math.min(s,.7))*ecology.scale,ecology.region.name))placed++;
  }
  return placed;
 }

 populate(){
  this.root.clear();let placed=0;

  // Candidate count is intentionally higher than the final object count. The
  // ecology density field creates forests, open saddles, rocky cliff margins
  // and basin vegetation without increasing the mobile rendering budget much.
  for(let i=0;i<1450;i++){
   const a=this.rand(i*4)*Math.PI*2;
   const r=13+Math.sqrt(this.rand(i*4+1))*116;
   const x=Math.cos(a)*r,z=Math.sin(a)*r;
   const y=this.world.heightAt(x,z),s=this.slopeAt(x,z);
   if(y<.12||s>.80||Math.hypot(x,z)<12||this.terrainClearance(x,z))continue;

   const ecology=this.ecologyAt(x,z,s);
   if(this.rand(i*9+41)>ecology.density)continue;

   // Broad deterministic clearings stop the forest from becoming uniform dots.
   const clearingThreshold=.16+Math.max(0,.40-ecology.noise)*.55;
   if(ecology.noise<clearingThreshold&&this.rand(i*7+91)>.34)continue;

   const type=this.pickType(ecology,this.rand(i*4+2),i*17+11);
   let scale=ecology.scale;
   if(type==='grass')scale*=.88+.24*ecology.noise;
   if(type==='bush'&&ecology.region.name==='southernBasin')scale*=1.08;
   if(type==='tree'&&ecology.region.name==='westernValley')scale*=1.06;

   if(this.placeObject(type,x,y,z,i,scale,ecology.region.name))placed++;
  }

  placed+=this.populateSlopeRocks(5000);
  return placed;
 }

 initialize(){
  this.scene.add(this.root);
  this.loadKayKit().then(()=>this.populate()).catch(err=>console.error('[KayKit forest load]',err));
 }
}
