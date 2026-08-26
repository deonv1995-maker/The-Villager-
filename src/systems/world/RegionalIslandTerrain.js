import { IslandTerrain as BaseIslandTerrain } from './IslandTerrain.js?v=536';

// Regional shaping layer.
//
// IslandTerrain remains the stable terrain/cliff implementation. This class
// composes several independent cliff formations through that same proven
// generator so the island can grow without duplicating terrain logic.
export class RegionalIslandTerrain extends BaseIslandTerrain {
 constructor(THREE){
  super(THREE);

  this.regionProfiles={
   westernHighland:{cx:-58,cz:35,yaw:.28,rx:38,rz:28,height:3.35},
   northernRidge:{cx:8,cz:55,yaw:-.18,rx:55,rz:12,height:2.15},
   easternShelf:{cx:54,cz:18,yaw:-.54,rx:34,rz:23,height:2.45},
   southernBasin:{cx:18,cz:-58,yaw:.20,rx:44,rz:30,height:-2.25},
   westernValley:{cx:-66,cz:-24,yaw:-.42,rx:38,rz:18,height:-1.55},
   centralSaddle:{cx:-2,cz:24,yaw:.12,rx:27,rz:18,height:-1.25}
  };

  // Preserve the original tested cliff exactly as the primary formation.
  this.primaryCliffFormation={...this.cliffFormation,id:'centralEscarpment'};
  this.cliffFormation=this.primaryCliffFormation;

  const base=this.primaryCliffFormation;
  this.cliffFormations=[
   this.primaryCliffFormation,
   {
    ...base,
    id:'westernHighlandCliff',
    cx:-63,cz:33,yaw:-.48,uMin:-17,uMax:16,drop:4.45,
    highDepth:14,lowDepth:10,rampCenter:-5.2,rampHalfWidth:3.1,
    rampBlend:1.35,rampHalfDepth:5.2,
    edgePhase:7.4,edgeScale:1.18,edgeOffset:.35,dropPhase:3.1
   },
   {
    ...base,
    id:'easternShelfCliff',
    cx:55,cz:16,yaw:.82,uMin:-14,uMax:15,drop:3.75,
    highDepth:12.5,lowDepth:9.2,rampCenter:5.6,rampHalfWidth:2.8,
    rampBlend:1.25,rampHalfDepth:4.8,
    edgePhase:-5.8,edgeScale:.86,edgeOffset:-.55,dropPhase:8.6
   },
   {
    ...base,
    id:'northernRidgeCliff',
    cx:6,cz:58,yaw:-.08,uMin:-18,uMax:17,drop:3.25,
    highDepth:11.5,lowDepth:8.8,rampCenter:-8.1,rampHalfWidth:2.65,
    rampBlend:1.2,rampHalfDepth:4.5,
    edgePhase:13.2,edgeScale:.72,edgeOffset:.7,dropPhase:-4.7
   }
  ];
 }

 rotatedEllipseDistance(x,z,profile){
  const dx=x-profile.cx;
  const dz=z-profile.cz;
  const c=Math.cos(profile.yaw||0);
  const s=Math.sin(profile.yaw||0);
  const u=(dx*c+dz*s)/profile.rx;
  const v=(-dx*s+dz*c)/profile.rz;
  return Math.hypot(u,v);
 }

 softRegionWeight(x,z,profile,inner=.62,outer=1.12){
  const d=this.rotatedEllipseDistance(x,z,profile);
  return 1-this.smoothstep(inner,outer,d);
 }

 softPlateau(x,z,profile){
  const weight=this.softRegionWeight(x,z,profile,.58,1.14);
  if(weight<=0)return 0;
  const detail=(Math.sin((x+profile.cx)*.045)+Math.cos((z-profile.cz)*.052))*.10;
  return (profile.height+detail*Math.sign(profile.height||1))*weight;
 }

