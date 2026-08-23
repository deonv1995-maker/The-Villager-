export const VILLAGE_CONFIG = Object.freeze({
  centerX: 900,
  centerY: 600,
  width: 640,
  height: 430,
  spawn: { x: 900, y: 710 },
});

export const VILLAGE_BUILDINGS = Object.freeze([
  { id: 'hall', name: 'Village Hall', x: 900, y: 470, width: 150, height: 110, wall: 0xc7a56a, roof: 0x6d3f2b },
  { id: 'home-west', name: 'West Cottage', x: 690, y: 545, width: 118, height: 90, wall: 0xd2b57b, roof: 0x774936 },
  { id: 'home-east', name: 'East Cottage', x: 1110, y: 545, width: 118, height: 90, wall: 0xd2b57b, roof: 0x774936 },
  { id: 'workshop', name: 'Workshop', x: 735, y: 700, width: 140, height: 96, wall: 0xb9925d, roof: 0x58412f },
  { id: 'storehouse', name: 'Storehouse', x: 1065, y: 700, width: 140, height: 96, wall: 0xb9925d, roof: 0x58412f },
]);

function drawBuilding(scene, building) {
  const baseY = building.y + building.height * 0.5;
  const container = scene.add.container(building.x, building.y);
  container.setDepth(baseY);

  const shadow = scene.add.rectangle(0, building.height * 0.37, building.width * 0.94, building.height * 0.34, 0x1f2c1d, 0.22);
  const wall = scene.add.rectangle(0, 10, building.width, building.height * 0.68, building.wall);
  wall.setStrokeStyle(3, 0x5b4931, 1);

  const roof = scene.add.graphics();
  roof.fillStyle(building.roof, 1);
  roof.lineStyle(3, 0x493124, 1);
  roof.beginPath();
  roof.moveTo(-building.width * 0.6, -building.height * 0.15);
  roof.lineTo(0, -building.height * 0.62);
  roof.lineTo(building.width * 0.6, -building.height * 0.15);
  roof.lineTo(building.width * 0.46, building.height * 0.03);
  roof.lineTo(-building.width * 0.46, building.height * 0.03);
  roof.closePath();
  roof.fillPath();
  roof.strokePath();

  const door = scene.add.rectangle(0, building.height * 0.22, 24, building.height * 0.36, 0x5a3826);
  door.setStrokeStyle(2, 0x3d281d, 1);

  const windowY = building.height * 0.08;
  const leftWindow = scene.add.rectangle(-building.width * 0.27, windowY, 22, 20, 0x9fd2d8);
  const rightWindow = scene.add.rectangle(building.width * 0.27, windowY, 22, 20, 0x9fd2d8);
  leftWindow.setStrokeStyle(2, 0x4c4030, 1);
  rightWindow.setStrokeStyle(2, 0x4c4030, 1);

  container.add([shadow, wall, roof, door, leftWindow, rightWindow]);
  return container;
}

function addStaticBlocker(scene, group, building) {
  const bodyWidth = building.width * 0.82;
  const bodyHeight = building.height * 0.42;
  const blocker = scene.add.rectangle(
    building.x,
    building.y + building.height * 0.18,
    bodyWidth,
    bodyHeight,
    0x000000,
    0,
  );
  scene.physics.add.existing(blocker, true);
  group.add(blocker);
}

export function createVillage(scene) {
  const blockers = scene.physics.add.staticGroup();
  const backDepth = VILLAGE_CONFIG.centerY - VILLAGE_CONFIG.height;

  const boundary = scene.add.rectangle(
    VILLAGE_CONFIG.centerX,
    VILLAGE_CONFIG.centerY,
    VILLAGE_CONFIG.width,
    VILLAGE_CONFIG.height,
    0x69834b,
    0.48,
  );
  boundary.setStrokeStyle(4, 0x4d6438, 0.75);
  boundary.setDepth(backDepth);

  const mainPath = scene.add.rectangle(VILLAGE_CONFIG.centerX, 600, 72, 390, 0xb89b70, 0.9);
  const crossPath = scene.add.rectangle(VILLAGE_CONFIG.centerX, 610, 520, 64, 0xb89b70, 0.9);
  mainPath.setDepth(backDepth + 1);
  crossPath.setDepth(backDepth + 1);

  const green = scene.add.ellipse(VILLAGE_CONFIG.centerX, 610, 190, 128, 0x78a655, 1);
  green.setStrokeStyle(4, 0x4d713b, 1);
  green.setDepth(backDepth + 2);

  const wellBase = scene.add.ellipse(VILLAGE_CONFIG.centerX, 610, 56, 34, 0x7d7567, 1);
  wellBase.setStrokeStyle(4, 0x4f4a42, 1);
  wellBase.setDepth(614);
  const wellWater = scene.add.ellipse(VILLAGE_CONFIG.centerX, 606, 36, 17, 0x5f9db6, 1);
  wellWater.setDepth(615);

  for (const building of VILLAGE_BUILDINGS) {
    drawBuilding(scene, building);
    addStaticBlocker(scene, blockers, building);
  }

  const wellBlocker = scene.add.ellipse(VILLAGE_CONFIG.centerX, 610, 50, 30, 0x000000, 0);
  scene.physics.add.existing(wellBlocker, true);
  blockers.add(wellBlocker);

  return { blockers };
}
