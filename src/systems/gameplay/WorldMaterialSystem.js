export class WorldMaterialSystem{
 constructor(THREE,{world,scene,player,hudRoot=null}){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.hudRoot=hudRoot;

  this.root=new THREE.Group();
  this.root.name='PhysicalRawMaterials';
  this.items=[];
  this.nextId=1;
  this.carried=null;
  this.pickupRange=2.45;
  this.placeDistance=1.65;

  // One authoritative physical log size. Building, harvesting and previews all
  // derive from this value so a log never changes length between gameplay states.
  this.logLength=2.90;
  this.logHalfLength=this.logLength*.5;
  this.logRadius=.27;

  // Lightweight terrain rigid-body approximation for loose harvested logs.
  // This deliberately avoids a general physics engine: only moving logs are
  // simulated, which keeps the mobile cost proportional to recent harvesting.
  this.logGravity=18.5;
  this.logBounce=.22;
  this.logGroundDrag=3.15;
  this.logAirDrag=.22;
  this.logSlopeForce=5.2;
  this.logMaxSpeed=6.4;
  this.logSettleSpeed=.19;
  this.logSettleTime=.65;
  this.logGroundProbe=.68;

  this.materials={
   bark:new THREE.MeshStandardMaterial({color:0x6f472c,roughness:.96,metalness:0,flatShading:true}),
   cut:new THREE.MeshStandardMaterial({color:0xb98555,roughness:.92,metalness:0}),
   stone:new THREE.MeshStandardMaterial({color:0x747d78,roughness:.97,metalness:0,flatShading:true})
  };

  const halfShape=new THREE.Shape();
  const halfRadius=.26;
  halfShape.moveTo(-halfRadius,0);
  halfShape.lineTo(halfRadius,0);
  for(let i=0;i<=10;i++){
   const a=-i/10*Math.PI;
   halfShape.lineTo(Math.cos(a)*halfRadius,Math.sin(a)*halfRadius);
  }
  halfShape.closePath();
  const halfLog=new THREE.ExtrudeGeometry(halfShape,{
   depth:this.logLength,
   bevelEnabled:false,
   steps:1
  });
  halfLog.translate(0,0,-this.logHalfLength);
  halfLog.rotateY(Math.PI/2);
  halfLog.computeVertexNormals();

  this.geometry={
   log:new THREE.CylinderGeometry(.22,this.logRadius,this.logLength,8,1,false),
   cut:new THREE.CylinderGeometry(.225,.225,.012,8,1,false),
   stone:new THREE.IcosahedronGeometry(.34,0),
   halfLog,
   splitFace:new THREE.BoxGeometry(this.logLength,.018,.52)
  };
  this.tempPosition=new THREE.Vector3();
 }

 initialize(){
  this.scene.add(this.root);
  this.world.materials=this;
  this.updateHud();
 }

 makeLogVisual(){
  const T=this.T;
  const group=new T.Group();
  group.name='RawLog';

  // Keep yaw/translation on the root and cylinder rolling on a child. Rotating
  // the child around local X makes a loose log visibly roll without corrupting
  // the heading used by building placement and physics.
  const rollGroup=new T.Group();
  rollGroup.name='LogRollVisual';
  group.add(rollGroup);
  group.userData.rollGroup=rollGroup;

  const trunk=new T.Mesh(this.geometry.log,this.materials.bark);
  trunk.rotation.z=Math.PI/2;
  trunk.castShadow=false;
  trunk.receiveShadow=true;
  rollGroup.add(trunk);

  const capX=this.logHalfLength+.006;
  for(const x of [-capX,capX]){
   const cut=new T.Mesh(this.geometry.cut,this.materials.cut);
   cut.rotation.z=Math.PI/2;
   cut.position.x=x;
   cut.castShadow=false;
   cut.receiveShadow=true;
   rollGroup.add(cut);
  }
  return group;
 }

 // Shared factory for structural half logs. The rounded bark surface remains on
 // the underside while a thin lighter cut face makes the split visually obvious.
 makeHalfLogVisual(){
  const T=this.T;
  const group=new T.Group();
  group.name='SplitHalfLog';
  const half=new T.Mesh(this.geometry.halfLog,this.materials.bark);
  half.castShadow=false;
  half.receiveShadow=true;
  group.add(half);

  const face=new T.Mesh(this.geometry.splitFace,this.materials.cut);
  face.position.y=.008;
  face.castShadow=false;
  face.receiveShadow=true;
  group.add(face);
  return group;
 }

 makeStoneVisual(seed=0){
  const mesh=new this.T.Mesh(this.geometry.stone,this.materials.stone);
  mesh.name='RawStone';
  mesh.scale.set(1.05+(seed%3)*.07,.72+((seed+1)%3)*.06,.92+((seed+2)%3)*.08);
  mesh.rotation.set((seed%5)*.08,(seed%7)*.29,(seed%4)*.07);
  mesh.castShadow=false;
  mesh.receiveShadow=true;
  return mesh;
 }

 createItem(type,x,y,z,yaw=0){
  const object=type==='log'?this.makeLogVisual():this.makeStoneVisual(this.nextId);
  object.position.set(x,y,z);
  object.rotation.y+=yaw;
  object.userData.rawMaterialType=type;
  object.userData.rawMaterialId=this.nextId;
  this.root.add(object);

  const item={
   id:this.nextId++,
   type,
   object,
   state:'loose',
   radius:type==='log'?this.logLength*.48:.42,
   stackHeight:.46,
   physics:type==='log'?{
    active:false,
    vx:0,vy:0,vz:0,
    spinY:0,
    rollSpeed:0,
    settleTimer:0,
    grounded:false
   }:null
  };
  this.items.push(item);
  return item;
 }

 resetLogVisualRoll(item){
  const roll=item?.object?.userData?.rollGroup;
  if(roll)roll.rotation.x=0;
 }

 spawnLog(x,z,yaw=0){
  const y=(this.world?.heightAt?.(x,z)??0)+this.logRadius;
  return this.createItem('log',x,y,z,yaw);
 }

 spawnPhysicalLog(x,y,z,yaw=0,velocity={}){
  const item=this.createItem('log',x,y,z,yaw);
  const physics=item.physics;
  physics.active=true;
  physics.vx=Number.isFinite(velocity.vx)?velocity.vx:0;
  physics.vy=Number.isFinite(velocity.vy)?velocity.vy:0;
  physics.vz=Number.isFinite(velocity.vz)?velocity.vz:0;
  physics.spinY=Number.isFinite(velocity.spinY)?velocity.spinY:0;
  physics.rollSpeed=Number.isFinite(velocity.rollSpeed)?velocity.rollSpeed:0;
  physics.settleTimer=0;
  return item;
 }

 spawnStone(x,z){
  const y=(this.world?.heightAt?.(x,z)??0)+.24;
  return this.createItem('stone',x,y,z,0);
 }

 activeItems(type=null){
  return this.items.filter(item=>item.state!=='consumed'&&(!type||item.type===type));
 }

 placedItems(type=null){
  return this.items.filter(item=>item.state==='placed'&&(!type||item.type===type));
 }

 looseItems(type=null){
  return this.items.filter(item=>item.state==='loose'&&(!type||item.type===type));
 }

 findNearestLoose(range=this.pickupRange){
  if(!this.player)return null;
  const px=this.player.position.x,pz=this.player.position.z;
  const yaw=this.player.rotation.y;
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  let best=null,bestScore=Infinity;

  for(const item of this.items){
   if(item.state!=='loose'||!item.object?.parent)continue;
   // Let freshly fallen logs finish rolling before they can be picked up.
   if(item.physics?.active)continue;
   item.object.getWorldPosition(this.tempPosition);
   const dx=this.tempPosition.x-px,dz=this.tempPosition.z-pz;
   const distance=Math.hypot(dx,dz);
   if(distance>range)continue;
   const dot=(dx*fx+dz*fz)/Math.max(.001,distance);
   if(distance>1.15&&dot<-.18)continue;
   const score=distance-dot*.28;
   if(score<bestScore){best=item;bestScore=score;}
  }
  return best;
 }

 pickup(item){
  if(this.carried||!item||item.state!=='loose'||!item.object?.parent||item.physics?.active)return false;
  item.object.removeFromParent();
  this.player.add(item.object);
  item.state='carried';
  this.carried=item;

  if(item.type==='log'){
   if(item.physics){item.physics.active=false;item.physics.vx=item.physics.vy=item.physics.vz=0;}
   this.resetLogVisualRoll(item);
   // Across the torso so the Ranger's two procedural hand targets grip the log.
   item.object.position.set(0,1.24,.76);
   item.object.rotation.set(0,0,0);
  }else{
   item.object.position.set(.48,1.08,.48);
   item.object.rotation.set(.18,0,.12);
  }
  this.updateHud();
  return true;
 }

 placementTarget(item){
  const yaw=this.player.rotation.y;
  let x=this.player.position.x+Math.sin(yaw)*this.placeDistance;
  let z=this.player.position.z+Math.cos(yaw)*this.placeDistance;
  let y=(this.world?.heightAt?.(x,z)??0)+(item.type==='log'?this.logRadius:.24);
  let rotationY=item.type==='log'
   ?Math.round(yaw/(Math.PI/4))*(Math.PI/4)
   :yaw;

  if(item.type==='stone'){
   let stack=null,stackDistance=.62;
   for(const other of this.placedItems('stone')){
    const d=Math.hypot(other.object.position.x-x,other.object.position.z-z);
    if(d<stackDistance){stack=other;stackDistance=d;}
   }
   if(stack){
    x=stack.object.position.x;
    z=stack.object.position.z;
    y=stack.object.position.y+stack.stackHeight*.76;
   }
  }

  return {x,y,z,rotationY};
 }

 placeCarried(){
  const item=this.carried;
  if(!item)return null;
  const target=this.placementTarget(item);
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(target.x,target.z))return null;
  if(this.world?.environment?.terrainClearance?.(target.x,target.z))return null;

  item.object.removeFromParent();
  this.root.add(item.object);
  this.resetLogVisualRoll(item);
  item.object.position.set(target.x,target.y,target.z);
  item.object.rotation.set(0,target.rotationY,0);
  item.state='placed';
  if(item.physics){
   item.physics.active=false;
   item.physics.vx=item.physics.vy=item.physics.vz=0;
   item.physics.spinY=item.physics.rollSpeed=0;
  }
  this.carried=null;
  this.updateHud();
  return item;
 }

 returnPlacedToLoose(item){
  if(!item||item.state!=='placed')return false;
  item.state='loose';
  return true;
 }

 consume(item){
  if(!item||item.state==='consumed')return false;
  if(this.carried===item)this.carried=null;
  item.object?.removeFromParent?.();
  item.state='consumed';
  if(item.physics)item.physics.active=false;
  this.updateHud();
  return true;
 }

 logAxis(item){
  const yaw=item.object.rotation.y||0;
  return {x:Math.cos(yaw),z:-Math.sin(yaw)};
 }

 terrainLogSupportY(item,x,z){
  const axis=this.logAxis(item);
  const reach=this.logHalfLength*.86;
  const heightAt=(px,pz)=>this.world?.heightAt?.(px,pz)??0;
  const h0=heightAt(x,z);
  const h1=heightAt(x+axis.x*reach,z+axis.z*reach);
  const h2=heightAt(x-axis.x*reach,z-axis.z*reach);
  return Math.max(h0,h1,h2)+this.logRadius;
 }

 terrainDownhill(x,z){
  const e=this.logGroundProbe;
  const heightAt=(px,pz)=>this.world?.heightAt?.(px,pz)??0;
  return {
   x:(heightAt(x-e,z)-heightAt(x+e,z))/(2*e),
   z:(heightAt(x,z-e)-heightAt(x,z+e))/(2*e)
  };
 }

 updateLogPhysics(item,dt){
  const p=item.physics,object=item.object;
  if(!p?.active||item.state!=='loose'||!object?.parent)return;

  p.vy-=this.logGravity*dt;

  let nx=object.position.x+p.vx*dt;
  let nz=object.position.z+p.vz*dt;
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(nx,nz)){
   p.vx*=-.28;
   p.vz*=-.28;
   nx=object.position.x+p.vx*dt;
   nz=object.position.z+p.vz*dt;
  }

  object.position.x=nx;
  object.position.z=nz;
  object.position.y+=p.vy*dt;
  object.rotation.y+=p.spinY*dt;

  const supportY=this.terrainLogSupportY(item,nx,nz);
  let grounded=false;
  if(object.position.y<=supportY){
   const impact=Math.max(0,-p.vy);
   object.position.y=supportY;
   grounded=true;
   p.grounded=true;

   if(impact>1.15)p.vy=impact*this.logBounce;
   else p.vy=0;

   const downhill=this.terrainDownhill(nx,nz);
   p.vx+=downhill.x*this.logSlopeForce*dt;
   p.vz+=downhill.z*this.logSlopeForce*dt;

   const drag=Math.exp(-this.logGroundDrag*dt);
   p.vx*=drag;
   p.vz*=drag;
   p.spinY*=Math.exp(-2.8*dt);
  }else{
   p.grounded=false;
   const drag=Math.exp(-this.logAirDrag*dt);
   p.vx*=drag;
   p.vz*=drag;
   p.spinY*=Math.exp(-.42*dt);
  }

  const horizontalSpeed=Math.hypot(p.vx,p.vz);
  if(horizontalSpeed>this.logMaxSpeed){
   const k=this.logMaxSpeed/horizontalSpeed;
   p.vx*=k;p.vz*=k;
  }

  const axis=this.logAxis(item);
  const sideX=-axis.z,sideZ=axis.x;
  const sideways=p.vx*sideX+p.vz*sideZ;
  const physicalRoll=sideways/Math.max(.08,this.logRadius);
  const rollGroup=object.userData?.rollGroup;
  if(rollGroup)rollGroup.rotation.x+=(physicalRoll+p.rollSpeed)*dt;
  p.rollSpeed*=Math.exp(-(grounded?3.4:.65)*dt);

  if(grounded&&Math.hypot(p.vx,p.vz)<this.logSettleSpeed&&Math.abs(p.vy)<.12&&Math.abs(p.spinY)<.12){
   p.settleTimer+=dt;
   if(p.settleTimer>=this.logSettleTime){
    p.active=false;
    p.vx=p.vy=p.vz=0;
    p.spinY=p.rollSpeed=0;
    p.settleTimer=0;
    object.position.y=this.terrainLogSupportY(item,object.position.x,object.position.z);
   }
  }else p.settleTimer=0;
 }

 update(dt){
  for(const item of this.items){
   if(item.type==='log'&&item.physics?.active)this.updateLogPhysics(item,dt);
  }
 }

 updateHud(){
  if(!this.hudRoot)return;
  if(!this.carried){
   this.hudRoot.textContent='HANDS EMPTY · gather and place raw materials';
   return;
  }
  this.hudRoot.textContent=`CARRYING ${this.carried.type.toUpperCase()} · place it in the world`;
 }
}
