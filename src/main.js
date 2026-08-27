import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const status=document.getElementById('status');
const RECOVERY_BOOT='https://cdn.jsdelivr.net/gh/deonv1995-maker/The-Villager-@b92c156a2d47221b592181e8895de6004e595313/src/systems/GameBootstrap.js';

async function launch(){
 try{
  const {GameBootstrap}=await import('./systems/GameBootstrap.js?v=616');
  const game=new GameBootstrap(THREE);
  game.start();
  globalThis.__villagerGame=game;
 }catch(primaryError){
  console.error('[BOOT IMPORT]',primaryError);
  if(status)status.textContent='0.6.16 · recovery…';
  try{
   const {GameBootstrap}=await import(RECOVERY_BOOT);
   const game=new GameBootstrap(THREE);
   game.start();
   globalThis.__villagerGame=game;
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
