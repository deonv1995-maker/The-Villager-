import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const root = document.getElementById('game-root');
const joystickRoot = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystick-knob');
const hint = document.getElementById('hint');
const harvestPanel = document.getElementById('harvest');
const harvestLabel = document.getElementById('harvest-label');
const harvestFill = document.getElementById('harvest-fill');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc36d);
scene.fog = new THREE.Fog(0x8fc36d, 28, 62);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(11, 13, 14);

scene.add(new THREE.HemisphereLight(0xfff4d3, 0x40562f, 2.1));
const sun = new THREE.DirectionalLight(0xffe4a7, 3.2);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
scene.add(sun);

const mat = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
const grassMat = mat(0x6fa957);
const pathMat = mat(0xb9935b);
const woodMat = mat(0x6f4428);
const darkWoodMat = mat(0x45291d);
const roofMat = mat(0x8f4930);
const wallMat = mat(0xd0b078);
const stoneMat = mat(0x858883);
const stoneLightMat = mat(0xa9aaa1);
const leafMat = mat(0x4f8f3e);
const leafLightMat = mat(0x72ad4a);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x5eb4c7, roughness: 0.25, metalness: 0.05 });

function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, scale = 1, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.setScalar(scale);
  m.castShadow = cast;
  m.receiveShadow = receive;
  scene.add(m);
  return m;
}

// Terrain
mesh(new THREE.PlaneGeometry(90, 90), grassMat, { rx: -Math.PI / 2, receive: true, cast: false });

function addPath(x, z, w, h, rotation = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const p = mesh(g, pathMat, { x, y: 0.015, z, rx: -Math.PI / 2, rz: rotation, cast: false, receive: true });
  return p;
}
addPath(0, 1.5, 4.2, 23);
addPath(0, -2.5, 20, 3.5);
addPath(0, 2.5, 13, 3.2);

function addGrassTuft(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7 + Math.random() * 0.35, 4), mat(i % 2 ? 0x4b8b3b : 0x5e9c46));
    blade.position.set((i - 2) * 0.12, 0.35, (i % 2) * 0.12);
    blade.rotation.z = (i - 2) * 0.08;
    blade.castShadow = true;
    group.add(blade);
  }
  group.scale.setScalar(scale);
  scene.add(group);
}
for (let i = 0; i < 36; i++) {
  const x = (Math.random() - 0.5) * 34;
  const z = (Math.random() - 0.5) * 34;
  if (Math.abs(x) < 4 && Math.abs(z) < 9) continue;
  addGrassTuft(x, z, 0.7 + Math.random() * 0.8);
}

// Cottage
const cottage = new THREE.Group();
cottage.position.set(0, 0, -7.2);
scene.add(cottage);
function addTo(group, geometry, material, position, rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
addTo(cottage, new THREE.BoxGeometry(5.4, 2.5, 3.8), wallMat, [0, 1.25, 0]);
addTo(cottage, new THREE.ConeGeometry(3.8, 2.2, 4), roofMat, [0, 3.05, 0], [0, Math.PI / 4, 0]);
addTo(cottage, new THREE.BoxGeometry(0.9, 1.8, 0.18), darkWoodMat, [0, 0.95, 1.99]);
addTo(cottage, new THREE.BoxGeometry(0.75, 0.75, 0.12), mat(0x9ed5d8), [-1.55, 1.45, 1.99]);
addTo(cottage, new THREE.BoxGeometry(0.75, 0.75, 0.12), mat(0x9ed5d8), [1.55, 1.45, 1.99]);
addTo(cottage, new THREE.BoxGeometry(0.4, 1.5, 0.4), stoneMat, [1.7, 3.25, -0.2]);

// Fence and flower props
function fenceSegment(x, z, length, rot = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rot;
  for (const px of [-length / 2, length / 2]) addTo(group, new THREE.BoxGeometry(0.18, 1.2, 0.18), woodMat, [px, 0.6, 0]);
  addTo(group, new THREE.BoxGeometry(length, 0.16, 0.16), woodMat, [0, 0.38, 0]);
  addTo(group, new THREE.BoxGeometry(length, 0.16, 0.16), woodMat, [0, 0.82, 0]);
  scene.add(group);
}
fenceSegment(-6.5, -9.7, 4.5);
fenceSegment(6.5, -9.7, 4.5);
fenceSegment(-7.5, 7.3, 4.5);
fenceSegment(7.5, 7.3, 4.5);

function addFlower(x, z, color) {
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 5), mat(0x42753b), { x, y: 0.23, z });
  mesh(new THREE.SphereGeometry(0.12, 6, 4), mat(color), { x, y: 0.48, z });
}
for (let i = 0; i < 16; i++) addFlower(-4.5 + Math.random() * 9, -4.5 + Math.random() * 3, [0xe26d61, 0xf0d46f, 0xcaa4e5][i % 3]);

