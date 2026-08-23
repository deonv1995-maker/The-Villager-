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
    bloom.setStrokeStyle(1, 0x6e5b35, 0.4);
  }
}

function drawPathStones(scene, x, y, horizontal, length, depth) {
  const step = 32;
  for (let offset = -length / 2 + 18, i = 0; offset < length / 2; offset += step, i += 1) {
    const px = horizontal ? x + offset : x + (i % 2 ? 22 : -22);
    const py = horizontal ? y + (i % 2 ? 19 : -19) : y + offset;
    scene.add.ellipse(px, py, 13 + (i % 3) * 2, 7 + (i % 2) * 2, 0x9c8767, 0.42).setDepth(depth);
  }
}

function drawFence(scene, x, y, width, depth) {
  const railTop = scene.add.rectangle(x, y - 7, width, 5, 0x7d5a3e, 1).setDepth(depth);
  const railBottom = scene.add.rectangle(x, y + 8, width, 5, 0x684832, 1).setDepth(depth);
  railTop.setStrokeStyle(1, 0x4d3526, 0.8);
  railBottom.setStrokeStyle(1, 0x4d3526, 0.8);
  const postCount = Math.max(3, Math.floor(width / 46));
  for (let i = 0; i <= postCount; i += 1) {
    const px = x - width / 2 + (width / postCount) * i;
    const post = scene.add.rectangle(px, y, 8, 32, 0x876044, 1).setDepth(depth + 0.1);
    post.setStrokeStyle(1, 0x4d3526, 1);
  }
}

function drawBuilding(scene, building) {
  const baseY = building.y + building.height * 0.5;
  const container = scene.add.container(building.x, building.y);
  container.setDepth(baseY);
  const shadow = scene.add.ellipse(0, building.height * 0.44, building.width * 1.05, building.height * 0.32, 0x20301d, 0.25);
  const foundation = scene.add.rectangle(0, building.height * 0.31, building.width * 0.94, 15, 0x77654f, 1);
  foundation.setStrokeStyle(2, 0x514537, 1);
  const wall = scene.add.rectangle(0, 12, building.width, building.height * 0.67, building.wall);
  wall.setStrokeStyle(3, 0x6b563c, 1);
  const wallShade = scene.add.rectangle(0, building.height * 0.18, building.width - 7, building.height * 0.18, building.wallShade, 0.85);
  const timberLeft = scene.add.rectangle(-building.width * 0.33, 9, 7, building.height * 0.61, building.timber, 1);
  const timberRight = scene.add.rectangle(building.width * 0.33, 9, 7, building.height * 0.61, building.timber, 1);
  const timberCross = scene.add.rectangle(0, -3, building.width * 0.94, 6, building.timber, 1);
  const roof = scene.add.graphics();
  roof.fillStyle(building.roof, 1); roof.lineStyle(3, 0x493124, 1); roof.beginPath();
  roof.moveTo(-building.width * 0.61, -building.height * 0.12); roof.lineTo(0, -building.height * 0.64); roof.lineTo(building.width * 0.61, -building.height * 0.12); roof.lineTo(building.width * 0.48, building.height * 0.03); roof.lineTo(-building.width * 0.48, building.height * 0.03); roof.closePath(); roof.fillPath(); roof.strokePath();
  const roofHighlight = scene.add.graphics(); roofHighlight.lineStyle(5, building.roofLight, 0.7); roofHighlight.beginPath(); roofHighlight.moveTo(-building.width * 0.47, -building.height * 0.13); roofHighlight.lineTo(0, -building.height * 0.55); roofHighlight.strokePath();
  const chimney = scene.add.rectangle(building.width * 0.27, -building.height * 0.45, 14, 30, 0x79604c, 1); chimney.setStrokeStyle(2, 0x4d3b30, 1);
  const chimneyCap = scene.add.rectangle(building.width * 0.27, -building.height * 0.61, 19, 5, 0x4d3b30, 1);
  const door = scene.add.rectangle(0, building.height * 0.21, 25, building.height * 0.37, 0x5a3826); door.setStrokeStyle(2, 0x3d281d, 1);
  const doorInset = scene.add.rectangle(-5, building.height * 0.21, 2, building.height * 0.29, 0x79513a, 0.85);
  const handle = scene.add.circle(7, building.height * 0.22, 2.5, 0xd5b46a, 1);
  const windowY = building.height * 0.08;
  const leftWindow = scene.add.rectangle(-building.width * 0.27, windowY, 23, 20, 0x9fcbd0); const rightWindow = scene.add.rectangle(building.width * 0.27, windowY, 23, 20, 0x9fcbd0);
  leftWindow.setStrokeStyle(3, building.timber, 1); rightWindow.setStrokeStyle(3, building.timber, 1);
  const leftGlint = scene.add.rectangle(-building.width * 0.27 - 4, windowY - 4, 5, 8, 0xd9f0e7, 0.75); const rightGlint = scene.add.rectangle(building.width * 0.27 - 4, windowY - 4, 5, 8, 0xd9f0e7, 0.75);
  container.add([shadow,foundation,wall,wallShade,timberLeft,timberRight,timberCross,roof,roofHighlight,chimney,chimneyCap,door,doorInset,handle,leftWindow,rightWindow,leftGlint,rightGlint]);
}

