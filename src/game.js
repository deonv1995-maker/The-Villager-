import { GAME_CONFIG } from './config.js';
import { Inventory, renderInventory } from './inventory.js';
import { VirtualJoystick } from './input.js';
import { createStarterResources } from './resources.js';
import { CraftingSystem, renderCrafting } from './crafting.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const joystick = new VirtualJoystick(
  document.getElementById('joystick'),
  document.getElementById('joystick-knob'),
);

const targetPanel = document.getElementById('target-panel');
const targetName = document.getElementById('target-name');
const toolName = document.getElementById('tool-name');
const harvestProgress = document.getElementById('harvest-progress');
const inventoryPanel = document.getElementById('inventory-panel');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryButton = document.getElementById('inventory-button');
const inventoryClose = document.getElementById('inventory-close');
const craftingPanel = document.getElementById('crafting-panel');
const craftingList = document.getElementById('crafting-list');
const craftingButton = document.getElementById('crafting-button');
const craftingClose = document.getElementById('crafting-close');
const equippedTools = document.getElementById('equipped-tools');

let crafting = null;
const inventory = new Inventory(() => refreshPanels());
crafting = new CraftingSystem(inventory, () => refreshPanels());
refreshPanels();

inventoryButton.addEventListener('click', () => openPanel(inventoryPanel));
inventoryClose.addEventListener('click', () => inventoryPanel.classList.add('hidden'));
craftingButton.addEventListener('click', () => openPanel(craftingPanel));
craftingClose.addEventListener('click', () => craftingPanel.classList.add('hidden'));

const player = {
  x: GAME_CONFIG.world.width / 2,
  y: GAME_CONFIG.world.height / 2,
  facingX: 0,
  facingY: 1,
  state: 'idle',
};

const camera = { x: player.x, y: player.y };
const resources = createStarterResources();
const keyboard = new Set();

let currentTarget = null;
let harvestElapsed = 0;
let lastTime = performance.now();
let gameTime = 0;
let movementMagnitude = 0;

window.addEventListener('keydown', (event) => keyboard.add(event.key.toLowerCase()));
window.addEventListener('keyup', (event) => keyboard.delete(event.key.toLowerCase()));
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);

function openPanel(panel) {
  inventoryPanel.classList.add('hidden');
  craftingPanel.classList.add('hidden');
  panel.classList.remove('hidden');
  clearHarvestTarget();
}

function anyPanelOpen() {
  return !inventoryPanel.classList.contains('hidden') || !craftingPanel.classList.contains('hidden');
}

function refreshPanels() {
  renderInventory(inventoryGrid, inventory);
  if (!crafting) return;
  renderCrafting(craftingList, crafting, inventory);
  renderEquippedTools();
}

function renderEquippedTools() {
  equippedTools.innerHTML = '';
  const classes = [
    ['axe', 'Trees'],
    ['pickaxe', 'Stone'],
    ['sickle', 'Grass'],
  ];

  for (const [toolClass, label] of classes) {
    const tool = crafting.getEquipped(toolClass);
    const chip = document.createElement('div');
    chip.className = 'equipped-chip';
    chip.textContent = tool ? `${label}: ${tool.name}` : `${label}: Hands`;
    equippedTools.appendChild(chip);
  }
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  gameTime += dt;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (!anyPanelOpen()) {
    updatePlayer(dt);
    updateHarvest(dt);
  } else {
    movementMagnitude = 0;
    player.state = 'idle';
    clearHarvestTarget();
  }

  for (const node of resources) node.update(dt);

  camera.x += (player.x - camera.x) * GAME_CONFIG.camera.followLerp;
  camera.y += (player.y - camera.y) * GAME_CONFIG.camera.followLerp;
}

