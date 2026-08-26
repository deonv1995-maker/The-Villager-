import { RegionalIslandTerrain } from './RegionalIslandTerrain.js?v=541';

// Visual/geological refinement layer for the regional cliff system.
//
// RegionalIslandTerrain owns geography and formation composition. This layer
// only changes how the authored regional cliffs erode, round off and blend
// into their grassy shoulders. The primary tested cliff remains untouched.
export class NaturalCliffTerrain extends RegionalIslandTerrain {
 constructor(THREE){
  super(THREE);

  const tuning={
   westernHighlandCliff:{
    naturalShoulder:true,shoulderWidth:6.2,shoulderPhase:3.2,organicScale:.48,
    naturalBreaks:[
     {center:-12.1,width:2.8,strength:.72,open:true},
     {center:2.4,width:3.5,strength:.42,open:false},
     {center:11.1,width:2.5,strength:.66,open:true}
    ]
   },
   easternShelfCliff:{
    naturalShoulder:true,shoulderWidth:5.8,shoulderPhase:-4.6,organicScale:.44,
    naturalBreaks:[
     {center:-8.8,width:2.6,strength:.68,open:true},
     {center:0.7,width:3.1,strength:.38,open:false},
     {center:11.2,width:2.3,strength:.62,open:true}
    ]
   },
   northernRidgeCliff:{
    naturalShoulder:true,shoulderWidth:6.5,shoulderPhase:8.7,organicScale:.42,
    naturalBreaks:[
     {center:-14.2,width:2.5,strength:.64,open:true},
     {center:-1.8,width:3.3,strength:.44,open:false},
     {center:7.8,width:2.7,strength:.70,open:true},
     {center:14.3,width:2.2,strength:.54,open:false}
    ]
   }
  };

  for(const formation of this.cliffFormations){
   const patch=tuning[formation.id];
   if(patch)Object.assign(formation,patch);
  }
 }

 cliffBreakFactor(u){
  const f=this.cliffFormation;
  const breaks=f.naturalBreaks||[];
  if(!breaks.length)return 1;

  let factor=1;
  for(const br of breaks){
   const width=Math.max(.1,br.width||1);
   const d=Math.abs(u-br.center)/width;
   if(d>=1)continue;

   // Cosine erosion has zero slope at both ends. It makes a rounded saddle in
   // the cliff instead of collapsing a span to a pointed/needle-shaped end.
   const influence=.5+.5*Math.cos(Math.PI*d);
   factor*=1-Math.max(0,Math.min(.82,br.strength||0))*influence;
  }
  return Math.max(.30,Math.min(1,factor));
 }

 cliffBreakFactorFor(formation,u){
  return this.withCliffFormation(formation,()=>this.cliffBreakFactor(u));
 }

 roundedInheritedEdge(u){
  const step=.72;
  const weights=[1,2,3,2,1];
  let total=0;
  let weight=0;
  for(let i=-2;i<=2;i++){
   const w=weights[i+2];
   total+=super.cliffEdgeV(u+i*step)*w;
   weight+=w;
  }
  return total/weight;
 }

 roundedInheritedDrop(u){
  const step=.82;
  const weights=[1,2,3,2,1];
  let total=0;
  let weight=0;
  for(let i=-2;i<=2;i++){
   const w=weights[i+2];
   total+=super.cliffDropAt(u+i*step)*w;
   weight+=w;
  }
  return total/weight;
 }

 cliffDropAt(u){
  const f=this.cliffFormation;
  if(!f.naturalBreaks?.length)return super.cliffDropAt(u);

  // Smooth the inherited drop before adding large-scale variation. This keeps
  // the low-poly character without the sudden height spikes that read broken.
  const base=this.roundedInheritedDrop(u);
  const phase=f.shoulderPhase||0;
  const longWave=1
   +Math.sin((u+phase)*.082)*.040
   +Math.cos((u-phase*.42)*.137)*.028;
  return base*Math.max(.90,longWave)*this.cliffBreakFactor(u);
 }

 cliffEdgeV(u){
  const f=this.cliffFormation;
  if(!f.naturalShoulder)return super.cliffEdgeV(u);

  // Average the inherited edge first, then apply only broad bends. The rock
  // face can remain faceted while the landform silhouette stays rounded.
  const base=this.roundedInheritedEdge(u);
  const phase=f.shoulderPhase||0;
  const scale=f.organicScale??.45;
  const broad=Math.sin((u+phase)*.061)*.66+Math.cos((u-phase*.35)*.106)*.30;
  const bay=-.42*Math.exp(-Math.pow((u-phase*.18)/5.2,2));
  const nose=.30*Math.exp(-Math.pow((u+phase*.31)/4.8,2));
  return base+(broad+bay+nose)*scale;
 }

 naturalWallSpansFor(formation){
  // Do not physically cut extra holes into the wall for erosion breaks. The
  // height mask already lowers those areas smoothly; hard span cuts created
  // the triangular shards and sharp endpoint wedges visible in 0.5.43.
  return super.cliffWallSpansFor(formation);
 }

 cliffWallSpansFor(formation){
  return this.naturalWallSpansFor(formation);
 }

 appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments){
  const f=this.cliffFormation;
  if(!f.naturalShoulder){
   super.appendCliffTopCapSpan(positions,colors,indices,u0,u1,segments);
   return;
  }

  const rows=[];
  const fractions=[0,.055,.13,.24,.38,.55,.75,1];
  const phase=f.shoulderPhase||0;

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const width=(f.shoulderWidth||6.0)*(
    .94+Math.sin((u+phase)*.090)*.045+Math.cos((u-phase)*.058)*.030
   );
   const edgeV=this.cliffEdgeV(u);
   const lip=this.cliffLipPoint(u);
   const anchorOffset=Math.min(1.65,width*.30);
   const anchorWorld=this.cliffFormationWorld(u,edgeV+anchorOffset);
   const anchorY=this.heightAt(anchorWorld.x,anchorWorld.z);
   const sample=[];

   for(let r=0;r<fractions.length;r++){
    const frac=fractions[r];
    if(r===0){
     const y=lip.y+.018;
     sample.push({p:new this.T.Vector3(lip.x,y,lip.z),color:this.grassSurfaceColorAt(y)});
     continue;
    }

    // Smooth lateral drift replaces per-vertex random jitter. Adjacent rows now
    // curve together instead of producing isolated pointed triangles.
    const sampleU=u+Math.sin((u+phase)*.24+frac*1.35)*.075*frac;
    const localEdge=this.cliffEdgeV(sampleU);
    const offset=.015+(width-.015)*frac;
    const w=this.cliffFormationWorld(sampleU,localEdge+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(width*.14,width*.94,offset);
    const shoulderEase=blend*blend*(3-2*blend);
    const shoulderY=anchorY*(1-shoulderEase)+terrainY*shoulderEase;
    const micro=Math.sin((u+phase)*.37+r*.72)*.014*(1-shoulderEase);
    const y=shoulderY+micro+.016*(1-shoulderEase);
    sample.push({p:new this.T.Vector3(w.x,y,w.z),color:this.grassSurfaceColorAt(y)});
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<fractions.length-1;r++){
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

 appendCliffBaseApronSpan(positions,colors,indices,u0,u1,segments){
  const f=this.cliffFormation;
  if(!f.naturalShoulder){
   super.appendCliffBaseApronSpan(positions,colors,indices,u0,u1,segments);
   return;
  }

  const rows=[];
  const fractions=[0,.11,.25,.43,.63,.82,1];
  const phase=f.shoulderPhase||0;

  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const u=u0+(u1-u0)*t;
   const apronWidth=4.15*(.94+Math.cos((u+phase)*.105)*.045+Math.sin(u*.064)*.030);
   const edgeV=this.cliffEdgeV(u);
   const base=this.cliffBasePoint(u);
   const sample=[];

   for(let r=0;r<fractions.length;r++){
    const frac=fractions[r];
    if(r===0){
     const y=base.y+.008;
     sample.push({p:new this.T.Vector3(base.x,y,base.z),color:this.grassSurfaceColorAt(y)});
     continue;
    }

    const sampleU=u+Math.sin((u-phase)*.21+frac*1.15)*.085*frac;
    const localEdge=this.cliffEdgeV(sampleU);
    const offset=-.34-(apronWidth-.34)*frac;
    const w=this.cliffFormationWorld(sampleU,localEdge+offset);
    const terrainY=this.heightAt(w.x,w.z);
    const blend=this.smoothstep(.34,apronWidth*.96,Math.abs(offset));
    const apronEase=blend*blend*(3-2*blend);
    const y=base.y*(1-apronEase)+terrainY*apronEase
     +Math.cos((u+phase)*.33+r*.61)*.012*(1-apronEase);
    sample.push({p:new this.T.Vector3(w.x,y,w.z),color:this.grassSurfaceColorAt(y)});
   }
   rows.push(sample);
  }

  for(let i=0;i<segments;i++){
   for(let r=0;r<fractions.length-1;r++){
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

 buildCliffDetailGeometry(formation,index){
  return this.withCliffFormation(formation,()=>{
   const T=this.T;
   const positions=[];
   const colors=[];
   const indices=[];
   const spans=this.naturalWallSpansFor(formation);

   spans.forEach((span,spanIndex)=>{
    const length=Math.max(1,span[1]-span[0]);
    // More longitudinal samples round the silhouette while preserving the
    // broad low-poly faces vertically.
    const segments=Math.max(16,Math.round(length/.58));
    const seed=31000+index*11000+spanIndex*3700;
    this.appendCliffSpan(positions,colors,indices,span[0],span[1],segments,seed);
    this.appendCliffTopCapSpan(positions,colors,indices,span[0],span[1],segments);
    this.appendCliffBaseApronSpan(positions,colors,indices,span[0],span[1],segments);

    // The authoritative ground remains under the cliff. Only close the two
    // outer formation ends; avoiding closures at ramp-facing span ends removes
    // the large triangular shards while the ground naturally fills the ramp.
    const isFirst=spanIndex===0;
    const isLast=spanIndex===spans.length-1;
    if(isFirst)this.appendCliffEndClosure(positions,colors,indices,span[0],-1,seed+1500);
    if(isLast)this.appendCliffEndClosure(positions,colors,indices,span[1],1,seed+2100);
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
}