// Well
const well = new THREE.Group();
well.position.set(0, 0, -1.9);
scene.add(well);
addTo(well, new THREE.CylinderGeometry(1.05, 1.2, 0.75, 12), stoneMat, [0, 0.38, 0]);
addTo(well, new THREE.CylinderGeometry(0.76, 0.76, 0.06, 20), waterMat, [0, 0.78, 0]);
addTo(well, new THREE.BoxGeometry(0.18, 2.2, 0.18), woodMat, [-0.95, 1.45, 0]);
addTo(well, new THREE.BoxGeometry(0.18, 2.2, 0.18), woodMat, [0.95, 1.45, 0]);
addTo(well, new THREE.BoxGeometry(2.2, 0.18, 0.18), woodMat, [0, 2.35, 0]);

// Tree
function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  addTo(group, new THREE.CylinderGeometry(0.42, 0.62, 3.8, 7), woodMat, [0, 1.9, 0]);
  addTo(group, new THREE.IcosahedronGeometry(1.75, 1), leafMat, [-0.7, 4.1, 0.05]);
  addTo(group, new THREE.IcosahedronGeometry(1.8, 1), leafLightMat, [0.65, 4.35, 0]);
  addTo(group, new THREE.IcosahedronGeometry(1.9, 1), leafMat, [0, 5.1, -0.2]);
  scene.add(group);
  return group;
}
const tree = createTree(-6.5, 2.4, 1.05);

// Rock cluster
function createRockCluster(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);
  const rocks = [
    [-0.5, 0.6, 0, 1.15, stoneMat],
    [0.55, 0.45, 0.25, 0.85, stoneLightMat],
    [0.1, 0.3, -0.6, 0.7, stoneMat],
  ];
  for (const [rx, ry, rz, s, material] of rocks) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), material);
    r.position.set(rx, ry, rz);
    r.scale.set(s, s * 0.8, s);
    r.rotation.set(Math.random(), Math.random(), Math.random());
    r.castShadow = true;
    r.receiveShadow = true;
    group.add(r);
  }
  return group;
}
const rock = createRockCluster(6.2, 2.8);

// Player
const player = new THREE.Group();
scene.add(player);
player.position.set(0, 0, 4.5);
const body = addTo(player, new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), mat(0x315a3b), [0, 1.15, 0]);
addTo(player, new THREE.SphereGeometry(0.38, 8, 6), mat(0xd6a06f), [0, 2.05, 0]);
addTo(player, new THREE.ConeGeometry(0.48, 0.45, 6), mat(0x5c3524), [0, 2.42, 0]);
addTo(player, new THREE.BoxGeometry(0.68, 0.85, 0.26), mat(0x6c4b2f), [0, 1.38, -0.46]);
addTo(player, new THREE.BoxGeometry(0.2, 0.78, 0.2), mat(0x5b3928), [-0.42, 0.58, 0]);
addTo(player, new THREE.BoxGeometry(0.2, 0.78, 0.2), mat(0x5b3928), [0.42, 0.58, 0]);

const keys = new Set();
window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