function updatePlayer(dt) {
  let x = joystick.vector.x;
  let y = joystick.vector.y;

  if (keyboard.has('a') || keyboard.has('arrowleft')) x -= 1;
  if (keyboard.has('d') || keyboard.has('arrowright')) x += 1;
  if (keyboard.has('w') || keyboard.has('arrowup')) y -= 1;
  if (keyboard.has('s') || keyboard.has('arrowdown')) y += 1;

  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }

  movementMagnitude = Math.hypot(x, y);
  if (movementMagnitude > 0.05) {
    player.facingX = x;
    player.facingY = y;
  }

  player.x = clamp(
    player.x + x * GAME_CONFIG.player.speed * dt,
    GAME_CONFIG.player.radius,
    GAME_CONFIG.world.width - GAME_CONFIG.player.radius,
  );
  player.y = clamp(
    player.y + y * GAME_CONFIG.player.speed * dt,
    GAME_CONFIG.player.radius,
    GAME_CONFIG.world.height - GAME_CONFIG.player.radius,
  );

  if (!currentTarget) player.state = movementMagnitude > 0.05 ? 'walk' : 'idle';
}

function updateHarvest(dt) {
  const nearest = findNearestHarvestable();

  if (nearest !== currentTarget) {
    currentTarget = nearest;
    harvestElapsed = 0;
  }

  if (!currentTarget) {
    player.state = movementMagnitude > 0.05 ? 'walk' : 'idle';
    targetPanel.classList.add('hidden');
    harvestProgress.style.width = '0%';
    return;
  }

  const modifiers = crafting.getHarvestModifiers(currentTarget.config);
  const duration = currentTarget.config.harvestSeconds / modifiers.speedMultiplier;
  harvestElapsed += dt;
  const progress = Math.min(harvestElapsed / duration, 1);

  player.state = `harvest-${currentTarget.type}`;
  faceTarget(currentTarget);
  targetPanel.classList.remove('hidden');
  targetName.textContent = `Harvesting ${currentTarget.config.name}`;
  toolName.textContent = modifiers.tool
    ? `${modifiers.tool.name} · ${modifiers.speedMultiplier.toFixed(2)}× speed`
    : 'Bare hands';
  harvestProgress.style.width = `${progress * 100}%`;

  if (harvestElapsed >= duration) {
    const drop = currentTarget.harvest();
    if (drop) {
      const amount = Math.max(1, Math.round(drop.amount * modifiers.yieldMultiplier));
      inventory.add(drop.itemId, amount);
    }
    currentTarget = null;
    harvestElapsed = 0;
  }
}

function faceTarget(target) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  player.facingX = dx / length;
  player.facingY = dy / length;
}

function clearHarvestTarget() {
  currentTarget = null;
  harvestElapsed = 0;
  targetPanel.classList.add('hidden');
  harvestProgress.style.width = '0%';
}

function findNearestHarvestable() {
  let nearest = null;
  let bestDistance = Infinity;

  for (const node of resources) {
    if (!node.active) continue;
    const distance = Math.hypot(node.x - player.x, node.y - player.y);
    const allowed = GAME_CONFIG.player.harvestRange + node.config.radius;
    if (distance <= allowed && distance < bestDistance) {
      nearest = node;
      bestDistance = distance;
    }
  }

  return nearest;
}

function draw() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const originX = Math.round(viewportWidth / 2 - camera.x);
  const originY = Math.round(viewportHeight / 2 - camera.y);

  drawGround(originX, originY, viewportWidth, viewportHeight);

  ctx.save();
  ctx.translate(originX, originY);

  drawWorldBorder();
  drawResourceRange();

  const drawable = [
    ...resources.filter((node) => node.active),
    { type: 'player', x: player.x, y: player.y },
  ].sort((a, b) => a.y - b.y);

  for (const item of drawable) {
    if (item.type === 'player') drawPlayer(player.x, player.y);
    else drawResource(item);
  }

  ctx.restore();
}

