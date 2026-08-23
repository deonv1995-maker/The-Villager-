const release=window.__THE_VILLAGER_RELEASE__;
if(!release?.releaseId)throw new Error('Game boot requires the active release manifest.');
function moduleUrl(path){const url=new URL(path,import.meta.url);url.searchParams.set('r',release.releaseId);return url.href;}
const [configModule,inventoryModule,inputModule,resourcesModule,craftingModule,artModule]=await Promise.all([
  import(moduleUrl('./config.js')),
  import(moduleUrl('./inventory.js')),
  import(moduleUrl('./input.js')),
  import(moduleUrl('./resources.js')),
  import(moduleUrl('./crafting.js')),
  import(moduleUrl('./art.js'))
]);
const {GAME_CONFIG}=configModule;
const {Inventory,renderInventory}=inventoryModule;
const {VirtualJoystick}=inputModule;
const {createStarterResources}=resourcesModule;
const {CraftingSystem,renderCrafting}=craftingModule;
const {drawGround,drawResource,drawPlayer,drawTargetRing,drawWorldBorder}=artModule;

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d',{alpha:false});
ctx.imageSmoothingEnabled=false;
const joystick=new VirtualJoystick(document.getElementById('joystick'),document.getElementById('joystick-knob'));
const targetPanel=document.getElementById('target-panel');
const targetName=document.getElementById('target-name');
const toolName=document.getElementById('tool-name');
const harvestProgress=document.getElementById('harvest-progress');
const inventoryPanel=document.getElementById('inventory-panel');
const craftingPanel=document.getElementById('crafting-panel');
const inventoryGrid=document.getElementById('inventory-grid');
const craftingList=document.getElementById('crafting-list');
const equippedTools=document.getElementById('equipped-tools');
const inventoryButton=document.getElementById('inventory-button');
const craftingButton=document.getElementById('crafting-button');
const inventoryClose=document.getElementById('inventory-close');
const craftingClose=document.getElementById('crafting-close');

let crafting=null;
const inventory=new Inventory(refreshPanels);
crafting=new CraftingSystem(inventory,refreshPanels);
refreshPanels();

inventoryButton.addEventListener('click',()=>openPanel(inventoryPanel));
craftingButton.addEventListener('click',()=>openPanel(craftingPanel));
inventoryClose.addEventListener('click',()=>inventoryPanel.classList.add('hidden'));
craftingClose.addEventListener('click',()=>craftingPanel.classList.add('hidden'));

const player={x:GAME_CONFIG.world.width/2,y:GAME_CONFIG.world.height/2,facingX:0,facingY:1,state:'idle'};
const camera={x:player.x,y:player.y};
const resources=createStarterResources();
const keyboard=new Set();
let currentTarget=null,harvestElapsed=0,lastTime=performance.now(),gameTime=0,movementMagnitude=0;

window.addEventListener('keydown',e=>keyboard.add(e.key.toLowerCase()));
window.addEventListener('keyup',e=>keyboard.delete(e.key.toLowerCase()));
window.addEventListener('resize',resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);

