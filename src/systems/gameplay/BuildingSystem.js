import {BUILDING_CATALOG,buildingDefinition} from './BuildingCatalog.js?v=563';

export class BuildingSystem{
 constructor(THREE,{
  world,scene,player,inventory,harvesting=null,
  actionButton=null,buildButton=null,menuRoot=null,feedbackElement=null
 }){
  this.T=THREE;
  this.world=world;
  this.scene=scene;
  this.player=player;
  this.inventory=inventory;
  this.harvesting=harvesting;
  this.actionButton=actionButton;
  this.buildButton=buildButton;
  this.menuRoot=menuRoot;
  this.feedbackElement=feedbackElement;

  this.root=new THREE.Group();
  this.root.name='PlayerBuildings';
  this.active=false;
  this.selectedId='wood_floor';
  this.preview=null;
  this.previewValid=false;
  this.previewAffordable=false;
  this.placements=[];
  this.feedbackTimer=null;

  this.previewMaterial=new THREE.MeshBasicMaterial({
   color:0x62c96a,
   transparent:true,
   opacity:.48,
   depthWrite:false
  });
  this.materials={
   wood:new THREE.MeshStandardMaterial({color:0x8a5b37,roughness:.92,metalness:0}),
   woodDark:new THREE.MeshStandardMaterial({color:0x5d3c27,roughness:.94,metalness:0}),
   stone:new THREE.MeshStandardMaterial({color:0x737b77,roughness:.96,metalness:0,flatShading:true}),
   ember:new THREE.MeshBasicMaterial({color:0xf4a34a})
  };
  this.geometry={
   floor:new THREE.BoxGeometry(2.8,.18,2.8),
   floorTrim:new THREE.BoxGeometry(2.86,.09,.12),
   log:new THREE.BoxGeometry(1.35,.18,.24),
   stone:new THREE.IcosahedronGeometry(.24,0),
   ember:new THREE.CylinderGeometry(.42,.52,.06,12)
  };

  this.onBuildPress=e=>{
   e.preventDefault();
   e.stopPropagation();
   this.setActive(!this.active);
  };
  this.onActionPress=e=>{
   if(!this.active)return;
   e.preventDefault();
   e.stopPropagation();
   this.placeSelected();
  };
  this.onMenuPress=e=>{
   const button=e.target.closest?.('[data-building-id]');
   if(!button)return;
   e.preventDefault();
   e.stopPropagation();
   this.select(button.dataset.buildingId);
  };
 }

 initialize(){
  this.scene.add(this.root);
  this.world.buildings=this;
  this.buildButton?.addEventListener('pointerdown',this.onBuildPress,{passive:false});
  this.actionButton?.addEventListener('pointerdown',this.onActionPress,{passive:false});
  this.menuRoot?.addEventListener('pointerdown',this.onMenuPress,{passive:false});
  this.populateMenu();
  this.setActive(false);
 }

 dispose(){
  this.buildButton?.removeEventListener('pointerdown',this.onBuildPress);
  this.actionButton?.removeEventListener('pointerdown',this.onActionPress);
  this.menuRoot?.removeEventListener('pointerdown',this.onMenuPress);
 }

 populateMenu(){
  if(!this.menuRoot)return;
  this.menuRoot.innerHTML='';
  for(const definition of Object.values(BUILDING_CATALOG)){
   const button=document.createElement('button');
   button.type='button';
   button.dataset.buildingId=definition.id;
   button.dataset.gameUi='true';
   button.className='build-choice';
   button.innerHTML=`<strong>${definition.shortLabel}</strong><span>${this.inventory.formatCost(definition.cost)}</span>`;
   this.menuRoot.appendChild(button);
  }
  this.updateMenuSelection();
 }

 updateMenuSelection(){
  if(!this.menuRoot)return;
  for(const button of this.menuRoot.querySelectorAll('[data-building-id]')){
   button.classList.toggle('selected',button.dataset.buildingId===this.selectedId);
  }
 }

 select(id){
  if(!buildingDefinition(id)||id===this.selectedId)return;
  this.selectedId=id;
  this.destroyPreview();
  this.updateMenuSelection();
 }

 setActive(active){
  this.active=!!active;
  this.harvesting?.setEnabled(!this.active);
  this.menuRoot?.classList.toggle('open',this.active);
  if(this.buildButton)this.buildButton.textContent=this.active?'CANCEL':'BUILD';

  if(!this.active){
   this.destroyPreview();
   this.actionButton?.classList.add('hidden-action');
   if(this.actionButton)this.actionButton.disabled=true;
  }else{
   this.ensurePreview();
   this.updatePreview();
  }
 }

 showFeedback(text){
  if(!this.feedbackElement)return;
  this.feedbackElement.textContent=text;
  this.feedbackElement.classList.add('show');
  clearTimeout(this.feedbackTimer);
  this.feedbackTimer=setTimeout(()=>this.feedbackElement.classList.remove('show'),850);
 }

 makeWoodFloor(preview=false){
  const T=this.T;
  const group=new T.Group();
  const floor=new T.Mesh(this.geometry.floor,preview?this.previewMaterial:this.materials.wood);
  floor.receiveShadow=true;
  floor.castShadow=false;
  group.add(floor);

  if(!preview){
   for(const z of [-1.33,1.33]){
    const trim=new T.Mesh(this.geometry.floorTrim,this.materials.woodDark);
    trim.position.set(0,.10,z);
    trim.receiveShadow=true;
    trim.castShadow=false;
    group.add(trim);
   }
  }
  return group;
 }