function addStaticBlocker(scene, group, building) {
  const blocker = scene.add.rectangle(building.x, building.y + building.height * 0.18, building.width * 0.82, building.height * 0.42, 0x000000, 0);
  scene.physics.add.existing(blocker, true); group.add(blocker);
}

function drawVillageProps(scene) {
  const depth = VILLAGE_CONFIG.centerY - VILLAGE_CONFIG.height + 5;
  drawFence(scene, 694, 421, 176, depth); drawFence(scene, 1106, 421, 176, depth); drawFence(scene, 642, 756, 120, 756); drawFence(scene, 1158, 756, 120, 756);
  addFlowerPatch(scene, 682, 472, 12, 90, 38, 476); addFlowerPatch(scene, 1118, 472, 12, 90, 38, 476); addFlowerPatch(scene, 820, 628, 9, 70, 30, 632); addFlowerPatch(scene, 980, 628, 9, 70, 30, 632);
  const crate1 = scene.add.rectangle(650, 711, 26, 24, 0x9a6d43, 1).setDepth(724); const crate2 = scene.add.rectangle(675, 718, 23, 21, 0x845b39, 1).setDepth(725); crate1.setStrokeStyle(2, 0x563b28, 1); crate2.setStrokeStyle(2, 0x563b28, 1);
  const barrel = scene.add.ellipse(1130, 714, 25, 31, 0x765239, 1).setDepth(728); barrel.setStrokeStyle(3, 0x4a3528, 1);
  const signPost = scene.add.rectangle(820, 554, 7, 42, 0x765139, 1).setDepth(575); const sign = scene.add.rectangle(832, 538, 42, 19, 0x9c754f, 1).setDepth(576); sign.setStrokeStyle(2, 0x4f392a, 1); signPost.setStrokeStyle(1, 0x4f392a, 1);
  const benchSeat = scene.add.rectangle(974, 670, 56, 8, 0x805638, 1).setDepth(680); const benchBack = scene.add.rectangle(974, 659, 56, 7, 0x906445, 1).setDepth(679); benchSeat.setStrokeStyle(1, 0x4c3526, 1); benchBack.setStrokeStyle(1, 0x4c3526, 1);
  scene.add.rectangle(957, 679, 5, 18, 0x4c3526, 1).setDepth(681); scene.add.rectangle(991, 679, 5, 18, 0x4c3526, 1).setDepth(681);
}

