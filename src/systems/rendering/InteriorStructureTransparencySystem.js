export class InteriorStructureTransparencySystem{
 constructor({buildingModes,player,camera}){
  this.buildingModes=buildingModes;
  this.player=player;
  this.camera=camera;

  this.fadeOpacity=.16;
  this.fadeSpeed=10.5;
  this.refreshInterval=.10;
  this.refreshTimer=0;
  this.lastTime=0;
  this.running=false;
  this.rafId=0;

  this.targetPlacements=new Set();
  this.meshState=new WeakMap();
  this.knownMeshes=new Set();
 }

 initialize(){
  if(this.running)return;
  this.running=true;
  this.lastTime=performance.now();
  const loop=now=>{
   if(!this.running)return;
   const dt=Math.min(.05,Math.max(0,(now-this.lastTime)/1000));
   this.lastTime=now;
   this.update(dt);
   this.rafId=requestAnimationFrame(loop);
  };
  this.rafId=requestAnimationFrame(loop);
 }

 dispose(){
  this.running=false;
  if(this.rafId)cancelAnimationFrame(this.rafId);
  this.rafId=0;
  for(const mesh of this.knownMeshes)this.restoreMesh(mesh,true);
  this.knownMeshes.clear();
  this.targetPlacements.clear();
 }

 activePlacements(){
  return (this.buildingModes?.placements||[]).filter(p=>p?.object?.parent);
 }

 placementHeight(placement){
  const minY=Number.isFinite(placement?.minY)?placement.minY:(placement?.centerY??placement?.object?.position?.y??0)-.5;
  const maxY=Number.isFinite(placement?.maxY)?placement.maxY:(placement?.centerY??placement?.object?.position?.y??0)+.5;
  return {minY,maxY};
 }

 roofAbovePlayer(placements){
  const player=this.player;
  if(!player)return null;
  const px=player.position.x,py=player.position.y,pz=player.position.z;
  let best=null,bestScore=Infinity;

  for(const placement of placements){
   if(placement.mode!=='roofClad'&&placement.mode!=='roofFrame')continue;
   const dx=(placement.x??placement.object.position.x)-px;
   const dz=(placement.z??placement.object.position.z)-pz;
   const distance=Math.hypot(dx,dz);
   if(distance>5.4)continue;
   const {minY,maxY}=this.placementHeight(placement);
   if(maxY<py+.75||minY>py+6.5)continue;
   const vertical=Math.max(.25,minY-py);
   const score=distance+vertical*.10;
   if(score<bestScore){best=placement;bestScore=score;}
  }
  return best;
 }

 rebuildTargets(){
  const placements=this.activePlacements();
  const roof=this.roofAbovePlayer(placements);
  const next=new Set();
  if(!roof){
   this.targetPlacements=next;
   return;
  }

  const px=this.player.position.x,py=this.player.position.y,pz=this.player.position.z;
  let cameraX=this.camera.position.x-px;
  let cameraZ=this.camera.position.z-pz;
  const cameraLength=Math.hypot(cameraX,cameraZ)||1;
  cameraX/=cameraLength;
  cameraZ/=cameraLength;
  const roofRegion=roof.roofRegionKey||null;

  for(const placement of placements){
   const x=placement.x??placement.object.position.x;
   const z=placement.z??placement.object.position.z;
   const dx=x-px,dz=z-pz;
   const distance=Math.hypot(dx,dz);
   const {minY,maxY}=this.placementHeight(placement);

   if(placement.mode==='roofClad'||placement.mode==='roofFrame'){
    const sameRoof=!roofRegion||!placement.roofRegionKey||placement.roofRegionKey===roofRegion;
    if(sameRoof&&distance<=8.5&&maxY>=py+.65&&minY<=py+7.0)next.add(placement);
    continue;
   }

   if(placement.mode!=='wall'&&placement.mode!=='frame'&&placement.mode!=='beam'&&placement.mode!=='angle')continue;
   if(distance>6.8)continue;
   if(maxY<py+.10||minY>py+4.6)continue;

   const cameraSide=dx*cameraX+dz*cameraZ;
   const sideDistance=Math.abs(dx*cameraZ-dz*cameraX);
   if(cameraSide>=-.35&&sideDistance<=4.6)next.add(placement);
  }

  this.targetPlacements=next;
 }

 ensureMeshState(mesh){
  let state=this.meshState.get(mesh);
  if(state)return state;

  const originalMaterial=mesh.material;
  if(!originalMaterial)return null;
  const originals=Array.isArray(originalMaterial)?originalMaterial:[originalMaterial];
  const owned=originals.map(material=>material?.clone?.()||material);
  mesh.material=Array.isArray(originalMaterial)?owned:owned[0];

  state={
   originalMaterial,
   materials:owned,
   base:owned.map((material,index)=>({
    opacity:Number.isFinite(originals[index]?.opacity)?originals[index].opacity:1,
    transparent:!!originals[index]?.transparent,
    depthWrite:originals[index]?.depthWrite!==false
   })),
   opacity:1,
   target:1,
   castShadow:mesh.castShadow
  };
  this.meshState.set(mesh,state);
  this.knownMeshes.add(mesh);
  return state;
 }

 setPlacementTarget(placement,faded){
  placement?.object?.traverse?.(child=>{
   if(!child?.isMesh||!child.material)return;
   const state=this.ensureMeshState(child);
   if(state)state.target=faded?this.fadeOpacity:1;
  });
 }

 applyMesh(mesh,state,dt){
  const blend=1-Math.exp(-this.fadeSpeed*dt);
  state.opacity+=(state.target-state.opacity)*blend;
  if(Math.abs(state.opacity-state.target)<.004)state.opacity=state.target;

  const faded=state.opacity<.995;
  for(let i=0;i<state.materials.length;i++){
   const material=state.materials[i];
   if(!material)continue;
   const base=state.base[i];
   material.transparent=faded||base.transparent;
   material.opacity=base.opacity*state.opacity;
   material.depthWrite=faded?false:base.depthWrite;
   material.needsUpdate=true;
  }
  mesh.castShadow=faded?false:state.castShadow;
 }

 restoreMesh(mesh,hard=false){
  const state=this.meshState.get(mesh);
  if(!state)return;
  if(hard){
   mesh.material=state.originalMaterial;
   mesh.castShadow=state.castShadow;
   return;
  }
  state.target=1;
 }

 update(dt){
  this.refreshTimer-=dt;
  if(this.refreshTimer<=0){
   this.refreshTimer=this.refreshInterval;
   this.rebuildTargets();

   const active=new Set();
   for(const placement of this.activePlacements()){
    const faded=this.targetPlacements.has(placement);
    this.setPlacementTarget(placement,faded);
    placement.object?.traverse?.(child=>{if(child?.isMesh&&child.material)active.add(child);});
   }
   for(const mesh of this.knownMeshes){
    if(!active.has(mesh))this.restoreMesh(mesh,false);
   }
  }

  for(const mesh of this.knownMeshes){
   const state=this.meshState.get(mesh);
   if(state)this.applyMesh(mesh,state,dt);
  }
 }
}
