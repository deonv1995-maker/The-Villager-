export class FineGrassFieldDecorator {
 constructor(THREE,{world,scene,player=null}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.seed=36271;

  this.root=new THREE.Group();
  this.root.name='FineGrassFieldDecorator';
  this.mesh=null;

  // Fine field grass remains a presentation-only layer. Ecology decides where
  // grass belongs; this system owns the instanced field silhouette and density.
  this.maxInstances=19000;
  this.patchCandidates=1280;
  this.minPatchRadius=2.15;
  this.maxPatchRadius=6.35;
  this.minTuftsPerPatch=72;
  this.maxTuftsPerPatch=182;
  this.maxSlope=.46;
  this.spawnClearRadius=2.6;

  this.obstacleCellSize=5;
  this.obstacleGrid=new Map();

  // Fine-grass interaction is spatially indexed. Only tufts near the Ranger are
  // animated; distant instances remain untouched even as field density grows.
  this.interactionRadius=2.75;
  this.innerRadius=.52;
  this.maxBend=.62;
  this.maxCompression=.16;
  this.followSpeed=17;
  this.recoverySpeed=8.5;
  this.minimumMoveSpeed=.16;
  this.instanceCellSize=3.5;
  this.instanceGrid=new Map();
  this.entries=[];
  this.active=new Set();
  this.matrixDummy=new THREE.Object3D();

  this.lastPlayerX=player?.position?.x??0;
  this.lastPlayerZ=player?.position?.z??0;
  this.smoothedVelocityX=0;
  this.smoothedVelocityZ=0;
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
  this.instanceGrid.clear();
  this.entries.length=0;
  this.active.clear();
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
  const baseHeight=.82;
  const baseWidth=.098;

  // Each tuft is several segmented ribbon blades. Upper segments arc forward
  // and sideways, so the field keeps a soft grass silhouette rather than spikes.
  for(let blade=0;blade<bladeCount;blade++){
   const angle=blade*(Math.PI*2/bladeCount)+(blade%2?-.11:.08);
   const dirX=Math.cos(angle);
   const dirZ=Math.sin(angle);
   const acrossX=-dirZ;
   const acrossZ=dirX;
   const height=baseHeight*(.78+(blade%4)*.075);
   const bend=.118+(blade%3)*.046;
   const sideBend=(blade%2?1:-1)*(.020+(blade%3)*.010);
   const base=positions.length/3;

   for(let level=0;level<=segments;level++){
    const t=level/segments;
    const eased=t*t;
    const y=height*t;
    const forward=bend*eased;
    const sideways=sideBend*Math.sin(Math.PI*t);
    const centerX=dirX*forward+acrossX*sideways;
    const centerZ=dirZ*forward+acrossZ*sideways;
    const taper=Math.max(.07,1-t*.91);
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

  return Math.max(.30,Math.min(1,
   density*(.84+grassShare*2.18)*(.90+noise*.30)
  ));
 }

 instanceKey(ix,iz){return `${ix}:${iz}`;}

 addEntryToGrid(entry){
  const cell=this.instanceCellSize;
  const ix=Math.floor(entry.x/cell);
  const iz=Math.floor(entry.z/cell);
  const key=this.instanceKey(ix,iz);
  let bucket=this.instanceGrid.get(key);
  if(!bucket){bucket=[];this.instanceGrid.set(key,bucket);}
  bucket.push(entry);
 }

 nearbyEntries(x,z){
  const cell=this.instanceCellSize;
  const r=this.interactionRadius;
  const minX=Math.floor((x-r)/cell);
  const maxX=Math.floor((x+r)/cell);
  const minZ=Math.floor((z-r)/cell);
  const maxZ=Math.floor((z+r)/cell);
  const found=[];

  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const bucket=this.instanceGrid.get(this.instanceKey(ix,iz));
    if(bucket)found.push(...bucket);
   }
  }
  return found;
 }

 writeEntryMatrix(entry){
  const d=this.matrixDummy;
  d.position.set(entry.x,entry.y,entry.z);
  d.rotation.set(
   entry.baseLeanX+entry.bendX,
   entry.baseYaw,
   entry.baseLeanZ+entry.bendZ
  );
  d.scale.set(
   entry.scaleX,
   entry.scaleY*(1-entry.compression),
   entry.scaleZ
  );
  d.updateMatrix();
  this.mesh.setMatrixAt(entry.index,d.matrix);
 }

 smoothstep01(t){
  t=Math.max(0,Math.min(1,t));
  return t*t*(3-2*t);
 }

 updatePlayerVelocity(dt){
  if(!this.player)return 0;
  const px=this.player.position.x;
  const pz=this.player.position.z;
  const safeDt=Math.max(.001,dt);
  const vx=(px-this.lastPlayerX)/safeDt;
  const vz=(pz-this.lastPlayerZ)/safeDt;
  const blend=1-Math.exp(-10*dt);

  this.smoothedVelocityX+=(vx-this.smoothedVelocityX)*blend;
  this.smoothedVelocityZ+=(vz-this.smoothedVelocityZ)*blend;
  this.lastPlayerX=px;
  this.lastPlayerZ=pz;
  return Math.hypot(this.smoothedVelocityX,this.smoothedVelocityZ);
 }

 update(dt){
  if(!this.player||!this.mesh||!this.entries.length)return;

  const speed=this.updatePlayerVelocity(dt);
  const px=this.player.position.x;
  const pz=this.player.position.z;
  const candidates=this.nearbyEntries(px,pz);
  const current=new Set();
  const runStrength=Math.max(
   0,
   Math.min(1,(speed-this.minimumMoveSpeed)/(5.2-this.minimumMoveSpeed))
  );

  let moveX=this.smoothedVelocityX;
  let moveZ=this.smoothedVelocityZ;
  const moveLength=Math.hypot(moveX,moveZ);
  if(moveLength>.001){
   moveX/=moveLength;
   moveZ/=moveLength;
  }

  let changed=false;
  for(const entry of candidates){
   const dx=entry.x-px;
   const dz=entry.z-pz;
   const distance=Math.hypot(dx,dz);
   if(distance>=this.interactionRadius)continue;

   current.add(entry);
   this.active.add(entry);

   const outwardLength=Math.max(.001,distance);
   const outwardX=dx/outwardLength;
   const outwardZ=dz/outwardLength;
   const radial=1-this.smoothstep01(
    (distance-this.innerRadius)/(this.interactionRadius-this.innerRadius)
   );

   // Grass parts away from the Ranger while movement direction adds a trailing
   // sweep, making running visibly push the field aside rather than just squash it.
   let pushX=outwardX;
   let pushZ=outwardZ;
   if(moveLength>.001){
    pushX=outwardX*.70+moveX*.30;
    pushZ=outwardZ*.70+moveZ*.30;
    const pushLength=Math.max(.001,Math.hypot(pushX,pushZ));
    pushX/=pushLength;
    pushZ/=pushLength;
   }

   const strength=radial*(.40+.60*runStrength);
   const targetBendX=pushZ*this.maxBend*strength;
   const targetBendZ=-pushX*this.maxBend*strength;
   const targetCompression=this.maxCompression*strength;
   const blend=1-Math.exp(-this.followSpeed*dt);

   entry.bendX+=(targetBendX-entry.bendX)*blend;
   entry.bendZ+=(targetBendZ-entry.bendZ)*blend;
   entry.compression+=(targetCompression-entry.compression)*blend;
   this.writeEntryMatrix(entry);
   changed=true;
  }

  for(const entry of Array.from(this.active)){
   if(current.has(entry))continue;

   const blend=1-Math.exp(-this.recoverySpeed*dt);
   entry.bendX+=(0-entry.bendX)*blend;
   entry.bendZ+=(0-entry.bendZ)*blend;
   entry.compression+=(0-entry.compression)*blend;

   this.writeEntryMatrix(entry);
   changed=true;

   if(Math.abs(entry.bendX)<.004
    &&Math.abs(entry.bendZ)<.004
    &&entry.compression<.002){
    entry.bendX=0;
    entry.bendZ=0;
    entry.compression=0;
    this.writeEntryMatrix(entry);
    this.active.delete(entry);
   }
  }

  if(changed)this.mesh.instanceMatrix.needsUpdate=true;
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
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);

  const dummy=new T.Object3D();
  const color=new T.Color();
  let placed=0;
  const terrainRadius=Math.max(55,(this.world?.terrain?.radius||135)-10);

  for(let patchIndex=0;patchIndex<this.patchCandidates&&placed<this.maxInstances;patchIndex++){
   const seed=patchIndex*97+11;
   const angle=this.rand(seed)*Math.PI*2;
   const radius=5+Math.sqrt(this.rand(seed+1))*Math.max(1,terrainRadius-5);
   const cx=Math.cos(angle)*radius;
   const cz=Math.sin(angle)*radius;

   if(!this.terrainAllowsGrass(cx,cz))continue;
   const suitability=this.patchSuitability(cx,cz);
   if(this.rand(seed+2)>.985*suitability)continue;

   const patchRadius=this.minPatchRadius
    +(this.maxPatchRadius-this.minPatchRadius)*this.rand(seed+3);
   const stretch=.76+this.rand(seed+4)*.66;
   const patchYaw=this.rand(seed+5)*Math.PI*2;
   const c=Math.cos(patchYaw);
   const s=Math.sin(patchYaw);
   const tuftTarget=Math.round(
    this.minTuftsPerPatch
    +(this.maxTuftsPerPatch-this.minTuftsPerPatch)
     *this.rand(seed+6)*(.90+.26*suitability)
   );
   const attempts=Math.ceil(tuftTarget*2.35);
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
    if(!this.isObstacleClear(x,z,.055))continue;

    // Very soft edge thinning lets neighboring patches merge into a continuous
    // field while still avoiding obviously stamped circles.
    const edge=localRadius/Math.max(.001,patchRadius);
    if(this.rand(tuftSeed+2)<Math.max(0,(edge-.90)*.16))continue;

    const y=this.world.heightAt(x,z)+.016;
    const scaleY=.94+this.rand(tuftSeed+3)*.78;
    const scaleX=.88+this.rand(tuftSeed+4)*.54;
    const scaleZ=.88+this.rand(tuftSeed+11)*.54;
    const baseLeanX=(this.rand(tuftSeed+5)-.5)*.18;
    const baseLeanZ=(this.rand(tuftSeed+6)-.5)*.18;
    const baseYaw=this.rand(tuftSeed+7)*Math.PI*2;

    dummy.position.set(x,y,z);
    dummy.rotation.set(baseLeanX,baseYaw,baseLeanZ);
    dummy.scale.set(scaleX,scaleY,scaleZ);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed,dummy.matrix);

    const shade=this.rand(tuftSeed+8);
    color.setHSL(
     .252+shade*.021,
     .44+this.rand(tuftSeed+9)*.09,
     .39+this.rand(tuftSeed+10)*.13
    );
    mesh.setColorAt(placed,color);

    const entry={
     index:placed,x,y,z,
     baseYaw,baseLeanX,baseLeanZ,
     scaleX,scaleY,scaleZ,
     bendX:0,bendZ:0,compression:0
    };
    this.entries.push(entry);
    this.addEntryToGrid(entry);

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

  if(this.player){
   this.lastPlayerX=this.player.position.x;
   this.lastPlayerZ=this.player.position.z;
  }
  return placed;
 }
}
