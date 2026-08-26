export class FoundationTerrainSystem{
 constructor(THREE,{world,scene,buildingModes,fineGrass=null}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.buildingModes=buildingModes;
  this.fineGrass=fineGrass;

  this.terrainMesh=null;
  this.positionAttribute=null;
  this.originalPositions=null;
  this.colorAttribute=null;
  this.originalColors=null;

  this.cuts=[];
  this.processedPlacements=new Set();
  this.baseHeightAt=null;

  // The first placed floor remains the construction datum. Terrain above that
  // level is excavated; terrain below it is never filled, so downhill pieces can
  // remain genuine deck overhangs.
  this.floorClearance=.09;
  this.coreMargin=.58;
  this.blendDistance=2.15;
  this.soilColor=new THREE.Color(0x795d3f);

  // Vegetation follows the same terrain authority as the visible/collision
  // surface. Ground cover inside the actual floor footprint is removed, while
  // vegetation in the graded shoulder is lowered with the new terrain.
  this.floorVegetationPadding=.10;
  this.vegetationBlendPadding=.42;
  this.reprojectTypes=new Set(['grass','bush','tree','bareTree']);
  this.clearUnderFloorTypes=new Set(['grass','bush']);

  // Environment and fine-grass populations load asynchronously. These markers
  // let existing foundation cuts be replayed once those populations appear.
  this.lastEnvironmentChildCount=-1;
  this.lastFineGrassMesh=null;
 }

 initialize(){
  this.terrainMesh=this.scene.getObjectByName('UnifiedProceduralIslandLand')||null;
  this.positionAttribute=this.terrainMesh?.geometry?.getAttribute?.('position')||null;
  this.colorAttribute=this.terrainMesh?.geometry?.getAttribute?.('color')||null;

  if(this.positionAttribute){
   this.originalPositions=new Float32Array(this.positionAttribute.array);
  }
  if(this.colorAttribute){
   this.originalColors=new Float32Array(this.colorAttribute.array);
  }

  const terrain=this.world?.terrain;
  if(terrain?.heightAt){
   this.baseHeightAt=terrain.heightAt.bind(terrain);
   terrain.heightAt=(x,z)=>this.heightAt(x,z);
  }

  this.lastEnvironmentChildCount=this.world?.environment?.root?.children?.length??0;
  this.lastFineGrassMesh=this.fineGrass?.mesh??null;
  this.world.foundationTerrain=this;
 }

 smoothstep01(t){
  t=Math.max(0,Math.min(1,t));
  return t*t*(3-2*t);
 }

 localPoint(cut,x,z){
  const dx=x-cut.x;
  const dz=z-cut.z;
  const c=Math.cos(cut.yaw);
  const s=Math.sin(cut.yaw);
  return {
   x:dx*c-dz*s,
   z:dx*s+dz*c
  };
 }

 insideRect(local,halfX,halfZ){
  return Math.abs(local.x)<=halfX&&Math.abs(local.z)<=halfZ;
 }

 floorFootprint(){
  return {
   halfX:(this.buildingModes?.floorHalfLength??1.45)+this.floorVegetationPadding,
   halfZ:(this.buildingModes?.floorHalfWidth??.5)+this.floorVegetationPadding
  };
 }

 outsideDistance(cut,x,z){
  const p=this.localPoint(cut,x,z);
  const ox=Math.max(Math.abs(p.x)-cut.halfX,0);
  const oz=Math.max(Math.abs(p.z)-cut.halfZ,0);
  return Math.hypot(ox,oz);
 }

 cutHeightAt(cut,x,z,naturalY){
  // Never raise the downhill side. Only terrain that would cover the floor gets
  // excavated; this preserves the requested deck behavior on lower ground.
  if(naturalY<=cut.cutY)return naturalY;

  const distance=this.outsideDistance(cut,x,z);
  if(distance>cut.blendDistance)return naturalY;

  const t=this.smoothstep01(distance/cut.blendDistance);
  return cut.cutY+(naturalY-cut.cutY)*t;
 }

 heightAt(x,z){
  const natural=this.baseHeightAt
   ?this.baseHeightAt(x,z)
   :this.world?.terrain?.rawHeightAt?.(x,z)??0;

  let result=natural;
  for(const cut of this.cuts){
   const candidate=this.cutHeightAt(cut,x,z,natural);
   if(candidate<result)result=candidate;
  }
  return result;
 }

 makeCutFromFloor(floor){
  const halfX=(this.buildingModes?.floorHalfLength??1.45)+this.coreMargin;
  const halfZ=(this.buildingModes?.floorHalfWidth??.5)+this.coreMargin;
  return {
   id:floor.id,
   x:floor.x,
   z:floor.z,
   yaw:floor.yaw||0,
   cutY:floor.maxY-this.floorClearance,
   halfX,
   halfZ,
   blendDistance:this.blendDistance
  };
 }

 applyCutsToTerrain(activeCut=null){
  if(!this.positionAttribute||!this.originalPositions)return false;

  const positions=this.positionAttribute.array;
  const colors=this.colorAttribute?.array||null;
  let changed=false;

  for(let i=0;i<positions.length;i+=3){
   const x=this.originalPositions[i];
   const z=this.originalPositions[i+2];
   const naturalY=this.originalPositions[i+1];
   const nextY=this.heightAt(x,z);

   if(Math.abs(nextY-positions[i+1])>.002){
    positions[i+1]=nextY;
    changed=true;
   }

   if(colors&&this.originalColors&&nextY<naturalY-.002){
    const lowered=naturalY-nextY;
    const distance=activeCut?this.outsideDistance(activeCut,x,z):0;
    const edge=activeCut
     ?1-this.smoothstep01(distance/activeCut.blendDistance)
     :1;
    const strength=Math.min(.78,lowered/1.35)*(.55+.45*edge);
    colors[i]=this.originalColors[i]+(this.soilColor.r-this.originalColors[i])*strength;
    colors[i+1]=this.originalColors[i+1]+(this.soilColor.g-this.originalColors[i+1])*strength;
    colors[i+2]=this.originalColors[i+2]+(this.soilColor.b-this.originalColors[i+2])*strength;
   }
  }

  if(changed&&this.terrainMesh?.geometry){
   this.positionAttribute.needsUpdate=true;
   if(this.colorAttribute)this.colorAttribute.needsUpdate=true;
   this.terrainMesh.geometry.computeVertexNormals();
   this.terrainMesh.geometry.computeBoundingSphere();
  }

  return changed;
 }

 ensureTerrainOffset(object,worldX,worldY,worldZ){
  if(object.userData?.foundationTerrainOffsetReady)return;
  const natural=this.baseHeightAt?this.baseHeightAt(worldX,worldZ):worldY;
  object.userData.foundationTerrainOffset=worldY-natural;
  object.userData.foundationTerrainOffsetReady=true;
 }

 setObjectWorldY(object,y){
  const p=new this.T.Vector3();
  object.getWorldPosition(p);
  p.y=y;

  if(object.parent){
   const local=object.parent.worldToLocal(p.clone());
   object.position.copy(local);
  }else{
   object.position.copy(p);
  }

  object.updateMatrix?.();
  object.updateWorldMatrix?.(true,true);
 }

 syncEnvironmentForCut(cut){
  const root=this.world?.environment?.root;
  if(!root)return;

  const worldPos=new this.T.Vector3();
  const footprint=this.floorFootprint();

  for(const object of root.children){
   const type=object.userData?.environmentType;
   if(!this.reprojectTypes.has(type)||object.visible===false)continue;

   object.getWorldPosition(worldPos);
   const local=this.localPoint(cut,worldPos.x,worldPos.z);

   // Grass and bushes disappear only under the true timber footprint. Trees stay
   // physical resources/obstacles and are never silently deleted by construction.
   if(this.clearUnderFloorTypes.has(type)
    &&this.insideRect(local,footprint.halfX,footprint.halfZ)){
    object.visible=false;
    continue;
   }

   const distance=this.outsideDistance(cut,worldPos.x,worldPos.z);
   if(distance>cut.blendDistance+this.vegetationBlendPadding)continue;

   this.ensureTerrainOffset(object,worldPos.x,worldPos.y,worldPos.z);
   const offset=object.userData.foundationTerrainOffset??0;
   const nextY=this.heightAt(worldPos.x,worldPos.z)+offset;

   // Foundation grading only lowers terrain. Avoid any upward vegetation popping
   // when several adjacent floor cuts overlap.
   if(nextY>=worldPos.y-.002)continue;
   this.setObjectWorldY(object,nextY);
  }
 }

 hideFineGrassEntry(grass,entry,cut){
  entry.foundationHidden=true;
  entry.bendX=0;
  entry.bendZ=0;
  entry.compression=0;

  // Do not use a zero-scale transform: singular instance matrices can produce
  // the black star-shaped artifacts seen around the floor. Move the hidden tuft
  // safely below the foundation instead while retaining a valid transform.
  entry.y=Math.min(entry.y,cut.cutY-6);
  grass.active?.delete?.(entry);
  grass.writeEntryMatrix(entry);
 }

 syncFineGrassForCut(cut){
  const grass=this.fineGrass;
  if(!grass?.mesh||!grass.entries?.length||!grass.writeEntryMatrix)return;

  const footprint=this.floorFootprint();
  let changed=false;

  for(const entry of grass.entries){
   const local=this.localPoint(cut,entry.x,entry.z);

   if(this.insideRect(local,footprint.halfX,footprint.halfZ)){
    if(!entry.foundationHidden){
     this.hideFineGrassEntry(grass,entry,cut);
     changed=true;
    }
    continue;
   }

   if(entry.foundationHidden)continue;

   const distance=this.outsideDistance(cut,entry.x,entry.z);
   if(distance>cut.blendDistance+this.vegetationBlendPadding)continue;

   const nextY=this.heightAt(entry.x,entry.z)+.016;
   if(nextY>=entry.y-.002)continue;
   entry.y=nextY;
   grass.writeEntryMatrix(entry);
   changed=true;
  }

  if(changed){
   grass.mesh.instanceMatrix.needsUpdate=true;
   grass.mesh.computeBoundingSphere?.();
  }
 }

 syncAllEnvironment(){
  if(!this.cuts.length)return;
  for(const cut of this.cuts)this.syncEnvironmentForCut(cut);
 }

 syncAllFineGrass(){
  if(!this.cuts.length)return;
  for(const cut of this.cuts)this.syncFineGrassForCut(cut);
 }

 registerFloor(floor){
  if(!floor||floor.mode!=='floor'||this.processedPlacements.has(floor.id))return false;
  this.processedPlacements.add(floor.id);

  const cut=this.makeCutFromFloor(floor);
  this.cuts.push(cut);

  this.applyCutsToTerrain(cut);
  this.syncEnvironmentForCut(cut);
  this.syncFineGrassForCut(cut);
  return true;
 }

 refreshAsyncVegetation(){
  const environmentCount=this.world?.environment?.root?.children?.length??0;
  if(environmentCount!==this.lastEnvironmentChildCount){
   this.lastEnvironmentChildCount=environmentCount;
   this.syncAllEnvironment();
  }

  const fineGrassMesh=this.fineGrass?.mesh??null;
  if(fineGrassMesh!==this.lastFineGrassMesh){
   this.lastFineGrassMesh=fineGrassMesh;
   this.syncAllFineGrass();
  }
 }

 update(){
  const placements=this.buildingModes?.placements;
  if(placements?.length){
   for(const placement of placements){
    if(placement.mode==='floor')this.registerFloor(placement);
   }
  }
  this.refreshAsyncVegetation();
 }
}
