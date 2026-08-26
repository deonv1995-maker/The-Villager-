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
  // Coverage is intentionally broad so the world reads as mixed natural ground
  // rather than one continuous green surface.
  this.candidateCount=1650;
  this.maxPatches=620;
  this.minRadius=3.8;
  this.maxRadius=12.6;
  this.minSegments=11;
  this.maxSegments=18;
  this.maxSlope=.46;
  this.surfaceOffset=.045;
  this.goldenAngle=Math.PI*(3-Math.sqrt(5));
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
   Math.sin(x*.031+z*.017)
   +Math.cos(z*.036-x*.013)
   +Math.sin((x-z)*.054+.8)*.72
   +Math.cos((x+z)*.019-1.1)*.82;
  const detail=
   Math.sin(x*.118-z*.073)*.28
   +Math.cos(z*.104+x*.061)*.24;
  return Math.max(0,Math.min(1,.5+(broad+detail)/7.0));
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
  if(Number.isFinite(metric)&&metric>.974)return false;
  const y=this.world.heightAt(x,z);
  if(y<-.48)return false;
  if(this.slopeAt(x,z)>this.maxSlope)return false;
  if(this.world?.environment?.terrainClearance?.(x,z))return false;
  return true;
 }

 surfaceWeightsAt(x,z){
  const terrain=this.world?.terrain;
  const d=terrain?.islandMetric?.(x,z)??0;
  const y=this.world.heightAt(x,z);
  const noise=this.fieldNoise(x,z);
  const region=this.regionAt(x,z).name;

  const lowElevation=1-this.smoothstep(2.2,6.2,y);
  const shoreBand=this.smoothstep(.69,.965,d)*lowElevation;
  const dry=1-noise;
  const rich=noise;

  let sand=.05+shoreBand*.88+this.smoothstep(.57,.78,dry)*.22*lowElevation;
  let soil=.18+this.smoothstep(.45,.74,rich)*.50;

  if(region==='easternShelf')sand*=1.30;
  else if(region==='southernBasin')sand*=1.12;
  else if(region==='westernHighland')sand*=.58;
  else if(region==='northernRidge')sand*=.70;

  if(region==='southernBasin')soil*=1.42;
  else if(region==='westernValley')soil*=1.38;
  else if(region==='centralSaddle')soil*=1.24;
  else if(region==='westernHighland')soil*=.82;

  soil*=1-shoreBand*.72;

  return {
   sand:Math.max(0,Math.min(.97,sand)),
   soil:Math.max(0,Math.min(.88,soil)),
   noise,
   shoreBand
  };
 }

 chooseSurfaceType(x,z,seed){
  const w=this.surfaceWeightsAt(x,z);
  const roll=this.rand(seed+7);
  if(roll<w.sand)return 'sand';
  if(this.rand(seed+11)<w.soil)return 'soil';
  return null;
 }

 surfaceTypeAt(x,z,seed=0){
  const w=this.surfaceWeightsAt(x,z);
  if(w.sand>.66)return 'sand';
  if(w.soil>.55)return 'soil';
  const roll=this.rand(Math.floor(x*13.7+z*17.3)+seed+29);
  if(roll<w.sand*.68)return 'sand';
  if(roll<w.sand*.68+w.soil*.52)return 'soil';
  return 'grass';
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
    .105+variation*.020,
    .42+this.rand(seed+2)*.12,
    .56+this.rand(seed+3)*.10
   );
  }else{
   c.setHSL(
    .071+variation*.021,
    .40+this.rand(seed+2)*.13,
    .27+this.rand(seed+3)*.10
   );
  }
  return c;
 }

 addTriangle(positions,colors,a,b,c,ca,cb,cc){
  // Patch rings are generated counter-clockwise in XZ. Swapping B/C here gives
  // every triangle an upward-facing normal so the ground patches render from
  // the player's camera instead of being removed by back-face culling.
  for(const p of [a,c,b])positions.push(p.x,p.y,p.z);
  for(const color of [ca,cc,cb])colors.push(color.r,color.g,color.b);
 }

 buildPatch(positions,colors,cx,cz,type,radius,seed){
  const T=this.T;
  const segments=this.minSegments
   +Math.floor(this.rand(seed+1)*(this.maxSegments-this.minSegments+1));
  const yaw=this.rand(seed+2)*Math.PI*2;
  const stretch=.58+this.rand(seed+3)*.72;
  const centerY=this.world.heightAt(cx,cz);
  const center=new T.Vector3(cx,centerY+this.surfaceOffset,cz);
  const inner=[];
  const outer=[];

  for(let i=0;i<segments;i++){
   const angle=yaw+i/segments*Math.PI*2;
   const irregular=.68+this.rand(seed+i*17+20)*.46;
   const outerRadius=radius*irregular;
   const innerRadius=outerRadius*(.50+this.rand(seed+i*19+30)*.17);
   const dx=Math.cos(angle);
   const dz=Math.sin(angle)*stretch;

   const ox=cx+dx*outerRadius;
   const oz=cz+dz*outerRadius;
   const ix=cx+dx*innerRadius;
   const iz=cz+dz*innerRadius;

   if(!this.isSurfaceAvailable(ox,oz)||!this.isSurfaceAvailable(ix,iz))return false;

   const oy=this.world.heightAt(ox,oz);
   const iy=this.world.heightAt(ix,iz);
   const maxDelta=Math.max(1.15,radius*.32);
   if(Math.abs(oy-centerY)>maxDelta||Math.abs(iy-centerY)>maxDelta)return false;

   outer.push(new T.Vector3(ox,oy+this.surfaceOffset,oz));
   inner.push(new T.Vector3(ix,iy+this.surfaceOffset+.002,iz));
  }

  const centerColor=this.patchColor(type,seed+100);

  for(let i=0;i<segments;i++){
   const next=(i+1)%segments;
   const sectorColor=this.patchColor(type,seed+200+i*31);
   const nextColor=this.patchColor(type,seed+200+next*31);

   this.addTriangle(
    positions,colors,
    center,inner[i],inner[next],
    centerColor,sectorColor,nextColor
   );

   const baseA=this.baseColorAt(outer[i].x,outer[i].z);
   const baseB=this.baseColorAt(outer[next].x,outer[next].z);
   const edgeA=baseA.clone().lerp(sectorColor,.48);
   const edgeB=baseB.clone().lerp(nextColor,.48);

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
   const normalized=(i+.55)/this.candidateCount;
   const distance=4+Math.sqrt(normalized)*Math.max(1,terrainRadius-4);
   const angle=i*this.goldenAngle+(this.rand(seed)-.5)*.72;
   const radialJitter=(this.rand(seed+1)-.5)*4.8;
   const r=Math.max(3,distance+radialJitter);
   const x=Math.cos(angle)*r;
   const z=Math.sin(angle)*r;

   if(!this.isSurfaceAvailable(x,z))continue;
   const type=this.chooseSurfaceType(x,z,seed);
   if(!type)continue;

   const baseRadius=this.minRadius
    +(this.maxRadius-this.minRadius)*this.rand(seed+4);
   const w=this.surfaceWeightsAt(x,z);
   let radius=baseRadius;
   if(type==='sand')radius*=1.12+w.shoreBand*.28;
   else radius*=.96+w.noise*.18;

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
   roughness:.99,
   metalness:0,
   flatShading:true,
   side:T.FrontSide,
   polygonOffset:true,
   polygonOffsetFactor:-1,
   polygonOffsetUnits:-3
  });

  const mesh=new T.Mesh(geometry,material);
  mesh.name='GroundSoilSandPatches';
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  mesh.renderOrder=3;

  this.mesh=mesh;
  this.root.add(mesh);
  return placed;
 }

 initialize(){
  this.scene.add(this.root);
  setTimeout(()=>this.populate(),0);
 }
}
