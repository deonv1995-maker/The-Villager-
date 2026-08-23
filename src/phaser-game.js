const release = window.__THE_VILLAGER_RELEASE__;
if (!release?.releaseId || !release?.assets || !release?.playerAtlas) {
  throw new Error('Phaser runtime requires the active release manifest.');
}

const Phaser = window.Phaser;
if (!Phaser) throw new Error('Phaser engine failed to load.');

function moduleUrl(path) {
  const url = new URL(path, import.meta.url);
  url.searchParams.set('r', release.releaseId);
  return url.href;
}

function assetUrl(key) {
  const path = release.assets[key];
  if (!path) throw new Error(`Missing asset mapping: ${key}`);
  const url = new URL(`../${path}`, import.meta.url);
  url.searchParams.set('r', release.releaseId);
  return url.href;
}

const [
  configModule,
  inventoryModule,
  inputModule,
  resourcesModule,
  craftingModule,
  villageModule,
  environmentArtModule,
] = await Promise.all([
  import(moduleUrl('./config.js')),
  import(moduleUrl('./inventory.js')),
  import(moduleUrl('./input.js')),
  import(moduleUrl('./resources.js')),
  import(moduleUrl('./crafting.js')),
  import(moduleUrl('./village.js')),
  import(moduleUrl('./environment-art.js')),
]);

const { GAME_CONFIG } = configModule;
const { Inventory, renderInventory } = inventoryModule;
const { VirtualJoystick } = inputModule;
const { createStarterResources } = resourcesModule;
const { CraftingSystem, renderCrafting } = craftingModule;
const { VILLAGE_CONFIG, createVillage } = villageModule;
const { createWorldArt } = environmentArtModule;

const root = document.getElementById('phaser-root');
const joystick = new VirtualJoystick(
  document.getElementById('joystick'),
  document.getElementById('joystick-knob'),
);

const targetPanel = document.getElementById('target-panel');
const targetName = document.getElementById('target-name');
const toolName = document.getElementById('tool-name');
const harvestProgress = document.getElementById('harvest-progress');
const inventoryPanel = document.getElementById('inventory-panel');
const craftingPanel = document.getElementById('crafting-panel');
const inventoryGrid = document.getElementById('inventory-grid');
const craftingList = document.getElementById('crafting-list');
const equippedTools = document.getElementById('equipped-tools');
const inventoryButton = document.getElementById('inventory-button');
const craftingButton = document.getElementById('crafting-button');
const inventoryClose = document.getElementById('inventory-close');
const craftingClose = document.getElementById('crafting-close');

let crafting = null;
const inventory = new Inventory(refreshPanels);
crafting = new CraftingSystem(inventory, refreshPanels);
refreshPanels();

inventoryButton.addEventListener('click', () => openPanel(inventoryPanel));
craftingButton.addEventListener('click', () => openPanel(craftingPanel));
inventoryClose.addEventListener('click', () => inventoryPanel.classList.add('hidden'));
craftingClose.addEventListener('click', () => craftingPanel.classList.add('hidden'));

const keyboard = new Set();
window.addEventListener('keydown', (event) => keyboard.add(event.key.toLowerCase()));
window.addEventListener('keyup', (event) => keyboard.delete(event.key.toLowerCase()));

function openPanel(panel) {
  inventoryPanel.classList.add('hidden');
  craftingPanel.classList.add('hidden');
  panel.classList.remove('hidden');
  window.__THE_VILLAGER_SCENE__?.clearHarvestTarget();
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
  [['axe', 'Trees'], ['pickaxe', 'Stone'], ['sickle', 'Grass']].forEach(([cls, label]) => {
    const tool = crafting.getEquipped(cls);
    const chip = document.createElement('div');
    chip.className = 'equipped-chip';
    chip.textContent = tool ? `${label}: ${tool.name}` : `${label}: Hands`;
    equippedTools.appendChild(chip);
  });
}

class VillagerScene extends Phaser.Scene {
  constructor() {
    super('villager-world');
    this.resources = createStarterResources();
    this.resourceSprites = new Map();
    this.currentTarget = null;
    this.harvestElapsed = 0;
    this.movementMagnitude = 0;
    this.facingX = 0;
    this.facingY = 1;
    this.village = null;
    this.worldArt = null;
  }

