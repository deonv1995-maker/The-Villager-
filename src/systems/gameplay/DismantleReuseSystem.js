export class DismantleReuseSystem{
 constructor({interaction,buildingModes,materials,player}){
  this.interaction=interaction;
  this.buildingModes=buildingModes;
  this.materials=materials;
  this.player=player;
  this.range=3.25;
  this.verticalRange=3.20;
  this.active=false;
  this.originalResolve=null;
  this.originalPerform=null;
  this.tmpWorld=buildingModes?.T?new buildingModes.T.Vector3():null;
  this.button=null;
  this.styleElement=null;
 }

 initialize(){
  if(!this.interaction||!this.buildingModes||!this.materials)return;
  this.originalResolve=this.interaction.resolve.bind(this.interaction);
  this.originalPerform=this.interaction.perform.bind(this.interaction);
  this.createModeButton();

  this.interaction.resolve=()=>{
   if(!this.active)return this.originalResolve();

   if(this.interaction.pending||this.materials.carried){
    if(this.materials.carried)this.setActive(false);
    return this.originalResolve();
   }

   const target=this.findTarget();
   if(target)return {type:'dismantle',target,label:`TAKE DOWN ${this.labelFor(target)}`};

   // Disassembly mode is deliberately exclusive. Normal pickup / harvest
   // interactions stay suspended until the player leaves the mode.
   return null;
  };

  this.interaction.perform=()=>{
   if(!this.active)return this.originalPerform();
   if(this.interaction.pending||this.materials.carried){
    if(this.materials.carried)this.setActive(false);
    return false;
   }

   const resolved=this.interaction.resolve();
   if(resolved?.type!=='dismantle')return false;

   const label=this.labelFor(resolved.target);
   const returned=this.dismantle(resolved.target);
   if(!returned)return false;

   this.interaction.showFeedback?.(`${label} dismantled · material recovered`);
   this.interaction.current=null;
   this.interaction.updateButton?.();
   return true;
  };
 }

 createModeButton(){
  if(document.getElementById('disassembly-mode-button'))return;

  const style=document.createElement('style');
  style.id='disassembly-mode-style';
  style.textContent=`
   #disassembly-mode-button{position:fixed;right:7px;top:62px;z-index:47;width:82px;height:34px;border:3px solid #3a2b21;border-radius:10px;background:#314632e8;color:#f4ead8;font:900 8px system-ui;letter-spacing:.35px;touch-action:none;box-shadow:0 3px 10px #0004;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 7px}
   #disassembly-mode-button .disassembly-icon{font-size:15px;line-height:1}
   #disassembly-mode-button:active{transform:scale(.94)}
   #disassembly-mode-button.active{background:#a75d43;color:#fff5e7;border-color:#5a2f24;box-shadow:0 0 0 2px #d7a06466,0 3px 10px #0005}
   #disassembly-mode-button:disabled{opacity:.35;filter:saturate(.5)}
   @media(max-width:760px){#disassembly-mode-button{right:5px;top:56px;width:74px;height:31px;font-size:7px;border-width:2px}.disassembly-icon{font-size:13px!important}}
  `;
  document.head.appendChild(style);

  const button=document.createElement('button');
  button.id='disassembly-mode-button';
  button.type='button';
  button.dataset.gameUi='true';
  button.setAttribute('aria-label','Enter disassembly mode');
  button.setAttribute('aria-pressed','false');
  button.innerHTML='<span class="disassembly-icon" aria-hidden="true">🛠</span><span class="disassembly-label">DISASSEMBLE</span>';
  button.addEventListener('pointerdown',event=>{
   event.preventDefault();
   event.stopPropagation();
   if(this.materials?.carried||this.interaction?.pending)return;
   this.setActive(!this.active);
  },{passive:false});

  document.body.appendChild(button);
  this.button=button;
  this.styleElement=style;
 }

 setActive(active){
  const allowed=!this.materials?.carried&&!this.interaction?.pending;
  this.active=!!active&&allowed;

  if(this.button){
   this.button.classList.toggle('active',this.active);
   this.button.setAttribute('aria-pressed',this.active?'true':'false');
   this.button.setAttribute('aria-label',this.active?'Exit disassembly mode':'Enter disassembly mode');
   const label=this.button.querySelector('.disassembly-label');
   if(label)label.textContent=this.active?'DONE':'DISASSEMBLE';
  }

  document.body.classList.toggle('disassembly-mode-active',this.active);
  this.interaction.current=null;
  this.interaction.updateButton?.();
  this.interaction.showFeedback?.(this.active?'DISASSEMBLY MODE · select a placed piece':'Disassembly mode off');
 }

 labelFor(target){
  if(target?.kind==='raw')return target.item?.type==='log'?'LOG':'ITEM';
  const p=target?.placement;
  if(!p)return 'ITEM';
  if(p.mode==='roofClad')return p.roofMaterial==='grass'?'THATCH':'ROOF PLANKS';
  if(p.mode==='roofFrame')return p.snapKind==='roof-ridge'?'RIDGE':'RAFTER';
  if(p.mode==='stairTread')return 'STAIR TREADS';
  if(p.mode==='beam')return 'BEAM';
  if(p.mode==='frame')return 'FRAME';
  if(p.mode==='wall')return 'WALL';
  if(p.mode==='floor')return 'FLOOR';
  if(p.mode==='angle')return p.snapKind?.includes('stair')?'STAIR RAIL':'ANGLE';
  return String(p.mode||'ITEM').toUpperCase();
 }

 targetScore(x,y,z){
  const px=this.player?.position?.x??0;
  const py=this.player?.position?.y??0;
  const pz=this.player?.position?.z??0;
  const dx=x-px,dz=z-pz,dy=y-py;
  const horizontal=Math.hypot(dx,dz);
  if(horizontal>this.range||Math.abs(dy)>this.verticalRange)return Infinity;
  return horizontal+Math.abs(dy)*.34;
 }

 findTarget(){
  let best=null,bestScore=Infinity;

  for(const item of this.materials.items||[]){
   if(item?.state!=='placed'||!item.object?.parent)continue;
   const p=this.tmpWorld?item.object.getWorldPosition(this.tmpWorld):item.object.position;
   const score=this.targetScore(p.x,p.y,p.z);
   if(score<bestScore){bestScore=score;best={kind:'raw',item};}
  }

  for(const placement of this.buildingModes.placements||[]){
   if(!placement?.object?.parent)continue;
   if(placement.snapKind==='roof-grass-ridge')continue;
   const p=this.tmpWorld?placement.object.getWorldPosition(this.tmpWorld):placement.object.position;
   const score=this.targetScore(p.x,p.y,p.z);
   if(score<bestScore){bestScore=score;best={kind:'construction',placement};}
  }
  return best;
 }

 spawnLooseGrass(x,z){
  const make=this.materials.makeGrassBundleVisual;
  if(!make)return null;
  const object=make();
  const id=this.materials.nextId++;
  const y=(this.buildingModes.world?.heightAt?.(x,z)??0)+.48;
  object.position.set(x,y,z);
  object.rotation.set(0,0,Math.PI/2);
  object.userData.rawMaterialId=id;
  this.materials.root.add(object);
  const item={id,type:'grass',object,state:'loose',radius:.34,stackHeight:.30,carryMotion:null,physics:null};
  this.materials.items.push(item);
  return item;
 }

 removeAutomaticGrassRidge(regionKey){
  if(!regionKey)return;
  const placements=this.buildingModes.placements||[];
  for(let i=placements.length-1;i>=0;i--){
   const p=placements[i];
   if(p?.snapKind!=='roof-grass-ridge'||p.roofRegionKey!==regionKey)continue;
   p.object?.removeFromParent?.();
   placements.splice(i,1);
  }
 }

 dismantle(target){
  if(target?.kind==='raw'){
   const item=target.item;
   if(!item?.object)return null;
   item.state='loose';
   if(item.physics){
    item.physics.active=false;
    item.physics.vx=item.physics.vy=item.physics.vz=0;
    item.physics.spinY=item.physics.rollSpeed=0;
    item.physics.settleTimer=0;
    item.physics.grounded=true;
   }
   return item;
  }

  const p=target?.placement;
  if(!p)return null;
  const placements=this.buildingModes.placements||[];
  const index=placements.indexOf(p);
  if(index<0)return null;

  const x=p.x??p.object?.position?.x??this.player.position.x;
  const z=p.z??p.object?.position?.z??this.player.position.z;
  const yaw=p.yaw??0;
  const grass=p.mode==='roofClad'&&p.roofMaterial==='grass';
  const roofRegionKey=p.roofRegionKey||null;

  p.object?.removeFromParent?.();
  placements.splice(index,1);

  if(grass){
   this.removeAutomaticGrassRidge(roofRegionKey);
   return this.spawnLooseGrass(x,z);
  }

  const log=this.materials.spawnLog?.(x,z,yaw)||null;
  if(log){
   log.state='loose';
   if(log.physics){log.physics.active=false;log.physics.grounded=true;}
  }
  return log;
 }
}
