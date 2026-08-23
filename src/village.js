export const VILLAGE_CONFIG = Object.freeze({
  centerX: 900,
  centerY: 600,
  width: 760,
  height: 520,
  spawn: { x: 900, y: 760 },
});

export const VILLAGE_BUILDINGS = Object.freeze([
  { id: 'hall', name: 'Village Hall', frame: 'hall', x: 900, y: 410, drawWidth: 240, drawHeight: 200, bodyWidth: 150, bodyHeight: 62 },
  { id: 'home-west', name: 'West Cottage', frame: 'cottage', x: 630, y: 560, drawWidth: 210, drawHeight: 175, bodyWidth: 132, bodyHeight: 54 },
  { id: 'home-east', name: 'East Cottage', frame: 'cottage', x: 1170, y: 560, drawWidth: 210, drawHeight: 175, bodyWidth: 132, bodyHeight: 54 },
  { id: 'workshop', name: 'Workshop', frame: 'workshop', x: 690, y: 780, drawWidth: 220, drawHeight: 183, bodyWidth: 145, bodyHeight: 58 },
  { id: 'storehouse', name: 'Storehouse', frame: 'workshop', x: 1110, y: 780, drawWidth: 220, drawHeight: 183, bodyWidth: 145, bodyHeight: 58 },
]);

function addBlocker(scene, group, x, y, width, height) {
  const blocker = scene.add.rectangle(x, y, width, height, 0x000000, 0);
  scene.physics.add.existing(blocker, true);
  group.add(blocker);
  return blocker;
}

function placePath(scene, x, y, horizontal, count) {
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * 82;
    const px = horizontal ? x + offset : x;
    const py = horizontal ? y : y + offset;
    scene.add.image(px, py, 'environment-atlas', 'path')
      .setDisplaySize(96, 96)
      .setDepth(-455);
  }
}

function drawFence(scene, x, y, width, depth) {
  scene.add.rectangle(x, y - 6, width, 5, 0x714a2c).setDepth(depth);
  scene.add.rectangle(x, y + 7, width, 5, 0x5a3c27).setDepth(depth);
  const count = Math.max(3, Math.floor(width / 44));
  for (let i = 0; i <= count; i += 1) {
    const px = x - width / 2 + (width / count) * i;
    scene.add.rectangle(px, y, 8, 31, 0x815638).setDepth(depth + 0.1);
  }
}

function flowers(scene, x, y, count, spread) {
  const colors = [0xf4d34f, 0xeb7b72, 0xe8e3b2, 0xb99be5];
  for (let i = 0; i < count; i += 1) {
    const px = x + Math.sin(i * 1.91) * spread;
    const py = y + Math.cos(i * 2.17) * spread * 0.45;
    scene.add.rectangle(px, py + 4, 1, 7, 0x28542b).setDepth(py);
    scene.add.rectangle(px, py, 3, 3, colors[i % colors.length]).setDepth(py + 0.1);
  }
}

function placeBuilding(scene, building) {
  const sprite = scene.add.image(building.x, building.y, 'environment-atlas', building.frame);
  sprite.setDisplaySize(building.drawWidth, building.drawHeight);
  sprite.setOrigin(0.5, 0.82);
  sprite.setDepth(building.y + 1);
  return sprite;
}

export function createVillage(scene) {
  const blockers = scene.physics.add.staticGroup();

  const villageGround = scene.add.ellipse(
    VILLAGE_CONFIG.centerX,
    VILLAGE_CONFIG.centerY + 30,
    VILLAGE_CONFIG.width,
    VILLAGE_CONFIG.height,
    0x5e873f,
    0.20,
  );
  villageGround.setDepth(-470);

  placePath(scene, 900, 615, false, 8);
  placePath(scene, 900, 615, true, 8);

  const green = scene.add.ellipse(900, 615, 230, 165, 0x5f8e43, 0.78);
  green.setStrokeStyle(4, 0x3e6b35, 0.6);
  green.setDepth(-450);

  const well = scene.add.image(900, 610, 'environment-atlas', 'well');
  well.setDisplaySize(100, 117);
  well.setOrigin(0.5, 0.78);
  well.setDepth(625);
  addBlocker(scene, blockers, 900, 622, 58, 32);

  for (const building of VILLAGE_BUILDINGS) {
    placeBuilding(scene, building);
    addBlocker(
      scene,
      blockers,
      building.x,
      building.y + building.drawHeight * 0.23,
      building.bodyWidth,
      building.bodyHeight,
    );
  }

  drawFence(scene, 620, 420, 190, 425);
  drawFence(scene, 1180, 420, 190, 425);
  drawFence(scene, 600, 865, 170, 870);
  drawFence(scene, 1200, 865, 170, 870);

  flowers(scene, 740, 590, 15, 48);
  flowers(scene, 1060, 590, 15, 48);
  flowers(scene, 780, 690, 12, 40);
  flowers(scene, 1020, 690, 12, 40);

  const bench = scene.add.rectangle(1010, 700, 68, 10, 0x795034).setDepth(711);
  bench.setStrokeStyle(2, 0x4d3222, 1);
  scene.add.rectangle(990, 716, 6, 25, 0x4d3222).setDepth(712);
  scene.add.rectangle(1030, 716, 6, 25, 0x4d3222).setDepth(712);

  return { blockers };
}
