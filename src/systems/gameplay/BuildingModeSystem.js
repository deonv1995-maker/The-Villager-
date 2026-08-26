export class BuildingModeSystem{
 constructor(THREE,{world,scene,player,materials,button=null,feedbackElement=null}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.materials=materials;
  this.button=button;
  this.feedbackElement=feedbackElement;

  // RAW preserves the free-placement behaviour needed for fires and other future
  // material reactions. The four construction modes transform one carried log
  // into structural pieces instead of spawning prefab buildings.
  this.modes=['raw','floor','frame','wall','angle'];
  this.modeIndex=0;
  this.root=new THREE.Group();
  this.root.name='LogConstructionPieces';
  this.placements=[];
  this.nextPlacementId=1;
  this.placeDistance=1.90;
  this.feedbackTimer=null;

  this.onButton=e=>{
   e?.preventDefault?.();
   e?.stopPropagation?.();
   this.cycleMode();
  };
 }

 initialize(){
  this.scene.add(this.root);
  this.world.buildModes=this;
  this.button?.addEventListener('pointerdown',this.onButton,{passive:false});
  this.updateButton();
 }

 dispose(){
  this.button?.removeEventListener('pointerdown',this.onButton);
 }

 get mode(){return this.modes[this.modeIndex];}

 modeLabel(mode=this.mode){
  if(mode==='raw')return 'RAW';
  if(mode==='floor')return 'FLOOR';
  if(mode==='frame')return 'FRAME';
  if(mode==='wall')return 'WALL';
  return 'ANGLE';
 }

 cycleMode(){
  this.modeIndex=(this.modeIndex+1)%this.modes.length;
  this.updateButton();
  this.showFeedback(`Log mode: ${this.modeLabel()}`);
 }

 updateButton(){
  if(!this.button)return;
  this.button.textContent=this.modeLabel();
  this.button.dataset.buildMode=this.mode;
 }

 showFeedback(text){
  if(!this.feedbackElement||!text)return;
  this.feedbackElement.textContent=text;
  this.feedbackElement.classList.add('show');
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>this.feedbackElement.classList.remove('show'),720);
 }

 snapQuarter(value){return Math.round(value*4)/4;}
 snapYaw(yaw,step=Math.PI/4){return Math.round(yaw/step)*step;}

 placementBase(distance=this.placeDistance){
  const yaw=this.player.rotation.y;
  const x=this.snapQuarter(this.player.position.x+Math.sin(yaw)*distance);
  const z=this.snapQuarter(this.player.position.z+Math.cos(yaw)*distance);
  return {
   x,z,
   ground:this.world.heightAt(x,z),
   yaw:this.snapYaw(yaw)
  };
 }

 placementAllowed(x,z){
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(x,z))return false;
  if(this.world?.environment?.terrainClearance?.(x,z))return false;
  return true;
 }

 clearAuthoredGrass(x,z,radius=1.15){
  const root=this.world?.environment?.root;
  if(!root)return;
  const p=new this.T.Vector3();
  const r2=radius*radius;
  for(const object of root.children){
   if(object.userData?.environmentType!=='grass'||object.visible===false)continue;
   object.getWorldPosition(p);
   const dx=p.x-x,dz=p.z-z;
   if(dx*dx+dz*dz<r2)object.visible=false;
  }
 }

 registerStructureCollider(object,{standable=false,radiusScale=.46,standRadiusScale=.92}={}){
  if(!this.world?.registerRockColliderFromObject||!object)return null;
  object.updateWorldMatrix?.(true,true);
  return this.world.registerRockColliderFromObject(object,{
   owner:'player-construction',
   radiusScale,
   minRadius:.16,
   maxRadius:1.35,
   verticalInset:.01,
   standable,
   standRadiusScale,
   supportInsetScale:.025,
   minSupportInset:.01,
   maxSupportInset:.04
  });
 }

 recordPlacement(mode,object,x,z,yaw,standable=false){
  object.userData.playerConstruction=true;
  object.userData.constructionMode=mode;
  this.root.add(object);
  object.updateWorldMatrix(true,true);

  const box=new this.T.Box3().setFromObject(object);
  const placement={
   id:this.nextPlacementId++,mode,object,x,z,yaw,
   minY:box.min.y,maxY:box.max.y,
   standable
  };
  this.placements.push(placement);
  this.registerStructureCollider(object,{standable});
  return placement;
 }

 consumeCarriedLog(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return false;
  return this.materials.consume(item);
 }

 makeFloor(base){
  const T=this.T;
  const group=new T.Group();
  group.name='SplitLogFloor';

  // One whole log becomes two lengthwise halves. Their rounded sides sit against
  // the ground and the newly cut faces point upward to create a walkable surface.
  for(const offset of [-.28,.28]){
   const half=this.materials.makeHalfLogVisual();
   half.position.z=offset;
   group.add(half);
  }

  group.position.set(base.x,base.ground+.275,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 makeFrame(base){
  const T=this.T;
  const group=new T.Group();
  group.name='UprightLogFrame';
  const log=this.materials.makeLogVisual();
  log.rotation.z=Math.PI/2;
  group.add(log);
  group.position.set(base.x,base.ground+1.12,base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 yawDelta(a,b){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));}

 wallBaseHeight(base){
  let best=null;
  let bestDistance=.58;
  for(const placement of this.placements){
   if(placement.mode!=='wall')continue;
   if(this.yawDelta(placement.yaw,base.yaw)>.14)continue;
   const d=Math.hypot(placement.x-base.x,placement.z-base.z);
   if(d<bestDistance){best=placement;bestDistance=d;}
  }
  return best?best.maxY+.02:base.ground+.26;
 }

 makeWall(base){
  const T=this.T;
  const group=new T.Group();
  group.name='SplitLogWallSection';

  // The two lengthwise halves are turned so their cut faces become the wall
  // faces, then stacked. Repeating WALL at the same snapped location stacks the
  // next pair on top, allowing walls to grow between framework posts.
  for(const y of [0,.50]){
   const half=this.materials.makeHalfLogVisual();
   half.rotation.x=Math.PI/2;
   half.position.y=y;
   group.add(half);
  }

  group.position.set(base.x,this.wallBaseHeight(base),base.z);
  group.rotation.y=base.yaw;
  return group;
 }

 makeAngle(base){
  const T=this.T;
  const group=new T.Group();
  group.name='AngledLog';
  const log=this.materials.makeLogVisual();
  log.rotation.z=Math.PI/4;
  group.add(log);

  // Rotate the log's long axis into the Ranger's forward direction, then pitch it
  // by 45 degrees. This is the common primitive for stairs and pitched roofing.
  group.position.set(base.x,base.ground+1.02,base.z);
  group.rotation.y=base.yaw-Math.PI/2;
  return group;
 }

 actionLabel(){
  if(this.mode==='raw')return 'PLACE LOG';
  return `PLACE ${this.modeLabel()}`;
 }

 placeCarriedLog(){
  const item=this.materials?.carried;
  if(!item||item.type!=='log')return null;

  if(this.mode==='raw')return this.materials.placeCarried();

  const base=this.placementBase();
  if(!this.placementAllowed(base.x,base.z))return null;

  let object=null;
  let standable=false;
  if(this.mode==='floor'){
   object=this.makeFloor(base);
   standable=true;
  }else if(this.mode==='frame'){
   object=this.makeFrame(base);
  }else if(this.mode==='wall'){
   object=this.makeWall(base);
  }else if(this.mode==='angle'){
   object=this.makeAngle(base);
  }
  if(!object)return null;

  if(!this.consumeCarriedLog())return null;
  const placement=this.recordPlacement(
   this.mode,object,base.x,base.z,object.rotation.y,standable
  );
  this.clearAuthoredGrass(base.x,base.z,this.mode==='floor'?1.35:.85);
  return placement;
 }
}
