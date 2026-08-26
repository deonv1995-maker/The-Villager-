export class GroundSurfaceDecorator {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.seed=51843;

  this.root=new THREE.Group();
  this.root.name='GroundSurfaceDecorator';
  this.land=null;

  // Ground material presentation only. The authoritative terrain mesh keeps all
  // height/collision ownership; this system recolours that same mesh instead of
  // stacking visible patch geometry over it.
  this.beachBlendStart=.77;
  this.beachFullStart=.87;
  this.beachOuterFade=.996;
 }

 rand(n){
  const x=Math.sin(n*12.9898+this.seed)*43758.5453;
  return x-Math.floor(x);
 }

 smoothstep(a,b,x){
  if(a===b)return x>=b?1:0;
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
 }

 fieldNoise(x,z){
  const broad=
   Math.sin(x*.030+z*.016)
   +Math.cos(z*.034-x*.012)
   +Math.sin((x-z)*.051+.8)*.72
   +Math.cos((x+z)*.018-1.1)*.82;
  const secondary=
   Math.sin(x*.071+z*.043+1.7)*.42
   +Math.cos(z*.064-x*.037-.9)*.34;
  return Math.max(0,Math.min(1,.5+(broad+secondary)/7.4));
 }

 detailNoise(x,z){
  const n=
   Math.sin(x*.137-z*.083)*.46
   +Math.cos(z*.121+x*.067)*.38
   +Math.sin((x+z)*.204+1.3)*.20;
  return Math.max(0,Math.min(1,.5+n/2.6));
 }

 regionAt(x,z){
  return this.world?.terrain?.terrainRegionAt?.(x,z)||{name:'lowlands',weight:0};
 }

 surfaceWeightsAt(x,z){
  const terrain=this.world?.terrain;
  const d=terrain?.islandMetric?.(x,z)??0;
  if(d>=1)return {beach:0,soil:0,inlandSand:0,noise:.5,metric:d};

  const noise=this.fieldNoise(x,z);
  const detail=this.detailNoise(x,z);
  const region=this.regionAt(x,z).name;

  // One continuous beach belt follows the actual island metric. This replaces
  // random shoreline patches and guarantees sand around the water-facing edge.
  const beachIn=this.smoothstep(this.beachBlendStart,this.beachFullStart,d);
  const beachOut=1-this.smoothstep(this.beachOuterFade,1,d);
  const beach=Math.max(0,Math.min(1,beachIn*beachOut));

  // Inland soil uses broad overlapping fields rather than discrete decals. The
  // result meanders through lowlands/valleys and softly dissolves into grass.
  let soilField=noise*.76+detail*.24;
  let soil=this.smoothstep(.49,.70,soilField)*.62;
  if(region==='southernBasin')soil*=1.28;
  else if(region==='westernValley')soil*=1.24;
  else if(region==='centralSaddle')soil*=1.13;
  else if(region==='westernHighland')soil*=.76;
  else if(region==='northernRidge')soil*=.82;
  soil*=1-beach*.96;
  soil=Math.max(0,Math.min(.72,soil));

  // Sparse dry sandy pockets can still occur inland, but they stay subordinate
  // to the continuous shoreline beach and never read as giant painted polygons.
  let inlandSand=this.smoothstep(.70,.88,1-noise)*.20;
  if(region==='easternShelf')inlandSand*=1.22;
  else if(region==='westernHighland')inlandSand*=.48;
  inlandSand*=1-beach;
  inlandSand=Math.max(0,Math.min(.24,inlandSand));

  return {beach,soil,inlandSand,noise,metric:d};
 }

 surfaceTypeAt(x,z){
  const w=this.surfaceWeightsAt(x,z);
  if(w.beach>.56)return 'sand';
  if(w.inlandSand>.16)return 'sand';
  if(w.soil>.38)return 'soil';
  return 'grass';
 }

 grassDensityMultiplierAt(x,z){
  const w=this.surfaceWeightsAt(x,z);
  return Math.max(.03,Math.min(1,
   1-w.beach*.97-w.inlandSand*.58-w.soil*.34
  ));
 }

 sandColorAt(x,z){
  const c=new this.T.Color();
  const detail=this.detailNoise(x,z);
  c.setHSL(
   .105+(detail-.5)*.014,
   .43+detail*.08,
   .575+(detail-.5)*.075
  );
  return c;
 }

 soilColorAt(x,z){
  const c=new this.T.Color();
  const detail=this.detailNoise(x+17,z-11);
  c.setHSL(
   .073+(detail-.5)*.018,
   .38+detail*.10,
   .285+(detail-.5)*.075
  );
  return c;
 }

 integratedColorAt(x,y,z,baseColor){
  const w=this.surfaceWeightsAt(x,z);
  if(w.metric>=1)return baseColor;

  const result=baseColor.clone();
  if(w.soil>.001)result.lerp(this.soilColorAt(x,z),w.soil*.78);
  if(w.inlandSand>.001)result.lerp(this.sandColorAt(x,z),w.inlandSand*.68);

  // Beach is the dominant shoreline material. The inner part blends naturally
  // with grass; the outer belt becomes a clear warm sandy beach.
  if(w.beach>.001)result.lerp(this.sandColorAt(x,z),w.beach*.96);
  return result;
 }

 applyToTerrain(){
  const land=this.scene.getObjectByName?.('UnifiedProceduralIslandLand');
  const geometry=land?.geometry;
  const positions=geometry?.getAttribute?.('position');
  const colors=geometry?.getAttribute?.('color');
  if(!land||!positions||!colors)return false;

  const base=new this.T.Color();
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i);
   const y=positions.getY(i);
   const z=positions.getZ(i);
   const metric=this.world?.terrain?.islandMetric?.(x,z);
   if(Number.isFinite(metric)&&metric>=1)continue;

   base.fromBufferAttribute(colors,i);
   const integrated=this.integratedColorAt(x,y,z,base);
   colors.setXYZ(i,integrated.r,integrated.g,integrated.b);
  }

  colors.needsUpdate=true;
  geometry.computeVertexNormals?.();
  land.material.vertexColors=true;
  land.material.roughness=.96;
  land.material.needsUpdate=true;
  this.land=land;
  return true;
 }

 applyBeachVegetationMask(){
  const root=this.world?.environment?.root;
  if(!root)return 0;
  const worldPosition=new this.T.Vector3();
  let hidden=0;

  for(const object of root.children){
   if(object.userData?.environmentType!=='grass')continue;
   object.getWorldPosition(worldPosition);
   const beach=this.surfaceWeightsAt(worldPosition.x,worldPosition.z).beach;
   if(beach>.72){
    object.visible=false;
    hidden++;
   }
  }
  return hidden;
 }

 initialize(){
  this.scene.add(this.root);
  setTimeout(()=>this.applyToTerrain(),0);

  const environment=this.world?.environment;
  if(environment?.loadKayKit){
   environment.loadKayKit()
    .then(()=>this.applyBeachVegetationMask())
    .catch(err=>console.error('[Ground surface vegetation integration]',err));
  }
 }
}
