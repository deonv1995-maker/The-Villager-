export class RoofingSystem{
 constructor(THREE,{buildingModes,materials,upperFloors}){
  this.T=THREE;
  this.buildingModes=buildingModes;
  this.materials=materials;
  this.upperFloors=upperFloors;

  this.snapRange=3.15;
  this.heightTolerance=.30;
  this.slotTolerance=.28;
  this.frameModes=new Set(['roofFrame']);
  this.cladModes=new Set(['roofClad']);
  this.plankStages=3;
  this.minRise=.78;
  this.maxRise=2.05;
  this.riseRatio=.72;
  this.roofSeat=.04;

  this.unitBox=new THREE.BoxGeometry(1,1,1);
  this.plankMaterial=new THREE.MeshLambertMaterial({color:0x9a6a43});
  this.plankEdgeMaterial=new THREE.MeshLambertMaterial({color:0x765035});
  this.thatchMaterial=new THREE.MeshLambertMaterial({color:0x7f9846});
  this.thatchHighlight=new THREE.MeshLambertMaterial({color:0xa4b75f});

  this.originalModeLabel=null;
  this.originalResolvedBase=null;
  this.originalCreatePreview=null;
  this.originalApplyPreviewTransform=null;
  this.originalPlacementAllowed=null;
  this.originalActionLabel=null;
  this.originalPlaceCarriedLogSnapshot=null;
  this.originalUpdatePreview=null;
  this.originalPlaceCarried=null;

  this.tmpX=new THREE.Vector3(1,0,0);
  this.tmpDir=new THREE.Vector3();
  this.tmpWidth=new THREE.Vector3();
  this.tmpNormal=new THREE.Vector3();
  this.tmpMatrix=new THREE.Matrix4();
  this.tmpQuaternion=new THREE.Quaternion();
 }

 initialize(){
  const bm=this.buildingModes;
  if(!bm||!this.materials||!this.upperFloors)return;
  if(!bm.modes.includes('roof'))bm.modes.push('roof');
  bm.world.roofing=this;

  this.originalModeLabel=bm.modeLabel.bind(bm);
  bm.modeLabel=mode=>mode==='roof'?'ROOF':this.originalModeLabel(mode);

  this.originalResolvedBase=bm.resolvedBase.bind(bm);
  bm.resolvedBase=mode=>mode==='roof'?this.roofSnapBase(bm.placementBase()):this.originalResolvedBase(mode);

  this.originalCreatePreview=bm.createPreview.bind(bm);
  bm.createPreview=(mode,base)=>mode==='roof'?this.createRoofPreview(base):this.originalCreatePreview(mode,base);

  this.originalApplyPreviewTransform=bm.applyPreviewTransform.bind(bm);
  bm.applyPreviewTransform=(mode,base)=>{
   if(mode==='roof')return this.applyRoofPreview(base);
   return this.originalApplyPreviewTransform(mode,base);
  };

  this.originalPlacementAllowed=bm.placementAllowed.bind(bm);
  bm.placementAllowed=(base,mode=bm.mode)=>
   mode==='roof'?this.roofPlacementAllowed(base):this.originalPlacementAllowed(base,mode);

  this.originalActionLabel=bm.actionLabel.bind(bm);
  bm.actionLabel=()=>bm.mode==='roof'?this.actionLabel():this.originalActionLabel();

  this.originalPlaceCarriedLogSnapshot=bm.placeCarriedLogSnapshot.bind(bm);
  bm.placeCarriedLogSnapshot=snapshot=>
   snapshot?.mode==='roof'?this.placeRoofLog(snapshot):this.originalPlaceCarriedLogSnapshot(snapshot);

  this.originalUpdatePreview=bm.updatePreview.bind(bm);
  bm.updatePreview=()=>bm.mode==='roof'?this.updateRoofPreview():this.originalUpdatePreview();

  this.originalPlaceCarried=this.materials.placeCarried.bind(this.materials);
  this.materials.placeCarried=()=>{
   if(this.materials.carried?.type==='grass'&&bm.mode==='roof')return this.placeGrassRoof();
   return this.originalPlaceCarried();
  };
 }

 regionKey(region){return `roof:${[...(region.beamIds||[])].sort((a,b)=>a-b).join('-')}`;}

 project(point,cx,cz,ux,uz,vx,vz){
  const dx=point.x-cx,dz=point.z-cz;
  return {u:dx*ux+dz*uz,v:dx*vx+dz*vz};
 }

 regionData(region){
  const polygon=region?.polygon||[];
  if(polygon.length<4)return null;
  let cx=0,cz=0;
  for(const p of polygon){cx+=p.x;cz+=p.z;}
  cx/=polygon.length;cz/=polygon.length;

  const beamById=new Map(this.buildingModes.activePlacements('beam').map(b=>[b.id,b]));
  const axes=[];
  for(const id of region.beamIds||[]){
   const beam=beamById.get(id);
   if(!beam)continue;
   const yaw=beam.yaw||0;
   const ux=Math.cos(yaw),uz=-Math.sin(yaw);
   if(axes.some(a=>Math.abs(a.ux*ux+a.uz*uz)>.96))continue;
   axes.push({ux,uz});
  }
  if(!axes.length)axes.push({ux:1,uz:0});

  let best=null;
  for(const axis of axes){
   const vx=-axis.uz,vz=axis.ux;
   let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
   for(const p of polygon){
    const q=this.project(p,cx,cz,axis.ux,axis.uz,vx,vz);
    minU=Math.min(minU,q.u);maxU=Math.max(maxU,q.u);
    minV=Math.min(minV,q.v);maxV=Math.max(maxV,q.v);
   }
   const spanU=maxU-minU,spanV=maxV-minV;
   if(!best||spanU>best.spanU+.01)best={...axis,vx,vz,minU,maxU,minV,maxV,spanU,spanV};
  }
  if(!best||best.spanV<.55||best.spanU<.55)return null;

  const ridgeV=(best.minV+best.maxV)*.5;
  const halfRun=best.spanV*.5;
  const rise=Math.max(this.minRise,Math.min(this.maxRise,halfRun*this.riseRatio));
  const ridgeY=region.beamCenterY+rise;

  const slotValues=[];
  for(const p of polygon){
   const q=this.project(p,cx,cz,best.ux,best.uz,best.vx,best.vz);
   const onEave=Math.abs(q.v-best.minV)<=this.slotTolerance||Math.abs(q.v-best.maxV)<=this.slotTolerance;
   if(!onEave)continue;
   if(!slotValues.some(v=>Math.abs(v-q.u)<=this.slotTolerance))slotValues.push(q.u);
  }
  slotValues.sort((a,b)=>a-b);
  if(slotValues.length<2)slotValues.push(best.minU,best.maxU);
  const slots=[];
  for(const value of slotValues){
   if(!slots.length||Math.abs(value-slots[slots.length-1])>this.slotTolerance)slots.push(value);
  }
  if(slots.length<2)return null;

  return {
   region,
   key:this.regionKey(region),
   cx,cz,
   ux:best.ux,uz:best.uz,
   vx:best.vx,vz:best.vz,
   minU:best.minU,maxU:best.maxU,
   minV:best.minV,maxV:best.maxV,
   ridgeV,
   eaveY:region.beamCenterY+this.roofSeat,
   ridgeY,
   rise,
   slots
  };
 }

 worldPoint(data,u,v,y){
  return {
   x:data.cx+data.ux*u+data.vx*v,
   y,
   z:data.cz+data.uz*u+data.vz*v
  };
 }

 axisCandidate(data,key,a,b,snapKind,extra={}){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const length=Math.max(.01,Math.hypot(dx,dy,dz));
  return {
   x:(a.x+b.x)*.5,
   z:(a.z+b.z)*.5,
   centerY:(a.y+b.y)*.5,
   ground:this.buildingModes.world.heightAt((a.x+b.x)*.5,(a.z+b.z)*.5),
   yaw:Math.atan2(-dz,dx),
   snapKind,
   anchorIds:[...data.region.beamIds],
   roofRegionKey:data.key,
   roofKey:key,
   roofLength:length,
   roofDirX:dx/length,roofDirY:dy/length,roofDirZ:dz/length,
   roofVisualKey:key,
   ...extra
  };
 }

 frameCandidates(data){
  const candidates=[];
  for(let i=0;i<data.slots.length;i++){
   const u=data.slots[i];
   const ridge=this.worldPoint(data,u,data.ridgeV,data.ridgeY);
   for(const side of [-1,1]){
    const eaveV=side<0?data.minV:data.maxV;
    const eave=this.worldPoint(data,u,eaveV,data.eaveY);
    candidates.push(this.axisCandidate(
     data,`${data.key}:rafter:${i}:${side}`,eave,ridge,'roof-rafter',
     {roofSlot:i,roofSide:side}
    ));
   }
  }

  for(let i=0;i<data.slots.length-1;i++){
   const a=this.worldPoint(data,data.slots[i],data.ridgeV,data.ridgeY);
   const b=this.worldPoint(data,data.slots[i+1],data.ridgeV,data.ridgeY);
   candidates.push(this.axisCandidate(
    data,`${data.key}:ridge:${i}`,a,b,'roof-ridge',
    {roofSlot:i,roofSide:0}
   ));
  }
  return candidates;
 }

 framePlacementKeys(data){
  return new Set(
   this.buildingModes.activePlacements('roofFrame')
    .filter(p=>p.roofRegionKey===data.key)
    .map(p=>p.roofKey)
  );
 }

 missingFrameCandidates(data){
  const occupied=this.framePlacementKeys(data);
  return this.frameCandidates(data).filter(c=>!occupied.has(c.roofKey));
 }

 frameComplete(data){return this.missingFrameCandidates(data).length===0;}

 bayKey(data,index,side){return `${data.key}:bay:${index}:${side}`;}

 bayProgress(data,index,side){
  const key=this.bayKey(data,index,side);
  const placements=this.buildingModes.activePlacements('roofClad').filter(p=>p.roofBayKey===key);
  const grass=placements.some(p=>p.roofMaterial==='grass');
  const logs=placements.filter(p=>p.roofMaterial==='log').length;
  return {key,complete:grass||logs>=this.plankStages,grass,logs};
 }

 panelCandidate(data,index,side,materialType,stage=0){
  const u0=data.slots[index],u1=data.slots[index+1];
  const bayWidth=Math.abs(u1-u0);
  const segmentWidth=materialType==='grass'?bayWidth:bayWidth/this.plankStages;
  const lowU=Math.min(u0,u1);
  const uCenter=materialType==='grass'
   ?(u0+u1)*.5
   :lowU+(stage+.5)*segmentWidth;
  const eaveV=side<0?data.minV:data.maxV;
  const eave=this.worldPoint(data,uCenter,eaveV,data.eaveY+.055);
  const ridge=this.worldPoint(data,uCenter,data.ridgeV,data.ridgeY+.055);
  const dx=ridge.x-eave.x,dy=ridge.y-eave.y,dz=ridge.z-eave.z;
  const slopeLength=Math.max(.01,Math.hypot(dx,dy,dz));
  const bayKey=this.bayKey(data,index,side);
  const snapKind=materialType==='grass'?'roof-grass-clad':'roof-plank-clad';
  const visualKey=`${bayKey}:${materialType}:${stage}`;

  return {
   x:(eave.x+ridge.x)*.5,z:(eave.z+ridge.z)*.5,
   centerY:(eave.y+ridge.y)*.5,
   ground:this.buildingModes.world.heightAt((eave.x+ridge.x)*.5,(eave.z+ridge.z)*.5),
   yaw:Math.atan2(-dz,dx),
   snapKind,
   anchorIds:[...data.region.beamIds],
   roofRegionKey:data.key,
   roofBayKey:bayKey,
   roofBayIndex:index,
   roofSide:side,
   roofStage:stage,
   roofMaterial:materialType,
   roofSlopeLength:slopeLength,
   roofDirX:dx/slopeLength,roofDirY:dy/slopeLength,roofDirZ:dz/slopeLength,
   roofWidthDirX:data.ux,roofWidthDirZ:data.uz,
   roofBayWidth:bayWidth,
   roofSegmentWidth:segmentWidth,
   roofVisualKey:visualKey
  };
 }

 claddingCandidates(data,materialType){
  if(!this.frameComplete(data))return [];
  const result=[];
  for(let i=0;i<data.slots.length-1;i++){
   for(const side of [-1,1]){
    const progress=this.bayProgress(data,i,side);
    if(progress.complete)continue;
    if(materialType==='grass')result.push(this.panelCandidate(data,i,side,'grass',0));
    else result.push(this.panelCandidate(data,i,side,'log',progress.logs));
   }
  }
  return result;
 }

 roofCandidates(materialType=this.materials?.carried?.type){
  const result=[];
  const regions=this.upperFloors.perimeterFrameworks?.()||[];
  for(const region of regions){
   const data=this.regionData(region);
   if(!data)continue;
   const missing=this.missingFrameCandidates(data);
   if(materialType==='log'&&missing.length){
    result.push(...missing);
    continue;
   }
   if(missing.length)continue;
   result.push(...this.claddingCandidates(data,materialType));
  }
  return result;
 }

 roofSnapBase(base){
  if(!base)return base;
  const type=this.materials?.carried?.type;
  if(type!=='log'&&type!=='grass')return base;
  return this.buildingModes.chooseCandidate(base,this.roofCandidates(type),this.snapRange);
 }

 roofPlacementAllowed(base){
  if(!base?.snapKind||!String(base.snapKind).startsWith('roof-'))return false;
  const type=this.materials?.carried?.type;
  if(type==='grass'&&base.snapKind!=='roof-grass-clad')return false;
  if(type==='log'&&base.snapKind==='roof-grass-clad')return false;
  return true;
 }

 applyAxisPose(object,base){
  object.position.set(base.x,base.centerY,base.z);
  this.tmpDir.set(base.roofDirX,base.roofDirY,base.roofDirZ).normalize();
  this.tmpQuaternion.setFromUnitVectors(this.tmpX,this.tmpDir);
  object.quaternion.copy(this.tmpQuaternion);
 }

 applyPanelPose(object,base){
  object.position.set(base.x,base.centerY,base.z);
  this.tmpDir.set(base.roofDirX,base.roofDirY,base.roofDirZ).normalize();
  this.tmpWidth.set(base.roofWidthDirX,0,base.roofWidthDirZ).normalize();
  this.tmpNormal.crossVectors(this.tmpWidth,this.tmpDir).normalize();
  if(this.tmpNormal.y<0){
   this.tmpWidth.multiplyScalar(-1);
   this.tmpNormal.crossVectors(this.tmpWidth,this.tmpDir).normalize();
  }
  this.tmpMatrix.makeBasis(this.tmpDir,this.tmpNormal,this.tmpWidth);
  object.quaternion.setFromRotationMatrix(this.tmpMatrix);
 }

 makeFrameLog(base){
  const object=this.materials.makeLogVisual();
  object.name=base.snapKind==='roof-ridge'?'RoofRidgeLog':'RoofRafterLog';
  object.scale.x=Math.max(.12,base.roofLength/(this.materials.logLength||2.9));
  this.applyAxisPose(object,base);
  return object;
 }

 makePlankClad(base){
  const T=this.T;
  const group=new T.Group();
  group.name='ThreeSplitRoofPlanks';
  const segmentWidth=base.roofSegmentWidth;
  const plankWidth=segmentWidth/3*.92;

  for(let i=0;i<3;i++){
   const mesh=new T.Mesh(this.unitBox,i===1?this.plankEdgeMaterial:this.plankMaterial);
   mesh.scale.set(base.roofSlopeLength,.07,plankWidth);
   mesh.position.z=(i-1)*(segmentWidth/3);
   mesh.castShadow=false;
   mesh.receiveShadow=true;
   group.add(mesh);
  }
  this.applyPanelPose(group,base);
  return group;
 }

 makeGrassClad(base){
  const T=this.T;
  const group=new T.Group();
  group.name='GrassThatchedRoofBay';
  const width=base.roofBayWidth*.98;
  const panel=new T.Mesh(this.unitBox,this.thatchMaterial);
  panel.scale.set(base.roofSlopeLength,.10,width);
  panel.castShadow=false;
  panel.receiveShadow=true;
  group.add(panel);

  for(let i=-3;i<=3;i++){
   const strand=new T.Mesh(this.unitBox,this.thatchHighlight);
   strand.scale.set(base.roofSlopeLength*.97,.025,Math.max(.028,width/34));
   strand.position.set(0,.064,i*width/8);
   strand.castShadow=false;
   group.add(strand);
  }
  this.applyPanelPose(group,base);
  return group;
 }

 makeRoofObject(base){
  if(base.snapKind==='roof-rafter'||base.snapKind==='roof-ridge')return this.makeFrameLog(base);
  if(base.snapKind==='roof-plank-clad')return this.makePlankClad(base);
  if(base.snapKind==='roof-grass-clad')return this.makeGrassClad(base);
  return null;
 }

 createRoofPreview(base){
  if(!base?.snapKind)return null;
  const bm=this.buildingModes;
  const object=this.makeRoofObject(base);
  if(!object)return null;
  object.name='RoofConstructionGhost';
  object.userData.constructionGhost=true;
  object.userData.roofPreviewKey=base.roofVisualKey;
  bm.tintAsPreview(object);
  bm.scene.add(object);
  bm.preview=object;
  bm.previewMode='roof';
  return object;
 }

 applyRoofPreview(base){
  const bm=this.buildingModes;
  if(!bm.preview||!base?.snapKind)return;
  if(bm.preview.userData?.roofPreviewKey!==base.roofVisualKey){
   bm.destroyPreview();
   bm.createPreview('roof',base);
   return;
  }
  if(base.snapKind==='roof-rafter'||base.snapKind==='roof-ridge')this.applyAxisPose(bm.preview,base);
  else this.applyPanelPose(bm.preview,base);
 }

 updateRoofPreview(){
  const bm=this.buildingModes;
  const carried=this.materials?.carried;
  if(!carried||(carried.type!=='log'&&carried.type!=='grass')){
   bm.destroyPreview();bm.previewValid=false;return;
  }

  const base=this.roofSnapBase(bm.placementBase());
  if(!base?.snapKind){
   bm.destroyPreview();
   bm.previewValid=false;
   bm.lastPreviewBase=null;
   return;
  }

  if(!bm.preview||bm.previewMode!=='roof'){
   bm.destroyPreview();
   bm.createPreview('roof',base);
  }
  if(!bm.preview)return;
  bm.applyPreviewTransform('roof',base);
  bm.previewValid=this.roofPlacementAllowed(base);
  bm.lastPreviewBase=bm.clonePlacementBase(base);
  bm.previewMaterial.color.setHex(bm.previewValid?0x65d879:0xd85d57);
  bm.previewMaterial.opacity=bm.previewValid?.44:.34;
  bm.preview.visible=true;
 }

 actionLabel(){
  const base=this.buildingModes.currentPreviewBase?.()||this.roofSnapBase(this.buildingModes.placementBase());
  if(base?.snapKind==='roof-rafter')return 'SNAP RAFTER';
  if(base?.snapKind==='roof-ridge')return 'SNAP RIDGE';
  if(base?.snapKind==='roof-plank-clad')return `CLAD ROOF ${Math.min(this.plankStages,base.roofStage+1)}/${this.plankStages}`;
  if(base?.snapKind==='roof-grass-clad')return 'THATCH ROOF BAY';

  const regions=this.upperFloors.perimeterFrameworks?.()||[];
  if(!regions.length)return 'NEEDS TOP FRAME';
  if(this.materials?.carried?.type==='grass')return 'FINISH ROOF FRAME';
  return 'ROOF COMPLETE';
 }

 recordRoofPlacement(mode,object,base,material){
  const placement=this.buildingModes.recordPlacement(mode,object,base,false);
  placement.roofRegionKey=base.roofRegionKey;
  placement.roofKey=base.roofKey||null;
  placement.roofBayKey=base.roofBayKey||null;
  placement.roofBayIndex=base.roofBayIndex??null;
  placement.roofSide=base.roofSide??null;
  placement.roofStage=base.roofStage??null;
  placement.roofMaterial=material;
  return placement;
 }

 placeRoofLog(snapshot){
  const item=this.materials?.carried;
  if(!item||item.type!=='log'||!snapshot?.valid||!snapshot.base)return null;
  const base=this.buildingModes.clonePlacementBase(snapshot.base);
  if(!this.roofPlacementAllowed(base))return null;
  const object=this.makeRoofObject(base);
  if(!object)return null;
  if(!this.materials.consume(item))return null;
  this.buildingModes.destroyPreview();
  const mode=base.snapKind==='roof-plank-clad'?'roofClad':'roofFrame';
  return this.recordRoofPlacement(mode,object,base,'log');
 }

 placeGrassRoof(){
  const item=this.materials?.carried;
  if(!item||item.type!=='grass')return null;
  let base=this.buildingModes.currentPreviewBase?.();
  if(!base)base=this.roofSnapBase(this.buildingModes.placementBase());
  if(!base||base.snapKind!=='roof-grass-clad'||!this.roofPlacementAllowed(base))return null;

  const object=this.makeGrassClad(base);
  if(!this.materials.consume(item))return null;
  this.buildingModes.destroyPreview();
  const placement=this.recordRoofPlacement('roofClad',object,base,'grass');
  placement.type='grass';
  return placement;
 }
}
