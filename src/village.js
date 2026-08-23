export const VILLAGE_CONFIG = Object.freeze({
  centerX: 900,
  centerY: 600,
  width: 640,
  height: 430,
  spawn: { x: 900, y: 710 },
});

export const VILLAGE_BUILDINGS = Object.freeze([
  { id: 'hall', name: 'Village Hall', x: 900, y: 470, width: 158, height: 116, wall: 0xd1b27d, wallShade: 0xb68f5d, timber: 0x5b3e2d, roof: 0x6b3829, roofLight: 0x8d5139 },
  { id: 'home-west', name: 'West Cottage', x: 690, y: 545, width: 122, height: 92, wall: 0xd9bd88, wallShade: 0xbe9a68, timber: 0x62432f, roof: 0x754534, roofLight: 0x98644a },
  { id: 'home-east', name: 'East Cottage', x: 1110, y: 545, width: 122, height: 92, wall: 0xd9bd88, wallShade: 0xbe9a68, timber: 0x62432f, roof: 0x754534, roofLight: 0x98644a },
  { id: 'workshop', name: 'Workshop', x: 735, y: 700, width: 144, height: 100, wall: 0xbf9a65, wallShade: 0x9f784c, timber: 0x4f392b, roof: 0x54392f, roofLight: 0x765243 },
  { id: 'storehouse', name: 'Storehouse', x: 1065, y: 700, width: 144, height: 100, wall: 0xbf9a65, wallShade: 0x9f784c, timber: 0x4f392b, roof: 0x54392f, roofLight: 0x765243 },
]);

const FLOWER_COLORS = [0xe9c35b, 0xd86f72, 0xbba5e4, 0xf2df8a];

function addFlowerPatch(scene, x, y, count, spreadX, spreadY, depth) {
  for (let i = 0; i < count; i += 1) {
    const px = x + Math.sin(i * 2.17) * spreadX * 0.5 + ((i % 3) - 1) * 7;
    const py = y + Math.cos(i * 1.71) * spreadY * 0.5 + ((i % 2) ? 4 : -3);
    scene.add.rectangle(px, py + 4, 2, 8, 0x4f7f3d, 1).setDepth(depth);
    const bloom = scene.add.circle(px, py, 3.5, FLOWER_COLORS[i % FLOWER_COLORS.length], 1).setDepth(depth + 0.1);
    bloom.setStrokeStyle(1, 0x6e5b35, 0.35);
  }
}

function drawFence(scene, x, y, width, depth) {
  const top = scene.add.rectangle(x, y - 7, width, 5, 0x7d5a3e, 1).setDepth(depth);
  const bottom = scene.add.rectangle(x, y + 8, width, 5, 0x684832, 1).setDepth(depth);
  top.setStrokeStyle(1, 0x4d3526, 0.8);
  bottom.setStrokeStyle(1, 0x4d3526, 0.8);
  const posts = Math.max(3, Math.floor(width / 46));
  for (let i = 0; i <= posts; i += 1) {
    const px = x - width / 2 + (width / posts) * i;
    scene.add.rectangle(px, y, 8, 32, 0x876044, 1).setDepth(depth + 0.1).setStrokeStyle(1, 0x4d3526, 1);
  }
}

function drawSoftPath(scene, x, y, width, height, depth) {
  const shadow = scene.add.ellipse(x + 3, y + 4, width + 12, height + 10, 0x675b43, 0.16).setDepth(depth);
  const path = scene.add.ellipse(x, y, width, height, 0xb79a6e, 0.84).setDepth(depth + 0.1);
  path.setStrokeStyle(2, 0x8d7654, 0.22);
  return { shadow, path };
}

