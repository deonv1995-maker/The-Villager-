export class FineGrassFieldDecorator {
 constructor(THREE,{world,scene}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.seed=36271;

  this.root=new THREE.Group();
  this.root.name='FineGrassFieldDecorator';
  this.mesh=null;

  // Fine field grass is a presentation layer only. Ecology still decides where
  // vegetation belongs; this system only turns suitable areas into dense,
  // mobile-friendly visual patches.
  this.maxInstances=8200;
  this.patchCandidates=760;
  this.minPatchRadius=1.35;
  this.maxPatchRadius=3.65;
  this.minTuftsPerPatch=24;
  this.maxTuftsPerPatch=74;
  this.maxSlope=.46;
  this.spawnClearRadius=4.5;

  // Obstacle lookup is built once when the field is generated so grass does not
  // clip through rocks, trunks or bushes without adding any per-frame cost.
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
  const bladeWidth=.088;
  const bladeHeight=.54;

  // Three crossed, tapered blades form one tiny tuft. One InstancedMesh then
  // renders thousands of these tufts in a single draw call.
  for(let blade=0;blade<3;blade++){
   const angle=blade*Math.PI/3;
   const dx=Math.cos(angle);
   const dz=Math.sin(angle);
   const half=bladeWidth*.5;
   const tipHalf=bladeWidth*.10;
   const base=positions.length/3;

   positions.push(
    -dx*half,0,-dz*half,
     dx*half,0, dz*half,
     dx*tipHalf,bladeHeight, dz*tipHalf,
    -dx*tipHalf,bladeHeight,-dz*tipHalf
   );
   indices.push(base,base+1,base+2,base,base+2,base+3);
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

  return Math.max(.18,Math.min(1,
   density*(.66+grassShare*1.9)*(.82+noise*.34)
  ));
 }

 populate(){
  this.clear();
  this.rebuildObstacleGrid();

  const T=this.T;
  const geometry=this.buildTuftGeometry();
  const material=new T.MeshStandardMaterial({
   color:0xffffff,
   roughness:.92,
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
   if(this.rand(seed+2)>.84*suitability)continue;

   const patchRadius=this.minPatchRadius
    +(this.maxPatchRadius-this.minPatchRadius)*this.rand(seed+3);
   const stretch=.68+this.rand(seed+4)*.56;
   const patchYaw=this.rand(seed+5)*Math.PI*2;
   const c=Math.cos(patchYaw);
   const s=Math.sin(patchYaw);
   const tuftTarget=Math.round(
    this.minTuftsPerPatch
    +(this.maxTuftsPerPatch-this.minTuftsPerPatch)*this.rand(seed+6)*(.78+.34*suitability)
   );
   const attempts=Math.ceil(tuftTarget*2.6);
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
    if(!this.isObstacleClear(x,z,.08))continue;

    const edge=localRadius/Math.max(.001,patchRadius);
    if(this.rand(tuftSeed+2)<Math.max(0,(edge-.72)*.42))continue;

    const y=this.world.heightAt(x,z)+.018;
    const heightScale=.82+this.rand(tuftSeed+3)*.95;
    const widthScale=.88+this.rand(tuftSeed+4)*.56;
    const leanX=(this.rand(tuftSeed+5)-.5)*.13;
    const leanZ=(this.rand(tuftSeed+6)-.5)*.13;

    dummy.position.set(x,y,z);
    dummy.rotation.set(leanX,this.rand(tuftSeed+7)*Math.PI*2,leanZ);
    dummy.scale.set(widthScale,heightScale,widthScale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed,dummy.matrix);

    const shade=this.rand(tuftSeed+8);
    color.setHSL(
     .255+shade*.018,
     .43+this.rand(tuftSeed+9)*.08,
     .41+this.rand(tuftSeed+10)*.12
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