 makeCampfire(preview=false){
  const T=this.T;
  const group=new T.Group();
  const material=preview?this.previewMaterial:null;

  for(let i=0;i<8;i++){
   const angle=i/8*Math.PI*2;
   const stone=new T.Mesh(this.geometry.stone,material||this.materials.stone);
   stone.position.set(Math.cos(angle)*.62,.18,Math.sin(angle)*.62);
   stone.scale.set(1.15,.72,1);
   stone.receiveShadow=true;
   stone.castShadow=false;
   group.add(stone);
  }

  const logA=new T.Mesh(this.geometry.log,material||this.materials.woodDark);
  const logB=new T.Mesh(this.geometry.log,material||this.materials.woodDark);
  logA.position.y=.24;logB.position.y=.24;
  logA.rotation.y=Math.PI*.25;logB.rotation.y=-Math.PI*.25;
  logA.receiveShadow=true;logB.receiveShadow=true;
  logA.castShadow=false;logB.castShadow=false;
  group.add(logA,logB);

  const ember=new T.Mesh(this.geometry.ember,material||this.materials.ember);
  ember.position.y=.09;
  ember.receiveShadow=false;
  ember.castShadow=false;
  group.add(ember);
  return group;
 }

 createVisual(definition,preview=false){
  if(definition.renderer==='campfire')return this.makeCampfire(preview);
  return this.makeWoodFloor(preview);
 }

 ensurePreview(){
  if(!this.active||this.preview)return;
  const definition=buildingDefinition(this.selectedId);
  if(!definition)return;
  this.preview=this.createVisual(definition,true);
  this.preview.name='BuildingPlacementPreview';
  this.scene.add(this.preview);
 }

 destroyPreview(){
  if(!this.preview)return;
  this.scene.remove(this.preview);
  this.preview=null;
 }

 placementTransform(definition){
  const yaw=this.player.rotation.y;
  const x=this.player.position.x+Math.sin(yaw)*definition.placementDistance;
  const z=this.player.position.z+Math.cos(yaw)*definition.placementDistance;
  const snappedX=Math.round(x*2)/2;
  const snappedZ=Math.round(z*2)/2;
  const snappedYaw=Math.round(yaw/(Math.PI*.5))*(Math.PI*.5);
  const y=this.world.heightAt(snappedX,snappedZ)+definition.heightOffset;
  return {x:snappedX,y,z:snappedZ,yaw:snappedYaw};
 }

 groundDeltaAt(x,z,radius){
  const center=this.world.heightAt(x,z);
  let maxDelta=0;
  for(const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){
   maxDelta=Math.max(maxDelta,Math.abs(this.world.heightAt(x+dx,z+dz)-center));
  }
  return maxDelta;
 }

 overlapsExisting(x,z,radius){
  for(const placed of this.placements){
   if(Math.hypot(x-placed.x,z-placed.z)<radius+placed.radius-.10)return true;
  }
  return false;
 }

 placementAllowed(definition,transform){
  const {x,z}=transform;
  if(this.world?.isWithinPlayableBounds&&!this.world.isWithinPlayableBounds(x,z))return false;
  if(this.world?.environment?.terrainClearance?.(x,z))return false;
  if(this.groundDeltaAt(x,z,definition.footprintRadius*.72)>definition.maxGroundDelta)return false;
  if(this.overlapsExisting(x,z,definition.footprintRadius))return false;
  return true;
 }

 updatePreview(){
  if(!this.active)return;
  this.ensurePreview();
  const definition=buildingDefinition(this.selectedId);
  if(!definition||!this.preview)return;

  const transform=this.placementTransform(definition);
  this.preview.position.set(transform.x,transform.y,transform.z);
  this.preview.rotation.y=transform.yaw;

  this.previewValid=this.placementAllowed(definition,transform);
  this.previewAffordable=this.inventory.canAfford(definition.cost);
  const ready=this.previewValid&&this.previewAffordable;
  this.previewMaterial.color.setHex(ready?0x62c96a:0xd45a52);
  this.previewMaterial.opacity=ready ? .50 : .40;

  if(this.actionButton){
   this.actionButton.classList.remove('hidden-action');
   this.actionButton.disabled=!ready;
   this.actionButton.textContent=ready?'PLACE':(this.previewValid?'NEED':'BLOCKED');
  }
 }

 clearAuthoredGrass(x,z,radius){
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

 placeSelected(){
  if(!this.active)return false;
  const definition=buildingDefinition(this.selectedId);
  if(!definition)return false;
  const transform=this.placementTransform(definition);
  if(!this.placementAllowed(definition,transform)){
   this.showFeedback('Cannot build here');
   return false;
  }
  if(!this.inventory.spend(definition.cost)){
   this.showFeedback(`Need ${this.inventory.formatCost(definition.cost)}`);
   return false;
  }

  const object=this.createVisual(definition,false);
  object.name=`Building_${definition.id}`;
  object.position.set(transform.x,transform.y,transform.z);
  object.rotation.y=transform.yaw;
  object.userData.buildingId=definition.id;
  object.userData.playerBuilt=true;
  this.root.add(object);
  this.placements.push({
   id:definition.id,
   object,
   x:transform.x,
   z:transform.z,
   radius:definition.footprintRadius
  });

  this.clearAuthoredGrass(transform.x,transform.z,definition.footprintRadius*1.05);
  this.showFeedback(`${definition.label} built`);
  this.updatePreview();
  return true;
 }

 update(){
  if(this.active)this.updatePreview();
 }
}
