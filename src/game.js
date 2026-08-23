import { GAME_CONFIG } from './config.js';
import { Inventory, renderInventory } from './inventory.js';
import { VirtualJoystick } from './input.js';
import { createStarterResources } from './resources.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const joystick = new VirtualJoystick(
  document.getElementById('joystick'),
  document.getElementById('joystick-knob'),
);

const targetPanel = document.getElementById('target-panel');
const targetName = document.getElementById('target-name');
const harvestProgress = document.getElementById('harvest-progress');
const inventoryPanel = document.getElementById('inventory-panel');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryButton = document.getElementById('inventory-button');
const inventoryClose = document.getElementById('inventory-close');

const inventory = new Inventory(() => renderInventory(inventoryGrid, inventory));
renderInventory(inventoryGrid, inventory);

inventoryButton.addEventListener('click', () => inventoryPanel.classList.remove('hidden'));
inventoryClose.addEventListener('click', () => inventoryPanel.classList.add('hidden'));

const player = {
  x: GAME_CONFIG.world.width / 2,
  y: GAME_CONFIG.world.height / 2,
  facingX: 0,
  facingY: 1,
};

const camera = { x: player.x, y: player.y };
const resources = createStarterResources();
const keyboard = new Set();

let currentTarget = null;
let harvestElapsed = 0;
let lastTime = performance.now();
let gameTime = 0;

window.addEventListener('keydown', (event) => keyboard.add(event.key.toLowerCase()));
window.addEventListener('keyup', (event) => keyboard.delete(event.key.toLowerCase()));
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);

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
  if (inventoryPanel.classList.contains('hidden')) {
    updatePlayer(dt);
    updateHarvest(dt);
  } else {
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

  if (Math.hypot(x, y) > 0.05) {
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
}

function updateHarvest(dt) {
  const nearest = findNearestHarvestable();

  if (nearest !== currentTarget) {
    currentTarget = nearest;
    harvestElapsed = 0;
  }

  if (!currentTarget) {
    targetPanel.classList.add('hidden');
    harvestProgress.style.width = '0%';
    return;
  }

  harvestElapsed += dt;
  const duration = currentTarget.config.harvestSeconds;
  const progress = Math.min(harvestElapsed / duration, 1);

  targetPanel.classList.remove('hidden');
  targetName.textContent = `Harvesting ${currentTarget.config.name}`;
  harvestProgress.style.width = `${progress * 100}%`;

  if (harvestElapsed >= duration) {
    const drop = currentTarget.harvest();
    if (drop) inventory.add(drop.itemId, drop.amount);
    currentTarget = null;
    harvestElapsed = 0;
  }
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
  ctx.fillStyle = '#5b9346';

  for (let y = startY; y < height; y += grid) {
    for (let x = startX; x < width; x += grid) {
      const worldX = Math.floor((x - originX) / grid);
      const worldY = Math.floor((y - originY) / grid);
      if ((worldX + worldY) % 3 === 0) ctx.fillRect(x + 5, y + 8, 3, 3);
      if ((worldX * 7 + worldY * 11) % 5 === 0) ctx.fillRect(x + 22, y + 19, 2, 5);
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
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(x - 24, y + 15, 48, 12);
  ctx.fillStyle = '#6b4425';
  ctx.fillRect(x - 7, y - 2, 14, 32);
  ctx.fillStyle = '#83532c';
  ctx.fillRect(x - 4, y + 1, 5, 25);
  ctx.fillStyle = '#28552c';
  ctx.fillRect(x - 25, y - 35, 50, 36);
  ctx.fillRect(x - 18, y - 48, 37, 48);
  ctx.fillStyle = '#36713a';
  ctx.fillRect(x - 18, y - 41, 28, 21);
  ctx.fillRect(x + 7, y - 28, 15, 18);
  ctx.fillStyle = '#4b8c47';
  ctx.fillRect(x - 11, y - 37, 11, 12);
}

function drawRock(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(x - 23, y + 10, 46, 10);
  ctx.fillStyle = '#777a75';
  ctx.fillRect(x - 20, y - 8, 40, 24);
  ctx.fillRect(x - 12, y - 18, 25, 10);
  ctx.fillStyle = '#989b95';
  ctx.fillRect(x - 10, y - 12, 17, 8);
  ctx.fillStyle = '#5f625e';
  ctx.fillRect(x + 9, y + 2, 11, 10);
  ctx.fillRect(x - 18, y + 9, 12, 7);
}

function drawGrass(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(x - 17, y + 10, 34, 7);
  ctx.fillStyle = '#245b2b';
  ctx.fillRect(x - 13, y - 4, 5, 18);
  ctx.fillRect(x - 4, y - 12, 5, 26);
  ctx.fillRect(x + 6, y - 7, 5, 21);
  ctx.fillStyle = '#78a944';
  ctx.fillRect(x - 8, y - 9, 4, 17);
  ctx.fillRect(x + 1, y - 17, 4, 23);
  ctx.fillRect(x + 10, y - 12, 4, 20);
}

function drawPlayer(x, y) {
  const walking = Math.abs(joystick.vector.x) + Math.abs(joystick.vector.y) > 0.12;
  const bob = walking ? Math.round(Math.sin(gameTime * 12) * 1.5) : 0;

  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(x - 13, y + 15, 26, 8);

  ctx.fillStyle = '#3b2a1b';
  ctx.fillRect(x - 10, y + 7 + bob, 7, 13);
  ctx.fillRect(x + 3, y + 7 - bob, 7, 13);

  ctx.fillStyle = '#394f7a';
  ctx.fillRect(x - 12, y - 11, 24, 24);
  ctx.fillStyle = '#5270a6';
  ctx.fillRect(x - 7, y - 8, 14, 15);

  ctx.fillStyle = '#d69b68';
  ctx.fillRect(x - 9, y - 25, 18, 16);
  ctx.fillStyle = '#6d4129';
  ctx.fillRect(x - 10, y - 29, 20, 7);
  ctx.fillRect(x - 9, y - 24, 4, 5);

  const eyeX = player.facingX > 0.3 ? 5 : player.facingX < -0.3 ? -6 : 0;
  ctx.fillStyle = '#251b16';
  ctx.fillRect(x + eyeX - 1, y - 19, 2, 2);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