function drawBuilding(scene, b) {
  const baseY = b.y + b.height * 0.5;
  const c = scene.add.container(b.x, b.y).setDepth(baseY);
  const shadow = scene.add.ellipse(0, b.height * 0.44, b.width * 1.05, b.height * 0.30, 0x1d2c1a, 0.22);
  const foundation = scene.add.rectangle(0, b.height * 0.31, b.width * 0.94, 15, 0x77654f, 1).setStrokeStyle(2, 0x514537, 1);
  const wall = scene.add.rectangle(0, 12, b.width, b.height * 0.67, b.wall).setStrokeStyle(3, 0x6b563c, 1);
  const shade = scene.add.rectangle(0, b.height * 0.18, b.width - 7, b.height * 0.18, b.wallShade, 0.85);
  const timberL = scene.add.rectangle(-b.width * 0.33, 9, 7, b.height * 0.61, b.timber, 1);
  const timberR = scene.add.rectangle(b.width * 0.33, 9, 7, b.height * 0.61, b.timber, 1);
  const timberX = scene.add.rectangle(0, -3, b.width * 0.94, 6, b.timber, 1);

  const roof = scene.add.graphics();
  roof.fillStyle(b.roof, 1);
  roof.lineStyle(3, 0x493124, 1);
  roof.beginPath();
  roof.moveTo(-b.width * 0.61, -b.height * 0.12);
  roof.lineTo(0, -b.height * 0.64);
  roof.lineTo(b.width * 0.61, -b.height * 0.12);
  roof.lineTo(b.width * 0.48, b.height * 0.03);
  roof.lineTo(-b.width * 0.48, b.height * 0.03);
  roof.closePath();
  roof.fillPath();
  roof.strokePath();

  const roofHi = scene.add.graphics();
  roofHi.lineStyle(5, b.roofLight, 0.65);
  roofHi.beginPath();
  roofHi.moveTo(-b.width * 0.47, -b.height * 0.13);
  roofHi.lineTo(0, -b.height * 0.55);
  roofHi.strokePath();

  const chimney = scene.add.rectangle(b.width * 0.27, -b.height * 0.45, 14, 30, 0x79604c, 1).setStrokeStyle(2, 0x4d3b30, 1);
  const chimneyCap = scene.add.rectangle(b.width * 0.27, -b.height * 0.61, 19, 5, 0x4d3b30, 1);
  const door = scene.add.rectangle(0, b.height * 0.21, 25, b.height * 0.37, 0x5a3826).setStrokeStyle(2, 0x3d281d, 1);
  const handle = scene.add.circle(7, b.height * 0.22, 2.5, 0xd5b46a, 1);
  const wy = b.height * 0.08;
  const wl = scene.add.rectangle(-b.width * 0.27, wy, 23, 20, 0x9fcbd0).setStrokeStyle(3, b.timber, 1);
  const wr = scene.add.rectangle(b.width * 0.27, wy, 23, 20, 0x9fcbd0).setStrokeStyle(3, b.timber, 1);
  const gl = scene.add.rectangle(-b.width * 0.27 - 4, wy - 4, 5, 8, 0xd9f0e7, 0.72);
  const gr = scene.add.rectangle(b.width * 0.27 - 4, wy - 4, 5, 8, 0xd9f0e7, 0.72);

  c.add([shadow, foundation, wall, shade, timberL, timberR, timberX, roof, roofHi, chimney, chimneyCap, door, handle, wl, wr, gl, gr]);
}

function addStaticBlocker(scene, group, b) {
  const blocker = scene.add.rectangle(b.x, b.y + b.height * 0.18, b.width * 0.82, b.height * 0.42, 0x000000, 0);
  scene.physics.add.existing(blocker, true);
  group.add(blocker);
}

function drawWell(scene, blockers) {
  const x = VILLAGE_CONFIG.centerX;
  const y = 610;
  scene.add.ellipse(x + 2, y + 8, 68, 40, 0x2e3c2c, 0.28).setDepth(612);
  scene.add.ellipse(x, y, 60, 37, 0x857d70, 1).setStrokeStyle(5, 0x524c44, 1).setDepth(614);
  scene.add.ellipse(x, y - 4, 48, 28, 0xa9a094, 1).setStrokeStyle(3, 0x625d55, 1).setDepth(615);
  scene.add.ellipse(x, y - 6, 34, 16, 0x5b9ab3, 1).setDepth(616);
  scene.add.ellipse(x - 7, y - 9, 10, 4, 0xb7dde3, 0.5).setDepth(617);
  scene.add.rectangle(x - 25, y - 27, 6, 44, 0x65472f, 1).setStrokeStyle(1, 0x3f2e22, 1).setDepth(616);
  scene.add.rectangle(x + 25, y - 27, 6, 44, 0x65472f, 1).setStrokeStyle(1, 0x3f2e22, 1).setDepth(616);
  scene.add.rectangle(x, y - 48, 58, 7, 0x65472f, 1).setStrokeStyle(1, 0x3f2e22, 1).setDepth(617);
  const blocker = scene.add.ellipse(x, y, 52, 31, 0x000000, 0);
  scene.physics.add.existing(blocker, true);
  blockers.add(blocker);
}

