export class IslandTerrain {
 constructor(THREE) {
  this.T = THREE;
  this.radius = 135;
  this.seaLevel = -2;
  this.seabedLevel = -5.2;
  this._moduleBaseHeight = null;
  this.moduleFormation = {
   cx: -20,
   cz: -18,
   yaw: .28,
   scale: 3.2,
   plateauWestUnits: -5.55,
   plateauEastUnits: 0,
   plateauSouthUnits: 0,
   plateauNorthUnits: 5.55,
   eastCliffNorthUnits: 5.55,
   southCliffWestUnits: -5.55,
   rampWestUnits: -3.55,
   rampEastUnits: -.45,
   rampLowUnits: -3.55,
   rampHighUnits: .55
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
  if (this._moduleBaseHeight != null) return this._moduleBaseHeight;
  const S = this.moduleFormation.scale;
  let highest = -Infinity;

  // Build the showcase on a flat apron that is guaranteed to sit above the
  // natural terrain beneath its entire footprint. This prevents a nearby
  // procedural hill from making the authored raised terrace read as a pit.
  for (let u = -6.5; u <= 1.5; u += 1) {
   for (let v = -4.5; v <= 6.5; v += 1) {
    const p = this.moduleFormationWorld(u * S, v * S);
    highest = Math.max(highest, this.regionalHeightAt(p.x, p.z));
   }
  }
  this._moduleBaseHeight = highest + .28;
  return this._moduleBaseHeight;
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
  const seam = .08 * S;

  // Verified from Cliff_Terrain_Side_Top.obj: the flat upper grass edge is
  // on local -X, while the rock face projects toward +X. Therefore the
  // outer-corner plateau belongs in the -U / +V quadrant, not +U / -V.
  const highWestOfEastEdge = 1 - this.smoothstep(-seam, seam, u);
  const highNorthOfSouthEdge = this.smoothstep(-seam, seam, v);
  const westLimit = this.smoothstep((f.plateauWestUnits - .10) * S, (f.plateauWestUnits + .10) * S, u);
  const northLimit = 1 - this.smoothstep((f.plateauNorthUnits - .10) * S, (f.plateauNorthUnits + .10) * S, v);
  const plateau = highWestOfEastEdge * highNorthOfSouthEdge * westLimit * northLimit;

  // Hilly_Terrain_Hill_Side_Gentle rises from source Z=-.5 to Z=3.5.
  // Unrotated, that is exactly the direction we need here: low at -V and
  // high at +V, opening a walkable route through the south cliff.
  const rampU = this.smoothstep((f.rampWestUnits - .10) * S, (f.rampWestUnits + .10) * S, u)
   * (1 - this.smoothstep((f.rampEastUnits - .10) * S, (f.rampEastUnits + .10) * S, u));
  const rampV = this.smoothstep((f.rampLowUnits - .10) * S, f.rampLowUnits * S, v)
   * (1 - this.smoothstep(f.rampHighUnits * S, (f.rampHighUnits + .10) * S, v));
  const rampLocalZ = v / S + 3.0;
  const ramp = rampU * rampV * this.gentleHillFactor(rampLocalZ);

  const raised = Math.max(plateau, ramp);

  // Broad lower apron around the authored modules. It fades back into the
  // procedural island outside the showcase, while the actual formation area
  // remains exactly at the kit's lower datum or one kit unit above it.
  const uWeight = this.smoothstep(-6.55 * S, -5.75 * S, u)
   * (1 - this.smoothstep(.75 * S, 1.55 * S, u));
  const vWeight = this.smoothstep(-4.55 * S, -3.75 * S, v)
   * (1 - this.smoothstep(5.75 * S, 6.55 * S, v));
  const weight = uWeight * vWeight;

  const baseHeight = this.moduleFormationBaseHeight();
  const upperHeight = baseHeight + S;
  const targetHeight = baseHeight + S * raised;

  const eastCliff = Math.abs(u) < .18 * S && v > .45 * S && v < f.eastCliffNorthUnits * S;
  const southCliffWest = Math.abs(v) < .18 * S && u > f.southCliffWestUnits * S && u < f.rampWestUnits * S;
  const southCliffCorner = Math.abs(v) < .18 * S && u > f.rampEastUnits * S && u < -.35 * S;
  const cliffSeam = eastCliff || southCliffWest || southCliffCorner;

  return {u,v,weight,raised,baseHeight,upperHeight,targetHeight,eastCliff,southCliffWest,southCliffCorner,cliffSeam};
 }

 moduleFormationContains(x, z, margin = 0) {
  const S = this.moduleFormation.scale;
  const { u, v } = this.moduleFormationLocal(x, z);
  return u > -6.6 * S - margin && u < 1.6 * S + margin && v > -4.6 * S - margin && v < 6.6 * S + margin;
 }

 moduleFormationBlocksSegment(fromX, fromZ, toX, toZ) {
  const f = this.moduleFormation;
  const S = f.scale;
  const a = this.moduleFormationLocal(fromX, fromZ);
  const b = this.moduleFormationLocal(toX, toZ);

  const crossedEast = (a.u <= 0 && b.u > 0) || (a.u >= 0 && b.u < 0);
  const eastMidV = (a.v + b.v) * .5;
  if (crossedEast && eastMidV > .45 * S && eastMidV < f.eastCliffNorthUnits * S) return true;

  const crossedSouth = (a.v <= 0 && b.v > 0) || (a.v >= 0 && b.v < 0);
  const southMidU = (a.u + b.u) * .5;
  const onWestCliff = southMidU > f.southCliffWestUnits * S && southMidU < f.rampWestUnits * S;
  const onCornerCliff = southMidU > f.rampEastUnits * S && southMidU < -.35 * S;
  if (crossedSouth && (onWestCliff || onCornerCliff)) return true;

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
   else if (formation.weight > .2 && formation.cliffSeam) c = stoneDark;
   else if (formation.weight > .2 && s > 1.28) c = stone;
   else if (s > 1.18) c = stoneDark;
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