export function createVillage(scene) {
  const blockers = scene.physics.add.staticGroup();
  const backDepth = VILLAGE_CONFIG.centerY - VILLAGE_CONFIG.height;
  scene.add.ellipse(VILLAGE_CONFIG.centerX,VILLAGE_CONFIG.centerY+30,VILLAGE_CONFIG.width+22,VILLAGE_CONFIG.height+28,0x20351f,0.16).setDepth(backDepth-2);
  const boundary = scene.add.rectangle(VILLAGE_CONFIG.centerX,VILLAGE_CONFIG.centerY,VILLAGE_CONFIG.width,VILLAGE_CONFIG.height,0x76975c,0.74); boundary.setStrokeStyle(5,0x526f42,0.82); boundary.setDepth(backDepth-1);
  const villageInner=scene.add.rectangle(VILLAGE_CONFIG.centerX,VILLAGE_CONFIG.centerY,VILLAGE_CONFIG.width-24,VILLAGE_CONFIG.height-24,0x84a765,0.18); villageInner.setStrokeStyle(2,0x9abc77,0.22); villageInner.setDepth(backDepth);
  scene.add.rectangle(VILLAGE_CONFIG.centerX+3,603,82,394,0x655744,0.28).setDepth(backDepth+0.5); scene.add.rectangle(VILLAGE_CONFIG.centerX+3,613,526,73,0x655744,0.28).setDepth(backDepth+0.5);
  const mainPath=scene.add.rectangle(VILLAGE_CONFIG.centerX,600,72,390,0xbca478,0.97); const crossPath=scene.add.rectangle(VILLAGE_CONFIG.centerX,610,520,64,0xbca478,0.97); mainPath.setStrokeStyle(2,0x9b825e,0.8); crossPath.setStrokeStyle(2,0x9b825e,0.8); mainPath.setDepth(backDepth+1); crossPath.setDepth(backDepth+1);
  drawPathStones(scene,900,600,false,370,backDepth+2); drawPathStones(scene,900,610,true,495,backDepth+2);
  scene.add.ellipse(VILLAGE_CONFIG.centerX+3,614,204,140,0x3f6237,0.33).setDepth(backDepth+2.4); const green=scene.add.ellipse(VILLAGE_CONFIG.centerX,610,194,132,0x75a75c,1); green.setStrokeStyle(5,0x527941,1); green.setDepth(backDepth+2.5);
  scene.add.ellipse(VILLAGE_CONFIG.centerX+2,617,66,39,0x32402f,0.35).setDepth(612); const wellBase=scene.add.ellipse(VILLAGE_CONFIG.centerX,610,60,37,0x857d70,1); wellBase.setStrokeStyle(5,0x524c44,1); wellBase.setDepth(614); const wellLip=scene.add.ellipse(VILLAGE_CONFIG.centerX,606,48,28,0xa9a094,1); wellLip.setStrokeStyle(3,0x625d55,1); wellLip.setDepth(615); scene.add.ellipse(VILLAGE_CONFIG.centerX,604,34,16,0x5b9ab3,1).setDepth(616); scene.add.ellipse(VILLAGE_CONFIG.centerX-7,601,10,4,0xb7dde3,0.5).setDepth(617);
  const wellPostLeft=scene.add.rectangle(875,583,6,44,0x65472f,1).setDepth(616); const wellPostRight=scene.add.rectangle(925,583,6,44,0x65472f,1).setDepth(616); const wellBeam=scene.add.rectangle(900,562,58,7,0x65472f,1).setDepth(617); wellPostLeft.setStrokeStyle(1,0x3f2e22,1); wellPostRight.setStrokeStyle(1,0x3f2e22,1); wellBeam.setStrokeStyle(1,0x3f2e22,1);
  drawVillageProps(scene);
  for (const building of VILLAGE_BUILDINGS) { drawBuilding(scene, building); addStaticBlocker(scene, blockers, building); }
  const wellBlocker=scene.add.ellipse(VILLAGE_CONFIG.centerX,610,52,31,0x000000,0); scene.physics.add.existing(wellBlocker,true); blockers.add(wellBlocker);
  return { blockers };
}
