export class IslandTerrain {
 constructor(THREE) {
  this.T = THREE;
  this.radius = 135;
  this.seaLevel = -2;
  this.seabedLevel = -5.2;
  this.moduleFormation = {
   cx: -20,
   cz: -18,
   yaw: .28,
   scale: 3.2,
   plateauEastUnits: 4,
   rampEndUnits: 8,
   plateauNorthUnits: -6,
   northFadeUnits: -10,
   westCliffNorthUnits: -6,
   southCliffEastUnits: 5
  };
 }

 smoothstep(a,b,x) {
  if (a === b) return x >= b ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
 }

 angularDistance(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
 }

 islandMetric(x, z) {
  const sx = x + 5;
  const sz = z - 3;
  const a = Math.atan2(sz, sx);
  const r = Math.hypot(sx * .9, sz * 1.05);
  const baseShape = 1 + .11 * Math.sin(a * 3 + .55) + .065 * Math.sin(a * 5 - 1.15) + .045 * Math.cos(a * 7 + .8);
  const peninsula = .18 * Math.exp(-Math.pow(this.angularDistance(a, -.42) / .34, 2));
  const shoulder = .08 * Math.exp(-Math.pow(this.angularDistance(a, 1.05) / .5, 2));
  const bay = .16 * Math.exp(-Math.pow(this.angularDistance(a, 2.38) / .3, 2));
  return r / (this.radius * Math.max(.72, baseShape + peninsula + shoulder - bay));
 }

 gaussian(x, z, cx, cz, sx, sz, height) {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return height * Math.exp(-(dx * dx + dz * dz));
 }

 rotatedGaussian(x, z, cx, cz, angle, longRadius, shortRadius, height) {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = (dx * c + dz * s) / longRadius;
  const v = (-dx * s + dz * c) / shortRadius;
  return height * Math.exp(-(u * u + v * v));
 }

 regionalHeightAt(x, z) {
  const broad = Math.sin(x * .024 + z * .008) * .75 + Math.cos(z * .027 - x * .006) * .65 + Math.sin((x - z) * .043) * .28;
  let h = 1.45 + broad;
  h += this.gaussian(x, z, -42, 30, 34, 29, 10.8);
  h += this.rotatedGaussian(x, z, 35, -20, -.58, 55, 15, 5.2);
  h += this.gaussian(x, z, 48, 38, 31, 24, 4.6);
  h += this.gaussian(x, z, -8, -42, 35, 28, -3.7);
  h += this.gaussian(x, z, 62, -58, 38, 24, -1.3);
  const spawnBlend = Math.exp(-(x * x + z * z) / (22 * 22));
  h = h * (1 - spawnBlend * .28) + (2.8 + broad * .18) * (spawnBlend * .28);
  return h;
 }

 coastHeight(x, z, interiorHeight) {
  const d = this.islandMetric(x, z);
  if (d >= 1) return this.seabedLevel;
  const coast = Math.max(0, 1 - d);
  const coastEase = Math.min(1, coast / .16);
  const eased = coastEase * coastEase * (3 - 2 * coastEase);
  const shore = -.35 + interiorHeight * .12;
  return Math.max(-.6, shore * (1 - eased) + interiorHeight * eased);
 }

 moduleFormationLocal(x, z) {
  const f = this.moduleFormation;
  const dx = x - f.cx;
  const dz = z - f.cz;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { u: c * dx - s * dz, v: s * dx + c * dz };
 }

