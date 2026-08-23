const P = {
  grass0: '#315f2f', grass1: '#3f7536', grass2: '#568c42', grass3: '#79aa50',
  dirt0: '#765238', dirt1: '#946748', dirt2: '#b07c54',
  bark0: '#3d271c', bark1: '#5c3422', bark2: '#7a482b', bark3: '#9a6540',
  leaf0: '#173d25', leaf1: '#24542d', leaf2: '#367239', leaf3: '#4f8d42', leaf4: '#78aa50',
  rock0: '#34373e', rock1: '#50555e', rock2: '#737984', rock3: '#a2a8b0', rock4: '#c3c7ca',
  skin0: '#7b432d', skin1: '#b86f47', skin2: '#df9a69', skin3: '#f1be87',
  cloth0: '#152b20', cloth1: '#244330', cloth2: '#356043', cloth3: '#567f59',
  leather0: '#4a2d20', leather1: '#71472d', leather2: '#9a673e',
  metal0: '#5c6369', metal1: '#8e989f', metal2: '#c4ccd0',
};

function hash(x, y, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); }

export function drawGround(ctx, originX, originY, width, height, grid = 32) {
  ctx.fillStyle = P.grass1; ctx.fillRect(0, 0, width, height);
  const sx = ((originX % grid) + grid) % grid;
  const sy = ((originY % grid) + grid) % grid;
  for (let y = sy - grid; y < height + grid; y += grid) {
    for (let x = sx - grid; x < width + grid; x += grid) {
      const gx = Math.floor((x - originX) / grid), gy = Math.floor((y - originY) / grid);
      const r = hash(gx, gy);
      if (r < .18) { rect(ctx, x + 2, y + 3, 28, 26, P.grass0); rect(ctx, x + 8, y + 8, 16, 14, P.grass1); }
      else if (r > .82) { rect(ctx, x + 5, y + 6, 24, 20, P.grass2); rect(ctx, x + 12, y + 10, 10, 8, P.grass3); }
      const d = hash(gx, gy, 2);
      if (d < .10) { rect(ctx, x + 3, y + 19, 11, 8, P.dirt0); rect(ctx, x + 6, y + 20, 6, 5, P.dirt1); }
      const a = hash(gx, gy, 7);
      if (a < .18) {
        rect(ctx, x + 4, y + 7, 2, 9, P.grass3); rect(ctx, x + 7, y + 10, 2, 7, P.grass0);
        if (a < .035) { rect(ctx, x + 9, y + 6, 3, 3, '#e6d96f'); rect(ctx, x + 7, y + 8, 2, 2, '#f2eee0'); }
      }
      if (hash(gx, gy, 11) < .055) { rect(ctx, x + 20, y + 20, 5, 3, '#62665f'); rect(ctx, x + 21, y + 19, 3, 2, '#93978e'); }
    }
  }
}

export function drawResource(ctx, node) {
  if (node.type === 'tree') drawTree(ctx, node.x, node.y, node.x + node.y);
  else if (node.type === 'rock') drawRock(ctx, node.x, node.y, node.x * 3 + node.y);
  else drawGrass(ctx, node.x, node.y, node.x - node.y);
}