  preload() {
    this.load.image('environment-atlas', assetUrl('environmentAtlas'));
    this.load.image('grass', assetUrl('grass'));
    this.load.spritesheet('player', assetUrl('playerSheet'), {
      frameWidth: release.playerAtlas.frameWidth,
      frameHeight: release.playerAtlas.frameHeight,
    });

    this.load.on('loaderror', (file) => {
      console.error('Phaser asset load failed:', file?.key, file?.src);
    });
  }

  registerEnvironmentAtlasFrames() {
    const texture = this.textures.get('environment-atlas');
    if (!texture || texture.has('cottage')) return;

    texture.add('cottage', 0, 0, 0, 240, 200);
    texture.add('hall', 0, 240, 0, 240, 200);
    texture.add('workshop', 0, 480, 0, 240, 200);
    texture.add('tree', 0, 0, 200, 160, 208);
    texture.add('rock', 0, 160, 200, 144, 104);
    texture.add('well', 0, 304, 200, 96, 112);
    texture.add('path', 0, 400, 200, 96, 96);
  }

  create() {
    window.__THE_VILLAGER_SCENE__ = this;

    this.cameras.main.setBackgroundColor('#315f2f');
    this.cameras.main.setBounds(0, 0, GAME_CONFIG.world.width, GAME_CONFIG.world.height);
    this.physics.world.setBounds(0, 0, GAME_CONFIG.world.width, GAME_CONFIG.world.height);

    this.registerEnvironmentAtlasFrames();
    this.worldArt = createWorldArt(this, GAME_CONFIG);
    this.village = createVillage(this);
    this.createResources();
    this.createPlayer();
    this.createPlayerAnimation();

    this.physics.add.collider(this.player, this.village.blockers);

    this.cameras.main.startFollow(this.player, true, GAME_CONFIG.camera.followLerp, GAME_CONFIG.camera.followLerp);
    this.cameras.main.setZoom(GAME_CONFIG.camera.zoom);
    this.cameras.main.setRoundPixels(true);

    this.scale.on('resize', () => {
      this.cameras.main.setSize(window.innerWidth, window.innerHeight);
      this.cameras.main.setZoom(GAME_CONFIG.camera.zoom);
    });
  }

  createResources() {
    for (const node of this.resources) {
      let sprite;
      if (node.type === 'tree') {
        sprite = this.add.image(node.x, node.y, 'environment-atlas', 'tree');
        sprite.setDisplaySize(160, 208);
        sprite.setOrigin(0.5, 0.90);
      } else if (node.type === 'rock') {
        sprite = this.add.image(node.x, node.y, 'environment-atlas', 'rock');
        sprite.setDisplaySize(144, 104);
        sprite.setOrigin(0.5, 0.82);
      } else {
        sprite = this.add.image(node.x, node.y, 'grass');
        sprite.setDisplaySize(64, 76);
        sprite.setOrigin(0.5, 0.88);
      }

      sprite.setDepth(node.y);
      this.resourceSprites.set(node, sprite);
    }
  }

  createPlayer() {
    const atlas = release.playerAtlas;
    const x = VILLAGE_CONFIG.spawn.x;
    const y = VILLAGE_CONFIG.spawn.y;

    this.player = this.physics.add.sprite(x, y, 'player', 0);
    this.player.setDisplaySize(atlas.drawWidth, atlas.drawHeight);
    this.player.setOrigin(0.5, 0.82);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(y + 1);

    const bodyWidth = Math.max(18, Math.round(atlas.drawWidth * 0.28));
    const bodyHeight = Math.max(20, Math.round(atlas.drawHeight * 0.25));
    this.player.body.setSize(bodyWidth, bodyHeight, true);
  }