 moduleFormationWorld(u, v) {
  const f = this.moduleFormation;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: f.cx + c * u + s * v, z: f.cz - s * u + c * v };
 }

 moduleFormationBaseHeight() {
  const f = this.moduleFormation;
  return this.regionalHeightAt(f.cx, f.cz);
 }

 gentleHillFactor(localZ) {
  if (localZ <= -.5) return 0;
  if (localZ < .5) return (localZ + .5) * .15;
  if (localZ < 2.5) return .15 + ((localZ - .5) / 2) * .70;
  if (localZ < 3.5) return .85 + (localZ - 2.5) * .15;
  return 1;
 }

 moduleFormationProfileAt(x, z) {
  const f = this.moduleFormation;
  const S = f.scale;
  const { u, v } = this.moduleFormationLocal(x, z);
  const cliffHalfWidth = .10 * S;
  const westStep = this.smoothstep(-cliffHalfWidth, cliffHalfWidth, u);
  const southStep = 1 - this.smoothstep(-cliffHalfWidth, cliffHalfWidth, v);
  const rampLocalZ = 7.5 - u / S;
  const eastRamp = this.gentleHillFactor(rampLocalZ);
  const northFade = this.smoothstep(f.northFadeUnits * S, f.plateauNorthUnits * S, v);
  const raised = westStep * southStep * eastRamp * northFade;
  const uWeight = this.smoothstep(-2.3 * S, -1.5 * S, u) * (1 - this.smoothstep(8.4 * S, 9.3 * S, u));
  const vWeight = this.smoothstep(-11.0 * S, -10.0 * S, v) * (1 - this.smoothstep(1.1 * S, 2.0 * S, v));
  const weight = uWeight * vWeight;
  const baseHeight = this.moduleFormationBaseHeight();
  const upperHeight = baseHeight + S;
  const targetHeight = baseHeight + S * raised;
  return { u, v, weight, raised, baseHeight, upperHeight, targetHeight };
 }

 moduleFormationContains(x, z, margin = 0) {
  const f = this.moduleFormation;
  const S = f.scale;
  const { u, v } = this.moduleFormationLocal(x, z);
  return u > -2.5 * S - margin && u < 9.5 * S + margin && v > -11.2 * S - margin && v < 2.2 * S + margin;
 }

 moduleFormationBlocksSegment(fromX, fromZ, toX, toZ) {
  const f = this.moduleFormation;
  const S = f.scale;
  const a = this.moduleFormationLocal(fromX, fromZ);
  const b = this.moduleFormationLocal(toX, toZ);

  const crossedWest = (a.u <= 0 && b.u > 0) || (a.u >= 0 && b.u < 0);
  const westMidV = (a.v + b.v) * .5;
  if (crossedWest && westMidV > f.westCliffNorthUnits * S && westMidV < -.35 * S) return true;

  const crossedSouth = (a.v <= 0 && b.v > 0) || (a.v >= 0 && b.v < 0);
  const southMidU = (a.u + b.u) * .5;
  if (crossedSouth && southMidU > .35 * S && southMidU < f.southCliffEastUnits * S) return true;

  return false;
 }

 rawHeightAt(x, z) {
  const d = this.islandMetric(x, z);
  if (d >= 1) return this.seabedLevel;
  const natural = this.regionalHeightAt(x, z);
  const formation = this.moduleFormationProfileAt(x, z);
  const interior = natural * (1 - formation.weight) + formation.targetHeight * formation.weight;
  return this.coastHeight(x, z, interior);
 }

 heightAt(x, z) { return this.rawHeightAt(x, z); }

 slopeAt(x, z) {
  const e = .8;
  const h = this.heightAt(x, z);
  return Math.max(
   Math.abs(this.heightAt(x + e, z) - h),
   Math.abs(this.heightAt(x - e, z) - h),
   Math.abs(this.heightAt(x, z + e) - h),
   Math.abs(this.heightAt(x, z - e) - h)
  ) / e;
 }

 createLandMaterial(geometry) {
  const T = this.T;
  const p = geometry.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const grass = new T.Color(0x7fb64e);
  const grassDark = new T.Color(0x6da246);
  const grassLight = new T.Color(0x8cc65b);
  const soil = new T.Color(0x7a6b4b);
  const stone = new T.Color(0x7d8681);
  const stoneDark = new T.Color(0x69736f);
  const seabed = new T.Color(0x64745e);

  for (let i = 0; i < p.count; i++) {
   const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
   const d = this.islandMetric(x, z);
   const s = this.slopeAt(x, z);
   const formation = this.moduleFormationProfileAt(x, z);
   let c;
   if (d >= 1) c = seabed;
   else if (d > .955) c = soil;
   else if (formation.weight > .18 && s > 1.25) c = stoneDark;
   else if (s > 1.18) c = stoneDark;
   else if (s > .84) c = stone;
   else if (y > 7.5) c = grassLight;
   else if (y < 1.1) c = grassDark;
   else c = grass;
   colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  return new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, flatShading: true });
 }

 create() {
  const T = this.T;
  const root = new T.Group();
  root.name = 'IslandWorld';
  const size = this.radius * 2.42;
  const geo = new T.PlaneGeometry(size, size, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, this.heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const land = new T.Mesh(geo, this.createLandMaterial(geo));
  land.name = 'AsymmetricIslandLand';
  land.receiveShadow = true;
  root.add(land);

  const oceanGeo = new T.PlaneGeometry(700, 700, 1, 1);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new T.Mesh(oceanGeo, new T.MeshPhongMaterial({
   color: 0x43b7d5, shininess: 55, specular: 0x9fe7ef,
   depthWrite: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  }));
  ocean.name = 'OceanSurface';
  ocean.position.y = this.seaLevel;
  root.add(ocean);
  return root;
 }
}