export function drawTree(ctx, x, y, seed = 0) {
  ctx.save();
  ctx.globalAlpha = .22; ctx.fillStyle = '#0d1a11'; ctx.beginPath(); ctx.ellipse(x, y + 24, 43, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  poly(ctx, [[x-14,y+28],[x-11,y-31],[x-5,y-52],[x+4,y-51],[x+11,y-28],[x+15,y+28]], P.bark0);
  poly(ctx, [[x-8,y+27],[x-7,y-28],[x-2,y-45],[x+4,y-42],[x+6,y-23],[x+7,y+27]], P.bark2);
  rect(ctx, x-5, y-19, 4, 32, P.bark3); rect(ctx, x+5, y-11, 3, 24, P.bark1);
  poly(ctx, [[x-8,y-31],[x-29,y-50],[x-25,y-57],[x-4,y-43]], P.bark0);
  poly(ctx, [[x+5,y-35],[x+30,y-57],[x+33,y-51],[x+7,y-42]], P.bark1);
  const blobs = [
    [-31,-67,26,22],[-10,-79,29,24],[18,-69,29,22],[-42,-49,28,21],[-12,-52,35,28],[27,-48,29,22],[-3,-93,25,18]
  ];
  for (let i=0;i<blobs.length;i++) {
    const [dx,dy,rx,ry]=blobs[i];
    ctx.fillStyle = i%3===0?P.leaf1:i%3===1?P.leaf2:P.leaf3;
    ctx.beginPath(); ctx.ellipse(x+dx,y+dy,rx,ry,0,0,Math.PI*2); ctx.fill();
  }
  const highlights = [[-30,-74],[-12,-87],[10,-76],[30,-60],[-18,-58],[9,-58],[-43,-53]];
  for (let i=0;i<highlights.length;i++) { const [dx,dy]=highlights[i]; rect(ctx,x+dx,y+dy,11,7,i%2?P.leaf4:'#6b9e49'); rect(ctx,x+dx+5,y+dy-4,8,5,P.leaf4); }
  for (let i=0;i<11;i++) { const rx=(hash(seed,i)-.5)*78, ry=-42-hash(seed,i,2)*48; rect(ctx,x+rx,y+ry,3,3,hash(seed,i,4)>.5?P.leaf0:P.leaf4); }
  rect(ctx,x-18,y+20,10,4,P.grass3); rect(ctx,x+10,y+20,12,4,P.grass2);
  ctx.restore();
}

export function drawRock(ctx, x, y, seed = 0) {
  ctx.save();
  ctx.globalAlpha=.2; ctx.fillStyle='#101214'; ctx.beginPath(); ctx.ellipse(x,y+15,33,9,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  poly(ctx, [[x-28,y+12],[x-23,y-6],[x-12,y-25],[x+2,y-30],[x+20,y-18],[x+29,y+6],[x+21,y+15],[x-20,y+16]], P.rock0);
  poly(ctx, [[x-21,y+6],[x-16,y-7],[x-8,y-21],[x+1,y-25],[x+3,y+10]], P.rock2);
  poly(ctx, [[x+3,y+10],[x+2,y-25],[x+17,y-16],[x+24,y+5],[x+17,y+12]], P.rock1);
  poly(ctx, [[x-11,y-18],[x-4,y-27],[x+3,y-25],[x+8,y-18],[x-1,y-11]], P.rock4);
  rect(ctx,x-18,y-3,8,4,P.rock3); rect(ctx,x+8,y-8,7,4,P.rock3); rect(ctx,x+12,y+6,8,3,P.rock0);
  if (hash(seed,2)>.55) { rect(ctx,x-29,y+8,7,6,P.rock1); rect(ctx,x-27,y+5,4,3,P.rock3); }
  if (hash(seed,3)>.45) { rect(ctx,x+23,y+9,8,5,P.rock1); rect(ctx,x+24,y+7,5,3,P.rock3); }
  ctx.restore();
}

export function drawGrass(ctx, x, y, seed = 0) {
  ctx.save();
  ctx.globalAlpha=.16; ctx.fillStyle='#101810'; ctx.beginPath(); ctx.ellipse(x,y+12,24,7,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  const blades=[[-16,11,-9,-16],[-11,12,-15,-9],[-8,12,-3,-21],[-2,13,1,-25],[4,13,10,-20],[9,12,16,-14],[14,12,18,-4]];
  ctx.lineCap='square';
  blades.forEach((b,i)=>{ ctx.strokeStyle=i%3===0?P.grass3:i%3===1?P.grass2:'#82b956'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(x+b[0],y+b[1]); ctx.lineTo(x+b[2],y+b[3]); ctx.stroke(); });
  if (hash(seed,4)>.6) { rect(ctx,x-5,y-19,3,3,'#e9df86'); rect(ctx,x+8,y-14,3,3,'#eee4a0'); }
  ctx.restore();
}

export function drawPlayer(ctx, player, gameTime, crafting) {
  const x=player.x, y=player.y, walking=player.state==='walk', harvesting=player.state.startsWith('harvest-');
  const phase=Math.sin(gameTime*11), bob=walking?Math.round(Math.abs(phase)*2):0, stride=walking?Math.round(phase*3):0;
  ctx.save();
  ctx.globalAlpha=.25; ctx.fillStyle='#0d1410'; ctx.beginPath(); ctx.ellipse(x,y+20,18,7,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  rect(ctx,x-11-stride,y+7+bob,8,15,P.leather0); rect(ctx,x+3+stride,y+7+bob,8,15,P.leather0);
  rect(ctx,x-12-stride,y+18+bob,10,5,P.leather2); rect(ctx,x+2+stride,y+18+bob,10,5,P.leather2);
  poly(ctx,[[x-15,y-11+bob],[x+14,y-11+bob],[x+11,y+11+bob],[x-12,y+11+bob]],P.cloth1);
  rect(ctx,x-9,y-8+bob,18,17,P.cloth2); rect(ctx,x-14,y+4+bob,28,5,P.leather1); rect(ctx,x+3,y+4+bob,6,5,'#c49a4d');
  poly(ctx,[[x-15,y-9+bob],[x-7,y-16+bob],[x-2,y-8+bob],[x-10,y+5+bob]],P.cloth0);
  rect(ctx,x-9,y-28+bob,18,16,P.skin2); rect(ctx,x-7,y-25+bob,14,10,P.skin3);
  rect(ctx,x-10,y-32+bob,20,7,'#4a2b21'); rect(ctx,x-11,y-28+bob,5,8,'#4a2b21'); rect(ctx,x+6,y-28+bob,4,6,'#35231c');
  const ex=player.facingX>.3?5:player.facingX<-.3?-5:0; rect(ctx,x+ex-1,y-22+bob,2,2,'#1b1714');
  rect(ctx,x-7,y-15+bob,4,7,P.skin1); rect(ctx,x+8,y-15+bob,4,7,P.skin1);
  if (harvesting) drawTool(ctx,player,gameTime,crafting,bob);
  ctx.restore();
}

function drawTool(ctx, player, t, crafting, bob) {
  const x=player.x,y=player.y+bob;
  const cls=player.state==='harvest-tree'?'axe':player.state==='harvest-rock'?'pickaxe':'sickle';
  const equipped=crafting.getEquipped(cls); const dir=player.facingX>=0?1:-1; const swing=Math.sin(t*10)*.85*dir;
  ctx.save(); ctx.translate(x+dir*10,y-5); ctx.rotate(swing);
  rect(ctx,-2,-1,5,7,P.skin2); rect(ctx,0,3,4,24,P.leather2); rect(ctx,1,5,2,20,P.leather0);
  if (!equipped) { rect(ctx,-1,21,6,6,P.skin2); }
  else if (cls==='axe') { poly(ctx,[[-10,19],[4,17],[9,21],[3,29],[-9,27]],equipped.id==='stone_axe'?P.rock3:P.metal1); rect(ctx,-8,21,8,3,P.metal2); }
  else if (cls==='pickaxe') { poly(ctx,[[-11,18],[0,16],[11,19],[8,23],[0,20],[-8,23]],equipped.id==='stone_pickaxe'?P.rock3:P.metal1); rect(ctx,-5,18,10,2,P.metal2); }
  else { ctx.strokeStyle=P.metal2; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(7,20,9,-1.2,.55); ctx.stroke(); }
  ctx.restore();
}

export function drawTargetRing(ctx, node) {
  if (!node?.active) return;
  ctx.strokeStyle='rgba(246,226,133,.82)'; ctx.lineWidth=2; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.ellipse(node.x,node.y+9,node.config.radius+10,10,0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
}

export function drawWorldBorder(ctx, world) {
  ctx.strokeStyle='#1e3523'; ctx.lineWidth=10; ctx.strokeRect(0,0,world.width,world.height);
  ctx.strokeStyle='#6d8e4b'; ctx.lineWidth=2; ctx.strokeRect(5,5,world.width-10,world.height-10);
}
