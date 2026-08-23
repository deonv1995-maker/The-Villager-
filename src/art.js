const ASSETS = {
  ground: image('../assets/ground-tile.svg'),
  trees: image('../assets/tree-atlas.svg'),
  rocks: image('../assets/rock-atlas.svg'),
  grass: image('../assets/grass-atlas.svg'),
  player: image('../assets/player-sheet.svg'),
};

const TOOL = {
  leather: '#8d5c35', leatherDark: '#4a2d20', skin: '#d99363',
  metal: '#aeb7bd', metalHi: '#d5dcdf', stone: '#929aa0',
};

function image(path) {
  const img = new Image();
  img.decoding = 'async';
  img.src = new URL(path, import.meta.url).href;
  return img;
}

function ready(img) {
  return img.complete && img.naturalWidth > 0;
}

function hash(x, y, salt = 0) {
  let n = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

export function drawGround(ctx, originX, originY, width, height, grid = 32) {
  ctx.fillStyle = '#557d34';
  ctx.fillRect(0, 0, width, height);

  const sx = ((originX % grid) + grid) % grid;
  const sy = ((originY % grid) + grid) % grid;
  for (let y = sy - grid; y < height + grid; y += grid) {
    for (let x = sx - grid; x < width + grid; x += grid) {
      if (ready(ASSETS.ground)) ctx.drawImage(ASSETS.ground, x, y, grid, grid);
      else {
        ctx.fillStyle = '#5f8a3b';
        ctx.fillRect(x, y, grid, grid);
      }

      const gx = Math.floor((x - originX) / grid);
      const gy = Math.floor((y - originY) / grid);
      const d = hash(gx, gy, 7);
      if (d < .08) {
        rect(ctx, x + 5, y + 20, 11, 6, '#765238');
        rect(ctx, x + 8, y + 20, 6, 3, '#a06f49');
      }
      const flower = hash(gx, gy, 13);
      if (flower < .045) {
        rect(ctx, x + 22, y + 13, 2, 7, '#42672e');
        rect(ctx, x + 20, y + 11, 3, 3, '#eee5a0');
        rect(ctx, x + 23, y + 9, 3, 3, '#f3f0d4');
      }
    }
  }
}

export function drawResource(ctx, node) {
  if (node.type === 'tree') return drawTreeSprite(ctx, node);
  if (node.type === 'rock') return drawRockSprite(ctx, node);
  return drawGrassSprite(ctx, node);
}

function drawTreeSprite(ctx, node) {
  if (!ready(ASSETS.trees)) return drawTreeFallback(ctx, node.x, node.y);
  const variant = Math.floor(hash(node.x, node.y, 3) * 3) % 3;
  ctx.drawImage(ASSETS.trees, variant * 128, 0, 128, 160, node.x - 64, node.y - 140, 128, 160);
}

function drawRockSprite(ctx, node) {
  if (!ready(ASSETS.rocks)) return drawRockFallback(ctx, node.x, node.y);
  const variant = Math.floor(hash(node.x, node.y, 5) * 4) % 4;
  ctx.drawImage(ASSETS.rocks, variant * 96, 0, 96, 96, node.x - 48, node.y - 76, 96, 96);
}

function drawGrassSprite(ctx, node) {
  if (!ready(ASSETS.grass)) return drawGrassFallback(ctx, node.x, node.y);
  const variant = Math.floor(hash(node.x, node.y, 9) * 4) % 4;
  ctx.drawImage(ASSETS.grass, variant * 64, 0, 64, 64, node.x - 32, node.y - 48, 64, 64);
}

export function drawPlayer(ctx, player, gameTime, crafting) {
  const frame = playerFrame(player.state, gameTime);
  const x = Math.round(player.x);
  const y = Math.round(player.y);

  if (!ready(ASSETS.player)) {
    drawPlayerFallback(ctx, player, gameTime);
  } else {
    ctx.save();
    const flip = player.facingX < -.2;
    ctx.translate(x, 0);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(ASSETS.player, frame * 64, 0, 64, 80, -32, y - 62, 64, 80);
    ctx.restore();
  }

  if (player.state.startsWith('harvest-')) drawTool(ctx, player, gameTime, crafting);
}

function playerFrame(state, t) {
  if (state === 'walk') return Math.floor(t * 7) % 2 ? 1 : 2;
  if (state === 'harvest-tree') return Math.floor(t * 6) % 2 ? 3 : 4;
  if (state === 'harvest-rock') return Math.floor(t * 6) % 2 ? 5 : 6;
  if (state === 'harvest-grass') return 7;
  return 0;
}

function drawTool(ctx, player, t, crafting) {
  const cls = player.state === 'harvest-tree' ? 'axe' : player.state === 'harvest-rock' ? 'pickaxe' : 'sickle';
  const equipped = crafting.getEquipped(cls);
  const dir = player.facingX < -.2 ? -1 : 1;
  const swing = Math.sin(t * 10) * .72 * dir;

  ctx.save();
  ctx.translate(player.x + dir * 11, player.y - 23);
  ctx.rotate(swing);
  rect(ctx, -2, -1, 5, 7, TOOL.skin);
  rect(ctx, 0, 3, 4, 27, TOOL.leather);
  rect(ctx, 1, 5, 2, 22, TOOL.leatherDark);

  if (!equipped) {
    rect(ctx, -1, 24, 6, 6, TOOL.skin);
  } else if (cls === 'axe') {
    const head = equipped.id === 'stone_axe' ? TOOL.stone : TOOL.metal;
    poly(ctx, [[-11,22],[3,20],[10,23],[4,31],[-10,29]], head);
    rect(ctx, -8, 23, 9, 3, TOOL.metalHi);
  } else if (cls === 'pickaxe') {
    const head = equipped.id === 'stone_pickaxe' ? TOOL.stone : TOOL.metal;
    poly(ctx, [[-12,21],[0,19],[12,22],[9,26],[0,23],[-9,26]], head);
    rect(ctx, -6, 21, 12, 2, TOOL.metalHi);
  } else {
    ctx.strokeStyle = TOOL.metalHi;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(8, 23, 10, -1.25, .6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTargetRing(ctx, node) {
  if (!node?.active) return;
  ctx.strokeStyle = 'rgba(246,226,133,.88)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.ellipse(node.x, node.y + 8, node.config.radius + 12, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawWorldBorder(ctx, world) {
  ctx.strokeStyle = '#1f3522';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, world.width, world.height);
  ctx.strokeStyle = '#7b9d50';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, world.width - 10, world.height - 10);
}

function drawTreeFallback(ctx, x, y) {
  rect(ctx, x - 8, y - 54, 16, 72, '#6e4128');
  ctx.fillStyle = '#2f6c35';
  ctx.beginPath(); ctx.arc(x, y - 71, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4f8d42';
  ctx.beginPath(); ctx.arc(x - 17, y - 78, 21, 0, Math.PI * 2); ctx.fill();
}

function drawRockFallback(ctx, x, y) {
  poly(ctx, [[x-28,y+10],[x-20,y-12],[x-8,y-28],[x+8,y-24],[x+28,y],[x+20,y+14],[x-20,y+14]], '#59606a');
  poly(ctx, [[x-18,y],[x-8,y-22],[x+2,y-21],[x,y+8]], '#949aa2');
}

function drawGrassFallback(ctx, x, y) {
  ctx.strokeStyle = '#72a64b';
  ctx.lineWidth = 4;
  for (let i = -15; i <= 15; i += 6) {
    ctx.beginPath(); ctx.moveTo(x + i, y + 10); ctx.lineTo(x + i * .55, y - 18 - Math.abs(i) * .3); ctx.stroke();
  }
}

function drawPlayerFallback(ctx, player, t) {
  const bob = player.state === 'walk' ? Math.round(Math.abs(Math.sin(t * 10)) * 2) : 0;
  rect(ctx, player.x - 12, player.y - 28 + bob, 24, 35, '#315c3c');
  rect(ctx, player.x - 9, player.y - 42 + bob, 18, 15, '#d99363');
  rect(ctx, player.x - 10, player.y - 46 + bob, 20, 7, '#4b2c20');
}