function openPanel(panel){inventoryPanel.classList.add('hidden');craftingPanel.classList.add('hidden');panel.classList.remove('hidden');clearHarvestTarget();}
function anyPanelOpen(){return !inventoryPanel.classList.contains('hidden')||!craftingPanel.classList.contains('hidden');}
function refreshPanels(){renderInventory(inventoryGrid,inventory);if(!crafting)return;renderCrafting(craftingList,crafting,inventory);renderEquippedTools();}
function renderEquippedTools(){equippedTools.innerHTML='';[['axe','Trees'],['pickaxe','Stone'],['sickle','Grass']].forEach(([cls,label])=>{const tool=crafting.getEquipped(cls);const chip=document.createElement('div');chip.className='equipped-chip';chip.textContent=tool?`${label}: ${tool.name}`:`${label}: Hands`;equippedTools.appendChild(chip);});}
function resizeCanvas(){const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.floor(window.innerWidth*dpr);canvas.height=Math.floor(window.innerHeight*dpr);canvas.style.width=`${window.innerWidth}px`;canvas.style.height=`${window.innerHeight}px`;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;}
function loop(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;gameTime+=dt;update(dt);draw();requestAnimationFrame(loop);}
function update(dt){if(!anyPanelOpen()){updatePlayer(dt);updateHarvest(dt);}else{movementMagnitude=0;player.state='idle';clearHarvestTarget();}for(const node of resources)node.update(dt);camera.x+=(player.x-camera.x)*GAME_CONFIG.camera.followLerp;camera.y+=(player.y-camera.y)*GAME_CONFIG.camera.followLerp;}
function updatePlayer(dt){let x=joystick.vector.x,y=joystick.vector.y;if(keyboard.has('a')||keyboard.has('arrowleft'))x-=1;if(keyboard.has('d')||keyboard.has('arrowright'))x+=1;if(keyboard.has('w')||keyboard.has('arrowup'))y-=1;if(keyboard.has('s')||keyboard.has('arrowdown'))y+=1;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}movementMagnitude=Math.hypot(x,y);if(movementMagnitude>.05){player.facingX=x;player.facingY=y;}player.x=clamp(player.x+x*GAME_CONFIG.player.speed*dt,GAME_CONFIG.player.radius,GAME_CONFIG.world.width-GAME_CONFIG.player.radius);player.y=clamp(player.y+y*GAME_CONFIG.player.speed*dt,GAME_CONFIG.player.radius,GAME_CONFIG.world.height-GAME_CONFIG.player.radius);if(!currentTarget)player.state=movementMagnitude>.05?'walk':'idle';}
function updateHarvest(dt){const nearest=findNearestHarvestable();if(nearest!==currentTarget){currentTarget=nearest;harvestElapsed=0;}if(!currentTarget){player.state=movementMagnitude>.05?'walk':'idle';targetPanel.classList.add('hidden');harvestProgress.style.width='0%';return;}const modifiers=crafting.getHarvestModifiers(currentTarget.config);const duration=currentTarget.config.harvestSeconds/modifiers.speedMultiplier;harvestElapsed+=dt;const progress=Math.min(harvestElapsed/duration,1);player.state=`harvest-${currentTarget.type}`;faceTarget(currentTarget);targetPanel.classList.remove('hidden');targetName.textContent=`Harvesting ${currentTarget.config.name}`;toolName.textContent=modifiers.tool?`${modifiers.tool.name} · ${modifiers.speedMultiplier.toFixed(2)}× speed`:'Bare hands';harvestProgress.style.width=`${progress*100}%`;if(harvestElapsed>=duration){const drop=currentTarget.harvest();if(drop){const amount=Math.max(1,Math.round(drop.amount*modifiers.yieldMultiplier));inventory.add(drop.itemId,amount);}currentTarget=null;harvestElapsed=0;}}
function faceTarget(target){const dx=target.x-player.x,dy=target.y-player.y,len=Math.hypot(dx,dy)||1;player.facingX=dx/len;player.facingY=dy/len;}
function clearHarvestTarget(){currentTarget=null;harvestElapsed=0;targetPanel.classList.add('hidden');harvestProgress.style.width='0%';}
function findNearestHarvestable(){let nearest=null,best=Infinity;for(const node of resources){if(!node.active)continue;const d=Math.hypot(node.x-player.x,node.y-player.y);const allowed=GAME_CONFIG.player.harvestRange+node.config.radius;if(d<=allowed&&d<best){nearest=node;best=d;}}return nearest;}
function draw(){const vw=window.innerWidth,vh=window.innerHeight,originX=Math.round(vw/2-camera.x),originY=Math.round(vh/2-camera.y);drawGround(ctx,originX,originY,vw,vh,GAME_CONFIG.world.grid);ctx.save();ctx.translate(originX,originY);drawWorldBorder(ctx,GAME_CONFIG.world);drawTargetRing(ctx,currentTarget);const drawable=[...resources.filter(n=>n.active),{type:'player',x:player.x,y:player.y}].sort((a,b)=>a.y-b.y);for(const item of drawable){if(item.type==='player')drawPlayer(ctx,player,gameTime,crafting);else drawResource(ctx,item);}ctx.restore();}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
