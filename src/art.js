const release=window.__THE_VILLAGER_RELEASE__;
if(!release?.releaseId||!release?.assets)throw new Error('Art system requires the active release manifest.');

function assetUrl(key){
  const path=release.assets[key];
  if(!path)throw new Error(`Missing asset mapping: ${key}`);
  const url=new URL(`../${path}`,import.meta.url);
  url.searchParams.set('r',release.releaseId);
  return url.href;
}

function image(key){
  const img=new Image();
  img.decoding='async';
  img.dataset.loadState='loading';
  img.onload=()=>{img.dataset.loadState='ready';};
  img.onerror=()=>{img.dataset.loadState='error';};
  img.src=assetUrl(key);
  return img;
}

function textImage(key){
  const img=new Image();
  img.decoding='async';
  img.dataset.loadState='loading';
  img.onload=()=>{img.dataset.loadState='ready';};
  img.onerror=()=>{img.dataset.loadState='error';};
  fetch(assetUrl(key),{cache:'no-store'})
    .then(r=>{
      if(!r.ok)throw new Error(`${key} ${r.status}`);
      return r.text();
    })
    .then(b64=>{
      img.src=`data:image/png;base64,${b64.trim()}`;
    })
    .catch(error=>{
      img.dataset.loadState='error';
      console.error('Asset load failed:',key,error);
    });
  return img;
}

function ready(img){return img.complete&&img.naturalWidth>0;}
function failed(img){return img.dataset.loadState==='error';}

const ASSETS={
  ground:textImage('ground'),
  tree:image('tree'),
  rock:image('rock'),
  grass:image('grass'),
  playerSheet:textImage('playerSheet')
};

const PLAYER_SHEET={frameWidth:32,frameHeight:32,drawWidth:88,drawHeight:88,walkFps:8};
const TOOL={leather:'#8d5c35',leatherDark:'#4a2d20',skin:'#d99363',metal:'#aeb7bd',metalHi:'#d5dcdf',stone:'#929aa0'};

function hash(x,y,salt=0){let n=(Math.floor(x)*374761393+Math.floor(y)*668265263+salt*1442695041)|0;n=(n^(n>>>13))*1274126177;return((n^(n>>>16))>>>0)/4294967295;}
function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function poly(ctx,pts,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fill();}
function ellipse(ctx,x,y,rx,ry,color,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();}

export function drawGround(ctx,originX,originY,width,height){
  ctx.fillStyle='#355f2c';
  ctx.fillRect(0,0,width,height);
  if(!ready(ASSETS.ground))return;
  const tile=384,sx=((originX%tile)+tile)%tile,sy=((originY%tile)+tile)%tile;
  for(let y=sy-tile;y<height+tile;y+=tile){
    for(let x=sx-tile;x<width+tile;x+=tile){
      const gx=Math.floor((x-originX)/tile),gy=Math.floor((y-originY)/tile),flipX=hash(gx,gy,2)>.5,flipY=hash(gx,gy,3)>.5,rotate=hash(gx,gy,4)>.72;
      ctx.save();
      ctx.translate(x+tile/2,y+tile/2);
      if(rotate)ctx.rotate(Math.PI);
      ctx.scale(flipX?-1:1,flipY?-1:1);
      ctx.drawImage(ASSETS.ground,-tile/2,-tile/2,tile,tile);
      ctx.restore();
    }
  }
}

export function drawResource(ctx,node){
  if(node.type==='tree')return drawTree(ctx,node);
  if(node.type==='rock')return drawRock(ctx,node);
  return drawGrass(ctx,node);
}

function drawTree(ctx,node){
  ellipse(ctx,node.x+6,node.y+20,70,18,'#0d150d',.34);
  if(!ready(ASSETS.tree))return;
  const scale=1.02+hash(node.x,node.y,4)*.18,w=175*scale,h=252*scale,flip=hash(node.x,node.y,5)>.5;
  ctx.save();
  ctx.translate(node.x,node.y);
  if(flip)ctx.scale(-1,1);
  ctx.drawImage(ASSETS.tree,-w/2,-h+28,w,h);
  ctx.restore();
}

function drawRock(ctx,node){
  ellipse(ctx,node.x,node.y+13,43,12,'#0e1210',.28);
  if(!ready(ASSETS.rock))return;
  const scale=.84+hash(node.x,node.y,7)*.24,w=124*scale,h=100*scale,flip=hash(node.x,node.y,8)>.5;
  ctx.save();
  ctx.translate(node.x,node.y);
  if(flip)ctx.scale(-1,1);
  ctx.drawImage(ASSETS.rock,-w/2,-h+18,w,h);
  ctx.restore();
}

