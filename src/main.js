import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GameBootstrap } from './systems/GameBootstrap.js?v=613';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=613';

const BUILD='0.6.13';
const status=document.getElementById('status');
const keepBuildLabel=()=>{
 if(!status)return;
 const text=String(status.textContent||'');
 if(text.includes('ERROR'))status.textContent=`${BUILD} · ERROR`;
 else if(text.includes('fallback'))status.textContent=`${BUILD} · fallback`;
 else if(text.includes('anim'))status.textContent=`${BUILD} · Ranger anim…`;
 else if(text.includes('Ranger'))status.textContent=`${BUILD} · Ranger`;
 else status.textContent=`${BUILD} · loading`;
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
