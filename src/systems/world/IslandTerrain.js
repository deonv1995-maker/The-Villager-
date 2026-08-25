export class IslandTerrain {
 constructor(THREE) {
  this.T = THREE;
  this.radius = 135;
  this.seaLevel = -2;
  this.seabedLevel = -5.2;

  // One shared terrain definition drives the visible ground, procedural rock
  // wall, environment clearance and player blocking. No prefab placement data
  // is used here.
  this.cliffFormation = {
   cx: -20,
   cz: -18,
   yaw: .24,
   uMin: -19,
   uMax: 20,
   drop: 5.15,
   cliffSeam: .48,
   highDepth: 13.5,
   lowDepth: 9.5,
   rampCenter: 12.4,
   rampHalfWidth: 3.25,
   rampBlend: 1.35,
   rampHalfDepth: 5.4
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

 cliffFormationLocal(x, z) {
  const f = this.cliffFormation;
  const dx = x - f.cx;
  const dz = z - f.cz;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { u: c * dx - s * dz, v: s * dx + c * dz };
 }

 cliffFormationWorld(u, v) {
  const f = this.cliffFormation;
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return { x: f.cx + c * u + s * v, z: f.cz - s * u + c * v };
 }

 cliffEdgeV(u) {
  const broad = Math.sin((u + 4.5) * .18) * 2.15;
  const detail = Math.sin((u - 1.2) * .43) * .82 + Math.cos((u + 8) * .29) * .42;
  const shoulder = 1.45 * Math.exp(-Math.pow((u + 10.2) / 3.7, 2));
  const bite = -1.25 * Math.exp(-Math.pow((u - 3.8) / 2.9, 2));
  return -1.1 + broad + detail + shoulder + bite + u * .025;
 }

 cliffRampMask(u) {
  const f = this.cliffFormation;
  const left = this.smoothstep(f.rampCenter - f.rampHalfWidth - f.rampBlend, f.rampCenter - f.rampHalfWidth + f.rampBlend, u);
  const right = 1 - this.smoothstep(f.rampCenter + f.rampHalfWidth - f.rampBlend, f.rampCenter + f.rampHalfWidth + f.rampBlend, u);
  return left * right;
 }

 cliffFormationProfileAt(x, z) {
  const f = this.cliffFormation;
  const {u,v} = this.cliffFormationLocal(x,z);
  const edgeV = this.cliffEdgeV(u);
  const signed = v - edgeV;
  const rampMask = this.cliffRampMask(u);
  const transitionHalfWidth = f.cliffSeam * (1 - rampMask) + f.rampHalfDepth * rampMask;
  const highFactor = this.smoothstep(-transitionHalfWidth, transitionHalfWidth, signed);

  const uWeight = this.smoothstep(f.uMin - 3.2, f.uMin, u)
   * (1 - this.smoothstep(f.uMax, f.uMax + 3.2, u));
  const vWeight = this.smoothstep(-f.lowDepth - 3.0, -f.lowDepth, signed)
   * (1 - this.smoothstep(f.highDepth, f.highDepth + 3.0, signed));
  const weight = uWeight * vWeight;
  const raised = highFactor * weight;

  return {
   u,v,edgeV,signed,rampMask,transitionHalfWidth,weight,raised,
   isCliffSeam: Math.abs(signed) < Math.max(.72,transitionHalfWidth*1.25) && rampMask < .35
  };
 }

 // Compatibility boundary used by environment population. It now describes
 // the procedural formation rather than the retired modular prefab showcase.
 moduleFormationContains(x, z, margin = 0) {
  const f = this.cliffFormation;
  const p = this.cliffFormationProfileAt(x,z);
  return p.u > f.uMin - 3 - margin && p.u < f.uMax + 3 + margin
   && p.signed > -f.lowDepth - 2 - margin && p.signed < f.highDepth + 2 + margin;
 }

 moduleFormationBlocksSegment(fromX, fromZ, toX, toZ) {
  const f = this.cliffFormation;
  const a = this.cliffFormationLocal(fromX,fromZ);
  const b = this.cliffFormationLocal(toX,toZ);
  const sa = a.v - this.cliffEdgeV(a.u);
  const sb = b.v - this.cliffEdgeV(b.u);
  if (sa === 0 || sb === 0 || sa * sb > 0) return false;
  const midU = (a.u + b.u) * .5;
  if (midU < f.uMin || midU > f.uMax) return false;
  if (this.cliffRampMask(midU) > .32) return false;
  return true;
 }

 cliffWallSpans() {
  const f = this.cliffFormation;
  const gapStart = f.rampCenter - f.rampHalfWidth - f.rampBlend * .8;
  const gapEnd = f.rampCenter + f.rampHalfWidth + f.rampBlend * .8;
  return [[f.uMin + .5,gapStart],[gapEnd,f.uMax - .4]];
 }

 rawHeightAt(x, z) {
  const d = this.islandMetric(x, z);
  if (d >= 1) return this.seabedLevel;
  const natural = this.regionalHeightAt(x, z);
  const formation = this.cliffFormationProfileAt(x,z);
  const interior = natural + this.cliffFormation.drop * formation.raised;
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
  const soil = new T.Color(0x786a4d);
  const stone = new T.Color(0x7d8681);
  const stoneDark = new T.Color(0x69736f);
  const seabed = new T.Color(0x64745e);

  for (let i = 0; i < p.count; i++) {
   const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
   const d = this.islandMetric(x, z);
   const s = this.slopeAt(x, z);
   const formation = this.cliffFormationProfileAt(x,z);
   let c;
   if (d >= 1) c = seabed;
   else if (d > .955) c = soil;
   else if (formation.weight > .15 && formation.isCliffSeam) c = stoneDark;
   else if (s > 1.15) c = stone;
   else if (y > 7.5) c = grassLight;
   else if (y < 1.1) c = grassDark;
   else c = grass;
   colors[i * 3] = c.r;
   colors[i * 3 + 1] = c.g;
   colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  return new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, flatShading: true });
 }

 create() {
  const T = this.T;
  const root = new T.Group();
  root.name = 'IslandWorld';
  const size = this.radius * 2.42;
  const geo = new T.PlaneGeometry(size, size, 240, 240);
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