const stick = { pointerId: null, x: 0, y: 0 };
function updateStick(event) {
  const r = joystickRoot.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const max = r.width * 0.34;
  const len = Math.hypot(dx, dy) || 1;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  stick.x = dx / max;
  stick.y = dy / max;
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
joystickRoot.addEventListener('pointerdown', e => {
  stick.pointerId = e.pointerId;
  joystickRoot.setPointerCapture?.(e.pointerId);
  updateStick(e);
});
window.addEventListener('pointermove', e => { if (e.pointerId === stick.pointerId) updateStick(e); });
function releaseStick(e) {
  if (e.pointerId !== stick.pointerId) return;
  stick.pointerId = null; stick.x = 0; stick.y = 0;
  joystickKnob.style.transform = 'translate(-50%,-50%)';
}
window.addEventListener('pointerup', releaseStick);
window.addEventListener('pointercancel', releaseStick);

const colliders = [
  { x: 0, z: -7.2, radius: 3.15 },
  { x: 0, z: -1.9, radius: 1.35 },
];
const resources = [
  { name: 'Tree', type: 'wood', object: tree, x: -6.5, z: 2.4, radius: 1.25, active: true, respawn: 0 },
  { name: 'Rock', type: 'stone', object: rock, x: 6.2, z: 2.8, radius: 1.1, active: true, respawn: 0 },
];
let currentResource = null;
let harvestTime = 0;
const inventory = { wood: 0, stone: 0 };

function tryMove(dx, dz) {
  const nextX = THREE.MathUtils.clamp(player.position.x + dx, -18, 18);
  const nextZ = THREE.MathUtils.clamp(player.position.z + dz, -18, 18);
  for (const c of colliders) {
    if (Math.hypot(nextX - c.x, nextZ - c.z) < c.radius + 0.5) return;
  }
  player.position.x = nextX;
  player.position.z = nextZ;
}

function updateHarvest(dt) {
  let nearest = null;
  let best = Infinity;
  for (const r of resources) {
    if (!r.active) continue;
    const d = Math.hypot(player.position.x - r.x, player.position.z - r.z);
    if (d < best) { best = d; nearest = r; }
  }
  if (!nearest || best > nearest.radius + 1.1) {
    currentResource = null;
    harvestTime = 0;
    harvestPanel.classList.add('hidden');
    hint.classList.remove('hidden');
    return;
  }
  if (currentResource !== nearest) { currentResource = nearest; harvestTime = 0; }
  harvestTime += dt;
  harvestPanel.classList.remove('hidden');
  hint.classList.add('hidden');
  harvestLabel.textContent = `Harvesting ${nearest.name}`;
  harvestFill.style.width = `${Math.min(100, harvestTime / 1.5 * 100)}%`;
  if (harvestTime >= 1.5) {
    inventory[nearest.type] += 1;
    nearest.active = false;
    nearest.object.visible = false;
    nearest.respawn = 5;
    harvestLabel.textContent = `${nearest.name} harvested · ${nearest.type}: ${inventory[nearest.type]}`;
    harvestTime = 0;
    currentResource = null;
  }
}

const clock = new THREE.Clock();
const cameraOffset = new THREE.Vector3(10.5, 11.5, 12.5);
const lookOffset = new THREE.Vector3(0, 1.1, 0);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  let mx = stick.x;
  let my = stick.y;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }

  const speed = 4.2;
  if (Math.hypot(mx, my) > 0.06) {
    tryMove(mx * speed * dt, my * speed * dt);
    const targetYaw = Math.atan2(mx, my);
    let delta = targetYaw - player.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    player.rotation.y += delta * Math.min(1, dt * 10);
    body.position.y = 1.15 + Math.sin(performance.now() * 0.012) * 0.035;
  } else {
    body.position.y = THREE.MathUtils.lerp(body.position.y, 1.15, 0.2);
  }

  for (const r of resources) {
    if (r.active) continue;
    r.respawn -= dt;
    if (r.respawn <= 0) { r.active = true; r.object.visible = true; }
  }
  updateHarvest(dt);

  const desired = player.position.clone().add(cameraOffset);
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  const lookAt = player.position.clone().add(lookOffset);
  camera.lookAt(lookAt);

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
