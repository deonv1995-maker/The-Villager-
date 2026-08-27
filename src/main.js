import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=622';

const BUILD='0.6.22';
const status=document.getElementById('status');
const RECOVERY_BOOT='https://cdn.jsdelivr.net/gh/deonv1995-maker/The-Villager-@b92c156a2d47221b592181e8895de6004e595313/src/systems/GameBootstrap.js';

async function allowAnyOrientation(){
 const orientation=globalThis.screen?.orientation;
 try{orientation?.unlock?.();}catch(error){console.debug('[ORIENTATION unlock]',error);}
 try{await orientation?.lock?.('any');}catch(error){console.debug('[ORIENTATION any]',error);}
}

function refreshViewport(game){
 if(!game?.camera||!game?.renderer)return;
 const width=Math.max(1,globalThis.visualViewport?.width||innerWidth||1);
 const height=Math.max(1,globalThis.visualViewport?.height||innerHeight||1);
 game.camera.aspect=width/height;
 game.camera.updateProjectionMatrix();
 game.renderer.setSize(width,height);
}

function bindOrientation(game){
 const refresh=()=>{
  allowAnyOrientation();
  requestAnimationFrame(()=>refreshViewport(game));
  setTimeout(()=>refreshViewport(game),120);
  setTimeout(()=>refreshViewport(game),360);
 };
 addEventListener('orientationchange',refresh,{passive:true});
 globalThis.screen?.orientation?.addEventListener?.('change',refresh);
 globalThis.visualViewport?.addEventListener?.('resize',refresh,{passive:true});
 addEventListener('resize',()=>refreshViewport(game),{passive:true});
 refresh();
}

function syncBuildBadge(suffix='Ranger'){
 if(!status||String(status.textContent||'').includes('ERROR'))return;
 status.textContent=`${BUILD} · ${suffix}`;
}

function startGame(GameBootstrap){
 allowAnyOrientation();

 // GameBootstrap still carries an old internal build string. Hide the status ID
 // only while it starts so it cannot overwrite the shell's authoritative badge.
 const originalStatusId=status?.id||'status';
 if(status)status.id='villager-build-status';
 let game;
 try{
  game=new GameBootstrap(THREE);
  game.start();
 }finally{
  if(status)status.id=originalStatusId;
 }

 globalThis.__villagerGame=game;

 if(game?.survivalInteraction&&game.buildModes&&game.materials&&game.player){
  const system=new DismantleReuseSystem({
   interaction:game.survivalInteraction,
   buildingModes:game.buildModes,
   materials:game.materials,
   player:game.player
  });
  system.initialize();
  game.dismantleReuse=system;
 }

 bindOrientation(game);
 syncBuildBadge('Ranger');
 return game;
}

async function launch(){
 syncBuildBadge('loading');
 allowAnyOrientation();
 try{
  const {GameBootstrap}=await import('./systems/GameBootstrap.js?v=622');
  startGame(GameBootstrap);
 }catch(primaryError){
  console.error('[BOOT IMPORT]',primaryError);
  syncBuildBadge('recovery…');
  try{
   const {GameBootstrap}=await import(RECOVERY_BOOT);
   startGame(GameBootstrap);
   syncBuildBadge('recovery');
  }catch(recoveryError){
   console.error('[BOOT RECOVERY]',recoveryError);
   if(status){
    status.textContent=`${BUILD} · IMPORT ERROR`;
    status.style.background='#5b1818';
   }
  }
 }
}

launch();
