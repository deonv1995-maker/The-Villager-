import { VISUAL_PACK_1 } from './visual-pack-validation.js';

export const VILLAGE_CONFIG = Object.freeze({
  centerX: 900,
  centerY: 600,
  width: 720,
  height: 500,
  spawn: Object.freeze({ x: 900, y: 760 }),
});

export const VILLAGE_BUILDINGS = Object.freeze([
  Object.freeze({ id: 'hall', name: 'Village Hall', x: 900, y: 420, drawWidth: 300, drawHeight: 250, bodyWidth: 170, bodyHeight: 70 }),
  Object.freeze({ id: 'home-west', name: 'West Cottage', x: 650, y: 570, drawWidth: 245, drawHeight: 205, bodyWidth: 145, bodyHeight: 60 }),
  Object.freeze({ id: 'home-east', name: 'East Cottage', x: 1150, y: 570, drawWidth: 245, drawHeight: 205, bodyWidth: 145, bodyHeight: 60 }),
  Object.freeze({ id: 'workshop', name: 'Workshop', x: 720, y: 800, drawWidth: 245, drawHeight: 205, bodyWidth: 145, bodyHeight: 60 }),
  Object.freeze({ id: 'storehouse', name: 'Storehouse', x: 1080, y: 800, drawWidth: 245, drawHeight: 205, bodyWidth: 145, bodyHeight: 60 }),
]);

const PRESENTATION = VISUAL_PACK_1.presentation;

function addBlocker(scene, group, x, y, width, height) {
  const blocker = scene.add.rectangle(x, y, width, height, 0, 0);
  scene.physics.add.existing(blocker, true);
  group.add(blocker);
}

function addPath(scene, x, y, width, height, rotation = 0) {
  const art = PRESENTATION.path;
  const path = scene.add.image(x, y, 'vp1-path');
  path.setDisplaySize(width ?? art.width, height ?? art.height);
  path.setOrigin(art.originX, art.originY);
  path.setRotation(rotation);
  path.setDepth(-460);
  return path;
}

function addVegetation(scene, x, y, width, height, depth = y) {
  const art = PRESENTATION.vegetation;
  const vegetation = scene.add.image(x, y, 'vp1-vegetation');
  vegetation.setDisplaySize(width ?? art.width, height ?? art.height);
  vegetation.setOrigin(art.originX, art.originY);
  vegetation.setDepth(depth);
  return vegetation;
}

function addCottage(scene, building, flip = false) {
  const art = PRESENTATION.cottage;
  const cottage = scene.add.image(building.x, building.y, 'vp1-cottage');
  cottage.setDisplaySize(building.drawWidth ?? art.width, building.drawHeight ?? art.height);
  cottage.setOrigin(art.originX, art.originY);
  cottage.setDepth(building.y + 1);
  cottage.setFlipX(flip);
  return cottage;
}

function addFence(scene, x, y, width, depth) {
  scene.add.rectangle(x, y - 7, width, 6, 0x744b2f).setDepth(depth);
  scene.add.rectangle(x, y + 8, width, 6, 0x5f3e29).setDepth(depth);
  const count = Math.max(3, Math.round(width / 44));
  for (let i = 0; i <= count; i += 1) {
    const postX = x - width / 2 + (width / count) * i;
    const post = scene.add.rectangle(postX, y, 9, 34, 0x865a39).setDepth(depth + 0.1);
    post.setStrokeStyle(1, 0x4d3425, 1);
  }
}

function addProps(scene) {
  addFence(scene, 610, 420, 190, 426);
  addFence(scene, 1190, 420, 190, 426);
  addFence(scene, 600, 900, 180, 905);
  addFence(scene, 1200, 900, 180, 905);

  [
    [775, 525, 105, 70],
    [1025, 525, 105, 70],
    [800, 690, 120, 82],
    [1000, 690, 120, 82],
    [620, 735, 100, 68],
    [1180, 735, 100, 68],
    [820, 875, 115, 78],
    [980, 875, 115, 78],
  ].forEach(([x, y, width, height]) => addVegetation(scene, x, y, width, height, y + 2));

  const bench = scene.add.rectangle(1015, 690, 66, 9, 0x795034).setDepth(703);
  bench.setStrokeStyle(2, 0x4d3222, 1);
  scene.add.rectangle(995, 704, 6, 27, 0x4d3222).setDepth(704);
  scene.add.rectangle(1035, 704, 6, 27, 0x4d3222).setDepth(704);
}

export function createVillage(scene) {
  const blockers = scene.physics.add.staticGroup();

  addPath(scene, 900, 620, 720, 150);
  addPath(scene, 900, 650, 155, 700, Math.PI / 2);
  addPath(scene, 770, 700, 270, 100);
  addPath(scene, 1030, 700, 270, 100);

  scene.add.ellipse(900, 620, 245, 170, 0x4c7f3d, 0.18).setDepth(-455);

  const wellArt = PRESENTATION.well;
  const well = scene.add.image(900, 615, 'vp1-well');
  well.setDisplaySize(wellArt.width, wellArt.height);
  well.setOrigin(wellArt.originX, wellArt.originY);
  well.setDepth(635);
  addBlocker(scene, blockers, 900, 630, 68, 38);

  VILLAGE_BUILDINGS.forEach((building, index) => {
    addCottage(scene, building, index % 2 === 0);
    addBlocker(
      scene,
      blockers,
      building.x,
      building.y + building.drawHeight * 0.22,
      building.bodyWidth,
      building.bodyHeight,
    );
  });

  addProps(scene);
  return { blockers };
}
