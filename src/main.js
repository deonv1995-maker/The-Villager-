import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GameBootstrap } from './systems/GameBootstrap.js?v=614';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=614';

const BUILD='0.6.14';
const status=document.getElementById('status');
const keepBuildLabel=()=>{
 if(!status)return;
 const text=String(status.textContent||'');
 let desired;
 if(text.includes('ERROR'))desired=`${BUILD} · ERROR`;
 else if(text.includes('fallback'))desired=`${BUILD} · fallback`;
 else if(text.includes('anim'))desired=`${BUILD} · Ranger anim…`;
 else if(text.includes('Ranger'))desired=`${BUILD} · Ranger`;
 else desired=`${BUILD} · loading`;
 // Only write when the value actually changes. Writing unconditionally from
 // inside MutationObserver recursively retriggers the observer and can starve
 // requestAnimationFrame, freezing the game on its first rendered frame.
 if(status.textContent!==desired)status.textContent=desired;
};

if(status){
 keepBuildLabel();
 new MutationObserver(keepBuildLabel).observe(status,{childList:true,characterData:true,subtree:true});
}

const game=new GameBootstrap(THREE);
game.start();

if(game.survivalInteraction&&game.buildModes&&game.materials&&game.player){
 const dismantleReuse=new DismantleReuseSystem({
  interaction:game.survivalInteraction,
  buildingModes:game.buildModes,
  materials:game.materials,
  player:game.player
 });
 dismantleReuse.initialize();
 game.dismantleReuse=dismantleReuse;
}

keepBuildLabel();