function drawVillageProps(scene) {
  drawFence(scene, 694, 421, 176, 430);
  drawFence(scene, 1106, 421, 176, 430);
  drawFence(scene, 642, 756, 120, 756);
  drawFence(scene, 1158, 756, 120, 756);
  addFlowerPatch(scene, 682, 472, 12, 90, 38, 476);
  addFlowerPatch(scene, 1118, 472, 12, 90, 38, 476);
  addFlowerPatch(scene, 820, 628, 9, 70, 30, 632);
  addFlowerPatch(scene, 980, 628, 9, 70, 30, 632);

  const crate1 = scene.add.rectangle(650, 711, 26, 24, 0x9a6d43, 1).setDepth(724).setStrokeStyle(2, 0x563b28, 1);
  const crate2 = scene.add.rectangle(675, 718, 23, 21, 0x845b39, 1).setDepth(725).setStrokeStyle(2, 0x563b28, 1);
  scene.add.line(650, 711, -9, -8, 9, 8, 0x5d412b, 0.7).setDepth(725);
  scene.add.line(675, 718, -8, 7, 8, -7, 0x5d412b, 0.7).setDepth(726);
  const barrel = scene.add.ellipse(1130, 714, 25, 31, 0x765239, 1).setDepth(728).setStrokeStyle(3, 0x4a3528, 1);
  scene.add.rectangle(1130, 708, 27, 4, 0x3f3b36, 0.9).setDepth(729);
  scene.add.rectangle(1130, 720, 27, 4, 0x3f3b36, 0.9).setDepth(729);
  scene.add.rectangle(820, 554, 7, 42, 0x765139, 1).setDepth(575).setStrokeStyle(1, 0x4f392a, 1);
  scene.add.rectangle(832, 538, 42, 19, 0x9c754f, 1).setDepth(576).setStrokeStyle(2, 0x4f392a, 1);
  scene.add.rectangle(974, 670, 56, 8, 0x805638, 1).setDepth(680).setStrokeStyle(1, 0x4c3526, 1);
  scene.add.rectangle(974, 659, 56, 7, 0x906445, 1).setDepth(679).setStrokeStyle(1, 0x4c3526, 1);
  scene.add.rectangle(957, 679, 5, 18, 0x4c3526, 1).setDepth(681);
  scene.add.rectangle(991, 679, 5, 18, 0x4c3526, 1).setDepth(681);
}

export function createVillage(scene) {
  const blockers = scene.physics.add.staticGroup();
  const backDepth = VILLAGE_CONFIG.centerY - VILLAGE_CONFIG.height;

  // No rectangular village plate: paths and village green blend directly into world grass.
  drawSoftPath(scene, 900, 595, 92, 420, backDepth + 1);
  drawSoftPath(scene, 900, 610, 560, 84, backDepth + 1.1);

  const greenShadow = scene.add.ellipse(904, 616, 208, 144, 0x315132, 0.18).setDepth(backDepth + 2.2);
  const green = scene.add.ellipse(900, 610, 194, 132, 0x5f8c48, 0.52).setDepth(backDepth + 2.3);
  green.setStrokeStyle(3, 0x4a713c, 0.35);

  drawVillageProps(scene);
  drawWell(scene, blockers);

  for (const building of VILLAGE_BUILDINGS) {
    drawBuilding(scene, building);
    addStaticBlocker(scene, blockers, building);
  }

  return { blockers };
}
