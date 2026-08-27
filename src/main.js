import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=620';

const BUILD='0.6.20';
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

function startGame(GameBootstrap){
 allowAnyOrientation();
 const game=new GameBootstrap(THREE);
 game.start();
 globalThis.__villagerGame=game;

 if(game.survivalInteraction&&game.buildModes&&game.materials&&game.player){
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
 return game;
}

async function launch(){
 allowAnyOrientation();
 try{
  const {GameBootstrap}=await import('./systems/GameBootstrap.js?v=620');
  startGame(GameBootstrap);
  setTimeout(()=>{
   if(status&&!String(status.textContent||'').includes('ERROR'))status.textContent=`${BUILD} · Ranger`;
  },2800);
 }catch(primaryError){
  console.error('[BOOT IMPORT]',primaryError);
  if(status)status.textContent=`${BUILD} · recovery…`;
  try{
   const {GameBootstrap}=await import(RECOVERY_BOOT);
   startGame(GameBootstrap);
   setTimeout(()=>{
    if(status&&!String(status.textContent||'').includes('ERROR'))status.textContent=`${BUILD} · recovery`;
   },2200);
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
