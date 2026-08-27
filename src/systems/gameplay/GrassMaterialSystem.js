export class GrassMaterialSystem{
 constructor(THREE,{materials,player}){
  this.T=THREE;
  this.materials=materials;
  this.player=player;
  this.stemGeometry=new THREE.CylinderGeometry(.022,.034,.92,5,1,false);
  this.tieGeometry=new THREE.TorusGeometry(.115,.022,5,10);
  this.stemMaterial=new THREE.MeshLambertMaterial({color:0x719447});
  this.tipMaterial=new THREE.MeshLambertMaterial({color:0x94ad55});
  this.tieMaterial=new THREE.MeshLambertMaterial({color:0x8a6841});
 }

 initialize(){
  if(!this.materials)return;
  this.materials.makeGrassBundleVisual=()=>this.makeBundleVisual();
  this.materials.createCarriedGrassBundle=()=>this.createCarriedBundle();
 }

 makeBundleVisual(){
  const T=this.T;
  const group=new T.Group();
  group.name='HarvestedGrassBundle';

  for(let i=0;i<11;i++){
   const stem=new T.Mesh(this.stemGeometry,i%3===0?this.tipMaterial:this.stemMaterial);
   const angle=i*.93;
   const radius=.045+(i%4)*.014;
   stem.position.set(Math.cos(angle)*radius,(i%3-.8)*.018,Math.sin(angle)*radius);
   stem.rotation.set((i%2?1:-1)*.035,angle*.12,(i%3-1)*.035);
   stem.castShadow=false;
   stem.receiveShadow=true;
   group.add(stem);
  }

  const tie=new T.Mesh(this.tieGeometry,this.tieMaterial);
  tie.rotation.x=Math.PI/2;
  tie.position.y=-.07;
  tie.castShadow=false;
  group.add(tie);
  group.userData.rawMaterialType='grass';
  return group;
 }

 createCarriedBundle(){
  const materials=this.materials;
  if(!materials||materials.carried||!this.player)return null;

  const object=this.makeBundleVisual();
  const id=materials.nextId++;
  object.userData.rawMaterialId=id;
  this.player.add(object);
  object.position.set(.02,1.16,.58);
  object.rotation.set(.18,.04,-.86);

  const item={
   id,
   type:'grass',
   object,
   state:'carried',
   radius:.34,
   stackHeight:.30,
   carryMotion:null,
   physics:null
  };
  materials.items.push(item);
  materials.carried=item;
  materials.updateHud?.();
  return item;
 }
}
