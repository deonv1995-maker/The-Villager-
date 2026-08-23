export const VILLAGE_CONFIG = Object.freeze({
  centerX: 900,
  centerY: 600,
  width: 720,
  height: 500,
  spawn: { x: 900, y: 760 },
});

export const VILLAGE_BUILDINGS = Object.freeze([
  { id: 'hall', name: 'Village Hall', asset: 'village-hall', x: 900, y: 410, drawWidth: 300, drawHeight: 229, bodyWidth: 176, bodyHeight: 66 },
  { id: 'home-west', name: 'West Cottage', asset: 'village-cottage', x: 650, y: 565, drawWidth: 250, drawHeight: 195, bodyWidth: 148, bodyHeight: 58 },
  { id: 'home-east', name: 'East Cottage', asset: 'village-cottage', x: 1150, y: 565, drawWidth: 250, drawHeight: 195, bodyWidth: 148, bodyHeight: 58 },
  { id: 'workshop', name: 'Workshop', asset: 'village-workshop', x: 700, y: 790, drawWidth: 250, drawHeight: 191, bodyWidth: 154, bodyHeight: 58 },
  { id: 'storehouse', name: 'Storehouse', asset: 'village-workshop', x: 1100, y: 790, drawWidth: 250, drawHeight: 191, bodyWidth: 154, bodyHeight: 58 },
]);

const FLOWERS = [0xf1d86a, 0xe56f68, 0xe6e0b4, 0xc6a4e4, 0xf59a57];

function addBlocker(scene, group, x, y, width, height) {
  const blocker = scene.add.rectangle(x, y, width, height, 0x000000, 0);
  scene.physics.add.existing(blocker, true);
  group.add(blocker);
}

function addFlowerPatch(scene, x, y, count, spreadX, spreadY, seed = 1) {
  for (let i = 0; i < count; i += 1) {
    const a = i * 2.173 + seed;
    const px = x + Math.sin(a) * spreadX * (0.35 + (i % 5) * 0.1);
    const py = y + Math.cos(a * 1.31) * spreadY * (0.35 + (i % 4) * 0.12);
    scene.add.rectangle(px, py + 4, 1.5, 8, 0x28552c).setDepth(py);
    scene.add.circle(px, py, 3, FLOWERS[(i + seed) % FLOWERS.length]).setDepth(py + 0.1);
  }
}

function addDirtPath(scene, x, y, width, height, depth) {
  const shadow = scene.add.ellipse(x + 3, y + 4, width + 8, height + 6, 0x514b38, 0.2).setDepth(depth - 0.1);
  const path = scene.add.ellipse(x, y, width, height, 0xb5905e, 0.72).setDepth(depth);
  path.setStrokeStyle(2, 0x92744e, 0.35);
  return { shadow, path };
}

function addFence(scene, x, y, width, depth) {
  scene.add.rectangle(x, y - 7, width, 6, 0x744b2f).setDepth(depth);
  scene.add.rectangle(x, y + 8, width, 6, 0x5f3e29).setDepth(depth);
  const count = Math.max(3, Math.round(width / 44));
  for (let i = 0; i <= count; i += 1) {
    const px = x - width / 2 + (width / count) * i;
    const post = scene.add.rectangle(px, y, 9, 34, 0x865a39).setDepth(depth + 0.1);
    post.setStrokeStyle(1, 0x4d3425, 1);
  }
}

function addProps(scene) {
  addFence(scene, 610, 420, 190, 426);
  addFence(scene, 1190, 420, 190, 426);
  addFence(scene, 600, 885, 180, 890);
  addFence(scene, 1200, 885, 180, 890);

  addFlowerPatch(scene, 720, 510, 18, 78, 36, 2);
  addFlowerPatch(scene, 1080, 510, 18, 78, 36, 3);
  addFlowerPatch(scene, 790, 690, 15, 70, 32, 4);
  addFlowerPatch(scene, 1010, 690, 15, 70, 32, 5);
  addFlowerPatch(scene, 655, 735, 12, 56, 28, 6);
  addFlowerPatch(scene, 1145, 735, 12, 56, 28, 7);

  const bench = scene.add.rectangle(1010, 690, 68, 9, 0x795034).setDepth(702);
  bench.setStrokeStyle(2, 0x4d3222, 1);
  scene.add.rectangle(990, 704, 6, 27, 0x4d3222).setDepth(703);
  scene.add.rectangle(1030, 704, 6, 27, 0x4d3222).setDepth(703);

  const signPost = scene.add.rectangle(820, 558, 7, 48, 0x765139).setDepth(575);
  signPost.setStrokeStyle(1, 0x4f392a, 1);
  const sign = scene.add.rectangle(838, 541, 46, 21, 0x9c754f).setDepth(576);
  sign.setStrokeStyle(2, 0x4f392a, 1);

  for (const [x, y, s] of [[615, 720, 1], [645, 728, 0.9], [1168, 720, 1], [1196, 727, 0.9]]) {
    const box = scene.add.rectangle(x, y, 28 * s, 24 * s, 0x95653f).setDepth(y + 8);
    box.setStrokeStyle(2, 0x563b28, 1);
  }

  for (const [x, y] of [[625, 676], [1180, 680]]) {
    const barrel = scene.add.ellipse(x, y, 28, 34, 0x775139).setDepth(y + 8);
    barrel.setStrokeStyle(3, 0x473126, 1);
    scene.add.rectangle(x, y - 7, 30, 4, 0x3f3a35).setDepth(y + 9);
    scene.add.rectangle(x, y + 7, 30, 4, 0x3f3a35).setDepth(y + 9);
  }
}

function placeBuilding(scene, building) {
  const sprite = scene.add.image(building.x, building.y, building.asset);
  sprite.setDisplaySize(building.drawWidth, building.drawHeight);
  sprite.setOrigin(0.5, 0.84);
  sprite.setDepth(building.y + 1);
  return sprite;
}

export function createVillage(scene) {
  const blockers = scene.physics.add.staticGroup();

  addDirtPath(scene, 900, 610, 710, 118, -460);
  addDirtPath(scene, 900, 640, 125, 690, -459.8);
  addDirtPath(scene, 775, 690, 260, 86, -459.6);
  addDirtPath(scene, 1025, 690, 260, 86, -459.6);

  const green = scene.add.ellipse(900, 612, 245, 170, 0x5d873f, 0.32).setDepth(-455);
  green.setStrokeStyle(3, 0x416b34, 0.32);

  const well = scene.add.image(900, 610, 'village-well');
  well.setDisplaySize(126, 126);
  well.setOrigin(0.5, 0.74);
  well.setDepth(628);
  addBlocker(scene, blockers, 900, 624, 62, 34);

  for (const building of VILLAGE_BUILDINGS) {
    placeBuilding(scene, building);
    addBlocker(scene, blockers, building.x, building.y + building.drawHeight * 0.22, building.bodyWidth, building.bodyHeight);
  }

  addProps(scene);
  return { blockers };
}
