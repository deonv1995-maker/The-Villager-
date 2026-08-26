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
  const halfLog=new THREE.ExtrudeGeometry(halfShape,{depth:2.20,bevelEnabled:false,steps:1});
  halfLog.translate(0,0,-1.10);
  halfLog.rotateY(Math.PI/2);
  halfLog.computeVertexNormals();

  this.geometry={
   log:new THREE.CylinderGeometry(.22,.27,2.20,8,1,false),
   cut:new THREE.CylinderGeometry(.225,.225,.012,8,1,false),
   stone:new THREE.IcosahedronGeometry(.34,0),
   halfLog,
   splitFace:new THREE.BoxGeometry(2.20,.018,.52)
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
  const trunk=new T.Mesh(this.geometry.log,this.materials.bark);
  trunk.rotation.z=Math.PI/2;
  trunk.castShadow=false;
  trunk.receiveShadow=true;
  group.add(trunk);

  for(const x of [-1.106,1.106]){
   const cut=new T.Mesh(this.geometry.cut,this.materials.cut);
   cut.rotation.z=Math.PI/2;
   cut.position.x=x;
   cut.castShadow=false;
   cut.receiveShadow=true;
   group.add(cut);
  }
  return group;
 }

 // Shared factory for structural half logs. The rounded bark surface remains on
 // the underside while a thin lighter cut face makes the split visually obvious.
 // Building modes reuse this factory rather than owning duplicate log geometry.
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
   radius:type==='log'?1.05:.42,
   stackHeight:.46
  };
  this.items.push(item);
  return item;
 }

 spawnLog(x,z,yaw=0){
  const y=(this.world?.heightAt?.(x,z)??0)+.25;
  return this.createItem('log',x,y,z,yaw);
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
  if(this.carried||!item||item.state!=='loose'||!item.object?.parent)return false;
  item.object.removeFromParent();
  this.player.add(item.object);
  item.state='carried';
  this.carried=item;

  if(item.type==='log'){
   item.object.position.set(0,1.05,.72);
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
  let y=(this.world?.heightAt?.(x,z)??0)+(item.type==='log' ? .25 : .24);
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
  item.object.position.set(target.x,target.y,target.z);
  item.object.rotation.set(0,target.rotationY,0);
  item.state='placed';
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
  this.updateHud();
  return true;
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
