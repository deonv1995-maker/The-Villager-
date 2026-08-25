import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class TerrainFeatures {
 constructor(THREE, { world, scene }) {
  this.T = THREE;
  this.world = world;
  this.scene = scene;
  this.root = new THREE.Group();
  this.root.name = 'TerrainFeatures';
  this.loader = new OBJLoader();
  this.prototypes = {};
  this.loading = null;
  this.seed = 9137;
  this.materials = {
   rock: new THREE.MeshStandardMaterial({ color: 0x78827d, roughness: .96, metalness: 0, flatShading: true }),
   dirt: new THREE.MeshStandardMaterial({ color: 0x756d59, roughness: .97, metalness: 0, flatShading: true }),
   grass: new THREE.MeshStandardMaterial({ color: 0x7fb64e, roughness: .95, metalness: 0, flatShading: true }),
   bush: new THREE.MeshStandardMaterial({ color: 0x4f8747, roughness: .9, metalness: 0, flatShading: true })
  };
 }

 rand(i) {
  const x = Math.sin(i * 12.9898 + this.seed) * 43758.5453;
  return x - Math.floor(x);
 }

 materialFor(source, fallback) {
  const n = (source?.name || '').toLowerCase();
  if (n.includes('grass')) return this.materials.grass;
  if (n.includes('dirt')) return this.materials.dirt;
  if (n.includes('rock')) return this.materials.rock;
  return fallback;
 }

 measure(obj) {
  const box = new this.T.Box3().setFromObject(obj);
  const size = new this.T.Vector3();
  box.getSize(size);
  const metrics = {
   minY: box.min.y,
   maxY: box.max.y,
   height: Math.max(.001, size.y),
   width: Math.max(.001, size.z),
   depth: Math.max(.001, size.x),
   footprint: Math.max(.001, size.x, size.z)
  };
  obj.userData.metrics = metrics;
  return metrics;
 }

 async loadObj(path, fallback = this.materials.rock) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const obj = this.loader.parse(await res.text());
  obj.traverse(child => {
   if (!child.isMesh) return;
   child.material = Array.isArray(child.material)
    ? child.material.map(m => this.materialFor(m, fallback))
    : this.materialFor(child.material, fallback);
   child.castShadow = true;
   child.receiveShadow = true;
  });
  this.measure(obj);
  return obj;
 }

 async load() {
  if (this.loading) return this.loading;
  const A = './assets/modular-terrain/';
  this.loading = Promise.all([
   this.loadObj(`${A}Cliff_Terrain_Side_Base.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Mid.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Top.obj`, this.materials.rock),
   this.loadObj(`${A}Escarpment_Terrain_Side_Base.obj`, this.materials.dirt),
   this.loadObj(`${A}Escarpment_Terrain_Side_Mid.obj`, this.materials.dirt),
   this.loadObj(`${A}Escarpment_Terrain_Side_Top.obj`, this.materials.dirt),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Center.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Side_Falloff_Edge.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Base.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Mid.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Outer_2x2_Top.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Base.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Mid.obj`, this.materials.rock),
   this.loadObj(`${A}Cliff_Terrain_Corner_Inner_2x2_Top.obj`, this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_1_A_Color1.obj', this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_2_A_Color1.obj', this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Rock_3_A_Color1.obj', this.materials.rock),
   this.loadObj('./assets/kaykit/forest/Bush_1_A_Color1.obj', this.materials.bush),
   this.loadObj('./assets/kaykit/forest/Bush_2_A_Color1.obj', this.materials.bush)
  ]).then(v => {
   this.prototypes = {
    cliff: { base: v[0], mid: v[1], top: v[2] },
    escarp: { base: v[3], mid: v[4], top: v[5] },
    falloff: { center: v[6], edge: v[7] },
    outer: { base: v[8], mid: v[9], top: v[10] },
    inner: { base: v[11], mid: v[12], top: v[13] },
    rocks: [v[14], v[15], v[16]],
    bushes: [v[17], v[18]]
   };
   return this.prototypes;
  });
  return this.loading;
 }

 metrics(source) {
  return source?.userData?.metrics || null;
 }

 scaleForWidth(source, targetWidth) {
  const m = this.metrics(source);
  return m ? targetWidth / m.width : targetWidth;
 }

 addModel(source, x, y, z, yaw, sx, sy = sx, sz = sx) {
  if (!source) return null;
  const o = source.clone(true);
  o.position.set(x, y, z);
  o.rotation.y = yaw;
  o.scale.set(sx, sy, sz);
  this.root.add(o);
  return o;
 }

 addTopAligned(source, x, topY, z, yaw, sx, sy = sx, sz = sx) {
  if (!source) return null;
  const m = this.metrics(source);
  const y = m ? topY - m.maxY * sy : topY;
  const o = this.addModel(source, x, y, z, yaw, sx, sy, sz);
  return { object: o, bottomY: m ? y + m.minY * sy : y, scaleY: sy };
 }

 addNatural(list, x, y, z, yaw, scale) {
  if (!list?.length) return;
  const src = list[Math.floor(this.rand((x + z) * 17) * list.length) % list.length];
  this.addModel(src, x, y, z, yaw, scale);
 }

 curvatureAt(t) {
  const terrain = this.world.terrain;
  const a = terrain.cliffFrame(Math.max(.01, t - .045));
  const b = terrain.cliffFrame(Math.min(.99, t + .045));
  return a.tx * b.tz - a.tz * b.tx;
 }

 placeStack(family, profile, x, z, yaw, targetWidth, seed) {
  if (!family?.top) return;

  const topScale = this.scaleForWidth(family.top, targetWidth);
  const topDepth = topScale * (.76 + this.rand(seed + 1) * .10);
  const topHeight = topScale * (.90 + this.rand(seed + 2) * .08);
  const topWidth = topScale * (1.04 + this.rand(seed + 3) * .10);
  const lipY = profile.upperHeight - .16;
  const top = this.addTopAligned(family.top, x, lipY, z, yaw, topDepth, topHeight, topWidth);
  if (!top) return;

  let currentBottom = top.bottomY;
  const lowerTarget = profile.lowerHeight - .08;
  const mid = family.mid;
  let midCount = 0;

  while (mid && currentBottom - lowerTarget > .55 && midCount < 2) {
   const midScale = this.scaleForWidth(mid, targetWidth * (.98 + this.rand(seed + 10 + midCount) * .08));
   const midMetrics = this.metrics(mid);
   const midHeight = midScale * (.92 + this.rand(seed + 14 + midCount) * .08);
   const scaledHeight = midMetrics ? midMetrics.height * midHeight : midHeight;
   if (currentBottom - lowerTarget < scaledHeight * .42) break;

   const overlap = .18 + this.rand(seed + 18 + midCount) * .10;
   const placed = this.addTopAligned(
    mid,
    x - profile.nx * (.08 + midCount * .07),
    currentBottom + overlap,
    z - profile.nz * (.08 + midCount * .07),
    yaw + (this.rand(seed + 20 + midCount) - .5) * .06,
    midScale * (.79 + this.rand(seed + 22 + midCount) * .08),
    midHeight,
    midScale * (1.04 + this.rand(seed + 24 + midCount) * .08)
   );
   if (!placed) break;
   currentBottom = placed.bottomY;
   midCount++;
  }

  if (family.base && currentBottom - lowerTarget > .2) {
   const baseScale = this.scaleForWidth(family.base, targetWidth * (.96 + this.rand(seed + 30) * .08));
   this.addTopAligned(
    family.base,
    x - profile.nx * .18,
    currentBottom + .18,
    z - profile.nz * .18,
    yaw + (this.rand(seed + 31) - .5) * .07,
    baseScale * (.82 + this.rand(seed + 32) * .08),
    baseScale * (.92 + this.rand(seed + 33) * .08),
    baseScale * (1.02 + this.rand(seed + 34) * .08)
   );
  }
 }

 placeFalloff(source, profile, x, z, yaw, targetWidth, seed) {
  if (!source) return;
  const scale = this.scaleForWidth(source, targetWidth);
  this.addTopAligned(
   source,
   x,
   profile.upperHeight - .14,
   z,
   yaw,
   scale * (.80 + this.rand(seed + 1) * .08),
   scale * (.91 + this.rand(seed + 2) * .08),
   scale * (1.04 + this.rand(seed + 3) * .10)
  );
 }

 buildIntegratedCliff() {
  const anchors = [.03];
  let t = .09;
  let cursor = 0;
  while (t < .93 && cursor < 24) {
   anchors.push(t);
   t += .046 + this.rand(cursor * 41 + 5) * .046;
   cursor++;
  }
  anchors.push(.97);

  for (let i = 0; i < anchors.length; i++) {
   const t0 = Math.min(.985, Math.max(.015, anchors[i] + (this.rand(i * 23 + 4) - .5) * .014));
   const profile = this.world.terrain.cliffFeatureProfile(t0);
   if (profile.drop < 1.2) continue;

   const end = i === 0 || i === anchors.length - 1;
   if (!end && this.rand(i * 31 + 6) < .06) continue;

   const along = (this.rand(i * 43 + 7) - .5) * .7;
   const embed = .14 + this.rand(i * 37 + 2) * .24;
   const x = profile.x + profile.nx * embed + profile.tx * along;
   const z = profile.z + profile.nz * embed + profile.tz * along;
   const baseYaw = Math.atan2(profile.tx, profile.tz) + (this.rand(i * 47 + 9) - .5) * .10;
   const curve = this.curvatureAt(t0);
   const absCurve = Math.abs(curve);
   const seed = i * 101 + 13;
   const targetWidth = 3.6 + this.rand(seed + 2) * 1.6;

   if (end) {
    this.placeFalloff(
     this.prototypes.falloff.edge,
     profile,
     x,
     z,
     baseYaw + (i === 0 ? Math.PI : 0),
     targetWidth * 1.08,
     seed
    );
   } else if (profile.drop < 2.0 && this.rand(seed + 4) > .18) {
    this.placeFalloff(this.prototypes.falloff.center, profile, x, z, baseYaw, targetWidth * 1.05, seed + 6);
   } else if (absCurve > .07 && this.rand(seed + 8) > .14) {
    const outer = curve > 0;
    const family = outer ? this.prototypes.outer : this.prototypes.inner;
    const cornerYaw = baseYaw + (outer ? -Math.PI / 4 : Math.PI / 4) + (this.rand(seed + 9) - .5) * .045;
    this.placeStack(family, profile, x, z, cornerYaw, targetWidth * 1.2, seed + 10);
   } else if (this.rand(seed + 12) < .24) {
    this.placeFalloff(this.prototypes.falloff.center, profile, x, z, baseYaw, targetWidth, seed + 20);
   } else {
    const family = this.rand(seed + 16) < .38 ? this.prototypes.escarp : this.prototypes.cliff;
    this.placeStack(family, profile, x, z, baseYaw, targetWidth, seed + 30);
   }

   if (this.rand(seed + 50) > .26) {
    const rx = x - profile.nx * (1.4 + this.rand(seed + 51) * 2.4) + (this.rand(seed + 52) - .5) * 2.4 * profile.tx;
    const rz = z - profile.nz * (1.4 + this.rand(seed + 53) * 2.4) + (this.rand(seed + 54) - .5) * 2.4 * profile.tz;
    this.addNatural(this.prototypes.rocks, rx, this.world.heightAt(rx, rz) - .07, rz, this.rand(seed + 55) * Math.PI * 2, 1.0 + this.rand(seed + 56) * 1.55);
   }

   if (this.rand(seed + 60) > .5) {
    const bx = x + profile.nx * (.75 + this.rand(seed + 61) * 1.55) + (this.rand(seed + 62) - .5) * 2.2 * profile.tx;
    const bz = z + profile.nz * (.75 + this.rand(seed + 63) * 1.55) + (this.rand(seed + 64) - .5) * 2.2 * profile.tz;
    this.addNatural(this.prototypes.bushes, bx, this.world.heightAt(bx, bz), bz, this.rand(seed + 65) * Math.PI * 2, 1.3 + this.rand(seed + 66) * 1.35);
   }
  }
 }

 initialize() {
  this.scene.add(this.root);
  this.load().then(() => this.buildIntegratedCliff()).catch(err => console.error('[Terrain features load]', err));
 }
}
