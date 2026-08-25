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
  return m ? targetWidth / m.footprint : targetWidth;
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

 addTopAligned(source, x, topY, z, yaw, scale, sy = scale, sz = scale) {
  if (!source) return null;
  const m = this.metrics(source);
  const y = m ? topY - m.maxY * sy : topY;
  const o = this.addModel(source, x, y, z, yaw, scale, sy, sz);
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
  const scale = this.scaleForWidth(family.top, targetWidth);
  const topScaleY = scale * (.94 + this.rand(seed + 1) * .09);
  const topScaleZ = scale * (.92 + this.rand(seed + 2) * .14);
  const lipY = profile.upperHeight - .06;
  const top = this.addTopAligned(family.top, x, lipY, z, yaw, scale, topScaleY, topScaleZ);
  if (!top) return;

  let currentBottom = top.bottomY;
  const lowerTarget = profile.lowerHeight - .04;
  const mid = family.mid;
  let midCount = 0;

  while (mid && currentBottom - lowerTarget > .65 && midCount < 2) {
   const midScale = scale * (.94 + this.rand(seed + 10 + midCount) * .08);
   const metrics = this.metrics(mid);
   const scaledHeight = metrics ? metrics.height * midScale : midScale;
   if (currentBottom - lowerTarget < scaledHeight * .5) break;
   const overlap = Math.min(.18, targetWidth * .035);
   const placed = this.addTopAligned(
    mid,
    x - profile.nx * (.12 + midCount * .08),
    currentBottom + overlap,
    z - profile.nz * (.12 + midCount * .08),
    yaw + (this.rand(seed + 20 + midCount) - .5) * .08,
    midScale
   );
   if (!placed) break;
   currentBottom = placed.bottomY;
   midCount++;
  }

  if (family.base && currentBottom - lowerTarget > .25) {
   const baseScale = scale * (.92 + this.rand(seed + 30) * .1);
   this.addTopAligned(
    family.base,
    x - profile.nx * .28,
    currentBottom + .12,
    z - profile.nz * .28,
    yaw + (this.rand(seed + 31) - .5) * .1,
    baseScale
   );
  }
 }

 placeFalloff(source, profile, x, z, yaw, targetWidth, seed) {
  if (!source) return;
  const scale = this.scaleForWidth(source, targetWidth);
  this.addTopAligned(
   source,
   x,
   profile.upperHeight - .05,
   z,
   yaw,
   scale,
   scale * (.95 + this.rand(seed + 1) * .08),
   scale * (.93 + this.rand(seed + 2) * .12)
  );
 }

 buildIntegratedCliff() {
  const anchors = [.035];
  let t = .105;
  let cursor = 0;
  while (t < .91 && cursor < 18) {
   anchors.push(t);
   t += .052 + this.rand(cursor * 41 + 5) * .062;
   cursor++;
  }
  anchors.push(.965);

  for (let i = 0; i < anchors.length; i++) {
   const t0 = Math.min(.98, Math.max(.02, anchors[i] + (this.rand(i * 23 + 4) - .5) * .018));
   const profile = this.world.terrain.cliffFeatureProfile(t0);
   if (profile.drop < 1.35) continue;

   const end = i === 0 || i === anchors.length - 1;
   if (!end && this.rand(i * 31 + 6) < .12) continue;

   const along = (this.rand(i * 43 + 7) - .5) * 1.0;
   const faceInset = .08 + this.rand(i * 37 + 2) * .38;
   const x = profile.x - profile.nx * faceInset + profile.tx * along;
   const z = profile.z - profile.nz * faceInset + profile.tz * along;
   const baseYaw = Math.atan2(profile.tx, profile.tz) + (this.rand(i * 47 + 9) - .5) * .13;
   const curve = this.curvatureAt(t0);
   const absCurve = Math.abs(curve);
   const seed = i * 101 + 13;
   const targetWidth = 3.2 + this.rand(seed + 2) * 1.45;

   if (end) {
    this.placeFalloff(
     this.prototypes.falloff.edge,
     profile,
     x,
     z,
     baseYaw + (i === 0 ? Math.PI : 0),
     targetWidth * 1.06,
     seed
    );
   } else if (absCurve > .085 && this.rand(seed + 3) > .18) {
    const outer = curve > 0;
    const family = outer ? this.prototypes.outer : this.prototypes.inner;
    const cornerYaw = baseYaw + (outer ? -Math.PI / 4 : Math.PI / 4) + (this.rand(seed + 5) - .5) * .06;
    this.placeStack(family, profile, x, z, cornerYaw, targetWidth * 1.18, seed + 10);
   } else if (this.rand(seed + 6) < .18) {
    this.placeFalloff(this.prototypes.falloff.center, profile, x, z, baseYaw, targetWidth, seed + 20);
   } else {
    const family = this.rand(seed + 10) < .48 ? this.prototypes.escarp : this.prototypes.cliff;
    this.placeStack(family, profile, x, z, baseYaw, targetWidth, seed + 30);
   }

   if (this.rand(seed + 50) > .24) {
    const rx = x - profile.nx * (1.5 + this.rand(seed + 51) * 2.6) + (this.rand(seed + 52) - .5) * 2.6 * profile.tx;
    const rz = z - profile.nz * (1.5 + this.rand(seed + 53) * 2.6) + (this.rand(seed + 54) - .5) * 2.6 * profile.tz;
    this.addNatural(this.prototypes.rocks, rx, this.world.heightAt(rx, rz) - .05, rz, this.rand(seed + 55) * Math.PI * 2, 1.0 + this.rand(seed + 56) * 1.65);
   }

   if (this.rand(seed + 60) > .48) {
    const bx = x + profile.nx * (.65 + this.rand(seed + 61) * 1.7) + (this.rand(seed + 62) - .5) * 2.4 * profile.tx;
    const bz = z + profile.nz * (.65 + this.rand(seed + 63) * 1.7) + (this.rand(seed + 64) - .5) * 2.4 * profile.tz;
    this.addNatural(this.prototypes.bushes, bx, this.world.heightAt(bx, bz), bz, this.rand(seed + 65) * Math.PI * 2, 1.35 + this.rand(seed + 66) * 1.45);
   }
  }
 }

 initialize() {
  this.scene.add(this.root);
  this.load().then(() => this.buildIntegratedCliff()).catch(err => console.error('[Terrain features load]', err));
 }
}
