export class FineGrassFieldDecorator {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.seed=36271;

  this.root=new THREE.Group();
  this.root.name='FineGrassFieldDecorator';
  this.mesh=null;

  // Fine field grass remains a presentation-only layer. Density, patch scale
  // and blade silhouette live here; ecology still decides where grass belongs.
  this.maxInstances=14000;
  this.patchCandidates=980;
  this.minPatchRadius=1.8;
  this.maxPatchRadius=5.3;
  this.minTuftsPerPatch=48;
  this.maxTuftsPerPatch=128;
  this.maxSlope=.46;
  this.spawnClearRadius=4.5;

  this.obstacleCellSize=5;
  this.obstacleGrid=new Map();
 }

 rand(n){
  const x=Math.sin(n*12.9898+this.seed)*43758.5453;
  return x-Math.floor(x);
 }

 initialize(){
  this.scene.add(this.root);

  const environment=this.world?.environment;
  const build=()=>setTimeout(()=>this.populate(),0);

  if(environment?.loadKayKit){
   environment.loadKayKit().then(build).catch(err=>{
    console.error('[Fine grass fields]',err);
    build();
   });
  }else{
   build();
  }
 }

 clear(){
  if(this.mesh){
   this.root.remove(this.mesh);
   this.mesh.geometry?.dispose?.();
   this.mesh.material?.dispose?.();
   this.mesh=null;
  }
  this.obstacleGrid.clear();
 }

 obstacleKey(ix,iz){return `${ix}:${iz}`;}

 addObstacle(x,z,rx,rz){
  const cell=this.obstacleCellSize;
  rx=Math.max(.08,rx);
  rz=Math.max(.08,rz);
  const obstacle={x,z,rx,rz};
  const minX=Math.floor((x-rx)/cell);
  const maxX=Math.floor((x+rx)/cell);
  const minZ=Math.floor((z-rz)/cell);
  const maxZ=Math.floor((z+rz)/cell);

  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const key=this.obstacleKey(ix,iz);
    let bucket=this.obstacleGrid.get(key);
    if(!bucket){bucket=[];this.obstacleGrid.set(key,bucket);}
    bucket.push(obstacle);
   }
  }
 }

 collectObjectObstacle(object,type='detail'){
  if(!object)return;
  object.updateWorldMatrix?.(true,true);
  const box=new this.T.Box3().setFromObject(object);
  if(box.isEmpty())return;

  const size=new this.T.Vector3();
  const center=new this.T.Vector3();
  box.getSize(size);
  box.getCenter(center);

  let scale=.34;
  let min=.28;
  let max=2.2;
  if(type==='tree'||type==='bareTree'){
   scale=.11;min=.42;max=1.05;
  }else if(type==='bush'){
   scale=.25;min=.32;max=1.45;
  }else if(type==='rock'||type==='cliff-rock'){
   scale=.46;min=.28;max=3.2;
  }else if(type==='terrain-rock'){
   scale=.48;min=.24;max=1.8;
  }

  const rx=Math.max(min,Math.min(max,size.x*scale));
  const rz=Math.max(min,Math.min(max,size.z*scale));
  this.addObstacle(center.x,center.z,rx,rz);
 }

 rebuildObstacleGrid(){
  this.obstacleGrid.clear();

  const environmentRoot=this.world?.environment?.root;
  if(environmentRoot){
   for(const object of environmentRoot.children){
    const type=object.userData?.environmentType;
    if(type==='grass')continue;
    if(type==='tree'||type==='bareTree'||type==='rock'||type==='bush'){
     this.collectObjectObstacle(object,type);
    }
   }
  }

  const cliffRoot=this.world?.cliffRocks?.root;
  if(cliffRoot){
   for(const object of cliffRoot.children){
    if(Number.isFinite(object.userData?.cliffRockSource)){
     this.collectObjectObstacle(object,'cliff-rock');
    }
   }
  }

  const featureRoot=this.world?.features?.root;
  if(featureRoot){
   for(const object of featureRoot.children){
    this.collectObjectObstacle(object,'terrain-rock');
   }
  }
 }

 isObstacleClear(x,z,padding=.08){
  const cell=this.obstacleCellSize;
  const ix=Math.floor(x/cell);
  const iz=Math.floor(z/cell);
  const bucket=this.obstacleGrid.get(this.obstacleKey(ix,iz));
  if(!bucket)return true;

  for(const obstacle of bucket){
   const rx=obstacle.rx+padding;
   const rz=obstacle.rz+padding;
   const dx=(x-obstacle.x)/rx;
   const dz=(z-obstacle.z)/rz;
   if(dx*dx+dz*dz<1)return false;
  }
  return true;
 }

 buildTuftGeometry(){
  const T=this.T;
  const positions=[];
  const indices=[];
  const bladeCount=5;
  const segments=4;
  const baseHeight=.76;
  const baseWidth=.095;

  // Each tuft is made from several segmented ribbon blades. The upper segments
  // curve forward and slightly sideways, creating an actual leaf silhouette
  // instead of the straight spike shape used by the earlier field grass.
  for(let blade=0;blade<bladeCount;blade++){
   const angle=blade*(Math.PI*2/bladeCount)+(blade%2?-.11:.08);
   const dirX=Math.cos(angle);
   const dirZ=Math.sin(angle);
   const acrossX=-dirZ;
   const acrossZ=dirX;
   const height=baseHeight*(.78+(blade%4)*.075);
   const bend=.105+(blade%3)*.042;
   const sideBend=(blade%2?1:-1)*(.018+(blade%3)*.009);
   const base=positions.length/3;

   for(let level=0;level<=segments;level++){
    const t=level/segments;
    const eased=t*t;
    const y=height*t;
    const forward=bend*eased;
    const sideways=sideBend*Math.sin(Math.PI*t);
    const centerX=dirX*forward+acrossX*sideways;
    const centerZ=dirZ*forward+acrossZ*sideways;
    const taper=Math.max(.08,1-t*.90);
    const half=baseWidth*taper*.5;

    positions.push(
     centerX-acrossX*half,y,centerZ-acrossZ*half,
     centerX+acrossX*half,y,centerZ+acrossZ*half
    );
   }

   for(let segment=0;segment<segments;segment++){
    const a=base+segment*2;
    const b=a+1;
    const c=a+3;
    const d=a+2;
    indices.push(a,b,c,a,c,d);
   }
  }

  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
 }

 slopeAt(x,z){
  const environment=this.world?.environment;
  if(environment?.slopeAt)return environment.slopeAt(x,z);
  const e=.55;
  const h=this.world.heightAt(x,z);
  return Math.max(
   Math.abs(this.world.heightAt(x+e,z)-h),
   Math.abs(this.world.heightAt(x,z+e)-h)
  )/e;
 }

 ecologyAt(x,z,slope){
  const environment=this.world?.environment;
  if(environment?.ecologyAt)return environment.ecologyAt(x,z,slope);
  return {density:.7,noise:.5,weights:{grass:.2},total:1,region:{name:'lowlands'}};
 }

 terrainAllowsGrass(x,z){
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(x,z))return false;
  if(Math.hypot(x,z)<this.spawnClearRadius)return false;

  const y=this.world.heightAt(x,z);
  if(y<.10)return false;

  const slope=this.slopeAt(x,z);
  if(slope>this.maxSlope)return false;
  if(this.world?.environment?.terrainClearance?.(x,z))return false;
  return true;
 }

 patchSuitability(x,z){
  const slope=this.slopeAt(x,z);
  const ecology=this.ecologyAt(x,z,slope);
  const grassShare=(ecology.weights?.grass??.18)/Math.max(.001,ecology.total??1);
  const density=ecology.density??.7;
  const noise=ecology.noise??.5;

  return Math.max(.24,Math.min(1,
   density*(.76+grassShare*2.05)*(.86+noise*.32)
  ));
 }

 populate(){
  this.clear();
  this.rebuildObstacleGrid();

  const T=this.T;
  const geometry=this.buildTuftGeometry();
  const material=new T.MeshStandardMaterial({
   color:0xffffff,
   roughness:.94,
   metalness:0,
   side:T.DoubleSide
  });
  const mesh=new T.InstancedMesh(geometry,material,this.maxInstances);
  mesh.name='FineGrassFieldInstances';
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(T.StaticDrawUsage);

  const dummy=new T.Object3D();
  const color=new T.Color();
  let placed=0;
  const terrainRadius=Math.max(55,(this.world?.terrain?.radius||135)-10);

  for(let patchIndex=0;patchIndex<this.patchCandidates&&placed<this.maxInstances;patchIndex++){
   const seed=patchIndex*97+11;
   const angle=this.rand(seed)*Math.PI*2;
   const radius=7+Math.sqrt(this.rand(seed+1))*Math.max(1,terrainRadius-7);
   const cx=Math.cos(angle)*radius;
   const cz=Math.sin(angle)*radius;

   if(!this.terrainAllowsGrass(cx,cz))continue;
   const suitability=this.patchSuitability(cx,cz);
   if(this.rand(seed+2)>.95*suitability)continue;

   const patchRadius=this.minPatchRadius
    +(this.maxPatchRadius-this.minPatchRadius)*this.rand(seed+3);
   const stretch=.72+this.rand(seed+4)*.62;
   const patchYaw=this.rand(seed+5)*Math.PI*2;
   const c=Math.cos(patchYaw);
   const s=Math.sin(patchYaw);
   const tuftTarget=Math.round(
    this.minTuftsPerPatch
    +(this.maxTuftsPerPatch-this.minTuftsPerPatch)
     *this.rand(seed+6)*(.84+.30*suitability)
   );
   const attempts=Math.ceil(tuftTarget*2.45);
   let accepted=0;

   for(let j=0;j<attempts&&accepted<tuftTarget&&placed<this.maxInstances;j++){
    const tuftSeed=seed*131+j*17+29;
    const localAngle=this.rand(tuftSeed)*Math.PI*2;
    const localRadius=Math.sqrt(this.rand(tuftSeed+1))*patchRadius;
    let lx=Math.cos(localAngle)*localRadius;
    let lz=Math.sin(localAngle)*localRadius*stretch;
    const rx=lx*c-lz*s;
    const rz=lx*s+lz*c;
    const x=cx+rx;
    const z=cz+rz;

    if(!this.terrainAllowsGrass(x,z))continue;
    if(!this.isObstacleClear(x,z,.07))continue;

    // The field now keeps most edge tufts so overlapping patches merge into
    // broad meadow areas rather than isolated sparse circles.
    const edge=localRadius/Math.max(.001,patchRadius);
    if(this.rand(tuftSeed+2)<Math.max(0,(edge-.82)*.28))continue;

    const y=this.world.heightAt(x,z)+.016;
    const heightScale=.88+this.rand(tuftSeed+3)*.72;
    const widthScale=.86+this.rand(tuftSeed+4)*.50;
    const leanX=(this.rand(tuftSeed+5)-.5)*.16;
    const leanZ=(this.rand(tuftSeed+6)-.5)*.16;

    dummy.position.set(x,y,z);
    dummy.rotation.set(leanX,this.rand(tuftSeed+7)*Math.PI*2,leanZ);
    dummy.scale.set(widthScale,heightScale,widthScale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed,dummy.matrix);

    const shade=this.rand(tuftSeed+8);
    color.setHSL(
     .252+shade*.021,
     .44+this.rand(tuftSeed+9)*.09,
     .39+this.rand(tuftSeed+10)*.13
    );
    mesh.setColorAt(placed,color);

    placed++;
    accepted++;
   }
  }

  mesh.count=placed;
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere?.();

  this.mesh=mesh;
  this.root.add(mesh);
  return placed;
 }
}
