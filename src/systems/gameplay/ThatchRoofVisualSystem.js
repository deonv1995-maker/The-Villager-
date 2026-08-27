export class ThatchRoofVisualSystem{
 constructor(THREE,{roofing,buildingModes,upperFloors}){
  this.T=THREE;
  this.roofing=roofing;
  this.buildingModes=buildingModes;
  this.upperFloors=upperFloors;

  this.unitBox=new THREE.BoxGeometry(1,1,1);
  this.ridgeGeometry=new THREE.CylinderGeometry(.22,.27,1,7,1,false);
  this.baseMaterial=new THREE.MeshLambertMaterial({color:0xc99a43});
  this.layerMaterial=new THREE.MeshLambertMaterial({color:0xb88435});
  this.lightMaterial=new THREE.MeshLambertMaterial({color:0xe0b65a});
  this.shadowMaterial=new THREE.MeshLambertMaterial({color:0x9c6d2e});

  this.originalMakeGrassClad=null;
  this.originalPlaceGrassRoof=null;
 }

 initialize(){
  if(!this.roofing?.makeGrassClad||!this.roofing?.placeGrassRoof)return;
  this.originalMakeGrassClad=this.roofing.makeGrassClad.bind(this.roofing);
  this.originalPlaceGrassRoof=this.roofing.placeGrassRoof.bind(this.roofing);

  this.roofing.makeGrassClad=base=>this.makeGrassClad(base);
  this.roofing.placeGrassRoof=()=>{
   const placement=this.originalPlaceGrassRoof();
   if(placement)this.ensureFinishedRidge(placement.roofRegionKey);
   return placement;
  };
 }

 mesh(geometry,material){
  const mesh=new this.T.Mesh(geometry,material);
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  return mesh;
 }

 makeGrassClad(base){
  const T=this.T;
  const group=new T.Group();
  group.name='LayeredThatchedRoofBay';

  const slope=Math.max(.6,base.roofSlopeLength||1);
  const width=Math.max(.45,(base.roofBayWidth||1)*1.08);
  const eaveOverhang=.34;
  const ridgeOverlap=.12;
  const totalLength=slope+eaveOverhang+ridgeOverlap;

  const body=this.mesh(this.unitBox,this.baseMaterial);
  body.scale.set(totalLength,.16,width);
  body.position.set((ridgeOverlap-eaveOverhang)*.5,.035,0);
  group.add(body);

  const rows=5;
  const rowStep=slope/rows;
  for(let i=0;i<rows;i++){
   const course=this.mesh(this.unitBox,i%2?this.layerMaterial:this.lightMaterial);
   const courseLength=rowStep*1.34+(i===0?eaveOverhang*.65:0);
   const x=-slope*.5+(i+.5)*rowStep-(i===0?eaveOverhang*.22:0);
   course.scale.set(courseLength,.095,width*(1.06-i*.008));
   course.position.set(x,.13+i*.012,0);
   group.add(course);
  }

  const clumps=9;
  for(let i=0;i<clumps;i++){
   const t=i/(clumps-1);
   const variation=Math.sin((i+1)*2.17)*.045;
   const clump=this.mesh(this.unitBox,i%3===0?this.shadowMaterial:this.lightMaterial);
   clump.scale.set(.25+((i*7)%4)*.035,.075,width/clumps*.86);
   clump.position.set(
    -slope*.5-eaveOverhang*.68-((i%2)*.035),
    .075+variation,
    -width*.5+t*width
   );
   clump.rotation.z=(i%2?1:-1)*.035;
   group.add(clump);
  }

  for(let i=-2;i<=2;i++){
   const rib=this.mesh(this.unitBox,this.lightMaterial);
   rib.scale.set(totalLength*.95,.028,Math.max(.025,width/48));
   rib.position.set((ridgeOverlap-eaveOverhang)*.5,.205,i*width/6);
   group.add(rib);
  }

  this.roofing.applyPanelPose(group,base);
  group.userData.thatchRoof=true;
  return group;
 }

 regionDataForKey(regionKey){
  for(const region of this.upperFloors?.perimeterFrameworks?.()||[]){
   if(this.roofing.regionKey(region)!==regionKey)continue;
   return this.roofing.regionData(region);
  }
  return null;
 }

 allBaysGrass(data){
  if(!data?.slots||data.slots.length<2)return false;
  for(let i=0;i<data.slots.length-1;i++){
   for(const side of [-1,1]){
    if(!this.roofing.bayProgress(data,i,side).grass)return false;
   }
  }
  return true;
 }

 ridgeExists(regionKey){
  return this.buildingModes.activePlacements('roofClad').some(p=>
   p.snapKind==='roof-grass-ridge'&&p.roofRegionKey===regionKey
  );
 }

 makeRidgeCap(data){
  const T=this.T;
  const group=new T.Group();
  group.name='ThatchedRidgeCap';
  const span=Math.max(.5,data.maxU-data.minU+.38);

  for(let i=-1;i<=1;i++){
   const bundle=this.mesh(this.ridgeGeometry,i===0?this.lightMaterial:this.baseMaterial);
   bundle.scale.set(1,span,1);
   bundle.rotation.z=Math.PI/2;
   bundle.position.set(0,(i===0 ? .08 : -.015),i*.16);
   group.add(bundle);
  }

  for(const end of [-1,1]){
   for(let i=-1;i<=1;i++){
    const tuft=this.mesh(this.unitBox,i===0?this.lightMaterial:this.layerMaterial);
    tuft.scale.set(.26,.08,.12);
    tuft.position.set(end*span*.5,.02,i*.13);
    tuft.rotation.z=end*.08;
    group.add(tuft);
   }
  }

  const center=this.roofing.worldPoint(
   data,(data.minU+data.maxU)*.5,data.ridgeV,data.ridgeY+.22
  );
  group.position.set(center.x,center.y,center.z);
  group.rotation.y=Math.atan2(-data.uz,data.ux);
  return group;
 }

 ensureFinishedRidge(regionKey){
  if(!regionKey||this.ridgeExists(regionKey))return null;
  const data=this.regionDataForKey(regionKey);
  if(!data||!this.allBaysGrass(data))return null;

  const object=this.makeRidgeCap(data);
  const center=this.roofing.worldPoint(
   data,(data.minU+data.maxU)*.5,data.ridgeV,data.ridgeY+.22
  );
  const base={
   x:center.x,z:center.z,centerY:center.y,
   ground:this.buildingModes.world.heightAt(center.x,center.z),
   yaw:Math.atan2(-data.uz,data.ux),
   snapKind:'roof-grass-ridge',
   anchorIds:[...(data.region.beamIds||[])],
   roofRegionKey:data.key
  };
  const placement=this.buildingModes.recordPlacement('roofClad',object,base,false);
  placement.roofRegionKey=data.key;
  placement.roofMaterial='grass-ridge';
  placement.type='grass';
  return placement;
 }
}