  createPlayerAnimation() {
    const frameCount = release.playerAtlas.columns;
    if (frameCount < 2) return;

    this.anims.create({
      key: 'player-walk',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: frameCount - 1 }),
      frameRate: release.playerAtlas.walkFps || 8,
      repeat: -1,
    });
  }

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);

    if (anyPanelOpen()) {
      this.player.setVelocity(0, 0);
      this.stopWalking();
      this.clearHarvestTarget();
    } else {
      this.updatePlayer(dt);
      this.updateHarvest(dt);
    }

    this.updateResources(dt);
    this.player.setDepth(this.player.y + 1);
  }

  updatePlayer() {
    let x = joystick.vector.x;
    let y = joystick.vector.y;

    if (keyboard.has('a') || keyboard.has('arrowleft')) x -= 1;
    if (keyboard.has('d') || keyboard.has('arrowright')) x += 1;
    if (keyboard.has('w') || keyboard.has('arrowup')) y -= 1;
    if (keyboard.has('s') || keyboard.has('arrowdown')) y += 1;

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    this.movementMagnitude = Math.hypot(x, y);
    if (this.movementMagnitude > 0.05) {
      this.facingX = x;
      this.facingY = y;
      this.player.setVelocity(x * GAME_CONFIG.player.speed, y * GAME_CONFIG.player.speed);
      this.player.setFlipX(x < -0.08);
      if (!this.currentTarget) this.playWalking();
    } else {
      this.player.setVelocity(0, 0);
      if (!this.currentTarget) this.stopWalking();
    }
  }

  playWalking() {
    if (this.anims.exists('player-walk')) this.player.play('player-walk', true);
  }

  stopWalking() {
    if (this.player.anims?.isPlaying) this.player.stop();
    this.player.setFrame(0);
  }

  updateHarvest(dt) {
    const nearest = this.findNearestHarvestable();
    if (nearest !== this.currentTarget) {
      this.currentTarget = nearest;
      this.harvestElapsed = 0;
    }

    if (!this.currentTarget) {
      targetPanel.classList.add('hidden');
      harvestProgress.style.width = '0%';
      if (this.movementMagnitude <= 0.05) this.stopWalking();
      return;
    }

    const modifiers = crafting.getHarvestModifiers(this.currentTarget.config);
    const duration = this.currentTarget.config.harvestSeconds / modifiers.speedMultiplier;
    this.harvestElapsed += dt;
    const progress = Math.min(this.harvestElapsed / duration, 1);

    this.faceTarget(this.currentTarget);
    this.player.setVelocity(0, 0);
    this.stopWalking();

    targetPanel.classList.remove('hidden');
    targetName.textContent = `Harvesting ${this.currentTarget.config.name}`;
    toolName.textContent = modifiers.tool
      ? `${modifiers.tool.name} · ${modifiers.speedMultiplier.toFixed(2)}× speed`
      : 'Bare hands';
    harvestProgress.style.width = `${progress * 100}%`;

    if (this.harvestElapsed >= duration) {
      const sprite = this.resourceSprites.get(this.currentTarget);
      const drop = this.currentTarget.harvest();
      if (sprite) sprite.setVisible(false);

      if (drop) {
        const amount = Math.max(1, Math.round(drop.amount * modifiers.yieldMultiplier));
        inventory.add(drop.itemId, amount);
      }

      this.currentTarget = null;
      this.harvestElapsed = 0;
    }
  }

  faceTarget(target) {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    this.facingX = dx / len;
    this.facingY = dy / len;
    this.player.setFlipX(this.facingX < -0.08);
  }

  clearHarvestTarget() {
    this.currentTarget = null;
    this.harvestElapsed = 0;
    targetPanel.classList.add('hidden');
    harvestProgress.style.width = '0%';
  }

  findNearestHarvestable() {
    let nearest = null;
    let best = Infinity;

    for (const node of this.resources) {
      if (!node.active) continue;
      const distance = Math.hypot(node.x - this.player.x, node.y - this.player.y);
      const allowed = GAME_CONFIG.player.harvestRange + node.config.radius;
      if (distance <= allowed && distance < best) {
        nearest = node;
        best = distance;
      }
    }

    return nearest;
  }

  updateResources(dt) {
    for (const node of this.resources) {
      const wasActive = node.active;
      node.update(dt);
      const sprite = this.resourceSprites.get(node);
      if (!sprite) continue;

      if (!wasActive && node.active) sprite.setVisible(true);
      sprite.setDepth(node.y);
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#315f2f',
  transparent: false,
  antialias: false,
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: VillagerScene,
});

window.__THE_VILLAGER_GAME__ = game;