 ridgeChain(x,z){
  let h=0;
  h+=this.rotatedGaussian(x,z,-18,62,-.22,42,9,1.35);
  h+=this.rotatedGaussian(x,z,18,55,-.08,36,8,1.05);
  h+=this.rotatedGaussian(x,z,46,47,.18,27,7,.72);
  return h;
 }

 knollField(x,z){
  let h=0;
  h+=this.gaussian(x,z,-84,6,18,15,1.45);
  h+=this.gaussian(x,z,77,42,17,14,1.25);
  h+=this.gaussian(x,z,72,-22,20,15,1.05);
  h+=this.gaussian(x,z,-38,-68,19,16,.95);
  return h;
 }

 getCliffFormations(){return this.cliffFormations;}

 withCliffFormation(formation,fn){
  const previous=this.cliffFormation;
  this.cliffFormation=formation;
  try{return fn();}
  finally{this.cliffFormation=previous;}
 }

 cliffEdgeV(u){
  const f=this.cliffFormation;
  const base=BaseIslandTerrain.prototype.cliffEdgeV.call(this,u);
  if(!Number.isFinite(f.edgePhase))return base;
  const phase=f.edgePhase;
  const scale=f.edgeScale??1;
  const offset=f.edgeOffset??0;
  return base
   +offset
   +Math.sin((u+phase)*.115)*1.15*scale
   +Math.cos((u-phase*.45)*.285)*.52*scale
   +Math.sin((u+phase*1.7)*.71)*.18*scale;
 }

 cliffDropAt(u){
  const f=this.cliffFormation;
  const base=BaseIslandTerrain.prototype.cliffDropAt.call(this,u);
  if(!Number.isFinite(f.dropPhase))return base;
  const variation=.94
   +Math.sin((u+f.dropPhase)*.23)*.08
   +Math.cos((u-f.dropPhase)*.41)*.05;
  return base*Math.max(.78,variation);
 }

 profileForFormation(formation,x,z){
  return this.withCliffFormation(formation,()=>{
   const profile=BaseIslandTerrain.prototype.cliffFormationProfileAt.call(this,x,z);
   return {...profile,formationId:formation.id,formation};
  });
 }

 cliffFormationProfileAt(x,z){
  let best=null;
  let bestScore=-Infinity;
  for(const formation of this.cliffFormations){
   const profile=this.profileForFormation(formation,x,z);
   const score=profile.weight*Math.max(.25,profile.drop)/(1+Math.abs(profile.signed)*.055);
   if(score>bestScore){bestScore=score;best=profile;}
  }
  return best||this.profileForFormation(this.primaryCliffFormation,x,z);
 }

 cliffProfilesAt(x,z){
  return this.cliffFormations.map(formation=>this.profileForFormation(formation,x,z));
 }

 regionalHeightAt(x,z){
  const base=super.regionalHeightAt(x,z);
  const p=this.regionProfiles;

  let sculpt=0;
  sculpt+=this.softPlateau(x,z,p.westernHighland);
  sculpt+=this.softPlateau(x,z,p.northernRidge);
  sculpt+=this.softPlateau(x,z,p.easternShelf);
  sculpt+=this.softPlateau(x,z,p.southernBasin);
  sculpt+=this.softPlateau(x,z,p.westernValley);
  sculpt+=this.softPlateau(x,z,p.centralSaddle);
  sculpt+=this.ridgeChain(x,z);
  sculpt+=this.knollField(x,z);

  const r=Math.hypot(x,z);
  const spawnProtection=this.smoothstep(20,34,r);

  // Regional shaping stays subdued immediately around any cliff generator so
  // the cliff lip and ramp remain the dominant local forms.
  const cliff=this.cliffFormationProfileAt(x,z);
  const cliffProtection=1-this.smoothstep(.15,.72,cliff.weight);
  const regionalBlend=Math.max(.22,cliffProtection);

  return base+sculpt*spawnProtection*regionalBlend;
 }