function drawGround(originX, originY, width, height) {
  ctx.fillStyle = '#4f853e';
  ctx.fillRect(0, 0, width, height);

  const grid = GAME_CONFIG.world.grid;
  const startX = mod(originX, grid);
  const startY = mod(originY, grid);

  for (let y = startY; y < height; y += grid) {
    for (let x = startX; x < width; x += grid) {
      const worldX = Math.floor((x - originX) / grid);
      const worldY = Math.floor((y - originY) / grid);
      if ((worldX + worldY) % 3 === 0) {
        ctx.fillStyle = '#5b9346';
        ctx.fillRect(x + 5, y + 8, 3, 3);
      }
      if ((worldX * 7 + worldY * 11) % 5 === 0) {
        ctx.fillStyle = '#376d34';
        ctx.fillRect(x + 22, y + 19, 2, 5);
      }
      if ((worldX * 13 + worldY * 3) % 11 === 0) {
        ctx.fillStyle = '#79a84e';
        ctx.fillRect(x + 14, y + 5, 2, 2);
        ctx.fillRect(x + 16, y + 3, 2, 4);
      }
    }
  }
}

function drawWorldBorder() {
  ctx.strokeStyle = '#29381f';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, GAME_CONFIG.world.width, GAME_CONFIG.world.height);
}

function drawResourceRange() {
  if (!currentTarget?.active) return;
  ctx.strokeStyle = 'rgba(255, 241, 162, .65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(currentTarget.x, currentTarget.y, currentTarget.config.radius + 6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawResource(node) {
  if (node.type === 'tree') drawTree(node.x, node.y);
  else if (node.type === 'rock') drawRock(node.x, node.y);
  else drawGrass(node.x, node.y);
}

function drawTree(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.fillRect(x - 31, y + 19, 62, 12);

  ctx.fillStyle = '#4a2f20';
  ctx.fillRect(x - 9, y - 8, 18, 41);
  ctx.fillStyle = '#70442a';
  ctx.fillRect(x - 5, y - 8, 7, 39);
  ctx.fillRect(x - 18, y - 12, 14, 7);
  ctx.fillRect(x + 4, y - 16, 17, 7);

  ctx.fillStyle = '#234928';
  ctx.fillRect(x - 34, y - 54, 69, 31);
  ctx.fillRect(x - 27, y - 70, 54, 45);
  ctx.fillRect(x - 17, y - 79, 36, 23);
  ctx.fillStyle = '#376c32';
  ctx.fillRect(x - 27, y - 59, 30, 24);
  ctx.fillRect(x + 2, y - 65, 25, 30);
  ctx.fillRect(x - 15, y - 72, 28, 19);
  ctx.fillStyle = '#579043';
  ctx.fillRect(x - 20, y - 64, 14, 12);
  ctx.fillRect(x + 7, y - 57, 12, 12);
  ctx.fillRect(x - 7, y - 74, 13, 9);
}

function drawRock(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(x - 26, y + 12, 52, 10);
  ctx.fillStyle = '#555b60';
  ctx.fillRect(x - 23, y - 4, 46, 20);
  ctx.fillRect(x - 14, y - 19, 27, 18);
  ctx.fillStyle = '#777f83';
  ctx.fillRect(x - 17, y - 10, 18, 12);
  ctx.fillRect(x + 4, y - 4, 14, 12);
  ctx.fillStyle = '#a7adb0';
  ctx.fillRect(x - 8, y - 16, 11, 6);
  ctx.fillRect(x - 18, y - 5, 6, 7);
  ctx.fillStyle = '#3e4448';
  ctx.fillRect(x + 11, y + 5, 10, 9);
}

function drawGrass(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(x - 19, y + 11, 38, 7);
  ctx.fillStyle = '#204d27';
  ctx.fillRect(x - 14, y - 6, 5, 20);
  ctx.fillRect(x - 5, y - 15, 5, 29);
  ctx.fillRect(x + 6, y - 10, 5, 24);
  ctx.fillStyle = '#4d8c38';
  ctx.fillRect(x - 10, y - 12, 4, 20);
  ctx.fillRect(x + 1, y - 19, 4, 25);
  ctx.fillRect(x + 11, y - 14, 4, 22);
  ctx.fillStyle = '#84b84d';
  ctx.fillRect(x - 2, y - 16, 3, 13);
  ctx.fillRect(x + 8, y - 10, 3, 10);
}

