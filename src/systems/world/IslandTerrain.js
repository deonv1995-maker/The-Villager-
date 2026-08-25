export class IslandTerrain {
 constructor(THREE) {
  this.T = THREE;
  this.radius = 135;
  this.seaLevel = -2;
  this.seabedLevel = -5.2;
  this.cliffSettings = {
   nearestSamples: 36,
   transitionWidth: .78,
   profileFadeDistance: 24,
   snapDistance: 4.2,
   materialBand: 2.65
  };
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

 cliffPoint(t) {
  const u = (t - .5) * 64;
  const base = -.72;
  const c = Math.cos(base);
  const s = Math.sin(base);
  const nx = -s;
  const nz = c;
  const bend = Math.sin(t * Math.PI * 1.55) * 5.4 + Math.sin(t * Math.PI * 3.9 + 1.0) * 2.2 + Math.sin(t * Math.PI * 7.1 + .35) * .7;
  return { x: -48 + u * c + nx * bend, z: -12 + u * s + nz * bend };
 }

 cliffFrame(t) {
  const p = this.cliffPoint(t);
  const a = this.cliffPoint(Math.max(0, t - .01));
  const b = this.cliffPoint(Math.min(1, t + .01));
  let tx = b.x - a.x;
  let tz = b.z - a.z;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  return { ...p, t, tx, tz, nx: -tz, nz: tx };
 }

 nearestCliffFrame(x, z) {
  let best = null;
  const samples = this.cliffSettings.nearestSamples;
  for (let i = 0; i <= samples; i++) {
   const t = i / samples;
   const p = this.cliffPoint(t);
   const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
   if (!best || d2 < best.d2) best = { t, d2 };
  }
  const frame = this.cliffFrame(best.t);
  const dx = x - frame.x;
  const dz = z - frame.z;
  return {
   frame,
   signed: dx * frame.nx + dz * frame.nz,
   dist: Math.sqrt(best.d2),
   t: best.t
  };
 }

 cliffProfileAt(x, z) {
  const nearest = this.nearestCliffFrame(x, z);
  const t = nearest.t;
  const alongFade = Math.pow(Math.max(0, Math.sin(Math.PI * t)), .72);
  const edgeDrop = (5.0 + 1.15 * Math.sin(t * Math.PI * 2.25 + 1.05)) * alongFade;
  const fadeDistance = this.cliffSettings.profileFadeDistance;
  const envelope = Math.exp(-Math.pow(Math.abs(nearest.signed) / fadeDistance, 4));
  const transitionWidth = this.cliffSettings.transitionWidth * (1 + .12 * Math.sin(t * Math.PI * 5.1 + .4));
  const q = Math.max(0, Math.min(1, (nearest.signed / transitionWidth + 1) * .5));
  const smooth = q * q * q * (q * (q * 6 - 15) + 10);
  const signedStep = smooth * 2 - 1;
  const offset = edgeDrop * .5 * envelope * signedStep;
  const active = alongFade > .035 && nearest.dist < fadeDistance * 1.15;
  return {
   ...nearest,
   alongFade,
   edgeDrop,
   envelope,
   transitionWidth,
   offset,
   active,
   inSeam: active && Math.abs(nearest.signed) < Math.max(1.25, transitionWidth * 1.55),
   materialBand: this.cliffSettings.materialBand
  };
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

 baseHeightAt(x, z) {
  const d = this.islandMetric(x, z);
  if (d >= 1) return this.seabedLevel;
  return this.coastHeight(x, z, this.regionalHeightAt(x, z));
 }

 rawHeightAt(x, z) {
  const d = this.islandMetric(x, z);
  if (d >= 1) return this.seabedLevel;
  const profile = this.cliffProfileAt(x, z);
  const interior = this.regionalHeightAt(x, z) + profile.offset;
  return this.coastHeight(x, z, interior);
 }

 heightAt(x, z) {
  return this.rawHeightAt(x, z);
 }

 cliffFeatureProfile(t) {
  const frame = this.cliffFrame(Math.max(.001, Math.min(.999, t)));
  let nx = frame.nx;
  let nz = frame.nz;
  const d = this.cliffSettings.snapDistance;
  let upperX = frame.x + nx * d;
  let upperZ = frame.z + nz * d;
  let lowerX = frame.x - nx * d;
  let lowerZ = frame.z - nz * d;
  let upperHeight = this.heightAt(upperX, upperZ);
  let lowerHeight = this.heightAt(lowerX, lowerZ);

  if (upperHeight < lowerHeight) {
   nx = -nx;
   nz = -nz;
   upperX = frame.x + nx * d;
   upperZ = frame.z + nz * d;
   lowerX = frame.x - nx * d;
   lowerZ = frame.z - nz * d;
   upperHeight = this.heightAt(upperX, upperZ);
   lowerHeight = this.heightAt(lowerX, lowerZ);
  }

  return {
   ...frame,
   nx,
   nz,
   upperX,
   upperZ,
   lowerX,
   lowerZ,
   upperHeight,
   lowerHeight,
   drop: Math.max(0, upperHeight - lowerHeight),
   transitionWidth: this.cliffSettings.transitionWidth
  };
 }

 slopeAt(x, z) {
  const e = 1;
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
  const lipGrass = new T.Color(0x769f48);
  const soil = new T.Color(0x7a6b4b);
  const stone = new T.Color(0x7d8681);
  const stoneDark = new T.Color(0x69736f);
  const seabed = new T.Color(0x64745e);
  const scratch = new T.Color();

  for (let i = 0; i < p.count; i++) {
   const x = p.getX(i);
   const y = p.getY(i);
   const z = p.getZ(i);
   const d = this.islandMetric(x, z);
   const s = this.slopeAt(x, z);
   const profile = this.cliffProfileAt(x, z);
   const seamDistance = Math.abs(profile.signed);
   let c;

   if (d >= 1) c = seabed;
   else if (d > .955) c = soil;
   else if (profile.active && seamDistance < Math.max(.95, profile.transitionWidth * 1.08)) c = stoneDark;
   else if (profile.active && profile.signed > 0 && profile.signed < profile.materialBand) {
    const blend = 1 - Math.min(1, profile.signed / profile.materialBand);
    scratch.copy(grass).lerp(lipGrass, blend * .66);
    c = scratch;
   } else if (profile.active && profile.signed < 0 && -profile.signed < profile.materialBand) {
    const blend = 1 - Math.min(1, -profile.signed / profile.materialBand);
    scratch.copy(grassDark).lerp(soil, blend * .52);
    c = scratch;
   } else if (s > 1.18) c = stoneDark;
   else if (s > .84) c = stone;
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
  const geo = new T.PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;

  for (let i = 0; i < p.count; i++) {
   p.setY(i, this.heightAt(p.getX(i), p.getZ(i)));
  }

  geo.computeVertexNormals();
  const land = new T.Mesh(geo, this.createLandMaterial(geo));
  land.name = 'AsymmetricIslandLand';
  land.receiveShadow = true;
  root.add(land);

  const oceanGeo = new T.PlaneGeometry(700, 700, 1, 1);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new T.Mesh(oceanGeo, new T.MeshPhongMaterial({
   color: 0x43b7d5,
   shininess: 55,
   specular: 0x9fe7ef,
   depthWrite: true,
   polygonOffset: true,
   polygonOffsetFactor: -1,
   polygonOffsetUnits: -1
  }));
  ocean.name = 'OceanSurface';
  ocean.position.y = this.seaLevel;
  root.add(ocean);
  return root;
 }
}
