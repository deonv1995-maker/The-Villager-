export class GrassInteractionSystem {
 constructor(THREE,{world,player}){
  this.T=THREE;
  this.world=world;
  this.player=player;

  // Interaction tuning is owned here so ecology/population and player movement
  // stay independent. These values can later become biome/quality settings.
  this.interactionRadius=2.15;
  this.innerRadius=.55;
  this.maxBend=.52;
  this.maxCompression=.13;
  this.followSpeed=14;
  this.recoverySpeed=7;
  this.minimumRunSpeed=.22;

  this.cellSize=5;
  this.grid=new Map();
  this.entries=[];
  this.active=new Set();
  this.lastEnvironmentCount=-1;
  this.refreshTimer=0;

  this.lastPlayerX=player?.position?.x??0;
  this.lastPlayerZ=player?.position?.z??0;
  this.smoothedVelocityX=0;
  this.smoothedVelocityZ=0;
 }

 initialize(){
  this.refreshGrass();
 }

 cellKey(ix,iz){return `${ix}:${iz}`;}

 addToGrid(entry){
  const ix=Math.floor(entry.object.position.x/this.cellSize);
  const iz=Math.floor(entry.object.position.z/this.cellSize);
  const key=this.cellKey(ix,iz);
  let bucket=this.grid.get(key);
  if(!bucket){bucket=[];this.grid.set(key,bucket);}
  bucket.push(entry);
 }

 refreshGrass(){
  const root=this.world?.environment?.root;
  if(!root)return 0;

  // Restore existing entries before rebuilding references. Population may be
  // regenerated later and this keeps object transforms deterministic.
  for(const entry of this.entries)this.restoreImmediate(entry);

  this.grid.clear();
  this.entries.length=0;
  this.active.clear();

  for(const object of root.children){
   if(object.userData?.environmentType!=='grass')continue;

   const entry={
    object,
    baseRotationX:object.rotation.x,
    baseRotationZ:object.rotation.z,
    baseScaleY:object.scale.y,
    bendX:0,
    bendZ:0,
    compression:0
   };
   this.entries.push(entry);
   this.addToGrid(entry);
  }

  this.lastEnvironmentCount=root.children.length;
  return this.entries.length;
 }

 restoreImmediate(entry){
  const object=entry?.object;
  if(!object)return;
  object.rotation.x=entry.baseRotationX;
  object.rotation.z=entry.baseRotationZ;
  object.scale.y=entry.baseScaleY;
 }

 nearbyEntries(x,z){
  const cell=this.cellSize;
  const r=this.interactionRadius;
  const minX=Math.floor((x-r)/cell);
  const maxX=Math.floor((x+r)/cell);
  const minZ=Math.floor((z-r)/cell);
  const maxZ=Math.floor((z+r)/cell);
  const found=[];
  for(let ix=minX;ix<=maxX;ix++){
   for(let iz=minZ;iz<=maxZ;iz++){
    const bucket=this.grid.get(this.cellKey(ix,iz));
    if(bucket)found.push(...bucket);
   }
  }
  return found;
 }

 smoothstep01(t){
  t=Math.max(0,Math.min(1,t));
  return t*t*(3-2*t);
 }

 updatePlayerVelocity(dt){
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
  if(!this.player)return;

  this.refreshTimer-=dt;
  const root=this.world?.environment?.root;
  if(this.refreshTimer<=0){
   this.refreshTimer=.65;
   const count=root?.children?.length??-1;
   if(count!==this.lastEnvironmentCount||(!this.entries.length&&count>0)){
    this.refreshGrass();
   }
  }

  const speed=this.updatePlayerVelocity(dt);
  if(!this.entries.length)return;

  const px=this.player.position.x;
  const pz=this.player.position.z;
  const current=new Set();
  const candidates=this.nearbyEntries(px,pz);
  const runStrength=Math.max(
   0,
   Math.min(1,(speed-this.minimumRunSpeed)/(5.2-this.minimumRunSpeed))
  );

  let moveX=this.smoothedVelocityX;
  let moveZ=this.smoothedVelocityZ;
  const moveLength=Math.hypot(moveX,moveZ);
  if(moveLength>.001){
   moveX/=moveLength;
   moveZ/=moveLength;
  }

  for(const entry of candidates){
   const object=entry.object;
   const dx=object.position.x-px;
   const dz=object.position.z-pz;
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

   // Movement direction adds a trailing sweep while the radial component makes
   // grass part naturally to either side of the character.
   let pushX=outwardX;
   let pushZ=outwardZ;
   if(moveLength>.001){
    pushX=outwardX*.72+moveX*.28;
    pushZ=outwardZ*.72+moveZ*.28;
    const pushLength=Math.max(.001,Math.hypot(pushX,pushZ));
    pushX/=pushLength;
    pushZ/=pushLength;
   }

   const strength=radial*(.32+.68*runStrength);
   const targetBendX=pushZ*this.maxBend*strength;
   const targetBendZ=-pushX*this.maxBend*strength;
   const targetCompression=this.maxCompression*strength;
   const blend=1-Math.exp(-this.followSpeed*dt);

   entry.bendX+=(targetBendX-entry.bendX)*blend;
   entry.bendZ+=(targetBendZ-entry.bendZ)*blend;
   entry.compression+=(targetCompression-entry.compression)*blend;

   object.rotation.x=entry.baseRotationX+entry.bendX;
   object.rotation.z=entry.baseRotationZ+entry.bendZ;
   object.scale.y=entry.baseScaleY*(1-entry.compression);
  }

  // Only grasses touched recently are recovered. Distant grass costs nothing
  // per frame, which keeps this safe when population density grows later.
  for(const entry of Array.from(this.active)){
   if(current.has(entry))continue;

   const blend=1-Math.exp(-this.recoverySpeed*dt);
   entry.bendX+=(0-entry.bendX)*blend;
   entry.bendZ+=(0-entry.bendZ)*blend;
   entry.compression+=(0-entry.compression)*blend;

   entry.object.rotation.x=entry.baseRotationX+entry.bendX;
   entry.object.rotation.z=entry.baseRotationZ+entry.bendZ;
   entry.object.scale.y=entry.baseScaleY*(1-entry.compression);

   if(Math.abs(entry.bendX)<.004
    &&Math.abs(entry.bendZ)<.004
    &&entry.compression<.002){
    entry.bendX=0;
    entry.bendZ=0;
    entry.compression=0;
    this.restoreImmediate(entry);
    this.active.delete(entry);
   }
  }
 }
}
