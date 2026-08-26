export class GroundSurfaceDecorator {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.seed=51843;

  this.root=new THREE.Group();
  this.root.name='GroundSurfaceDecorator';
  this.mesh=null;

  // Presentation-only ground dressing. Terrain remains the sole authority for
  // height, collision and traversal; these patches simply conform to it.
  this.candidateCount=720;
  this.maxPatches=210;
  this.minRadius=2.4;
  this.maxRadius=7.8;
  this.minSegments=10;
  this.maxSegments=15;
  this.maxSlope=.39;
  this.surfaceOffset=.026;
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
  const n=
   Math.sin(x*.047+z*.021)
   +Math.cos(z*.052-x*.017)
   +Math.sin((x-z)*.091+.8)*.55
   +Math.cos((x+z)*.026-1.1)*.72;
  return Math.max(0,Math.min(1,.5+n/6.1));
 }

 slopeAt(x,z){
  if(this.world?.terrain?.slopeAt)return this.world.terrain.slopeAt(x,z);
  if(this.world?.environment?.slopeAt)return this.world.environment.slopeAt(x,z);
  const e=.65;
  const h=this.world.heightAt(x,z);
  return Math.max(
   Math.abs(this.world.heightAt(x+e,z)-h),
   Math.abs(this.world.heightAt(x-e,z)-h),
   Math.abs(this.world.heightAt(x,z+e)-h),
   Math.abs(this.world.heightAt(x,z-e)-h)
  )/e;
 }

 regionAt(x,z){
  return this.world?.terrain?.terrainRegionAt?.(x,z)||{name:'lowlands',weight:0};
 }

 isSurfaceAvailable(x,z){
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(x,z))return false;
  const metric=this.world?.terrain?.islandMetric?.(x,z);
  if(Number.isFinite(metric)&&metric>.972)return false;
  const y=this.world.heightAt(x,z);
  if(y<-.48)return false;
  if(this.slopeAt(x,z)>this.maxSlope)return false;
  if(this.world?.environment?.terrainClearance?.(x,z))return false;
  return true;
 }

 chooseSurfaceType(x,z,seed){
  const terrain=this.world?.terrain;
  const d=terrain?.islandMetric?.(x,z)??0;
  const y=this.world.heightAt(x,z);
  const noise=this.fieldNoise(x,z);
  const region=this.regionAt(x,z).name;

  const lowElevation=1-this.smoothstep(2.0,5.3,y);
  const coast=this.smoothstep(.73,.955,d)*lowElevation;

  let sandBoost=1;
  if(region==='easternShelf')sandBoost=1.28;
  else if(region==='southernBasin')sandBoost=1.10;
  else if(region==='westernHighland')sandBoost=.62;

  let soilBoost=1;
  if(region==='southernBasin')soilBoost=1.34;
  else if(region==='westernValley')soilBoost=1.30;
  else if(region==='centralSaddle')soilBoost=1.18;
  else if(region==='northernRidge')soilBoost=.72;

  const dryPocket=this.smoothstep(.18,.43,1-noise)*lowElevation;
  const richPocket=this.smoothstep(.52,.79,noise);
  const sandChance=Math.min(.92,(coast*.86+dryPocket*.18)*sandBoost);
  const soilChance=Math.min(.72,(richPocket*.54+.10)*soilBoost*(1-coast*.68));
  const roll=this.rand(seed+7);

  if(roll<sandChance)return 'sand';
  if(this.rand(seed+11)<soilChance)return 'soil';
  return null;
 }

 baseColorAt(x,z){
  const y=this.world.heightAt(x,z);
  const color=this.world?.terrain?.surfaceColorAt?.(x,y,z);
  return color?.clone?.()||new this.T.Color(0x7fb64e);
 }

 patchColor(type,seed){
  const T=this.T;
  const variation=this.rand(seed);
  const c=new T.Color();
  if(type==='sand'){
   c.setHSL(
    .105+variation*.018,
    .34+this.rand(seed+2)*.10,
    .48+this.rand(seed+3)*.10
   );
  }else{
   c.setHSL(
    .078+variation*.016,
    .34+this.rand(seed+2)*.11,
    .31+this.rand(seed+3)*.09
   );
  }
  return c;
 }

 addTriangle(positions,colors,a,b,c,ca,cb,cc){
  for(const p of [a,b,c])positions.push(p.x,p.y,p.z);
  for(const color of [ca,cb,cc])colors.push(color.r,color.g,color.b);
 }

 buildPatch(positions,colors,cx,cz,type,radius,seed){
  const T=this.T;
  const segments=this.minSegments
   +Math.floor(this.rand(seed+1)*(this.maxSegments-this.minSegments+1));
  const yaw=this.rand(seed+2)*Math.PI*2;
  const stretch=.62+this.rand(seed+3)*.58;
  const centerY=this.world.heightAt(cx,cz);
  const center=new T.Vector3(cx,centerY+this.surfaceOffset,cz);
  const inner=[];
  const outer=[];

  for(let i=0;i<segments;i++){
   const angle=yaw+i/segments*Math.PI*2;
   const irregular=.74+this.rand(seed+i*17+20)*.34;
   const outerRadius=radius*irregular;
   const innerRadius=outerRadius*(.54+this.rand(seed+i*19+30)*.13);
   const dx=Math.cos(angle);
   const dz=Math.sin(angle)*stretch;

   const ox=cx+dx*outerRadius;
   const oz=cz+dz*outerRadius;
   const ix=cx+dx*innerRadius;
   const iz=cz+dz*innerRadius;

   if(!this.isSurfaceAvailable(ox,oz)||!this.isSurfaceAvailable(ix,iz))return false;

   const oy=this.world.heightAt(ox,oz);
   const iy=this.world.heightAt(ix,iz);
   const maxDelta=Math.max(1.05,radius*.34);
   if(Math.abs(oy-centerY)>maxDelta||Math.abs(iy-centerY)>maxDelta)return false;

   outer.push(new T.Vector3(ox,oy+this.surfaceOffset,oz));
   inner.push(new T.Vector3(ix,iy+this.surfaceOffset+.002,iz));
  }

  const centerColor=this.patchColor(type,seed+100);

  for(let i=0;i<segments;i++){
   const next=(i+1)%segments;
   const sectorColor=this.patchColor(type,seed+200+i*31);
   const nextColor=this.patchColor(type,seed+200+next*31);

   // Inner fan creates the strongest soil/sand read. Slight sector-to-sector
   // shifts give the surface a granular low-poly texture instead of a flat decal.
   this.addTriangle(
    positions,colors,
    center,inner[i],inner[next],
    centerColor,sectorColor,nextColor
   );

   const baseA=this.baseColorAt(outer[i].x,outer[i].z);
   const baseB=this.baseColorAt(outer[next].x,outer[next].z);
   const edgeA=baseA.clone().lerp(sectorColor,.28);
   const edgeB=baseB.clone().lerp(nextColor,.28);

   // Transition ring fades back toward the existing grass colour at the edge,
   // so broad patches merge into the terrain rather than looking painted on.
   this.addTriangle(
    positions,colors,
    inner[i],outer[i],outer[next],
    sectorColor,edgeA,edgeB
   );
   this.addTriangle(
    positions,colors,
    inner[i],outer[next],inner[next],
    sectorColor,edgeB,nextColor
   );
  }

  return true;
 }

 populate(){
  if(this.mesh){
   this.root.remove(this.mesh);
   this.mesh.geometry?.dispose?.();
   this.mesh.material?.dispose?.();
   this.mesh=null;
  }

  const T=this.T;
  const positions=[];
  const colors=[];
  const terrainRadius=Math.max(55,(this.world?.terrain?.radius||135)-8);
  let placed=0;

  for(let i=0;i<this.candidateCount&&placed<this.maxPatches;i++){
   const seed=i*83+17;
   const angle=this.rand(seed)*Math.PI*2;
   const distance=5+Math.sqrt(this.rand(seed+1))*Math.max(1,terrainRadius-5);
   const x=Math.cos(angle)*distance;
   const z=Math.sin(angle)*distance;

   if(!this.isSurfaceAvailable(x,z))continue;
   const type=this.chooseSurfaceType(x,z,seed);
   if(!type)continue;

   const baseRadius=this.minRadius
    +(this.maxRadius-this.minRadius)*this.rand(seed+4);
   const radius=type==='sand'?baseRadius*1.12:baseRadius;

   if(this.buildPatch(positions,colors,x,z,type,radius,seed))placed++;
  }

  if(!positions.length)return 0;

  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material=new T.MeshStandardMaterial({
   vertexColors:true,
   roughness:.98,
   metalness:0,
   flatShading:true,
   polygonOffset:true,
   polygonOffsetFactor:-1,
   polygonOffsetUnits:-1
  });

  const mesh=new T.Mesh(geometry,material);
  mesh.name='GroundSoilSandPatches';
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  mesh.renderOrder=1;

  this.mesh=mesh;
  this.root.add(mesh);
  return placed;
 }

 initialize(){
  this.scene.add(this.root);
  // Defer one turn so the authoritative terrain and world decorators are fully
  // attached before the visual patches sample their surfaces.
  setTimeout(()=>this.populate(),0);
 }
}