function drawGrass(ctx,node){
  ellipse(ctx,node.x,node.y+8,27,8,'#0d140d',.18);
  if(!ready(ASSETS.grass))return;
  const scale=.95+hash(node.x,node.y,10)*.34,w=64*scale,h=76*scale,flip=hash(node.x,node.y,11)>.5;
  ctx.save();
  ctx.translate(node.x,node.y);
  if(flip)ctx.scale(-1,1);
  ctx.drawImage(ASSETS.grass,-w/2,-h+15,w,h);
  ctx.restore();
}

function direction(player){
  const x=player.facingX,y=player.facingY;
  if(Math.abs(x)>Math.abs(y))return x<0?'left':'right';
  return y<0?'up':'down';
}

function frameFor(player,t){
  const dir=direction(player),row={down:0,left:1,right:2,up:3}[dir];
  if(player.state==='walk')return{col:Math.floor(t*PLAYER_SHEET.walkFps)%6,row};
  return{col:0,row};
}

function drawPlayerAssetError(ctx,x,y){
  ctx.save();
  ctx.fillStyle='#4d1111';
  ctx.fillRect(x-28,y-62,56,56);
  ctx.strokeStyle='#ffcf5a';
  ctx.lineWidth=3;
  ctx.strokeRect(x-28,y-62,56,56);
  ctx.fillStyle='#fff3c4';
  ctx.font='bold 9px monospace';
  ctx.textAlign='center';
  ctx.fillText('PLAYER',x,y-34);
  ctx.fillText('ASSET ERROR',x,y-22);
  ctx.restore();
}

export function drawPlayer(ctx,player,gameTime,crafting){
  const harvesting=player.state.startsWith('harvest-'),x=Math.round(player.x),y=Math.round(player.y);
  ellipse(ctx,x,y+15,23,8,'#0b100c',.38);
  ctx.save();
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  ctx.imageSmoothingEnabled=false;
  if(ready(ASSETS.playerSheet)){
    const f=frameFor(player,gameTime),sx=f.col*PLAYER_SHEET.frameWidth,sy=f.row*PLAYER_SHEET.frameHeight;
    ctx.drawImage(ASSETS.playerSheet,sx,sy,PLAYER_SHEET.frameWidth,PLAYER_SHEET.frameHeight,x-PLAYER_SHEET.drawWidth/2,y-PLAYER_SHEET.drawHeight+20,PLAYER_SHEET.drawWidth,PLAYER_SHEET.drawHeight);
  }else if(failed(ASSETS.playerSheet)){
    drawPlayerAssetError(ctx,x,y);
  }
  ctx.restore();
  if(harvesting)drawTool(ctx,player,gameTime,crafting);
}

function drawTool(ctx,player,t,crafting){
  const cls=player.state==='harvest-tree'?'axe':player.state==='harvest-rock'?'pickaxe':'sickle',equipped=crafting.getEquipped(cls),dir=player.facingX<-.2?-1:1,swing=Math.sin(t*10)*.72*dir;
  ctx.save();
  ctx.translate(player.x+dir*20,player.y-38);
  ctx.rotate(swing);
  rect(ctx,-2,-1,5,7,TOOL.skin);
  rect(ctx,0,3,4,32,TOOL.leather);
  rect(ctx,1,5,2,27,TOOL.leatherDark);
  if(!equipped)rect(ctx,-1,29,6,6,TOOL.skin);
  else if(cls==='axe'){
    const head=equipped.id==='stone_axe'?TOOL.stone:TOOL.metal;
    poly(ctx,[[-12,26],[3,23],[12,26],[4,36],[-11,33]],head);
    rect(ctx,-8,27,9,3,TOOL.metalHi);
  }else if(cls==='pickaxe'){
    const head=equipped.id==='stone_pickaxe'?TOOL.stone:TOOL.metal;
    poly(ctx,[[-13,25],[0,22],[13,25],[9,29],[0,26],[-10,29]],head);
    rect(ctx,-6,25,12,2,TOOL.metalHi);
  }else{
    ctx.strokeStyle=TOOL.metalHi;
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.arc(8,27,10,-1.25,.6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTargetRing(ctx,node){
  if(!node?.active)return;
  ellipse(ctx,node.x,node.y+8,node.config.radius+13,12,'#e8cf67',.10);
  ctx.strokeStyle='rgba(246,226,133,.9)';
  ctx.lineWidth=2;
  ctx.setLineDash([5,4]);
  ctx.beginPath();
  ctx.ellipse(node.x,node.y+8,node.config.radius+12,11,0,0,Math.PI*2);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawWorldBorder(ctx,world){
  ctx.strokeStyle='#172418';
  ctx.lineWidth=12;
  ctx.strokeRect(0,0,world.width,world.height);
  ctx.strokeStyle='#8aa45b';
  ctx.lineWidth=2;
  ctx.strokeRect(6,6,world.width-12,world.height-12);
}
