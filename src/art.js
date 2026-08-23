const ASSETS = {
  ground: image('../assets/ground-raster.png'),
  tree: image('../assets/tree-raster.png'),
  rock: image('../assets/rock-raster.png'),
  grass: image('../assets/grass-raster.png'),
  player: image('../assets/player-raster.png'),
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

export function drawGround(ctx, originX, originY, width, height, grid = 48) {
  ctx.fillStyle = '#718c35';
  ctx.fillRect(0, 0, width, height);

  const tile = 96;
  const sx = ((originX % tile) + tile) % tile;
  const sy = ((originY % tile) + tile) % tile;

  if (ready(ASSETS.ground)) {
    for (let y = sy - tile; y < height + tile; y += tile) {
      for (let x = sx - tile; x < width + tile; x += tile) {
        const gx = Math.floor((x - originX) / tile);
        const gy = Math.floor((y - originY) / tile);
        const flipX = hash(gx, gy, 2) > .5;
        const flipY = hash(gx, gy, 3) > .5;
        ctx.save();
        ctx.translate(x + (flipX ? tile : 0), y + (flipY ? tile : 0));
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(ASSETS.ground, 0, 0, tile, tile);
        ctx.restore();
      }
    }
  }
}

export function drawResource(ctx, node) {
  if (node.type === 'tree') return drawTree(ctx, node);
  if (node.type === 'rock') return drawRock(ctx, node);
  return drawGrass(ctx, node);
}

function drawTree(ctx, node) {
  ellipse(ctx, node.x + 5, node.y + 18, 60, 16, '#11180f', .28);
  if (!ready(ASSETS.tree)) return;
  const scale = .90 + hash(node.x, node.y, 4) * .18;
  const w = 146 * scale;
  const h = 210 * scale;
  const flip = hash(node.x, node.y, 5) > .5;
  ctx.save();
  ctx.translate(node.x, node.y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(ASSETS.tree, -w / 2, -h + 24, w, h);
  ctx.restore();
}

function drawRock(ctx, node) {
  ellipse(ctx, node.x, node.y + 12, 40, 11, '#111514', .24);
  if (!ready(ASSETS.rock)) return;
  const scale = .76 + hash(node.x, node.y, 7) * .22;
  const w = 109 * scale;
  const h = 88 * scale;
  const flip = hash(node.x, node.y, 8) > .5;
  ctx.save();
  ctx.translate(node.x, node.y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(ASSETS.rock, -w / 2, -h + 17, w, h);
  ctx.restore();
}

function drawGrass(ctx, node) {
  ellipse(ctx, node.x, node.y + 8, 24, 7, '#101610', .16);
  if (!ready(ASSETS.grass)) return;
  const scale = .85 + hash(node.x, node.y, 10) * .30;
  const w = 54 * scale;
  const h = 64 * scale;
  const flip = hash(node.x, node.y, 11) > .5;
  ctx.save();
  ctx.translate(node.x, node.y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(ASSETS.grass, -w / 2, -h + 14, w, h);
  ctx.restore();
}

export function drawPlayer(ctx, player, gameTime, crafting) {
  const walking = player.state === 'walk';
  const harvesting = player.state.startsWith('harvest-');
  const bob = walking ? Math.sin(gameTime * 10) * 2.5 : harvesting ? Math.sin(gameTime * 7) * 1.2 : Math.sin(gameTime * 2.2) * .7;
  const lean = harvesting ? Math.sin(gameTime * 7) * .035 : walking ? Math.sin(gameTime * 9) * .02 : 0;
  const x = Math.round(player.x);
  const y = Math.round(player.y);

  ellipse(ctx, x, y + 15, 19, 7, '#101713', .28);

  if (ready(ASSETS.player)) {
    const w = 58;
    const h = 129;
    const flip = player.facingX < -.2;
    ctx.save();
    ctx.translate(x, y + bob);
    if (flip) ctx.scale(-1, 1);
    ctx.rotate(lean * (flip ? -1 : 1));
    ctx.drawImage(ASSETS.player, -w / 2, -h + 19, w, h);
    ctx.restore();
  }

  if (harvesting) drawTool(ctx, player, gameTime, crafting);
}

function drawTool(ctx, player, t, crafting) {
  const cls = player.state === 'harvest-tree' ? 'axe' : player.state === 'harvest-rock' ? 'pickaxe' : 'sickle';
  const equipped = crafting.getEquipped(cls);
  const dir = player.facingX < -.2 ? -1 : 1;
  const swing = Math.sin(t * 10) * .72 * dir;

  ctx.save();
  ctx.translate(player.x + dir * 18, player.y - 34);
  ctx.rotate(swing);
  rect(ctx, -2, -1, 5, 7, TOOL.skin);
  rect(ctx, 0, 3, 4, 30, TOOL.leather);
  rect(ctx, 1, 5, 2, 25, TOOL.leatherDark);

  if (!equipped) rect(ctx, -1, 27, 6, 6, TOOL.skin);
  else if (cls === 'axe') {
    const head = equipped.id === 'stone_axe' ? TOOL.stone : TOOL.metal;
    poly(ctx, [[-12,24],[3,22],[11,25],[4,34],[-11,32]], head);
    rect(ctx, -8, 25, 9, 3, TOOL.metalHi);
  } else if (cls === 'pickaxe') {
    const head = equipped.id === 'stone_pickaxe' ? TOOL.stone : TOOL.metal;
    poly(ctx, [[-13,23],[0,21],[13,24],[9,28],[0,25],[-10,28]], head);
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
