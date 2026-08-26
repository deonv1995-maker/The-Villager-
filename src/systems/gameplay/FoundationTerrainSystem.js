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

  // A placed floor is the construction datum. Higher terrain is cut back to the
  // floor level with a soft earthen shoulder. Lower terrain is never filled, so
  // the downhill edge remains a genuine deck/overhang.
  this.floorClearance=.09;
  this.coreMargin=.58;
  this.blendDistance=2.15;
  this.soilColor=new THREE.Color(0x795d3f);
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

 outsideDistance(cut,x,z){
  const p=this.localPoint(cut,x,z);
  const ox=Math.max(Math.abs(p.x)-cut.halfX,0);
  const oz=Math.max(Math.abs(p.z)-cut.halfZ,0);
  return Math.hypot(ox,oz);
 }

 cutHeightAt(cut,x,z,naturalY){
  // Never raise the downhill side. Only terrain that would cover the floor gets
  // excavated; this is what allows the opposite side to hang free like a deck.
  if(naturalY<=cut.cutY)return naturalY;

  const distance=this.outsideDistance(cut,x,z);
  if(distance>cut.blendDistance)return naturalY;

  const t=this.smoothstep01(distance/cut.blendDistance);
  return cut.cutY+(naturalY-cut.cutY)*t;
 }

 heightAt(x,z){
  const natural=this.baseHeightAt?this.baseHeightAt(x,z):this.world?.terrain?.rawHeightAt?.(x,z)??0;
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

 applyCutToTerrain(cut){
  if(!this.positionAttribute||!this.originalPositions)return false;

  const positions=this.positionAttribute.array;
  const colors=this.colorAttribute?.array||null;
  let changed=false;

  for(let i=0;i<positions.length;i+=3){
   const x=this.originalPositions[i];
   const z=this.originalPositions[i+2];
   const naturalY=this.originalPositions[i+1];
   const nextY=this.cutHeightAt(cut,x,z,naturalY);
   if(nextY>=positions[i+1]-.002)continue;

   positions[i+1]=nextY;
   changed=true;

   if(colors&&this.originalColors){
    const lowered=naturalY-nextY;
    const distance=this.outsideDistance(cut,x,z);
    const edge=1-this.smoothstep01(distance/cut.blendDistance);
    const strength=Math.min(.78,lowered/1.35)*(.55+.45*edge);
    const oi=i;
    colors[oi]=this.originalColors[oi]+(this.soilColor.r-this.originalColors[oi])*strength;
    colors[oi+1]=this.originalColors[oi+1]+(this.soilColor.g-this.originalColors[oi+1])*strength;
    colors[oi+2]=this.originalColors[oi+2]+(this.soilColor.b-this.originalColors[oi+2])*strength;
   }
  }

  return changed;
 }

 clearAuthoredGrass(cut){
  const root=this.world?.environment?.root;
  if(!root)return;
  const p=new this.T.Vector3();
  const halfX=cut.halfX+.20;
  const halfZ=cut.halfZ+.20;

  for(const object of root.children){
   if(object.userData?.environmentType!=='grass'||object.visible===false)continue;
   object.getWorldPosition(p);
   const local=this.localPoint({...cut,halfX,halfZ},p.x,p.z);
   if(Math.abs(local.x)<=halfX&&Math.abs(local.z)<=halfZ)object.visible=false;
  }
 }

 clearFineGrass(cut){
  const grass=this.fineGrass;
  if(!grass?.mesh||!grass.entries?.length||!grass.writeEntryMatrix)return;

  const halfX=cut.halfX+.18;
  const halfZ=cut.halfZ+.18;
  let changed=false;

  for(const entry of grass.entries){
   if(entry.foundationHidden)continue;
   const local=this.localPoint({...cut,halfX,halfZ},entry.x,entry.z);
   if(Math.abs(local.x)>halfX||Math.abs(local.z)>halfZ)continue;
   entry.foundationHidden=true;
   entry.scaleY=0;
   entry.bendX=0;
   entry.bendZ=0;
   entry.compression=0;
   grass.active?.delete?.(entry);
   grass.writeEntryMatrix(entry);
   changed=true;
  }

  if(changed)grass.mesh.instanceMatrix.needsUpdate=true;
 }

 registerFloor(floor){
  if(!floor||floor.mode!=='floor'||this.processedPlacements.has(floor.id))return false;
  this.processedPlacements.add(floor.id);

  const cut=this.makeCutFromFloor(floor);
  this.cuts.push(cut);

  const changed=this.applyCutToTerrain(cut);
  this.clearAuthoredGrass(cut);
  this.clearFineGrass(cut);

  if(changed&&this.terrainMesh?.geometry){
   this.positionAttribute.needsUpdate=true;
   if(this.colorAttribute)this.colorAttribute.needsUpdate=true;
   this.terrainMesh.geometry.computeVertexNormals();
   this.terrainMesh.geometry.computeBoundingSphere();
  }
  return true;
 }

 update(){
  const placements=this.buildingModes?.placements;
  if(!placements?.length)return;
  for(const placement of placements){
   if(placement.mode==='floor')this.registerFloor(placement);
  }
 }
}