 rawHeightAt(x,z){
  const d=this.islandMetric(x,z);
  if(d>=1)return this.seabedLevel;

  const natural=this.regionalHeightAt(x,z);
  let cliffRise=0;
  for(const profile of this.cliffProfilesAt(x,z)){
   if(profile.weight>.001)cliffRise+=profile.rise;
  }
  return this.coastHeight(x,z,natural+cliffRise);
 }

 heightAt(x,z){return this.rawHeightAt(x,z);}

 terrainRegionAt(x,z){
  let best={name:'lowlands',weight:0};
  for(const [name,profile] of Object.entries(this.regionProfiles)){
   const weight=this.softRegionWeight(x,z,profile,.50,1.12);
   if(weight>best.weight)best={name,weight};
  }
  return best;
 }

 moduleFormationContains(x,z,margin=0){
  return this.cliffFormations.some(formation=>{
   const p=this.profileForFormation(formation,x,z);
   return p.u>formation.uMin-3-margin && p.u<formation.uMax+3+margin
    && p.signed>-formation.lowDepth-2-margin
    && p.signed<formation.highDepth+2+margin;
  });
 }

 moduleFormationBlocksSegment(fromX,fromZ,toX,toZ){
  return this.cliffFormations.some(formation=>this.withCliffFormation(
   formation,
   ()=>BaseIslandTerrain.prototype.moduleFormationBlocksSegment.call(this,fromX,fromZ,toX,toZ)
  ));
 }

 cliffWallSpansFor(formation){
  return this.withCliffFormation(formation,()=>BaseIslandTerrain.prototype.cliffWallSpans.call(this));
 }

 cliffEdgeVFor(formation,u){
  return this.withCliffFormation(formation,()=>this.cliffEdgeV(u));
 }

 cliffFormationWorldFor(formation,u,v){
  return this.withCliffFormation(formation,()=>BaseIslandTerrain.prototype.cliffFormationWorld.call(this,u,v));
 }

 buildCliffDetailGeometry(formation,index){
  return this.withCliffFormation(formation,()=>{
   const T=this.T;
   const positions=[];
   const colors=[];
   const indices=[];
   const spans=BaseIslandTerrain.prototype.cliffWallSpans.call(this);

   spans.forEach((span,spanIndex)=>{
    const length=Math.max(1,span[1]-span[0]);
    const segments=Math.max(14,Math.round(length/.72));
    const seed=24000+index*9000+spanIndex*3100;
    this.appendCliffSpan(positions,colors,indices,span[0],span[1],segments,seed);
    this.appendCliffTopCapSpan(positions,colors,indices,span[0],span[1],segments);
    this.appendCliffBaseApronSpan(positions,colors,indices,span[0],span[1],segments);
    this.appendCliffEndClosure(positions,colors,indices,span[0],-1,seed+1500);
    this.appendCliffEndClosure(positions,colors,indices,span[1],1,seed+2100);
   });

   const geo=new T.BufferGeometry();
   geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
   geo.setIndex(indices);
   geo.computeVertexNormals();
   geo.computeBoundingSphere();
   return geo;
  });
 }

 create(){
  // The inherited create() builds the authoritative island surface and the
  // original central cliff. Additional formations are detail meshes generated
  // by exactly the same cliff functions over the same shared height sampler.
  const root=super.create();
  const T=this.T;

  for(let i=1;i<this.cliffFormations.length;i++){
   const formation=this.cliffFormations[i];
   const geo=this.buildCliffDetailGeometry(formation,i);
   const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({
    vertexColors:true,roughness:.95,metalness:0,flatShading:true
   }));
   mesh.name=`RegionalCliff_${formation.id}`;
   mesh.receiveShadow=true;
   mesh.castShadow=false;
   root.add(mesh);
  }
  return root;
 }

 // Never remove the authoritative island ground beneath cliff detail meshes.
 // Overlap is intentional and guarantees watertight terrain at every seam.
 shouldCutGroundQuad(){return false;}
}
