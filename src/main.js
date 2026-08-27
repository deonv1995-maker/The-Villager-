import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=619';

const status=document.getElementById('status');
const RECOVERY_BOOT='https://cdn.jsdelivr.net/gh/deonv1995-maker/The-Villager-@b92c156a2d47221b592181e8895de6004e595313/src/systems/GameBootstrap.js';

function releaseOrientationLock(){
 try{globalThis.screen?.orientation?.unlock?.();}catch(error){console.debug('[ORIENTATION]',error);}
}

function startGame(GameBootstrap){
 releaseOrientationLock();
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
 return game;
}

async function launch(){
 releaseOrientationLock();
 try{
  const {GameBootstrap}=await import('./systems/GameBootstrap.js?v=616');
  startGame(GameBootstrap);
 }catch(primaryError){
  console.error('[BOOT IMPORT]',primaryError);
  if(status)status.textContent='0.6.16 · recovery…';
  try{
   const {GameBootstrap}=await import(RECOVERY_BOOT);
   startGame(GameBootstrap);
   setTimeout(()=>{
    if(status&&!String(status.textContent||'').includes('ERROR'))status.textContent='0.6.16 · recovery';
   },2200);
  }catch(recoveryError){
   console.error('[BOOT RECOVERY]',recoveryError);
   if(status){
    status.textContent='0.6.16 · IMPORT ERROR';
    status.style.background='#5b1818';
   }
  }
 }
}

launch();
