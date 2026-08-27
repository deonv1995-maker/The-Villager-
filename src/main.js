import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GameBootstrap } from './systems/GameBootstrap.js?v=611';
import { DismantleReuseSystem } from './systems/gameplay/DismantleReuseSystem.js?v=612';

const status=document.getElementById('status');
const keepBuildLabel=()=>{
 if(!status)return;
 status.textContent=String(status.textContent||'').replace(/^0\.6\.1[01]/,'0.6.12');
};
if(status){
 new MutationObserver(keepBuildLabel).observe(status,{childList:true,characterData:true,subtree:true});
}

const game=new GameBootstrap(THREE);
game.start();

const dismantleReuse=new DismantleReuseSystem({
 interaction:game.survivalInteraction,
 buildingModes:game.buildModes,
 materials:game.materials,
 player:game.player
});
dismantleReuse.initialize();
game.dismantleReuse=dismantleReuse;
keepBuildLabel();