function drawPlayer(x, y) {
  const walking = player.state === 'walk';
  const harvesting = player.state.startsWith('harvest-');
  const bob = walking ? Math.round(Math.sin(gameTime * 12) * 2) : harvesting ? Math.round(Math.sin(gameTime * 8)) : 0;
  const stride = walking ? Math.round(Math.sin(gameTime * 12) * 3) : 0;
  const swing = harvesting ? Math.sin(gameTime * 10) : 0;

  ctx.fillStyle = 'rgba(0,0,0,.24)';
  ctx.fillRect(x - 15, y + 18, 30, 8);

  ctx.fillStyle = '#3b281b';
  ctx.fillRect(x - 10 - stride, y + 8 + bob, 7, 14);
  ctx.fillRect(x + 3 + stride, y + 8 - bob, 7, 14);
  ctx.fillStyle = '#755034';
  ctx.fillRect(x - 11 - stride, y + 18 + bob, 8, 4);
  ctx.fillRect(x + 3 + stride, y + 18 - bob, 8, 4);

  ctx.fillStyle = '#203f2b';
  ctx.fillRect(x - 13, y - 13 + bob, 26, 25);
  ctx.fillStyle = '#315c37';
  ctx.fillRect(x - 9, y - 10 + bob, 18, 17);
  ctx.fillStyle = '#6d472d';
  ctx.fillRect(x - 13, y + 4 + bob, 26, 5);

  ctx.fillStyle = '#d69b68';
  ctx.fillRect(x - 9, y - 27 + bob, 18, 16);
  ctx.fillStyle = '#5a3424';
  ctx.fillRect(x - 10, y - 31 + bob, 20, 7);
  ctx.fillRect(x - 9, y - 26 + bob, 4, 6);

  const eyeX = player.facingX > 0.3 ? 5 : player.facingX < -0.3 ? -6 : 0;
  ctx.fillStyle = '#251b16';
  ctx.fillRect(x + eyeX - 1, y - 21 + bob, 2, 2);

  if (harvesting) drawHarvestTool(x, y + bob, swing);
}

function drawHarvestTool(x, y, swing) {
  const state = player.state;
  const toolClass = state === 'harvest-tree' ? 'axe' : state === 'harvest-rock' ? 'pickaxe' : 'sickle';
  const equipped = crafting.getEquipped(toolClass);
  const reachX = player.facingX >= 0 ? 1 : -1;
  const angle = swing * 0.7 * reachX;

  ctx.save();
  ctx.translate(x + reachX * 10, y - 3);
  ctx.rotate(angle);

  ctx.fillStyle = '#d49a68';
  ctx.fillRect(-2, -1, 5, 6);
  ctx.fillStyle = '#7a4b2b';
  ctx.fillRect(1, -1, 4, 24);

  if (!equipped) {
    ctx.fillStyle = '#d49a68';
    ctx.fillRect(0, 16, 6, 7);
  } else if (toolClass === 'axe') {
    ctx.fillStyle = equipped.id === 'stone_axe' ? '#9ca5a8' : '#b2a07a';
    ctx.fillRect(-8, 17, 16, 8);
    ctx.fillRect(-9, 20, 8, 7);
  } else if (toolClass === 'pickaxe') {
    ctx.fillStyle = equipped.id === 'stone_pickaxe' ? '#9ca5a8' : '#b2a07a';
    ctx.fillRect(-9, 17, 18, 5);
    ctx.fillRect(-10, 20, 5, 5);
    ctx.fillRect(6, 20, 5, 5);
  } else {
    ctx.fillStyle = '#aeb5a8';
    ctx.fillRect(2, 16, 12, 4);
    ctx.fillRect(10, 13, 4, 7);
  }

  ctx.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
