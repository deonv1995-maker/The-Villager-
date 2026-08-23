const GRASS_COLORS = [0x315f2f, 0x396b32, 0x42763a, 0x4d803f, 0x567f3f];
const FLOWER_COLORS = [0xe8d35a, 0xf1e7a1, 0xd96b62, 0xc9a6df];

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createGrassTexture(scene) {
  if (scene.textures.exists('world-grass-pixel')) return;

  const size = 96;
  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(0x3f7137, 1);
  graphics.fillRect(0, 0, size, size);

  const rand = seeded(2000);
  for (let i = 0; i < 210; i += 1) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const color = GRASS_COLORS[Math.floor(rand() * GRASS_COLORS.length)];
    const w = rand() > 0.72 ? 2 : 1;
    const h = rand() > 0.82 ? 3 : 1;
    graphics.fillStyle(color, 0.85);
    graphics.fillRect(x, y, w, h);
  }

  for (let i = 0; i < 14; i += 1) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    graphics.fillStyle(0x244f2b, 0.8);
    graphics.fillRect(x, y, 1, 4);
    graphics.fillStyle(0x5f913f, 0.9);
    graphics.fillRect(x + 2, y + 1, 1, 3);
  }

  graphics.generateTexture('world-grass-pixel', size, size);
  graphics.destroy();
}

function addGrassTuft(scene, x, y, scale = 1) {
  const g = scene.add.graphics().setDepth(y - 0.2);
  g.lineStyle(Math.max(1, Math.floor(2 * scale)), 0x214f2c, 1);
  const blades = [-9, -5, -1, 3, 7, 11];
  blades.forEach((offset, index) => {
    const height = (10 + (index % 3) * 4) * scale;
    g.beginPath();
    g.moveTo(x + offset * scale, y + 3 * scale);
    g.lineTo(x + (offset + (index % 2 ? 3 : -2)) * scale, y - height);
    g.strokePath();
  });
  g.lineStyle(Math.max(1, Math.floor(scale)), 0x6a9640, 1);
  blades.slice(1, 5).forEach((offset, index) => {
    g.beginPath();
    g.moveTo(x + offset * scale, y);
    g.lineTo(x + (offset + 2) * scale, y - (7 + index * 2) * scale);
    g.strokePath();
  });
}

function addFlowerCluster(scene, x, y, count, seedValue) {
  const rand = seeded(seedValue);
  for (let i = 0; i < count; i += 1) {
    const px = x + (rand() - 0.5) * 70;
    const py = y + (rand() - 0.5) * 44;
    scene.add.rectangle(px, py + 4, 1, 7, 0x2f6330, 1).setDepth(py);
    const bloom = scene.add.rectangle(
      Math.round(px),
      Math.round(py),
      rand() > 0.5 ? 3 : 2,
      rand() > 0.5 ? 3 : 2,
      FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)],
      1,
    );
    bloom.setDepth(py + 0.1);
  }
}

function addGroundVariation(scene, worldWidth, worldHeight) {
  const rand = seeded(73621);

  for (let i = 0; i < 90; i += 1) {
    const x = 45 + rand() * (worldWidth - 90);
    const y = 45 + rand() * (worldHeight - 90);
    const width = 24 + rand() * 72;
    const height = 10 + rand() * 28;
    const patch = scene.add.ellipse(x, y, width, height, rand() > 0.5 ? 0x2f6030 : 0x568242, 0.16);
    patch.setDepth(-498);
  }

  const tuftPositions = [
    [260, 250], [390, 330], [520, 180], [610, 930], [770, 240], [835, 865],
    [1010, 210], [1180, 920], [1320, 245], [1450, 900], [1580, 320], [1650, 730],
    [290, 820], [510, 1030], [1260, 1040], [1530, 1030],
  ];
  tuftPositions.forEach(([x, y], index) => addGrassTuft(scene, x, y, index % 3 === 0 ? 1.15 : 1));

  addFlowerCluster(scene, 330, 490, 15, 201);
  addFlowerCluster(scene, 510, 865, 12, 202);
  addFlowerCluster(scene, 1260, 330, 14, 203);
  addFlowerCluster(scene, 1480, 760, 16, 204);
  addFlowerCluster(scene, 760, 990, 13, 205);
}

export function createWorldArt(scene, gameConfig) {
  createGrassTexture(scene);

  const ground = scene.add.tileSprite(
    gameConfig.world.width / 2,
    gameConfig.world.height / 2,
    gameConfig.world.width,
    gameConfig.world.height,
    'world-grass-pixel',
  );
  ground.setDepth(-500);

  addGroundVariation(scene, gameConfig.world.width, gameConfig.world.height);
  return { ground };
}
