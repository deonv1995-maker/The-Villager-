export class WallInteriorFacingSystem{
 constructor({buildingModes}){
  this.buildingModes=buildingModes;
  this.originalWallSnapBase=null;
  this.storeyTolerance=.58;
  this.sideSearchDistance=2.25;
 }

 initialize(){
  const bm=this.buildingModes;
  if(!bm?.wallSnapBase)return;
  this.originalWallSnapBase=bm.wallSnapBase.bind(bm);
  bm.wallSnapBase=base=>this.orientWall(this.originalWallSnapBase(base));
 }

 orientWall(base){
  if(!base?.snapKind||base.snapKind!=='between-frames')return base;
  const bm=this.buildingModes;
  const basis=bm.basis(base.yaw||0);
  let positive=0;
  let negative=0;

  for(const floor of bm.activePlacements('floor')){
   // Only floors belonging to the same storey should decide which face is inside.
   if(Number.isFinite(base.ground)&&Number.isFinite(floor.maxY)
    &&Math.abs(floor.maxY-base.ground)>this.storeyTolerance)continue;

   const dx=floor.x-base.x;
   const dz=floor.z-base.z;
   const localX=dx*basis.xX+dz*basis.xZ;
   const localZ=dx*basis.zX+dz*basis.zZ;
   if(Math.abs(localX)>bm.logHalfLength+bm.floorWidth*.72)continue;
   if(Math.abs(localZ)>this.sideSearchDistance||Math.abs(localZ)<.06)continue;

   // Nearest floor strips carry the strongest vote. Exterior walls therefore
   // point the flat split face toward the occupied floor footprint, independent
   // of which way the Ranger happens to be standing when the wall is placed.
   const weight=1/(.18+Math.abs(localZ));
   if(localZ>0)positive+=weight;
   else negative+=weight;
  }

  if(positive===0&&negative===0)return base;
  const flatTowardPositive=positive>=negative;
  const yaw=flatTowardPositive
   ?base.yaw
   :bm.snapYaw((base.yaw||0)+Math.PI);
  return {...base,yaw,wallFlatFaceInward:true};
 }
}
