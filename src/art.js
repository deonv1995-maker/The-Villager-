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

function ready(img) { return img.complete && img.naturalWidth > 0; }

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

function ellipse(ctx, x, y, rx, ry, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGround(ctx, originX, originY, width, height, grid = 32) {
  ctx.fillStyle = '#4d7834';
  ctx.fillRect(0, 0, width, height);

  const sx = ((originX % grid) + grid) % grid;
  const sy = ((originY % grid) + grid) % grid;

  for (let y = sy - grid; y < height + grid; y += grid) {
    for (let x = sx - grid; x < width + grid; x += grid) {
      const gx = Math.floor((x - originX) / grid);
      const gy = Math.floor((y - originY) / grid);

      if (ready(ASSETS.ground)) ctx.drawImage(ASSETS.ground, x, y, grid, grid);
      else { ctx.fillStyle = '#5f8a3b'; ctx.fillRect(x, y, grid, grid); }

      const tone = hash(gx, gy, 2);
      if (tone < .18) rect(ctx, x, y, grid, grid, 'rgba(36,77,37,.09)');
      else if (tone > .84) rect(ctx, x, y, grid, grid, 'rgba(190,207,103,.06)');

      const dirt = hash(gx, gy, 7);
      if (dirt < .12) {
        rect(ctx, x + 3, y + 18, 13, 7, '#6f4d32');
        rect(ctx, x + 7, y + 18, 7, 4, '#9f7149');
        if (dirt < .045) rect(ctx, x + 15, y + 22, 7, 4, '#7e5636');
      }

      const tuft = hash(gx, gy, 11);
      if (tuft < .20) {
        rect(ctx, x + 5, y + 8, 2, 8, '#345d2b');
        rect(ctx, x + 8, y + 5, 2, 11, '#7aa64b');
        rect(ctx, x + 11, y + 9, 2, 7, '#4f7f37');
      }

      const flower = hash(gx, gy, 13);
      if (flower < .065) {
        const fx = x + 20 + Math.floor(hash(gx, gy, 14) * 5);
        const fy = y + 10 + Math.floor(hash(gx, gy, 15) * 8);
        rect(ctx, fx, fy + 2, 2, 7, '#365f2e');
        const c = flower < .02 ? '#d96b63' : flower < .04 ? '#e9d35d' : '#eee9cf';
        rect(ctx, fx - 2, fy, 3, 3, c);
        rect(ctx, fx + 1, fy - 2, 3, 3, c);
      }

      const pebble = hash(gx, gy, 17);
      if (pebble < .08) {
        rect(ctx, x + 22, y + 23, 5, 3, '#5d6258');
        rect(ctx, x + 23, y + 22, 3, 2, '#979c88');
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
  ellipse(ctx, node.x + 4, node.y + 16, 48, 13, '#122016', .28);
  if (!ready(ASSETS.trees)) return drawTreeFallback(ctx, node.x, node.y);
  const variant = Math.floor(hash(node.x, node.y, 3) * 3) % 3;
  ctx.drawImage(ASSETS.trees, variant * 128, 0, 128, 160, node.x - 68, node.y - 146, 136, 170);
  if (hash(node.x, node.y, 21) > .5) {
    rect(ctx, node.x - 17, node.y + 15, 7, 3, '#769b4a');
    rect(ctx, node.x + 12, node.y + 17, 9, 3, '#4f7a37');
  }
}

function drawRockSprite(ctx, node) {
  ellipse(ctx, node.x, node.y + 12, 31, 10, '#111514', .24);
  if (!ready(ASSETS.rocks)) return drawRockFallback(ctx, node.x, node.y);
  const variant = Math.floor(hash(node.x, node.y, 5) * 4) % 4;
  ctx.drawImage(ASSETS.rocks, variant * 96, 0, 96, 96, node.x - 50, node.y - 78, 100, 100);
  if (hash(node.x, node.y, 22) > .6) {
    rect(ctx, node.x - 23, node.y + 11, 6, 3, '#55733b');
    rect(ctx, node.x + 18, node.y + 10, 5, 3, '#75984b');
  }
}

function drawGrassSprite(ctx, node) {
  ellipse(ctx, node.x, node.y + 10, 23, 7, '#121912', .18);
  if (!ready(ASSETS.grass)) return drawGrassFallback(ctx, node.x, node.y);
  const variant = Math.floor(hash(node.x, node.y, 9) * 4) % 4;
  ctx.drawImage(ASSETS.grass, variant * 64, 0, 64, 64, node.x - 34, node.y - 50, 68, 68);
}

export function drawPlayer(ctx, player, gameTime, crafting) {
  const frame = playerFrame(player.state, gameTime);
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  ellipse(ctx, x, y + 16, 18, 7, '#101713', .30);

  if (!ready(ASSETS.player)) {
    drawPlayerFallback(ctx, player, gameTime);
  } else {
    ctx.save();
    const flip = player.facingX < -.2;
    ctx.translate(x, 0);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(ASSETS.player, frame * 64, 0, 64, 80, -38, y - 72, 76, 95);
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
  ctx.translate(player.x + dir * 13, player.y - 28);
  ctx.rotate(swing);
  rect(ctx, -2, -1, 5, 7, TOOL.skin);
  rect(ctx, 0, 3, 4, 29, TOOL.leather);
  rect(ctx, 1, 5, 2, 24, TOOL.leatherDark);

  if (!equipped) rect(ctx, -1, 26, 6, 6, TOOL.skin);
  else if (cls === 'axe') {
    const head = equipped.id === 'stone_axe' ? TOOL.stone : TOOL.metal;
    poly(ctx, [[-11,24],[3,22],[10,25],[4,33],[-10,31]], head);
    rect(ctx, -8, 25, 9, 3, TOOL.metalHi);
  } else if (cls === 'pickaxe') {
    const head = equipped.id === 'stone_pickaxe' ? TOOL.stone : TOOL.metal;
    poly(ctx, [[-12,23],[0,21],[12,24],[9,28],[0,25],[-9,28]], head);
    rect(ctx, -6, 23, 12, 2, TOOL.metalHi);
  } else {
    ctx.strokeStyle = TOOL.metalHi;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(8, 25, 10, -1.25, .6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTargetRing(ctx, node) {
  if (!node?.active) return;
  ellipse(ctx, node.x, node.y + 8, node.config.radius + 13, 12, '#e8cf67', .10);
  ctx.strokeStyle = 'rgba(246,226,133,.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.ellipse(node.x, node.y + 8, node.config.radius + 12, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawWorldBorder(ctx, world) {
  ctx.strokeStyle = '#1b2e1e';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, world.width, world.height);
  ctx.strokeStyle = '#78984e';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, world.width - 10, world.height - 10);
}

function drawTreeFallback(ctx, x, y) {
  rect(ctx, x - 8, y - 54, 16, 72, '#6e4128');
  ctx.fillStyle = '#2f6c35'; ctx.beginPath(); ctx.arc(x, y - 71, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4f8d42'; ctx.beginPath(); ctx.arc(x - 17, y - 78, 21, 0, Math.PI * 2); ctx.fill();
}

function drawRockFallback(ctx, x, y) {
  poly(ctx, [[x-28,y+10],[x-20,y-12],[x-8,y-28],[x+8,y-24],[x+28,y],[x+20,y+14],[x-20,y+14]], '#59606a');
  poly(ctx, [[x-18,y],[x-8,y-22],[x+2,y-21],[x,y+8]], '#949aa2');
}

function drawGrassFallback(ctx, x, y) {
  ctx.strokeStyle = '#72a64b'; ctx.lineWidth = 4;
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
