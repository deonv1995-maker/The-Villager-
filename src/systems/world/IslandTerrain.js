export class IslandTerrain {
 constructor(THREE) {
  this.T = THREE;
  this.radius = 135;
  this.seaLevel = -2;
  this.seabedLevel = -5.2;

  // One formation definition remains the source of truth for terrain height,
  // rock geometry, grassy rim, ramp access, environment clearance and movement.
  this.cliffFormation = {
   cx: -20,
   cz: -18,
   yaw: .24,
   uMin: -19,
   uMax: 20,
   drop: 5.05,
   cliffSeam: .12,
   highDepth: 15,
   lowDepth: 10.5,
   rampCenter: 11.7,
   rampHalfWidth: 3.45,
   rampBlend: 1.5,
   rampHalfDepth: 5.8
  };
 }

 smoothstep(a,b,x) {
  if (a === b) return x >= b ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
 }

 hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
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
  const broad = Math.sin((u + 4.4) * .17) * 2.3;
  const secondary = Math.sin((u - 1.1) * .39) * .92;
  const detail = Math.cos((u + 7.6) * .61) * .34 + Math.sin(u * .83) * .20;
  const shoulderA = 1.55 * Math.exp(-Math.pow((u + 10.4) / 3.6, 2));
  const shoulderB = .85 * Math.exp(-Math.pow((u - 6.2) / 2.4, 2));
  const bite = -1.45 * Math.exp(-Math.pow((u - 2.9) / 2.7, 2));
  return -1.05 + broad + secondary + detail + shoulderA + shoulderB + bite + u * .018;
 }

 cliffEndFade(u) {
  const f = this.cliffFormation;
  return this.smoothstep(f.uMin - 1.6, f.uMin + 2.5, u)
   * (1 - this.smoothstep(f.uMax - 2.5, f.uMax + 1.6, u));
 }

 cliffDropAt(u) {
  const f = this.cliffFormation;
  const variation = .90
   + Math.sin((u + 3.5) * .19) * .10
   + Math.cos((u - 5.0) * .37) * .07
   + .16 * Math.exp(-Math.pow((u + 8.5) / 4.0, 2))
   - .12 * Math.exp(-Math.pow((u - 4.2) / 3.2, 2));
  return f.drop * Math.max(.62, variation) * this.cliffEndFade(u);
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
  const drop = this.cliffDropAt(u);
  const rise = drop * highFactor * weight;

  return {
   u,v,edgeV,signed,rampMask,transitionHalfWidth,weight,drop,rise,
   isCliffSeam: Math.abs(signed) < Math.max(.58,transitionHalfWidth*1.15) && rampMask < .35
  };
 }

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
  if (midU < f.uMin - .7 || midU > f.uMax + .7) return false;
  if (this.cliffRampMask(midU) > .32) return false;
  if (this.cliffDropAt(midU) < 1.15) return false;
  return true;
 }

 cliffWallSpans() {
  const f = this.cliffFormation;
  const gapStart = f.rampCenter - f.rampHalfWidth - f.rampBlend * .82;
  const gapEnd = f.rampCenter + f.rampHalfWidth + f.rampBlend * .82;
  return [[f.uMin - .6,gapStart],[gapEnd,f.uMax + .6]];
 }

 cliffWallActiveAtU(u) {
  return this.cliffWallSpans().some(([a,b])=>u>=a && u<=b);
 }

 rawHeightAt(x, z) {
  const d = this.islandMetric(x, z);
  if (d >= 1) return this.seabedLevel;
  const natural = this.regionalHeightAt(x, z);
  const formation = this.cliffFormationProfileAt(x,z);
  const interior = natural + formation.rise;
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

 grassSurfaceColorAt(y) {
  if(y>7.5)return new this.T.Color(0x8cc65b);
  if(y<1.1)return new this.T.Color(0x6da246);
  return new this.T.Color(0x7fb64e);
 }

 surfaceColorAt(x,y,z) {
  const T=this.T;
  const d=this.islandMetric(x,z);
  const s=this.slopeAt(x,z);
  const formation=this.cliffFormationProfileAt(x,z);
  if(d>=1)return new T.Color(0x64745e);
  if(d>.955)return new T.Color(0x786a4d);

  if(formation.weight>.15 && formation.isCliffSeam){
   if(formation.signed>=-.03)return this.grassSurfaceColorAt(y);
   return new T.Color(0x6d7773);
  }
  if(s>1.22 && !(formation.weight>.15 && formation.signed>0))return new T.Color(0x737d79);
  if(s>.88 && !(formation.weight>.15 && formation.signed>0))return new T.Color(0x71866b);
  return this.grassSurfaceColorAt(y);
 }

 cliffRockColor(seed,row) {
  const T=this.T;
  const roll=this.hash(seed);
  if(row===0 && roll>.90){
   const dirt=[0x766b55,0x6d6555,0x806f54];
   return new T.Color(dirt[Math.floor(this.hash(seed+3)*dirt.length)%dirt.length]);
  }
  const rocks=[0x5f6b68,0x697572,0x737e7a,0x7d8782,0x68736f,0x848d87];
  return new T.Color(rocks[Math.floor(this.hash(seed+7)*rocks.length)%rocks.length]);
 }

 appendTriangle(positions,colors,indices,a,b,c,colorA,colorB=colorA,colorC=colorA) {
  const base=positions.length/3;
  for(const p of [a,b,c])positions.push(p.x,p.y,p.z);
  for(const color of [colorA,colorB,colorC])colors.push(color.r,color.g,color.b);
  indices.push(base,base+1,base+2);
 }

 cliffLipPoint(u) {
  const edgeV=this.cliffEdgeV(u);
  const anchor=this.cliffFormationWorld(u,edgeV+1.05);
  const rim=this.cliffFormationWorld(u,edgeV+.015);
  const y=this.heightAt(anchor.x,anchor.z)-.018;
  return new this.T.Vector3(rim.x,y,rim.z);
 }

 cliffBasePoint(u) {
  const edgeV=this.cliffEdgeV(u);
  const groundSample=this.cliffFormationWorld(u,edgeV-1.8);
  const base=this.cliffFormationWorld(u,edgeV-.34);
  const y=this.heightAt(groundSample.x,groundSample.z)+.018;
  return new this.T.Vector3(base.x,y,base.z);
 }

 appendCliffSpan(positions,colors,indices,u0,u1,segments,seedOffset) {
  const T=this.T;
  const rows=[];

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const lip=this.cliffLipPoint(u);
   const base=this.cliffBasePoint(u);
   const drop=Math.max(.15,lip.y-base.y);
   const ledgeBias=this.hash(seedOffset+i*47)>.66 ? .48 : 0;
   const rowFractions=[0,.20,.45,.72,1];
   const sample=[];

   for(let r=0;r<rowFractions.length;r++){
    const seed=seedOffset+i*53+r*13;
    if(r===0){
     sample.push(new T.Vector3(lip.x,lip.y-.018,lip.z));
     continue;
    }
    if(r===4){
     sample.push(new T.Vector3(base.x,base.y+.012,base.z));
     continue;
    }

    const jitterU=(this.hash(seed)-.5)*.48;
    let outward;
    if(r===1)outward=-(.20+this.hash(seed+1)*.42+ledgeBias*.35);
    else if(r===2)outward=-(.08+this.hash(seed+2)*.48-ledgeBias*.22);
    else outward=-(.30+this.hash(seed+3)*.58+ledgeBias*.18);

    const pu=u+jitterU;
    const pv=this.cliffEdgeV(pu)+outward;
    const w=this.cliffFormationWorld(pu,pv);
    let y=lip.y-drop*rowFractions[r]+(this.hash(seed+5)-.5)*drop*.10;
    sample.push(new T.Vector3(w.x,y,w.z));
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<4;r++){
    const a=rows[i][r],b=rows[i+1][r],c=rows[i+1][r+1],d=rows[i][r+1];
    const c1=this.cliffRockColor(seedOffset+i*71+r*17,r);
    const c2=this.cliffRockColor(seedOffset+i*71+r*17+9,r);
    if((i+r)%2===0){
     this.appendTriangle(positions,colors,indices,a,b,c,c1,c2,c1);
     this.appendTriangle(positions,colors,indices,a,c,d,c2,c1,c2);
    }else{
     this.appendTriangle(positions,colors,indices,a,b,d,c1,c2,c2);
     this.appendTriangle(positions,colors,indices,b,c,d,c2,c1,c1);
    }
   }
  }
 }

 appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments) {
  const rows=[];
  const inwardOffsets=[.015,.45,1.0,1.8,2.8,4.1,5.8];

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const edgeV=this.cliffEdgeV(u);
   const lip=this.cliffLipPoint(u);
   const anchorWorld=this.cliffFormationWorld(u,edgeV+1.15);
   const anchorY=this.heightAt(anchorWorld.x,anchorWorld.z);
   const sample=[];

   for(let r=0;r<inwardOffsets.length;r++){
    const offset=inwardOffsets[r];
    const w=this.cliffFormationWorld(u,edgeV+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(.85,4.9,offset);
    const heldTop=anchorY*(1-blend)+terrainY*blend;
    const lift=.022*(1-this.smoothstep(.25,5.8,offset));
    const y=r===0 ? lip.y+.018 : heldTop+lift;
    sample.push({
     p:new this.T.Vector3(w.x,y,w.z),
     color:this.grassSurfaceColorAt(y)
    });
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<inwardOffsets.length-1;r++){
    const a=rows[i][r],b=rows[i+1][r],c=rows[i+1][r+1],d=rows[i][r+1];
    if((i+r)%2===0){
     this.appendTriangle(positions,colors,indices,a.p,c.p,b.p,a.color,c.color,b.color);
     this.appendTriangle(positions,colors,indices,a.p,d.p,c.p,a.color,d.color,c.color);
    }else{
     this.appendTriangle(positions,colors,indices,a.p,d.p,b.p,a.color,d.color,b.color);
     this.appendTriangle(positions,colors,indices,b.p,d.p,c.p,b.color,d.color,c.color);
    }
   }
  }
 }

 appendCliffBaseApronSpan(positions,colors,indices,u0,u1,segments) {
  const rows=[];
  const outwardOffsets=[-.34,-.72,-1.25,-2.0,-2.85,-3.7];

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const edgeV=this.cliffEdgeV(u);
   const base=this.cliffBasePoint(u);
   const sample=[];

   for(let r=0;r<outwardOffsets.length;r++){
    const offset=outwardOffsets[r];
    const w=this.cliffFormationWorld(u,edgeV+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(.34,3.35,Math.abs(offset));
    const y=r===0 ? base.y+.006 : base.y*(1-blend)+terrainY*blend+.006*(1-blend);
    sample.push({
     p:new this.T.Vector3(w.x,y,w.z),
     color:this.grassSurfaceColorAt(y)
    });
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<outwardOffsets.length-1;r++){
    const a=rows[i][r],b=rows[i+1][r],c=rows[i+1][r+1],d=rows[i][r+1];
    if((i+r)%2===0){
     this.appendTriangle(positions,colors,indices,a.p,b.p,c.p,a.color,b.color,c.color);
     this.appendTriangle(positions,colors,indices,a.p,c.p,d.p,a.color,c.color,d.color);
    }else{
     this.appendTriangle(positions,colors,indices,a.p,b.p,d.p,a.color,b.color,d.color);
     this.appendTriangle(positions,colors,indices,b.p,c.p,d.p,b.color,c.color,d.color);
    }
   }
  }
 }

 shouldCutGroundQuad(points) {
  let minSigned=Infinity;
  let maxSigned=-Infinity;
  let u=0;
  let weight=0;
  let ramp=0;
  let drop=0;

  for(const p of points){
   const profile=this.cliffFormationProfileAt(p.x,p.z);
   minSigned=Math.min(minSigned,profile.signed);
   maxSigned=Math.max(maxSigned,profile.signed);
   u+=profile.u;
   weight=Math.max(weight,profile.weight);
   ramp=Math.max(ramp,profile.rampMask);
   drop=Math.max(drop,profile.drop);
  }
  u/=points.length;

  if(!this.cliffWallActiveAtU(u) || weight<.10 || ramp>.48 || drop<1.0)return false;
  const crosses=minSigned<=0 && maxSigned>=0;
  const near=Math.min(Math.abs(minSigned),Math.abs(maxSigned))<1.35;
  return crosses || near;
 }

 buildUnifiedLandGeometry() {
  const T=this.T;
  const size=this.radius*2.42;
  const segments=240;
  const row=segments+1;
  const positions=[];
  const colors=[];
  const indices=[];

  for(let iz=0;iz<=segments;iz++){
   const z=-size*.5+size*(iz/segments);
   for(let ix=0;ix<=segments;ix++){
    const x=-size*.5+size*(ix/segments);
    const y=this.heightAt(x,z);
    const c=this.surfaceColorAt(x,y,z);
    positions.push(x,y,z);
    colors.push(c.r,c.g,c.b);
   }
  }

  const vertexPoint=index=>new T.Vector3(
   positions[index*3],
   positions[index*3+1],
   positions[index*3+2]
  );

  for(let iz=0;iz<segments;iz++){
   for(let ix=0;ix<segments;ix++){
    const a=iz*row+ix;
    const b=a+1;
    const c=(iz+1)*row+ix+1;
    const d=(iz+1)*row+ix;

    // Remove only the coarse height-field quads that cross the true cliff.
    // The stitched cap, rock wall and lower apron replace this narrow strip,
    // preventing green wedges from poking through the cliff or leaving holes.
    if(this.shouldCutGroundQuad([vertexPoint(a),vertexPoint(b),vertexPoint(c),vertexPoint(d)]))continue;

    if((ix+iz)%2===0)indices.push(a,c,b,a,d,c);
    else indices.push(a,d,b,b,d,c);
   }
  }

  this.cliffWallSpans().forEach((span,index)=>{
   const length=Math.max(1,span[1]-span[0]);
   const wallSegments=Math.max(16,Math.round(length/.72));
   this.appendCliffSpan(positions,colors,indices,span[0],span[1],wallSegments,1200+index*4000);
   this.appendCliffTopCapSpan(positions,colors,indices,span[0],span[1],wallSegments);
   this.appendCliffBaseApronSpan(positions,colors,indices,span[0],span[1],wallSegments);
  });

  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
 }

 create() {
  const T=this.T;
  const root=new T.Group();
  root.name='IslandWorld';

  const geo=this.buildUnifiedLandGeometry();
  const land=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,flatShading:true}));
  land.name='UnifiedProceduralIslandLand';
  land.receiveShadow=true;
  land.castShadow=false;
  root.add(land);

  const oceanGeo=new T.PlaneGeometry(700,700,1,1);
  oceanGeo.rotateX(-Math.PI/2);
  const ocean=new T.Mesh(oceanGeo,new T.MeshPhongMaterial({
   color:0x43b7d5,shininess:55,specular:0x9fe7ef,
   depthWrite:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  }));
  ocean.name='OceanSurface';
  ocean.position.y=this.seaLevel;
  root.add(ocean);
  return root;
 }
}
